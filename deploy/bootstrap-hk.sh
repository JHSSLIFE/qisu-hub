#!/usr/bin/env bash
# QISU HUB 一键部署（Ubuntu 22.04 / 24.04，香港或内地均可）
#
# 用法（在服务器上执行）：
#   curl -fsSL https://raw.githubusercontent.com/JHSSLIFE/qisu-hub/product-v3.3/deploy/bootstrap-hk.sh | sudo bash
# 或先下载再跑（推荐，便于看清内容）：
#   curl -fsSLO https://raw.githubusercontent.com/JHSSLIFE/qisu-hub/product-v3.3/deploy/bootstrap-hk.sh
#   sudo bash bootstrap-hk.sh
#
# 可覆盖的变量：
#   QISU_DOMAIN=xxx.com  QISU_BRANCH=product-v3.3  QISU_ADMIN_USER=jiahao
#
# 装什么：Python(venv) · Caddy · systemd 服务 · 每日备份 · ufw
# 前端用仓库内 prebuilt/ 产物（服务器不构建，避免跨平台二进制问题）
set -euo pipefail

SCRIPT_VER="2026-11-26-4"
DOMAIN="${QISU_DOMAIN:-qisushuo.com}"
REPO="${QISU_REPO:-https://github.com/JHSSLIFE/qisu-hub.git}"
BRANCH="${QISU_BRANCH:-product-v3.3}"
ADMIN_USER="${QISU_ADMIN_USER:-jiahao}"
NODE_VER="${QISU_NODE_VER:-v22.11.0}"

APP=/opt/qisu/app
DATA=/opt/qisu/data
ENVF=/opt/qisu/.env
VENV=/opt/qisu/.venv
LOG_DIR=/var/log/qisu
BK_DIR=/var/backups/qisu

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m!! %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" = "0" ] || die "请用 root 运行：sudo bash $0"

log "1/9 系统依赖（脚本版本 ${SCRIPT_VER}）"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl ca-certificates xz-utils python3 python3-venv python3-pip sqlite3 ufw >/dev/null
echo "  完成"

log "2/9 运行用户与目录"
if ! id qisu >/dev/null 2>&1; then
  useradd --system --create-home --home-dir /opt/qisu --shell /usr/sbin/nologin qisu
fi
mkdir -p "$DATA" "$BK_DIR" "$LOG_DIR" /var/lib/caddy /etc/caddy
chown -R qisu:qisu /opt/qisu "$DATA" "$BK_DIR" "$LOG_DIR"
echo "  用户 qisu · 数据 $DATA · 备份 $BK_DIR"

log "3/9 运行时"
echo "  python $(python3 -V 2>&1 | cut -d' ' -f2) / sqlite $(sqlite3 --version | cut -d' ' -f1)"

log "4/9 拉取代码（$BRANCH）"
git config --global --add safe.directory "$APP" 2>/dev/null || true
if [ -d "$APP/.git" ]; then
  sudo -u qisu git -C "$APP" fetch -q origin
  sudo -u qisu git -C "$APP" checkout -q "$BRANCH"
  sudo -u qisu git -C "$APP" reset -q --hard "origin/$BRANCH"
  echo "  已更新到 $(sudo -u qisu git -C "$APP" rev-parse --short HEAD)"
else
  git clone -q --branch "$BRANCH" --single-branch "$REPO" "$APP" || die "克隆失败（仓库是否公开？网络是否可达 GitHub？）"
  chown -R qisu:qisu "$APP"
  echo "  已克隆 $(sudo -u qisu git -C "$APP" rev-parse --short HEAD)"
fi

log "5/9 前端产物"
cd "$APP"
if [ -f prebuilt/index.html ]; then
  # 服务器不构建：lock 来自 macOS，缺 Linux 原生二进制，现场 build 必失败
  rm -rf dist && mkdir -p dist && cp -a prebuilt/. dist/ && rm -f dist/README.md
  echo "  使用预构建产物：index.html $(du -h dist/index.html | cut -f1) · app.html $(du -h dist/app.html | cut -f1)"
else
  echo "  未找到 prebuilt/，尝试现场构建（需要 Node 18+）"
  if ! command -v node >/dev/null 2>&1; then
    case "$(uname -m)" in
      x86_64) NARCH=x64 ;;
      aarch64|arm64) NARCH=arm64 ;;
      *) die "不支持的架构：$(uname -m)" ;;
    esac
    curl -fsSL "https://nodejs.org/dist/${NODE_VER}/node-${NODE_VER}-linux-${NARCH}.tar.xz" -o /tmp/node.tar.xz \
      || die "下载 Node 失败"
    tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1
    rm -f /tmp/node.tar.xz
  fi
  rm -rf node_modules
  sudo -u qisu npm install --include=dev --no-audit --no-fund >/tmp/qisu-npm.log 2>&1 || { tail -30 /tmp/qisu-npm.log; die "npm install 失败"; }
  sudo -u qisu npm run build >/tmp/qisu-build.log 2>&1 || { tail -30 /tmp/qisu-build.log; die "构建失败"; }
