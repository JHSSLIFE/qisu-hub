#!/usr/bin/env python3
"""Package the local launcher plus Python runtime on its native build OS.

Requires an existing local-first Vite build and PyInstaller 6.22.3. The resulting
ZIP needs no Python, Node, project dependencies, API key, or platform account.
"""
from __future__ import annotations

import argparse
import hashlib
from importlib import metadata
import json
import os
from pathlib import Path
import platform
import shutil
import stat
import subprocess
import sys
import tempfile
from urllib.request import urlopen
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PYINSTALLER_VERSION = "6.22.3"


def runtime_notices() -> dict[str, bytes]:
    """Carry the bundler exception and exact CPython runtime license."""
    notices: dict[str, bytes] = {}
    distribution = metadata.distribution("pyinstaller")
    for relative in distribution.files or []:
        if relative.name.lower().startswith(("copying", "license")):
            file = distribution.locate_file(relative)
            if file.is_file():
                notices["licenses/PyInstaller-" + relative.name] = file.read_bytes()
    if not notices:
        raise RuntimeError("PyInstaller license was not found in the installed distribution")
    for name in ("LICENSE.txt", "LICENSE"):
        file = Path(sys.base_prefix) / name
        if file.is_file():
            notices["licenses/Python-LICENSE.txt"] = file.read_bytes()
            break
    if "licenses/Python-LICENSE.txt" not in notices:
        # setup-python layouts differ by OS. Use the precise upstream release.
        version = ".".join(map(str, sys.version_info[:3]))
        url = f"https://raw.githubusercontent.com/python/cpython/v{version}/LICENSE"
        with urlopen(url, timeout=30) as response:
            notices["licenses/Python-LICENSE.txt"] = response.read()
    return notices


def zip_entry(archive: zipfile.ZipFile, name: str, content: bytes, executable: bool = False):
    info = zipfile.ZipInfo(name)
    info.compress_type = zipfile.ZIP_DEFLATED
    info.create_system = 3
    info.external_attr = ((stat.S_IFREG | (0o755 if executable else 0o644)) << 16)
    archive.writestr(info, content)


def build(output: Path) -> Path:
    if metadata.version("pyinstaller") != PYINSTALLER_VERSION:
        raise RuntimeError(f"Install PyInstaller=={PYINSTALLER_VERSION} before building")
    assets = ROOT / "dist"
    required = ("app.html", "manifest.webmanifest", "sw.js", "icons/icon-192.png", "icons/icon-512.png")
    for name in required:
        if not (assets / name).is_file():
            raise RuntimeError(f"Missing dist/{name}; run npm ci and npm run build first")
    if b"window.__QISU_LOCAL__=true" not in (assets / "app.html").read_bytes():
        raise RuntimeError("dist/app.html must use the local IndexedDB workspace")
    version = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
    os_name = {"win32": "Windows", "darwin": "macOS", "linux": "Linux"}.get(sys.platform)
    if os_name is None:
        raise RuntimeError("Native packages support Windows, macOS, and Linux")
    arch = {"amd64": "x64", "x86_64": "x64", "aarch64": "arm64"}.get(platform.machine().lower(), platform.machine().lower())
    executable_name = "QISU-HUB.exe" if sys.platform == "win32" else "QISU-HUB"
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="qisu-native-") as temporary:
        temp = Path(temporary)
        # The source build's index is the online API-backed entry. A standalone
        # package must stay local even when its user opens the directory root.
        site = temp / "site"
        shutil.copytree(assets, site)
        shutil.copyfile(site / "app.html", site / "index.html")
        hook = temp / "runtime_encoding.py"
        hook.write_text("import sys\nfor stream in (sys.stdout, sys.stderr):\n    if stream and hasattr(stream, 'reconfigure'):\n        stream.reconfigure(encoding='utf-8', errors='replace')\n", encoding="utf-8")
        command = [sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean", "--onefile",
                   "--name", "QISU-HUB", "--distpath", str(temp / "bin"),
                   "--workpath", str(temp / "work"), "--specpath", str(temp),
                   "--runtime-hook", str(hook), "--add-data", str(site) + os.pathsep + "dist",
                   str(ROOT / "launch.py")]
        subprocess.run(command, cwd=ROOT, check=True)
        executable = temp / "bin" / executable_name
        # Inspect actual bundled bytes; --help alone would not find missing assets.
        from PyInstaller.archive.readers import CArchiveReader
        bundle = CArchiveReader(str(executable))
        for name in (*required, "index.html"):
            key = "dist/" + name
            actual = next((entry for entry in bundle.toc if entry.replace("\\", "/") == key), None)
            if actual is None or bundle.extract(actual) != (site / name).read_bytes():
                raise RuntimeError("Bundled static asset is absent or differs: " + key)
        if (site / "index.html").read_bytes() != (site / "app.html").read_bytes():
            raise RuntimeError("Standalone root entry must equal the local app entry")
        for name in required:
            if (site / name).read_bytes() != (assets / name).read_bytes():
                raise RuntimeError("Standalone asset was unexpectedly changed: " + name)
        help_result = subprocess.run([str(executable), "--help"], capture_output=True, timeout=60)
        if help_result.returncode != 0 or b"--no-browser" not in help_result.stdout:
            raise RuntimeError("Frozen launcher --help smoke failed: " + help_result.stderr.decode("utf-8", "replace"))
        check_result = subprocess.run([str(executable), "--check"], capture_output=True, timeout=60)
        if check_result.returncode != 0:
            raise RuntimeError("Frozen launcher embedded resource smoke failed: " + check_result.stderr.decode("utf-8", "replace"))
        archive_path = output / f"QISU-HUB-{version}-{os_name}-{arch}-standalone.zip"
        prefix = archive_path.stem + "/"
        with zipfile.ZipFile(archive_path, "w") as archive:
            zip_entry(archive, prefix + executable_name, executable.read_bytes(), executable=True)
            for file in ("THIRD_PARTY.md", "THIRD_PARTY_LICENSES.txt", "docs/DESKTOP_NATIVE.md"):
                path = ROOT / file
                zip_entry(archive, prefix + path.name, path.read_bytes())
            for name, content in runtime_notices().items():
                zip_entry(archive, prefix + name, content)
            manifest = {"product": "耆宿说数字工作台 QISU HUB", "version": version,
                        "os": os_name, "architecture": arch, "python": platform.python_version(),
                        "pyinstaller": PYINSTALLER_VERSION, "embedded_assets": [*required, "index.html"],
                        "checks": ["embedded static asset byte comparison", "frozen launcher --help", "frozen launcher --check"],
                        "signed": False}
            zip_entry(archive, prefix + "BUILD-MANIFEST.json", json.dumps(manifest, ensure_ascii=False, indent=2).encode())
        checksum = hashlib.sha256(archive_path.read_bytes()).hexdigest()
        archive_path.with_suffix(archive_path.suffix + ".sha256").write_text(checksum + "  " + archive_path.name + "\n", encoding="utf-8")
    print(str(archive_path))
    return archive_path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "release" / "native")
    args = parser.parse_args()
    build(args.output.resolve())


if __name__ == "__main__":
    main()
