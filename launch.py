#!/usr/bin/env python3
"""Start the standalone QISU HUB package using only Python's standard library.

This launcher serves the compiled application, never the repository or user data.
No API server, npm installation, or external model is needed for local mode.
"""
from __future__ import annotations

import argparse
import json
import mimetypes
import os
from pathlib import Path
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit
import webbrowser


PRODUCT = "耆宿说数字工作台 QISU HUB"
ROOT = Path(__file__).resolve().parent
# These are distribution resources, not an arbitrary static directory listing.
RESOURCE_SUFFIXES = {".html", ".webmanifest", ".json", ".js", ".css", ".png", ".svg", ".ico", ".webp", ".woff", ".woff2", ".txt"}
RESOURCE_NAMES = {"app.html", "index.html", "preview.html", "manifest.webmanifest", "manifest.json", "sw.js", "service-worker.js", "favicon.ico", "offline.html", "robots.txt"}


def state_path() -> Path:
    if sys.platform == "win32":
        base = Path(os.environ.get("LOCALAPPDATA", str(Path.home() / "AppData" / "Local")))
    elif sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support"
    else:
        base = Path(os.environ.get("XDG_STATE_HOME", str(Path.home() / ".local" / "state")))
    return base / "qisu-hub" / "launcher.json"


def load_port(path: Path) -> int | None:
    try:
        config = json.loads(path.read_text(encoding="utf-8"))
        port = config.get("port") if isinstance(config, dict) else None
        return port if type(port) is int and 1 <= port <= 65535 else None
    except (OSError, ValueError, TypeError):
        return None


def save_port(path: Path, port: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps({"port": port}, indent=2), encoding="utf-8")
    temp.replace(path)


def resolve_resource(directory: Path, request_path: str) -> Path | None:
    """Allow only expected distribution resources; deny traversal and symlinks."""
    decoded = unquote(urlsplit(request_path).path)
    if "\x00" in decoded or "\\" in decoded:
        return None
    relative = decoded.lstrip("/") or "app.html"
    parts = Path(relative).parts
    if any(part in {".", ".."} or part.startswith(".") for part in parts):
        return None
    allowed = relative in RESOURCE_NAMES or (parts and parts[0] in {"assets", "icons"} and Path(relative).suffix.lower() in RESOURCE_SUFFIXES)
    if not allowed:
        return None
    file = directory / relative
    try:
        resolved = file.resolve(strict=True)
        if not resolved.is_relative_to(directory.resolve()) or not resolved.is_file():
            return None
        current = file
        while current != directory:
            if current.is_symlink():
                return None
            current = current.parent
        return resolved
    except (OSError, RuntimeError, ValueError):
        return None


def make_handler(directory: Path):
    class AppHandler(BaseHTTPRequestHandler):
        server_version = "QISUHUB"

        def send_resource(self, head: bool = False):
            file = resolve_resource(directory, self.path)
            if file is None:
                self.send_error(404, "Resource not available")
                return
            content = file.read_bytes()
            content_type = {".webmanifest": "application/manifest+json", ".js": "text/javascript", ".svg": "image/svg+xml"}.get(file.suffix, mimetypes.guess_type(file.name)[0] or "application/octet-stream")
            self.send_response(200)
            self.send_header("Content-Type", content_type + ("; charset=utf-8" if content_type.startswith("text/") or content_type in {"application/json", "application/manifest+json"} else ""))
            self.send_header("Content-Length", str(len(content)))
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "same-origin")
            self.send_header("Cache-Control", "no-cache")
            if file.name in {"sw.js", "service-worker.js"}:
                self.send_header("Service-Worker-Allowed", "/")
            self.end_headers()
            if not head:
                self.wfile.write(content)

        def do_GET(self):
            self.send_resource()

        def do_HEAD(self):
            self.send_resource(head=True)

        def log_message(self, fmt, *args):
            # Request paths may contain user-supplied queries; do not log them.
            return

    return AppHandler


def main(argv: list[str] | None = None) -> int:
    if sys.version_info < (3, 10):
        print("请安装 Python 3.10 或更新版本后重新启动。", file=sys.stderr)
        return 2
    parser = argparse.ArgumentParser(description=PRODUCT + " · 本地独立版")
    parser.add_argument("--port", type=int, help="端口，优先于环境变量 PORT；0 表示重新分配")
    parser.add_argument("--host", default="0.0.0.0", help="监听地址，默认 0.0.0.0")
    parser.add_argument("--no-browser", action="store_true", help="启动后不自动打开浏览器")
    parser.add_argument("--check", action="store_true", help="检查内嵌发行资源后退出，不启动服务")
    parser.add_argument("--dist", type=Path, default=ROOT / "dist", help="发行文件目录，默认 dist")
    args = parser.parse_args(argv)
    directory = args.dist.resolve()
    if not (directory / "app.html").is_file():
        print("缺少 dist/app.html。请使用完整的 QISU HUB portable 包，或先运行 npm ci 和 npm run build。", file=sys.stderr)
        return 2
    if args.check:
        required=("app.html", "manifest.webmanifest", "sw.js", "icons/icon-192.png", "icons/icon-512.png")
        if not all(resolve_resource(directory, "/" + name) for name in required):
            print("发行资源不完整，请重新下载完整安装包。", file=sys.stderr)
            return 2
        if b"window.__QISU_LOCAL__=true" not in (directory / "app.html").read_bytes():
            print("本机资料入口不正确，请重新构建或下载发行包。", file=sys.stderr)
            return 2
        print(PRODUCT + " · 内嵌资源检查通过")
        return 0
    config = state_path()
    requested = args.port
    if requested is None and os.environ.get("PORT"):
        try:
            requested = int(os.environ["PORT"])
        except ValueError:
            print("PORT 必须为 0–65535 的数字。", file=sys.stderr)
            return 2
    cached = load_port(config)
    port = requested if requested is not None else cached or 0
    if not 0 <= port <= 65535:
        print("端口必须为 0–65535 的数字。", file=sys.stderr)
        return 2
    try:
        server = ThreadingHTTPServer((args.host, port), make_handler(directory))
    except OSError:
        print("启动失败：监听地址不可用或原端口已被其他程序占用。", file=sys.stderr)
        print("请关闭此前的 QISU HUB 窗口后重试。--port 0 可分配新端口，但它是新的浏览器存储空间，旧资料需从备份导入。", file=sys.stderr)
        return 1
    actual_port = server.server_address[1]
    try:
        # A stable origin keeps IndexedDB and the installed app connected to their data.
        save_port(config, actual_port)
    except OSError:
        print("提示：无法记录端口。请下次使用 --port " + str(actual_port) + " 保持原资料空间。")
    url = "http://127.0.0.1:" + str(actual_port) + "/app.html"
    print(PRODUCT)
    print("已启动：" + url)
    print("资料保存在当前浏览器；请使用空间设置中的导出备份。")
    print("保持本窗口开启，按 Ctrl+C 停止。手机安装请使用已部署的 HTTPS 地址。")
    if not args.no_browser:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever(poll_interval=0.25)
    except KeyboardInterrupt:
        print("\nQISU HUB 已停止。")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
