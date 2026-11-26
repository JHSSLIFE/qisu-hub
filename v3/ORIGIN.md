# V3.3 生产改造分支说明

本目录来自 `v3.3-living-archive` 分支的 `demo/v3.3`（提交 `1a2076f`），用于把演示界面改造成真实产品。

## 与原始 demo 的差异

| 文件 | 状态 | 说明 |
|---|---|---|
| `index.html` | **已修改** | 替换 5 处模拟实现：登录、会话、保存、持久化、角色判断；移除演示账号入口 |
| `api.js` | 新增 | 数据适配层，封装 `/api/*`；同源 + `X-Qisushuo` 头 |
| `server.py` | 保留未用 | 原 demo 的本地 AI 代理，生产由 FastAPI 接管；保留供对照协议 |
| `SHA256SUMS` | 已删除 | 原校验清单针对未修改的 demo，已失效 |
| `README.md` / `TEST-RESULTS.txt` / `docs/` | 原样保留 | 原 demo 的说明与测试记录，作为设计依据 |

## 改造原则

1. 界面、样式、交互一律沿用 V3.3，不改视觉。
2. 数据只从 `/api` 来，服务端按身份裁剪，前端不做权限判断。
3. 新功能写成独立 `.js` 文件，`index.html` 只做壳，避免继续膨胀。

原始未修改版本：`git show v3.3-living-archive:demo/v3.3/index.html`
