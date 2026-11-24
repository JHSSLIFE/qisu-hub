# 无需 Python 的电脑独立包

产品名称：**耆宿说数字工作台 QISU HUB**。

在 [GitHub Releases](https://github.com/JHSSLIFE/qisu-hub/releases) 选择名称含 `standalone` 的 ZIP，解压到普通文件夹后运行其中的 `QISU-HUB.exe`（Windows）或 `QISU-HUB`（macOS / Linux）。它内含应用、Python 运行时及离线资源，不要求安装 Python、Node.js、项目依赖或配置 AI 密钥。

启动器会打开默认浏览器中的本地工作台。首次进入“空间设置”并等待“离线就绪”，可继续通过浏览器安装为独立应用窗口。资料存于当前浏览器的 IndexedDB，不存进可执行文件；请通过“空间设置 → 导出完整备份”定期备份。后续启动沿用保存的本机端口，以保持相同的资料空间。首次仍须运行启动器；关闭启动器后，已准备好的 `app.html` 或安装后的应用可以通过浏览器离线缓存重开。

## 选择系统版本

| 文件标记 | 适用系统与架构 |
| --- | --- |
| `Windows-x64-standalone` | Windows 10 / 11，Intel 或 AMD 64 位电脑 |
| `macOS-arm64-standalone` | Apple Silicon Mac（M 系列），当前发行包在 macOS 26 构建验证；更早系统未实机验收 |
| `macOS-x64-standalone` | Intel Mac，macOS 15 或更新版本 |
| `Linux-x64-standalone` | 主流 glibc Linux x64；基于 Ubuntu 22.04 构建 |

这是可执行的本地启动器，会打开浏览器工作台；不是商店上架安装器，不包含原生 WebView 外壳。当前文件未进行 Windows 代码签名或 Apple 公证，系统可能要求你确认来源。macOS 可在“隐私与安全性”中查看被阻止的应用，并在核对下载来源和校验和后允许打开。Linux 若解压工具没有保留执行权限，执行 `chmod +x QISU-HUB` 后运行 `./QISU-HUB`。

电脑启动器不直接作为手机安装包。手机通过 HTTPS 部署地址打开 `app.html`：Android 使用 Chrome / Edge 安装应用，iPhone / iPad 在 Safari 分享菜单选择“添加到主屏幕”。两台设备之间通过完整备份迁移资料，不自动同步。

## 发布与验证

GitHub Actions 中的 **QISU HUB standalone desktop** 工作流分别在 Windows、macOS Apple Silicon、macOS Intel、Linux 上构建。可在 Actions 手动运行；不填 `release_tag` 时只产出下载工件，填写已有 Release 标签时同时上传该版本的附件。推送 `v*` 标签也会自动构建并发布。是否已经构建成功，请查看对应工作流和 Release 的实际附件，不以配置文件存在作为构建完成证明。

每个平台会验证嵌入包中 `app.html`、manifest、Service Worker、图标与原构建字节一致，并运行可执行文件的 `--help` 与 `--check`。这些检查验证封装完整性和运行时可启动，不代替真机浏览器、系统安装流程或签名验证。每个 ZIP 带独立 `.sha256` 校验和；ZIP 内含构建清单、前端第三方声明、Python 及 PyInstaller 许可文本。

构建工具固定为 [PyInstaller 6.22.3](https://pypi.org/project/pyinstaller/6.22.3/)，Python 3.12。[PyInstaller 官方说明](https://pyinstaller.org/en/stable/)指出其打包应用无需用户另装 Python，且须在目标系统分别构建；本项目因此使用四个原生 Runner。[GitHub 官方 Runner 列表](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)说明 macOS Intel 与 Apple Silicon 使用不同标签。

本轮四个平台的可执行包均已生成并发布至 v1.1.0。Apple Silicon 首次排队未获运行资源，后由 **QISU HUB Apple Silicon recovery** 工作流在 macOS 26 成功构建。
