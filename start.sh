#!/bin/sh
set -eu
cd "$(dirname "$0")"
if ! .venv/bin/python -c 'import fastapi, uvicorn, sqlalchemy, httpx' >/dev/null 2>&1; then
  python3 -m venv .venv
  .venv/bin/pip install -r requirements.lock
fi
if [ ! -f dist/index.html ]; then
  npm ci --include=dev
  npm run build
fi
exec .venv/bin/python server.py
