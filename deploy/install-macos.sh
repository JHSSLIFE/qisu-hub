#!/bin/bash
# macOS 上把 QISU HUB 装成常驻服务 + 每日备份（launchd）
# 用法： ./install-macos.sh            安装并启动
#        ./install-macos.sh uninstall  卸载
# 说明： launchd 的 KeepAlive 会在崩溃后自动拉起；机器休眠期间服务不对外，
#        作为长期入口不合适——长期入口请走 DEPLOY.md 里的云主机方案。

set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"   # <repo>/deploy
APP="$(cd "$HERE/.." && pwd)"           # <repo>
RUN="$(cd "$APP/.." && pwd)"            # 运行根
PY="$RUN/.venv/bin/python"
[ -x "$PY" ] || PY="$APP/.venv/bin/python"
DATA="$RUN/data"; [ -d "$DATA" ] || DATA="$APP/data"
AGENTS="$HOME/Library/LaunchAgents"
LOGS="$HOME/Library/Logs/qisu"

[ -x "$PY" ] || { echo "找不到虚拟环境：$PY（先执行 python3 -m venv .venv && .venv/bin/pip install -r app/requirements.lock）"; exit 1; }
[ -f "$APP/dist/index.html" ] || { echo "缺少构建产物 dist/index.html（先 cd app && npm ci && npm run build）"; exit 1; }
mkdir -p "$AGENTS" "$LOGS"

if [ "${1:-}" = "uninstall" ]; then
  launchctl bootout "gui/$UID/com.qisu.app" 2>/dev/null
  launchctl bootout "gui/$UID/com.qisu.backup" 2>/dev/null
  rm -f "$AGENTS/com.qisu.app.plist" "$AGENTS/com.qisu.backup.plist"
  echo "已卸载（数据与备份保留在 $RUN）"
  exit 0
fi

# 从 .env 读取环境变量并转成 plist 字段
ENVFILE="$RUN/.env"; [ -f "$ENVFILE" ] || ENVFILE="$APP/.env"
[ -f "$ENVFILE" ] || { echo "缺少 $ENVFILE（从 deploy/.env.example 复制一份）"; exit 1; }
ENV_XML="$(grep -E '^[A-Z_]+=' "$ENVFILE" | grep -v '^#' | python3 -c "
import sys,re
for line in sys.stdin:
    k,_,v=line.strip().partition('=')
    v=v.strip().strip('\"')
    print(f'        <key>{k}</key><string>{v}</string>')
")"

cat > "$AGENTS/com.qisu.app.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
    <key>Label</key><string>com.qisu.app</string>
    <key>ProgramArguments</key>
    <array><string>$PY</string><string>server.py</string></array>
    <key>WorkingDirectory</key><string>$APP</string>
    <key>EnvironmentVariables</key><dict>
$ENV_XML
    </dict>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>ThrottleInterval</key><integer>5</integer>
    <key>StandardOutPath</key><string>$LOGS/app.log</string>
    <key>StandardErrorPath</key><string>$LOGS/app.err.log</string>
</dict></plist>
PLIST

cat > "$AGENTS/com.qisu.backup.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
    <key>Label</key><string>com.qisu.backup</string>
    <key>ProgramArguments</key>
    <array><string>/bin/bash</string><string>$HERE/backup.sh</string></array>
    <key>EnvironmentVariables</key><dict>
        <key>QISUSHUO_DATA</key><string>$DATA</string>
        <key>QISU_BACKUP_DIR</key><string>$RUN/backups/daily</string>
    </dict>
    <key>StartCalendarInterval</key><dict>
        <key>Hour</key><integer>3</integer><key>Minute</key><integer>30</integer>
    </dict>
    <key>StandardOutPath</key><string>$LOGS/backup.log</string>
    <key>StandardErrorPath</key><string>$LOGS/backup.err.log</string>
</dict></plist>
PLIST

launchctl bootout "gui/$UID/com.qisu.app" 2>/dev/null
launchctl bootout "gui/$UID/com.qisu.backup" 2>/dev/null
launchctl bootstrap "gui/$UID" "$AGENTS/com.qisu.app.plist" || exit 1
launchctl bootstrap "gui/$UID" "$AGENTS/com.qisu.backup.plist" || exit 1

sleep 2
echo "已安装："
launchctl print "gui/$UID/com.qisu.app" 2>/dev/null | grep -E "state|pid" | head -2
echo "  健康检查：$(curl -s -m 5 "http://127.0.0.1:${PORT:-8080}/api/health" || echo '未就绪')"
echo "  日志：$LOGS/app.log"
echo "  卸载：$0 uninstall"
