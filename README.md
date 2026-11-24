# 耆宿说数字工作台 QISU HUB

支持电脑与手机的文化遗产知识工作台。资料真实保存，支持 Obsidian Markdown 导入、来源考证、历史版本、内容创作、项目任务和 React Three Fiber 三维知识图谱。

## 直接使用

**产品网址：[耆宿说数字工作台 QISU HUB](https://jhsslife.github.io/qisu-hub/app.html)** · [GitHub 源码](https://github.com/JHSSLIFE/qisu-hub) · [下载发行包](https://github.com/JHSSLIFE/qisu-hub/releases)

- **平台在线版**：在“我的产品”打开“耆宿说数字工作台 QISU HUB”；“空间设置 → 打开独立应用”进入本机资料空间。
- **电脑免依赖包**：从 Releases 选择 `standalone` ZIP，解压后运行 `QISU-HUB.exe`（Windows）或 `QISU-HUB`（Mac / Linux），无需预装 Python。详见 [桌面包说明](docs/DESKTOP_NATIVE.md)。
- **轻量启动包**：从 [Releases](https://github.com/JHSSLIFE/qisu-hub/releases) 下载对应系统 ZIP，解压后运行启动脚本。需要 Python 3.10+，无需安装 Node 或项目依赖。首次允许浏览器打开后，在“空间设置”查看离线就绪状态。
- **可安装应用（PWA）**：通过 HTTPS 打开静态部署的 `app.html`；Chrome / Edge 选择“安装应用”，iPhone / iPad 在 Safari 的分享菜单选择“添加到主屏幕”。离线就绪后可断网重开，无需一直运行后台服务器。
- **部署者**：静态网页包可放到任意 HTTPS 服务器，支持子目录；也提供 Docker 在线后端和 GitHub Pages 手动部署工作流。当前仓库已按用户要求公开，并启用 GitHub Pages。

交付形态为可安装 Web 应用、内置运行时的桌面可执行启动器及轻量便携包。手机安装使用 PWA，当前不提供 APK / IPA。详细步骤、系统要求和迁移流程见 [安装指南](docs/INSTALL.md)。

## 资料与隐私

独立版资料存于当前设备和浏览器的 IndexedDB；在线版存于服务器中当前浏览器的独立空间。两个入口不自动同步，不会在切换时暗中迁移。迁移请使用“空间设置 → 导出完整备份 / 从备份恢复”，兼容原版备份，包含全部记录及历史版本。清除浏览器数据会删除本机资料，请保留外部备份。启动器保留稳定本机地址，避免重启后误入另一资料空间。

当前知识助理采用资料摘录模式；独立版不向外部模型发送资料。在线部署可在服务端配置模型，密钥只读环境变量。内置 50 条内容均为虚拟示例，真实专家资料和 Obsidian 知识库需要自行导入。

## 开发与验证

```sh
npm ci
npm run check
npm run build
python3 scripts/verify_package.py
python3 -m venv .venv
.venv/bin/pip install -r requirements.lock
.venv/bin/python -m pytest -q
```

平台按 `app.toml` 自动托管；`start.sh` 读取 `PORT` 并绑定 `0.0.0.0`。个人电脑使用 `launch.py`，发行包仅暴露静态白名单，不公开源码、数据库或环境文件。

技术栈：React 19、TypeScript、Vite、React Three Fiber 9、Three.js；可选后端 FastAPI、SQLAlchemy、SQLite。PWA 仅缓存应用静态资源，不缓存服务器 API。更新会等待所有应用窗口关闭，保护正在编辑的稿件。多窗口保存以事务和记录版本检查避免静默覆盖。

- [五分钟上手](docs/QUICK_START.md)
- [产品、功能与交互规划](docs/PRODUCT_SPEC.md)
- [数据库设计](docs/DATABASE.md)
- [工程架构](ARCHITECTURE.md)
- [视觉规范](VISUAL_GUIDE.md)
- [本轮封装验收](docs/PACKAGING_REPORT.md)
- [第三方说明](THIRD_PARTY.md)

浏览器自动化仅连接共享浏览器，示例：`QISUSHUO_URL=http://127.0.0.1:<平台分配端口> node tests/browser-pwa.cjs`。源码仓库不包含用户资料、构建产物、依赖缓存或凭据。
