#!/usr/bin/env python3
"""Build clean OS-specific portable and source ZIPs using the standard library.

Portable archives always use the local-first app for both HTML entry points.
No Git history, installed dependencies, credentials, or user data are copied.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import stat
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
EXCLUDE_PARTS = {".git", ".venv", "node_modules", "data", "dist", "__pycache__", ".pytest_cache", "test-results", "deliveries", "inbox", "outbox", ".local", "release"}
SOURCE_FILES = {
    "index.html", "vite.config.ts", "tsconfig.json", "package.json", "package-lock.json",
    "server.py", "seed.json", "seed_data.py", "requirements.txt", "requirements.lock",
    "start.sh", "app.toml", ".gitignore", ".gitattributes", ".dockerignore", "Dockerfile",
    "docker-compose.yml", "launch.py", "THIRD_PARTY_LICENSES.txt",
    "QISU-HUB-Windows.cmd", "QISU-HUB-macOS.command", "QISU-HUB-Linux.sh",
}
SOURCE_DIRECTORIES = {"src", "public", "scripts", "docs", "design-system", "tests", ".github"}
LAUNCHERS = {
    "windows": "QISU-HUB-Windows.cmd",
    "macos": "QISU-HUB-macOS.command",
    "linux": "QISU-HUB-Linux.sh",
}
PORTABLE_ROOT_FILES = {"launch.py", "THIRD_PARTY.md", "THIRD_PARTY_LICENSES.txt"}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def source_file(path: Path) -> bool:
    relative = path.relative_to(ROOT)
    return (
        not any(part in EXCLUDE_PARTS or part.startswith(".env") for part in relative.parts)
        and not path.is_symlink()
        and path.is_file()
        and (
            relative.parts[0] in SOURCE_DIRECTORIES
            or str(relative) in SOURCE_FILES
            or len(relative.parts) == 1 and path.suffix == ".md"
        )
        and path.suffix not in {".pyc", ".sqlite3", ".pem", ".key", ".p12", ".pfx", ".zip"}
    )


def collect_source() -> dict[str, bytes]:
    files = {}
    for directory, names, filenames in os.walk(ROOT, followlinks=False):
        names[:] = sorted(name for name in names if name not in EXCLUDE_PARTS and not name.startswith(".env") and not (Path(directory) / name).is_symlink())
        for name in sorted(filenames):
            path = Path(directory) / name
            if source_file(path):
                files[path.relative_to(ROOT).as_posix()] = path.read_bytes()
    required = {"package.json", "package-lock.json", "THIRD_PARTY_LICENSES.txt", "vite.config.ts", "src/main.tsx", "launch.py"}
    missing = required - files.keys()
    if missing:
        raise ValueError("源码包缺少必要文件：" + ", ".join(sorted(missing)))
    return files


def quick_start(platform: str, version: str) -> bytes:
    launcher = LAUNCHERS.get(platform, "适合当前电脑的 QISU-HUB 启动文件")
    return f"""# 耆宿说数字工作台 QISU HUB {version}

这是可独立运行的本地资料工作台，不需要仝人平台、Node.js 或付费 AI 密钥。

1. 先安装 Python 3.10 或更新版本：https://www.python.org/downloads/
   Windows 安装时勾选 Add Python to PATH。macOS 请安装 python.org 的 Python。
2. 完整解压本 ZIP，保留 dist、launch.py 和启动文件在同一目录。
3. 打开 `{launcher}`；浏览器会自动打开工作台。保持启动窗口开启。
   Linux 也可在此目录运行 `python3 launch.py`。
4. 首次进入可从知识库、三维读建筑或使用指南开始。资料保存在浏览器中。
5. 在空间设置中导出完整备份，迁移电脑或浏览器时再恢复。

启动器只使用 Python 标准库；完整包首次启动无需联网安装依赖。
若系统不允许直接打开启动文件，可在终端进入本目录后运行 `python3 launch.py`
（Windows 使用 `py -3 launch.py`）。双击 dist/app.html 也可尝试单文件体验，
但浏览器对 file:// 本地存储和安装支持不同，建议始终使用启动器。

## 手机与安装

手机可使用部署后的 HTTPS 地址，并通过 Safari 的“添加到主屏幕”或 Android
浏览器的“安装应用”安装；桌面 Chrome / Edge 也可安装。首次完整打开后可离线
使用缓存的本地工作台。仅把电脑的 HTTP 局域网地址发给手机，不满足安装要求。
本包不包含 Android APK、iOS IPA 或 Windows / macOS 原生安装器。

## 资料位置与升级