fi
[ -f dist/index.html ] || die "缺少 dist/index.html"
[ "$(stat -c%s dist/index.html)" -gt 50000 ] || die "dist/index.html 过小，产物不完整"
chown -R qisu:qisu "$APP/dist"

log "6/9 Python 环境"
[ -d "$VENV" ] || python3 -m venv "$VENV"
"$VENV/bin/pip" install -q --upgrade pip
"$VENV/bin/pip" install -q -r requirements.lock || die "Python 依赖安装失败"
chown -R qisu:qisu "$VENV"
"$VENV/bin/python" -c "import fastapi,sqlalchemy,uvicorn;print('  依赖就绪 fastapi',fastapi.__version__)"

log "7/9 环境变量"
if [ ! -f "$ENVF" ]; then
  PASS="$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 16)"
  cat > "$ENVF" <<EOF
PORT=8080
QISUSHUO_DATA=$DATA
QISUSHUO_REQUIRE_LOGIN=1
QISUSHUO_ADMIN_USER=$ADMIN_USER
QISUSHUO_ADMIN_PASSWORD=$PASS
QISUSHUO_SECURE_COOKIE=1
EOF
  chmod 600 "$ENVF"; chown qisu:qisu "$ENVF"
  ADMIN_PASS="$PASS"
  echo "  已生成管理员账号：$ADMIN_USER / $PASS"
else
  ADMIN_PASS="$(grep '^QISUSHUO_ADMIN_PASSWORD=' "$ENVF" | cut -d= -f2-)"
  echo "  沿用已有 $ENVF（管理员 $ADMIN_USER）"
fi

log "8/9 应用与备份服务"
install -m 644 deploy/qisu.service /etc/systemd/system/qisu.service
install -m 644 deploy/qisu-backup.service /etc/systemd/system/qisu-backup.service
install -m 644 deploy/qisu-backup.timer /etc/systemd/system/qisu-backup.timer
chmod +x deploy/backup.sh
systemctl daemon-reload
systemctl enable --now qisu >/dev/null 2>&1
for i in $(seq 1 15); do
  curl -fsS -m 3 http://127.0.0.1:8080/api/health >/dev/null 2>&1 && break
  sleep 1
done
if curl -fsS -m 3 http://127.0.0.1:8080/api/health >/dev/null 2>&1; then
  echo "  应用已启动：$(curl -s -m 3 http://127.0.0.1:8080/api/health)"
else
  systemctl status qisu --no-pager -l | tail -15
  die "应用未能启动，见上面的日志"
fi
systemctl enable --now qisu-backup.timer >/dev/null 2>&1
systemctl start qisu-backup.service >/dev/null 2>&1 || true
echo "  备份：$(ls -1 "$BK_DIR"/qisu-*.tar.gz 2>/dev/null | wc -l | tr -d ' ') 份，定时 03:30"

log "9/9 Caddy 与证书"
if ! command -v caddy >/dev/null 2>&1; then
  case "$(uname -m)" in
    x86_64) CARCH=amd64 ;;
    aarch64|arm64) CARCH=arm64 ;;
    *) die "不支持的架构" ;;
  esac
  curl -fsSL "https://caddyserver.com/api/download?os=linux&arch=${CARCH}" -o /usr/local/bin/caddy \
    || die "下载 Caddy 失败"
  chmod +x /usr/local/bin/caddy
fi
install -m 644 deploy/Caddyfile /etc/caddy/Caddyfile
cat > /etc/systemd/system/caddy.service <<UNIT
[Unit]
Description=Caddy (QISU HUB)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
Environment=QISU_DOMAIN=${DOMAIN}
Environment=QISU_LOG=/var/log/caddy/qisu-access.log
ExecStart=/usr/local/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
Restart=always
RestartSec=3
LimitNOFILE=1048576

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now caddy >/dev/null 2>&1
sleep 6
systemctl is-active caddy >/dev/null || { journalctl -u caddy -n 30 --no-pager; die "Caddy 未启动"; }

if ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null 2>&1; ufw allow 443/tcp >/dev/null 2>&1
  echo "  ufw 已放行 80/443"
else
  echo "  ufw 未启用 —— 腾讯云轻量需在控制台「防火墙」放行 80、443"
fi

printf '\n\033[1;32m======== 部署完成 ========\033[0m\n'
printf '  V3.3 界面 : https://%s/v3/\n' "$DOMAIN"
printf '  旧版界面 : https://%s/\n' "$DOMAIN"
printf '  管理员    : %s / %s\n' "$ADMIN_USER" "$ADMIN_PASS"
printf '  数据      : %s/research.sqlite3\n' "$DATA"
printf '  备份      : %s（每日 03:30，保留 30 份）\n' "$BK_DIR"
printf '  日志      : %s/app.log · journalctl -u qisu\n' "$LOG_DIR"
printf '\n首次访问若证书未就绪，等 30 秒再试。\n'
