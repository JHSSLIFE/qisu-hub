# 耆宿说数字工作台 QISU HUB v1.1.0

**直接使用：[打开 QISU HUB](https://jhsslife.github.io/qisu-hub/app.html)** · **源码：[JHSSLIFE/qisu-hub](https://github.com/JHSSLIFE/qisu-hub)**

电脑和手机均可直接使用。应用名称、安装图标和页面标题统一为“耆宿说数字工作台 QISU HUB”。

## 电脑下载

优先选择名称含 `standalone` 的 ZIP，无需预装 Python、Node 或数据库：

- Windows 10 / 11（x64）：`QISU-HUB-1.1.0-Windows-x64-standalone.zip`，解压运行 `QISU-HUB.exe`。
- Apple Silicon Mac（M 系列）：`QISU-HUB-1.1.0-macOS-arm64-standalone.zip`，解压运行 `QISU-HUB`。本次在 macOS 26 构建验证。
- Intel Mac：`QISU-HUB-1.1.0-macOS-x64-standalone.zip`，解压运行 `QISU-HUB`，在 macOS 15 构建验证。
- Linux（x64）：`QISU-HUB-1.1.0-Linux-x64-standalone.zip`，解压运行 `./QISU-HUB`，基于 Ubuntu 22.04。

启动器自动打开系统浏览器，内含运行时与离线资源。未进行 Windows 签名或 Apple 公证，系统可能要求确认来源。每个下载包有独立 `.sha256` 校验文件。

不带 `standalone` 的轻量 ZIP 需要 Python 3.10+；`portable.zip` 包含三套启动脚本；`source.zip` 为首次发行源码，持续更新源码见 main 分支。

## 手机安装

通过上述 HTTPS 地址首次打开完整工作台，进入“空间设置”确认“离线就绪”。

- iPhone / iPad：Safari → 分享 → 添加到主屏幕。
- Android：Chrome / Edge → 安装应用。
- 电脑：Chrome / Edge → 安装应用，也可使用免依赖启动器。

这是可安装的 Web 应用，当前不提供 APK / IPA。首次准备后可断网重开、查看、编辑、导入及备份。

## 已验证与资料说明

正式 HTTPS 子目录、离线新增与重载、多窗口冲突保护、备份与历史版本、30 组电脑和手机视口布局均通过；四种电脑可执行包在各自构建环境完成资源及运行验证，Docker CI 通过。手机原生安装界面尚未真机验收。

资料保存在当前设备浏览器，不自动跨设备同步；可用“导出完整备份 / 从备份恢复”迁移。内置内容均为虚拟示例；当前知识助理使用本地检索与原文摘录，未启用外部大模型。

详细步骤见 [安装指南](https://github.com/JHSSLIFE/qisu-hub/blob/main/docs/INSTALL.md) 与 [验收记录](https://github.com/JHSSLIFE/qisu-hub/blob/main/docs/PACKAGING_REPORT.md)。
