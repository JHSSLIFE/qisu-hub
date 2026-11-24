# 耆宿说数字工作台 QISU HUB · 安装与部署

QISU HUB 提供独立本地版、可安装的 Web 应用和可自行部署的服务版。电脑与手机使用同一套界面，手机有独立底部导航。内置资料为虚拟示例。

## 电脑：无需预装 Python 的启动器

下载 Release 中标记 `standalone` 的系统对应 ZIP。Windows 运行 `QISU-HUB.exe`，Mac / Linux 运行 `QISU-HUB`，会自动打开本机工作台。内含运行时，不需要先安装 Python，详细系统要求及签名说明见 [桌面独立包](DESKTOP_NATIVE.md)。

## 电脑：轻量 Python 便携包

从 GitHub Release 下载对应系统的 `windows.zip`、`macos.zip` 或 `linux.zip`。`portable.zip` 同时包含三套启动文件。完整解压，不要在 ZIP 预览中直接运行。

本地版需要 Python 3.10 或更新版本。它仅使用 Python 标准库，使用完整便携包时无需安装 Node.js、数据库或 Python 第三方包，首次运行也无需下载依赖。

| 系统 | 启动方式 |
| --- | --- |
| Windows 10 / 11 | 安装 Python 时勾选 Add Python to PATH，双击 `QISU-HUB-Windows.cmd` |
| macOS | 安装 python.org 提供的 Python，打开 `QISU-HUB-macOS.command` |
| Linux | 在发行目录运行 `sh QISU-HUB-Linux.sh` 或 `python3 launch.py` |

启动器自动打开浏览器的 `/app.html` 本地入口，请收藏或安装这个入口。首次运行会选择可用端口并记住它；保持终端窗口开启，关闭窗口或按 Ctrl+C 即可停止。服务监听所有网卡，默认只向用户打开本机页面，且只提供发行资源，不提供源码、资料数据库或目录列表。

macOS 若提示不能打开，可先检查文件来源，再右键启动文件选择“打开”。也可在终端进入解压目录运行：

```sh
python3 launch.py
```

Windows 可在解压目录的终端运行：

```powershell
py -3 launch.py
```

端口被占用时，启动器会停止并提示，不会自动换到看似丢失资料的新空间。优先关闭之前的 QISU HUB 启动窗口后重试。如确实需要更换端口，先从旧空间导出备份，再运行 `python3 launch.py --port 0`，并在新空间恢复备份。启动脚本会转发命令行参数。

启动器端口配置保存在：

| 系统 | 配置文件 |
| --- | --- |
| Windows | `%LOCALAPPDATA%\qisu-hub\launcher.json` |
| macOS | `~/Library/Application Support/qisu-hub/launcher.json` |
| Linux | `$XDG_STATE_HOME/qisu-hub/launcher.json`；未设置时为 `~/.local/state/qisu-hub/launcher.json` |

这个文件只记录端口，不含资料内容。

## 手机及桌面安装

