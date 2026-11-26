#!/bin/bash
# QISU HUB 上线自检（8 项）
# 用法：
#   BASE_URL=https://qisu.example.com QISU_USER=xx QISU_PASS=xx ./smoke.sh
# 只读校验为主，唯一一次写操作是提交空导入（不改数据）。

set -uo pipefail
BASE="${BASE_URL:-http://127.0.0.1:8080}"
USER_="${QISU_USER:-}"
PASS_="${QISU_PASS:-}"
JAR="$(mktemp)"; trap 'rm -f "$JAR"' EXIT
PASS=0; FAIL=0

ok()   { printf '  \033[32m✓\033[0m %-42s %s\n' "$1" "$2"; PASS=$((PASS+1)); }
bad()  { printf '  \033[31m✗\033[0m %-42s %s\n' "$1" "$2"; FAIL=$((FAIL+1)); }

code() { curl -sk -o /dev/null -w '%{http_code}' -m 10 "$@"; }

echo "目标：$BASE"

# 1 健康检查（注意：必须用 GET，/ 对 HEAD 返回 405）
[ "$(code "$BASE/api/health")" = "200" ] && ok "服务存活 /api/health" "200" || bad "服务存活 /api/health" "非 200"

# 2 未登录门禁
[ "$(code "$BASE/api/bootstrap")" = "401" ] && ok "未登录被拦截" "401" || bad "未登录被拦截" "未返回 401"

# 3 登录页可达
[ "$(code "$BASE/")" = "200" ] && ok "首页可访问" "200" || bad "首页可访问" "非 200"

# 4 HTTPS 安全头（仅 https 目标）
if [[ "$BASE" == https://* ]]; then
  H="$(curl -skI -m 10 "$BASE/api/health" | tr -d '\r')"
  echo "$H" | grep -qi "strict-transport-security" && ok "HSTS 已开启" "有" || bad "HSTS 已开启" "缺失"
  echo "$H" | grep -qi "^x-content-type-options: nosniff" && ok "nosniff 已开启" "有" || bad "nosniff 已开启" "缺失"
  echo "$H" | grep -qi "^server: caddy" && bad "Server 头已隐藏" "暴露 Caddy" || ok "Server 头已隐藏" "未暴露"
fi

# 5 登录与 Cookie 属性
if [ -n "$USER_" ] && [ -n "$PASS_" ]; then
  RESP="$(curl -sk -c "$JAR" -m 15 -D - -o /tmp/smoke_login.json -X POST "$BASE/api/auth/password" \
    -H 'Content-Type: application/json' -H 'X-Qisushuo: workspace' -H "Origin: $BASE" \
    -d "{\"username\":\"$USER_\",\"password\":\"$PASS_\"}" | tr -d '\r')"
  if grep -q "qisushuo_session" <<<"$RESP"; then
    ok "成员登录成功" "$(python3 -c "import json;d=json.load(open('/tmp/smoke_login.json'));print(d.get('role'),d.get('workspace','')[:8])" 2>/dev/null)"
    if [[ "$BASE" == https://* ]]; then
      grep -qi "Secure" <<<"$(grep -i '^set-cookie' <<<"$RESP")" && ok "会话 Cookie 带 Secure" "有" || bad "会话 Cookie 带 Secure" "缺失"
    fi
    grep -qi "HttpOnly" <<<"$(grep -i '^set-cookie' <<<"$RESP")" && ok "会话 Cookie 带 HttpOnly" "有" || bad "会话 Cookie 带 HttpOnly" "缺失"
  else
    bad "成员登录成功" "无 Set-Cookie"
  fi

  # 6 写操作同源校验通过（Host 未被反代改写）
  C="$(curl -sk -b "$JAR" -m 15 -o /dev/null -w '%{http_code}' -X POST "$BASE/api/imports" \
    -H 'Content-Type: application/json' -H 'X-Qisushuo: workspace' -H "Origin: $BASE" -d '{"records":[]}')"
  [ "$C" = "200" ] && ok "反代保留 Host（写操作可用）" "200" || bad "反代保留 Host（写操作可用）" "$C"

  # 7 跨站写被拒
  C="$(curl -sk -b "$JAR" -m 15 -o /dev/null -w '%{http_code}' -X POST "$BASE/api/imports" \
    -H 'Content-Type: application/json' -H 'X-Qisushuo: workspace' -H 'Origin: https://evil.example.com' -d '{"records":[]}')"
  [ "$C" = "403" ] && ok "跨站写入被拒" "403" || bad "跨站写入被拒" "$C"
else
  echo "  － 跳过登录类检查（未提供 QISU_USER / QISU_PASS）"
fi

# 8 备份新鲜度（本机目录，远端跳过）
RUN="$(cd "$(dirname "$0")/../.." && pwd)"; REPO="$(cd "$(dirname "$0")/.." && pwd)"
BDIR="$RUN/backups/daily"; [ -d "$BDIR" ] || BDIR="$REPO/backups/daily"
B="$(ls -1t "$BDIR"/qisu-*.tar.gz 2>/dev/null | head -1)"
if [ -n "$B" ]; then
  AGE=$(( ( $(date +%s) - $(stat -f%m "$B" 2>/dev/null || stat -c%Y "$B") ) / 3600 ))
  [ "$AGE" -le 30 ] && ok "最近备份在 30 小时内" "${AGE}h 前" || bad "最近备份在 30 小时内" "${AGE}h 前"
else
  echo "  － 跳过备份检查（本机无备份目录）"
fi

echo
echo "通过 $PASS 项，失败 $FAIL 项"
[ "$FAIL" -eq 0 ] || exit 1
