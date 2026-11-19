# 耆宿说 QISUSHUO

可运行的文化遗产资料研究、来源考证与内容创作工作台。真实保存、版本引用、Obsidian Markdown 导入、三维知识图谱、木构拆解、项目任务和完整备份。

在平台“我的产品”打开“耆宿说 · 文化知识工作台”。第一步可从首页“三维读建筑”或“使用指南”开始。当前知识助理为可直接使用的资料摘录模式，真实大模型尚未启用。内置内容全部为虚拟示例。

- [五分钟上手](docs/QUICK_START.md)
- [产品架构、功能、交互与路线](docs/PRODUCT_SPEC.md)
- [数据库与领域模型](docs/DATABASE.md)
- [工程架构与接口](ARCHITECTURE.md)
- [视觉规范](VISUAL_GUIDE.md)
- [验收记录](TEST_REPORT.md)

技术栈为 React 19 + TypeScript + Vite、React Three Fiber 9 + Three.js、FastAPI + SQLAlchemy + SQLite。前端生产构建为自包含 HTML，也提供离线 IndexedDB 体验。无 WebGL 时同一 R3F 场景通过 SVGRenderer 绘制，仍支持旋转与拆解。

验证：`npm run check`、`npm run build`、`.venv/bin/python -m pytest -q`。浏览器回归运行 `node tests/browser-flow.cjs`、`node tests/browser-3d.cjs`、`node tests/browser-final.cjs`，只连接共享浏览器。

启动由 app.toml 和平台管理，读取 PORT 并监听 0.0.0.0。Python 依赖锁定在 requirements.lock，前端锁定在 package-lock.json。不提交 data、dist、.venv、node_modules 或任何凭据。模型配置可由部署者使用现有服务端环境变量；默认不要求外部模型服务。

在线空间依赖当前浏览器会话，尚未提供团队账号找回；请定期导出完整备份。单文件离线资料与在线空间不自动同步。第三方说明见 THIRD_PARTY.md。