本地资料保存在当前浏览器的 IndexedDB，并与浏览器、协议、主机和端口绑定。
启动器会记录首次分配的端口，后续打开或升级继续使用原端口。请使用同一浏览器，
不要清除网站数据。移动发行目录不会删除资料，备份仍应自行保存在安全位置。
端口被占用时启动器会停止并提示；优先关闭旧的 QISU HUB 启动窗口后重试。
`python3 launch.py --port 0` 可分配新端口，但它会打开新的资料空间，需要导入备份。
电脑与手机各有独立资料空间，当前版本不提供自动云同步。

## 功能说明

支持资料增改、Obsidian Markdown 导入、引用溯源、三维知识图谱、创作、项目任务、
备份与恢复。内置专家与知识为虚拟示例。未配置模型时知识助理使用本地检索与摘录，
不会把资料发送给外部模型。关闭启动窗口可停止服务。

完整安装与 Docker 部署说明见 docs/INSTALL.md。文件校验值见 RELEASE-MANIFEST.json。
""".encode("utf-8")


def collect_portable(dist: Path, platform: str, version: str) -> dict[str, bytes]:
    if not (dist / "app.html").is_file():
        raise ValueError("缺少 dist/app.html，请先运行 npm ci 和 npm run build。")
    files = {}
    names = PORTABLE_ROOT_FILES | ({LAUNCHERS[platform]} if platform in LAUNCHERS else set(LAUNCHERS.values()))
    for name in sorted(names):
        file = ROOT / name
        if not file.is_file() or file.is_symlink():
            raise ValueError("缺少发行文件：" + name)
        files[name] = file.read_bytes()
    for directory, directories, filenames in os.walk(dist, followlinks=False):
        directories[:] = sorted(name for name in directories if not name.startswith(".") and not (Path(directory) / name).is_symlink())
        for name in sorted(filenames):
            file = Path(directory) / name
            if not file.is_symlink() and (not name.startswith(".") or name == ".nojekyll"):
                files["dist/" + file.relative_to(dist).as_posix()] = file.read_bytes()
    # A static host must never serve the API-backed HTML as its default entry.
    files["dist/index.html"] = files["dist/app.html"]
    install = ROOT / "docs" / "INSTALL.md"
    if not install.is_file():
        raise ValueError("缺少 docs/INSTALL.md 安装说明。")
    files["docs/INSTALL.md"] = install.read_bytes()
    files["README.md"] = quick_start(platform, version)
    return files


def write_archive(path: Path, prefix: str, files: dict[str, bytes], version: str, generated_at: str) -> dict:
    # Hash the exact bytes shipped, including Windows line ending normalization.
    files = {name: content.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n") if name.endswith(".cmd") else content for name, content in files.items()}
    manifest = {
        "product": "耆宿说数字工作台 QISU HUB",
        "version": version,
        "generated_at": generated_at,
        "files": {name: {"bytes": len(content), "sha256": sha256(content)} for name, content in sorted(files.items())},
    }
    files = {**files, "RELEASE-MANIFEST.json": json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8")}
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, content in sorted(files.items()):
            info = zipfile.ZipInfo(prefix + "/" + name)
            info.date_time = (2026, 1, 1, 0, 0, 0)
            info.create_system = 3
            mode = 0o755 if name.endswith((".sh", ".command")) else 0o644
            info.external_attr = (stat.S_IFREG | mode) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, content)
    with zipfile.ZipFile(path) as archive:
        if archive.testzip() is not None:
            raise ValueError("归档校验失败：" + path.name)
    return {"file": path.name, "bytes": path.stat().st_size, "sha256": sha256(path.read_bytes()), "files": len(files)}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build QISU HUB standalone release archives")
    parser.add_argument("--output", "--out", dest="output", type=Path, default=ROOT.parents[1] / "deliveries" / "qisu-hub")
    parser.add_argument("--dist", type=Path, default=ROOT / "dist")
    parser.add_argument("--version", default=json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"])
    args = parser.parse_args(argv)
    version = args.version.removeprefix("v")
    if not version or any(c not in "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-_" for c in version):
        parser.error("版本号只允许字母、数字、点、短横线、下划线")
    args.output.mkdir(parents=True, exist_ok=True)
    generated_at = datetime.now(timezone.utc).isoformat()
    source = collect_source()
    archives = []
    for platform in [*LAUNCHERS, "portable"]:
        files = collect_portable(args.dist.resolve(), platform, version)
        archives.append(write_archive(args.output / f"qisu-hub-{version}-{platform}.zip", f"qisu-hub-{version}", files, version, generated_at))
    archives.append(write_archive(args.output / f"qisu-hub-{version}-source.zip", f"qisu-hub-{version}-source", source, version, generated_at))
    result = {"product": "耆宿说数字工作台 QISU HUB", "version": version, "archives": archives}
    (args.output / "SHA256SUMS.txt").write_text("".join(item["sha256"] + "  " + item["file"] + "\n" for item in archives), encoding="utf-8")
    (args.output / "release.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, OSError) as error:
        print("打包失败：" + str(error), file=sys.stderr)
        raise SystemExit(1)
