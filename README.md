# 耆宿说

文化遗产资料研究、来源考证与内容生产工作台。提供真实持久化与可离线运行的单文件体验。

- 产品规划与交互：PRODUCT.md
- 技术架构、数据库、接口与边界：ARCHITECTURE.md
- 测试：`.venv/bin/python -m pytest -q`、`npm run check`、`npm run build`
- 启动由产品声明与平台管理，读取 PORT 并监听 0.0.0.0。
- Python 依赖通过 requirements.lock 恢复，前端通过 package-lock.json 恢复。不要提交 data、.venv、node_modules 或环境凭据。
- 内置数据由 seed_data.py 生成，全部明确标为虚拟示例。

第三方库的许可证说明见 THIRD_PARTY.md。