手机直接打开 **[耆宿说数字工作台 QISU HUB](https://jhsslife.github.io/qisu-hub/app.html)**。自行部署时使用 HTTPS 地址的 `app.html`。首次进入后等待工作台完整加载，再安装：

- iPhone / iPad：Safari → 分享 → 添加到主屏幕 → 添加。
- Android：Chrome / Edge 的菜单 → 安装应用或添加到主屏幕。
- Windows / macOS：Chrome / Edge 地址栏安装图标，或菜单中的安装应用。

浏览器若未提供自动安装按钮，使用上述菜单操作即可。PWA 是可安装的 Web 应用，上述 Python 便携包不包含 Android APK、iOS IPA 或原生桌面安装器。若 Release 提供无需 Python 的桌面程序，使用方法见 [原生桌面发行说明](DESKTOP_NATIVE.md)。浏览器安装入口及措辞会因系统版本而略有不同。

手机访问电脑的普通 HTTP 局域网地址可以浏览，但通常不能注册离线缓存或安装 PWA；手机安装需要正式 HTTPS 部署。电脑的 `localhost` / `127.0.0.1` 是浏览器允许的本机例外。

首次完整加载 `app.html` 后，其本地工作台和必要图标会进入离线缓存。安装后的应用以本地工作台启动，可以离线查看、编辑、检索、导入和备份已有资料。服务端 AI 模型在本地模式中不会调用。发布新版本后，请关闭所有应用窗口，再重新打开以应用更新。

## 资料保存、升级与迁移

本地版的资料、稿件和历史版本保存在浏览器 IndexedDB。数据与浏览器、协议、域名和端口绑定，换浏览器、无痕模式、清除网站数据或更换端口会形成不同空间。PWA 并不会自动给不同设备同步资料。

迁移或升级前，请在“空间设置 → 导出完整备份”保存 JSON。升级便携包时保留启动器端口配置，使用相同浏览器再次打开；恢复时在“空间设置 → 从备份恢复”选择该 JSON。备份可能包含研究资料，请自行保存在受信任的位置。在线服务版和本地版也通过完整备份迁移，不会静默混合两个空间。

单独双击 `dist/app.html` 可以尝试自包含页面；不同浏览器对 `file://` 的存储行为不一致，也不能完成 PWA 安装，建议使用启动器。

## 服务版：Docker Compose

已安装 Docker 和 Compose 后，在源码目录执行：

```sh
docker compose up --build -d
```

默认通过 `http://localhost:8080` 使用在线服务版。端口冲突时可在运行前设置环境变量 `QISU_HTTP_PORT`，例如 macOS / Linux 使用：

```sh
QISU_HTTP_PORT=8081 docker compose up --build -d
```

容器使用非 root 用户，应用文件系统只读，SQLite 数据保存于命名卷 `qisu-hub-data`。在线服务端读取 `PORT` 并监听 `0.0.0.0`，开发者可在自己的部署环境设置端口。

```sh
docker compose logs --tail=100
docker compose down
```

`docker compose down` 保留资料卷；`docker compose down -v` 会删除资料卷，操作前必须先导出备份。在线空间以当前浏览器的会话识别用户，当前版本未提供团队账号、找回或多设备同步。公开多人服务部署前，需要按产品路线补齐身份认证与权限管理。

手机安装时，在自己的域名上通过 HTTPS 反向代理该服务，并使用 `/app.html` 本地工作台入口。完整 API 服务、在线空间和可安装的本地空间是独立的资料存储方式；切换时请通过备份迁移。

## 开发者：从源码构建

推荐 Node.js 24、Python 3.12。前端和 Python 依赖均锁定版本：

```sh
npm ci --include=dev
npm run check
npm run build
python3 -m venv .venv
```

macOS / Linux 后端依赖与检查：

```sh
.venv/bin/python -m pip install -r requirements.lock
.venv/bin/python -m pytest -q
python3 scripts/verify_package.py
python3 launch.py
```

Windows 对应 Python 路径为 `.venv\Scripts\python.exe`。完整服务版使用 `server.py`，需先设置 `PORT`；平台托管则由 `app.toml` 和 `start.sh` 自动处理。

生产构建输出：

- `dist/index.html`：API 服务入口。
- `dist/app.html`：本地资料工作台入口。
- `dist/manifest.webmanifest`、`dist/sw.js`、`dist/icons/`：安装和离线资源。

独立发行包的 `dist/index.html` 会替换为本地入口，使静态托管打开根路径时也能使用。不要将原始在线 `dist/index.html` 单独上传到静态空间，它依赖后端 API。

## 打包与完整性校验

```sh
python3 scripts/verify_package.py
python3 scripts/build_release.py --output /path/to/qisu-hub-release
```

输出 Windows、macOS、Linux、三平台通用和源码 ZIP，附 `SHA256SUMS.txt` 和 `release.json`。每个 ZIP 内还有 `RELEASE-MANIFEST.json`，记录逐文件大小与 SHA-256。所有包都排除 `.git`、依赖、运行资料和环境变量文件；源码包保留构建需要的授权文本。

macOS 使用 `shasum -a 256 <文件名>`，Linux 使用 `sha256sum <文件名>`，Windows PowerShell 使用 `Get-FileHash <文件名> -Algorithm SHA256`，与 `SHA256SUMS.txt` 对比即可。

GitHub Actions 在 push / pull request 时检查类型、构建、后端和发行包；推送 `v*` 标签时生成 GitHub Release。仓库已公开并启用 GitHub Pages。main 分支的产品源文件变更会自动部署，也可手动执行 Pages 工作流。Pages 部署只发布本地版，不发布 API 或研究资料。
