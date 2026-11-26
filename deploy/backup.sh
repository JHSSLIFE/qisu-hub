#!/bin/bash
# QISU HUB 每日备份
# 用法：
#   ./backup.sh                 # 备份到 ../backups/daily
#   ./backup.sh --verify FILE   # 校验某个备份能否恢复
# 设计要点：
#   1. 用 sqlite3 .backup 取一致性快照（不直接 cp 正在写的库）
#   2. 快照立即做 integrity_check，坏档不入库
#   3. 只保留最近 KEEP 份，防止磁盘被撑满

set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"   # <repo>/deploy
REPO="$(cd "$HERE/.." && pwd)"          # <repo>
RUN="$(cd "$REPO/.." && pwd)"           # 运行根（含 data/ backups/ .venv/），可能是 <repo> 本身

DATA_DIR="${QISUSHUO_DATA:-}"
if [ -z "$DATA_DIR" ]; then
  if [ -f "$RUN/data/research.sqlite3" ]; then DATA_DIR="$RUN/data"; else DATA_DIR="$REPO/data"; fi
fi
if [ -d "$RUN/backups" ] || [ ! -d "$REPO/backups" ]; then
  DEST="${QISU_BACKUP_DIR:-$RUN/backups/daily}"
else
  DEST="${QISU_BACKUP_DIR:-$REPO/backups/daily}"
fi
KEEP="${QISU_BACKUP_KEEP:-30}"
DB="$DATA_DIR/research.sqlite3"
STAMP="$(date '+%Y%m%d-%H%M%S')"
LOG="$DEST/backup.log"

log() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOG"; }
fail() { log "FAIL  $*"; exit 1; }

verify_file() {
  local f="$1" tmp
  [ -f "$f" ] || { echo "文件不存在：$f"; return 1; }
  tmp="$(mktemp -d)"
  tar -xzf "$f" -C "$tmp" 2>/dev/null || { echo "解包失败"; rm -rf "$tmp"; return 1; }
  local db="$tmp/research.sqlite3"
  [ -f "$db" ] || db="$(find "$tmp" -name 'research.sqlite3' | head -1)"
  [ -n "$db" ] && [ -f "$db" ] || { echo "包内没有数据库"; rm -rf "$tmp"; return 1; }
  local integrity records spaces users
  integrity="$(sqlite3 "$db" 'pragma integrity_check;' 2>&1 | head -1)"
  records="$(sqlite3 "$db" 'select count(*) from records;' 2>&1)"
  spaces="$(sqlite3 "$db" 'select count(*) from workspaces;' 2>&1)"
  users="$(sqlite3 "$db" 'select count(*) from users;' 2>&1)"
  rm -rf "$tmp"
  echo "integrity=$integrity  records=$records  spaces=$spaces  users=$users"
  [ "$integrity" = "ok" ]
}

if [ "${1:-}" = "--verify" ]; then
  verify_file "${2:-}" || exit 1
  exit 0
fi

mkdir -p "$DEST"
[ -f "$DB" ] || fail "找不到数据库：$DB"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# 一致性快照；busy 时最多等 10 秒
sqlite3 "$DB" ".timeout 10000" ".backup '$TMP/research.sqlite3'" || fail "sqlite3 .backup 失败"

INTEGRITY="$(sqlite3 "$TMP/research.sqlite3" 'pragma integrity_check;' 2>&1 | head -1)"
[ "$INTEGRITY" = "ok" ] || fail "快照完整性校验不通过：$INTEGRITY"

RECORDS="$(sqlite3 "$TMP/research.sqlite3" 'select count(*) from records;')"
USERS="$(sqlite3 "$TMP/research.sqlite3" 'select count(*) from users;')"
BYTES="$(stat -f%z "$TMP/research.sqlite3" 2>/dev/null || stat -c%s "$TMP/research.sqlite3")"

printf 'source=%s\nstamp=%s\nrecords=%s\nusers=%s\nintegrity=%s\n' \
  "$DB" "$STAMP" "$RECORDS" "$USERS" "$INTEGRITY" > "$TMP/manifest.txt"

OUT="$DEST/qisu-$STAMP.tar.gz"
tar -czf "$OUT" -C "$TMP" research.sqlite3 manifest.txt || fail "打包失败"
chmod 600 "$OUT"

SHA="$(shasum -a 256 "$OUT" | awk '{print $1}')"
printf '%s  %s\n' "$SHA" "$(basename "$OUT")" >> "$DEST/SHA256SUMS"

log "OK  $(basename "$OUT")  ${BYTES}B  records=$RECORDS  users=$USERS  sha256=${SHA:0:16}…"

# 轮转：仅保留最近 KEEP 份
COUNT="$(ls -1 "$DEST"/qisu-*.tar.gz 2>/dev/null | wc -l | tr -d ' ')"
if [ "$COUNT" -gt "$KEEP" ]; then
  ls -1t "$DEST"/qisu-*.tar.gz | tail -n +$((KEEP + 1)) | while read -r old; do
    rm -f "$old" && log "DEL $(basename "$old")（超出保留 ${KEEP} 份）"
  done
fi

log "DONE 目录 $DEST 当前 $(ls -1 "$DEST"/qisu-*.tar.gz 2>/dev/null | wc -l | tr -d ' ') 份"
