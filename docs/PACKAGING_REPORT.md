# QISU HUB 1.1.0 封装验收

验收日期：2026-11-24。以下为本次产品封装的实际验证，不沿用旧版报告作为本轮通过证据。

## 产品形态

- 正式名称：耆宿说数字工作台 QISU HUB。
- 平台托管在线空间：保留服务端资料与原有会话。
- `app.html`：设备本地 IndexedDB 空间、可安装 PWA、静态 HTTPS 部署和断网使用。
- 三系统 Python 标准库便携启动包；启动器只提供构建文件白名单。
- GitHub Actions 自动检查、版本发布与可选 Pages 部署；桌面可执行包另见构建结果。

## 已验证

- TypeScript 类型检查、Vite 生产构建通过。
- 后端测试 10 项通过，覆盖资料隔离、历史版本、保存冲突、中文搜索、批量导入原子性、备份恢复、检索无依据降级、接口防护及 PWA 静态资源边界。
- 共享浏览器实际查看本机工作台、安装状态及手机导航，显示“离线就绪”。
- 发行验证脚本检查资源白名单、路径穿越与符号链接防护、稳定端口配置、PWA 相对路径和本地入口、逐文件归档校验。

PWA 浏览器封装回归通过：断网重开并新建保存、双窗口保存冲突、最新全量备份及历史版本、IndexedDB 读取故障不写种子。10 类页面在 1440 / 390 / 360px 的 30 组布局均无横向溢出，手机连续输入通过。JS 异常、console.error、HTTP 错误、误发 API 请求均为 0。详见 [测试机器报告](../tests/pwa-report.json)。

正式 HTTPS 子目录复验已通过（2026-11-24 08:42:47–08:43:13 UTC）：真实站点 `https://jhsslife.github.io/qisu-hub/` 的 Service Worker scope、清单、图标、断网重开、新增保存、多窗口冲突、完整备份及 30 组页面尺寸全部通过。浏览器安装条件检查 `installabilityErrors` 为空。详见 [正式站机器报告](../tests/pages-pwa-report.json)。

原有 browser-final、browser-3d、browser-gestures 本轮重新运行通过，含预览握手、手机连续输入、未保存保护、木构拆解、节点溯源、指针旋转与不同尺寸场景布局。共享浏览器 WebGL 禁用，三维交互使用同一 R3F 场景的 SVGRenderer；GPU 渲染路径未在此环境复验。

## 发行与构建证据

- [公开仓库](https://github.com/JHSSLIFE/qisu-hub)、[正式应用](https://jhsslife.github.io/qisu-hub/app.html)、[v1.1.0 下载页](https://github.com/JHSSLIFE/qisu-hub/releases/tag/v1.1.0)。
- [CI 检查](https://github.com/JHSSLIFE/qisu-hub/actions/runs/45357078478)通过，包含真实 Docker 构建、非 root 只读容器中的 API、SQLite、PWA 资源与私密路径检查。
- [Pages 部署](https://github.com/JHSSLIFE/qisu-hub/actions/runs/45357078474)与[版本发行](https://github.com/JHSSLIFE/qisu-hub/actions/runs/45356098183)成功。
- [电脑构建](https://github.com/JHSSLIFE/qisu-hub/actions/runs/45356098182)：Windows x64、macOS Intel、Linux x64 成功；该轮 Apple Silicon 因 GitHub runner 容量不足未取得运行资源，随后使用[备用 macOS 26 构建](https://github.com/JHSSLIFE/qisu-hub/actions/runs/45359961973)成功补齐 arm64。四个 ZIP 及各自 SHA256 已发布。
- 四平台在各自 runner 检查内嵌资源逐字节一致，并实际运行可执行启动器 `--help` / `--check`。下载至沙箱的四个 ZIP 全部校验 SHA256；Linux 下载包额外在无 Python 环境变量的进程中运行 `--check` 成功。
- macOS arm64 在 macOS 26 runner 验证；其他 macOS 版本未真机验收。所有桌面包未签名或公证，实际安装体验仍有系统确认来源步骤。

## 资料保护

保留旧 IndexedDB 数据库名及 `qisushuo-backup` schema 1 备份兼容。读取失败显示错误，不初始化示例覆盖现有资料。保存以同一 IndexedDB 事务读取最新状态并检查记录版本；批量导入要么全部提交，要么全部回滚。完整备份从数据库读取最新内容，包含其他窗口成功保存的资料。

PWA 只缓存 `app.html`、清单与图标，不缓存在线接口。安装入口始终使用本机空间，在线界面先引导导出再恢复。更新等待应用窗口关闭，不强制重载正在编辑的内容。

## 当前边界

用户明确授权后，仓库 `JHSSLIFE/qisu-hub` 已改为 Public。GitHub Pages 已启用，正式地址为 `https://jhsslife.github.io/qisu-hub/`；已完成 HTTPS 安装入口与真实子目录离线复验。

手机的原生“添加到主屏幕”界面与真实 iOS / Android 硬件未实机验收；浏览器手机尺寸测试不能替代实机验证。当前无 APK / IPA。电脑可执行启动器已生成，打开系统浏览器工作台。

本地资料不自动跨设备同步；内置内容为虚拟示例；本地知识助理为资料摘录模式。沙箱没有可用 Docker daemon；Docker 的实际构建与非 root 运行已在 GitHub runner 验证通过。

## 自评

本轮封装自评 **95/100**：具备公开访问、桌面免依赖包、手机 PWA、离线编辑与备份迁移的上手闭环；保留分数用于手机真机安装、桌面签名 / 公证，以及更多设备上的 GPU 兼容验收。
