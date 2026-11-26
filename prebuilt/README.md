# 预构建前端产物

此目录是 `npm run build` 的输出（`dist/` 的同内容副本），随仓库提交，用于**服务器端免构建部署**。

## 为什么放在这里

仓库的 `package-lock.json` 在 macOS 上生成，缺少 Linux 平台的 vite/rolldown 原生二进制
（`@rollup/binding-linux-x64-gnu` 等）。在香港服务器上 `npm ci` / `npm install` 都会在
`npm run build` 阶段报 `Cannot find module`，因此改为「本地构建 → 提交产物 → 服务器直接使用」。

## 重新生成

```bash
cd <repo> && npm install && npm run build && rm -rf prebuilt && cp -a dist prebuilt && \
  git add -f prebuilt && git commit -m "build: 更新预构建产物"
```

## 部署时如何使用

`deploy/bootstrap-hk.sh` 会检测本目录：存在则直接 `cp -a prebuilt/. dist/`，不存在才回退到现场构建。
