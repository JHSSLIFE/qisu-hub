#!/usr/bin/env python3
"""Verify launch safety, build entries, PWA assets and distribution contents.

This check uses only the Python standard library and never binds an HTTP port.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
import re
import struct
import sys
import tempfile
from urllib.parse import urlsplit
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def require(condition, message: str):
    if not condition:
        raise ValueError(message)


def verify_launcher(launcher):
    with tempfile.TemporaryDirectory(prefix="qisu-hub-check-") as directory:
        root = Path(directory)
        dist = root / "dist"
        dist.mkdir()
        (dist / "icons").mkdir()
        (dist / "app.html").write_text("local", encoding="utf-8")
        (dist / "icons" / "test.png").write_bytes(b"test")
        (root / "private.txt").write_text("private", encoding="utf-8")
        require(launcher.resolve_resource(dist, "/") == dist / "app.html", "启动根路径未映射至本地 app.html")
        require(launcher.resolve_resource(dist, "/icons/test.png?v=1") == dist / "icons" / "test.png", "图标资源未正确解析")
        for path in ["/launch.py", "/.env", "/server.py", "/data/research.sqlite3", "/../private.txt", "/%2e%2e/private.txt", "/icons/../../private.txt", "/icons/%2e%2e/%2e%2e/private.txt", "/icons/test.png%00", "/icons\\test.png"]:
            require(launcher.resolve_resource(dist, path) is None, "启动器暴露了受限路径：" + path)
        try:
            (dist / "icons" / "link.txt").symlink_to(root / "private.txt")
        except (OSError, NotImplementedError):
            pass
        else:
            require(launcher.resolve_resource(dist, "/icons/link.txt") is None, "启动器未拦截符号链接")
        config = root / "config" / "launcher.json"
        require(launcher.load_port(config) is None, "缺失端口配置处理错误")
        launcher.save_port(config, 49152)
        require(launcher.load_port(config) == 49152, "启动端口未持久化")
        config.write_text('{"port": 70000}', encoding="utf-8")
        require(launcher.load_port(config) is None, "无效端口未拦截")
        config.write_text("invalid", encoding="utf-8")
        require(launcher.load_port(config) is None, "损坏配置未容错")
        for value in ('[]', 'null', '{"port": true}'):
            config.write_text(value, encoding="utf-8")
            require(launcher.load_port(config) is None, "非对象或布尔端口配置未容错")


def verify_dist(dist: Path):
    for name in ["index.html", "app.html", "manifest.webmanifest", "sw.js"]:
        require((dist / name).is_file(), "缺少发行资源：" + name)
    local = (dist / "app.html").read_text(encoding="utf-8")
    require(bool(re.search(r"__QISU_LOCAL__\s*=\s*true", local)), "app.html 未启用独立本地模式")
    require("manifest.webmanifest" in local and "QISU HUB" in local, "独立入口缺少安装声明或产品标识")
    manifest = json.loads((dist / "manifest.webmanifest").read_text(encoding="utf-8"))
    require(manifest.get("display") == "standalone", "PWA 未配置独立窗口模式")
    require(manifest.get("name") == "耆宿说数字工作台 QISU HUB", "PWA 名称与产品名称不一致")
    start = urlsplit(manifest.get("start_url", ""))
    require(not start.scheme and not start.netloc and start.path in {"app.html", "./app.html"}, "PWA 启动入口必须为相对的 app.html")
    require(manifest.get("scope") in {".", "./"}, "PWA scope 必须兼容仓库子路径")
    sizes = set()
    for icon in manifest.get("icons", []):
        parsed = urlsplit(icon["src"])
        require(not parsed.scheme and not parsed.netloc and not parsed.path.startswith("/"), "PWA 图标必须是相对路径")
        path = (dist / parsed.path).resolve()
        require(path.is_relative_to(dist.resolve()) and path.is_file(), "PWA 图标缺失或越界")
        content = path.read_bytes()
        require(content[:8] == b"\x89PNG\r\n\x1a\n" and len(content) >= 24, "PWA 图标不是有效 PNG")
        width, height = struct.unpack(">II", content[16:24])
        require(icon.get("sizes") == f"{width}x{height}", "图标实际尺寸与 manifest 声明不一致")
        sizes.add((width, height))
    require({(192, 192), (512, 512)} <= sizes, "PWA 需要 192 和 512 像素图标")
    require("__BUILD__" not in (dist / "sw.js").read_text(encoding="utf-8"), "Service Worker 构建版本未替换")


def verify_archives(builder, dist: Path):
    source = builder.collect_source()
    require("THIRD_PARTY_LICENSES.txt" in source, "源码包缺少构建所需授权文本")
    for name in source:
        require(not any(part in builder.EXCLUDE_PARTS for part in Path(name).parts), "源码包混入资料或依赖：" + name)
        require(not any(part.startswith(".env") for part in Path(name).parts), "源码包混入环境变量文件")
    for platform in [*builder.LAUNCHERS, "portable"]:
        files = builder.collect_portable(dist, platform, "test")
        require(files["dist/index.html"] == files["dist/app.html"], "便携版根入口未使用本地模式")
        require("launch.py" in files and "docs/INSTALL.md" in files, "便携包缺少启动或安装说明")
    with tempfile.TemporaryDirectory(prefix="qisu-hub-archive-") as directory:
        path = Path(directory) / "archive.zip"
        builder.write_archive(path, "qisu-hub-test", {"test.cmd": b"line1\nline2\n", "run.command": b"#!/bin/sh\n"}, "test", "2026-01-01T00:00:00Z")
        with zipfile.ZipFile(path) as archive:
            manifest = json.loads(archive.read("qisu-hub-test/RELEASE-MANIFEST.json"))
            for name, details in manifest["files"].items():
                content = archive.read("qisu-hub-test/" + name)
                require(len(content) == details["bytes"] and builder.sha256(content) == details["sha256"], "发行 manifest 校验失败")
            require(b"\r\n" in archive.read("qisu-hub-test/test.cmd"), "Windows 换行未标准化")
            require(archive.getinfo("qisu-hub-test/run.command").external_attr >> 16 & 0o111, "macOS 启动文件未标记为可执行")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dist", type=Path, default=ROOT / "dist")
    args = parser.parse_args()
    launcher = module("qisu_launcher", ROOT / "launch.py")
    builder = module("qisu_builder", ROOT / "scripts" / "build_release.py")
    verify_launcher(launcher)
    verify_dist(args.dist)
    verify_archives(builder, args.dist)
    print("QISU HUB 封装验证通过：启动器边界、端口保存、本地入口、PWA 资源、三平台归档及逐文件校验。")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, KeyError) as error:
        print("QISU HUB 封装验证失败：" + str(error), file=sys.stderr)
        raise SystemExit(1)
