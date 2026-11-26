# QISU HUB 部署手册（S6）

> 目标：让电脑与手机在**任意网络**下通过 **HTTPS** 访问同一份数据，并且每天有可恢复的备份。
> 版本：2026-11-26　适用代码：`qisu-hub` main @ `377d55a`＋ 本目录的部署资产

---

## 0. 四条硬约束（漏一条就会坏，且症状很难查）

| 约束 | 原因 | 症状 |
|---|---|---|
| **前后端必须同域** | Cookie 是 `SameSite=Lax`，跨站请求不带 Cookie；仓库里没有 CORS 中间件 | 登录成功但立刻变回未登录 |
| **反代必须保留 Host** | `server.py` 的同源校验用 `Host` 比对 `Origin` | 所有写操作 403「仅允许在当前页面操作资料」 |
| **反代必须传 `X-Forwarded-Proto: https`** | 登录接口据此决定 Cookie 是否加 `Secure` | Cookie 缺 `Secure`，退化为明文可窃取 |
| **必须 HTTPS** | iOS「添加到主屏幕」、Service Worker、`isSecureContext` 全部要求安全上下文 | 手机上装不了 PWA，剪贴板等 API 不可用 |

`deploy/Caddyfile` 已按这四条写好，**不要"顺手优化"掉其中的 header 或改成不同域名**。

另有两个容易踩的点：
- `/` 对 `HEAD` 返回 **405**（FastAPI 只注册了 GET），健康检查请用 `GET /api/health`。
- 反代后面 `request.client.host` 是 `127.0.0.1`。审计里要真实 IP，需读 `X-Real-IP`（已在 Caddy 配置中注入）。

---

## 1. 三条路，先选一条

| 路径 | 前置条件 | 公网可达 | 手机要装东西 | 成本 | 适合 |
|---|---|---|---|---|---|
| **A 云主机 + 域名** | 一台 Linux 云主机、一个域名、域名解析权；中国大陆主机还需 **ICP 备案** | ✅ 任何人 | 否 | 主机 + 域名年费 | 长期正式使用 |
| **B Cloudflare Tunnel** | 域名已托管在 Cloudflare；本机（Mac）常开 | ✅ 任何人（可加 Access 限制） | 否 | 免费 | 有域名但不想买主机 |
| **C Tailscale** | 每台设备装 Tailscale 并登录同一账号（本机已装 1.94.2，处于未登录状态） | ❌ 仅 tailnet 内 | 是 | 免费 | 内部小团队、最快可用 |

**我的建议**：先用 **C** 在今天拿到 HTTPS 远程访问（10 分钟），确认体验没问题后，再按 **A** 迁到云主机作为长期入口。**B** 适合"有域名、不想维护服务器"的情况。

---

## 2. 路径 A：云主机 + 域名（终态）

### 2.1 准备
- 2 核 2G 起，Ubuntu 22.04/24.04；磁盘 ≥ 40G（SQLite + 备份）
- 安全组放行 **80 / 443**，**不要**放行 8080
- 域名 A 记录指向主机公网 IP（`qisu.example.com`）
- 中国大陆主机：先完成 ICP 备案，否则 80/443 会被拦

### 2.2 装运行时

```bash
sudo adduser --system --group --home /opt/qisu qisu
sudo mkdir -p /opt/qisu/{app,data,deploy} /var/log/qisu /var/backups/qisu
sudo chown -R qisu:qisu /opt/qisu /var/log/qisu /var/backups/qisu

# 代码（用 deploy key 或直接 clone）
sudo -u qisu git clone https://github.com/JHSSLIFE/qisu-hub.git /opt/qisu/app
cd /opt/qisu/app

# 前端产物（服务器上也要构建，dist/ 不进仓库）
sudo apt install -y nodejs npm python3-venv
sudo -u qisu npm ci && sudo -u qisu npm run build

# Python
sudo -u qisu python3 -m venv /opt/qisu/.venv
sudo -u qisu /opt/qisu/.venv/bin/pip install -r requirements.lock
```

### 2.3 配置

```bash
sudo -u qisu cp /opt/qisu/app/../deploy/.env.example /opt/qisu/.env   # 若 deploy 未随仓库，从本工作区拷
sudo chmod 600 /opt/qisu/.env
sudo -u qisu vi /opt/qisu/.env    # 改 QISUSHUO_DATA=/opt/qisu/data、管理员密码
```

关键项：
```
PORT=8080
QISUSHUO_DATA=/opt/qisu/data
QISUSHUO_REQUIRE_LOGIN=1
QISUSHUO_ADMIN_USER=<管理员用户名>
QISUSHUO_ADMIN_PASSWORD=<强密码>
QISUSHUO_SECURE_COOKIE=1
```
> `QISUSHUO_ADMIN_PASSWORD` 每次启动都会比对，**改了它就等于重置该账号密码**。首次登录后建议把这一行改成注释，避免密码长期留在环境文件里。

### 2.4 常驻服务

```bash
sudo cp deploy/qisu.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now qisu
curl -s localhost:8080/api/health      # {"ok":true}
```

### 2.5 反代 + 证书

```bash
sudo apt install -y caddy              # 或 deb 安装包
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo sed -i 's/qisu.localhost/qisu.example.com/' /etc/caddy/Caddyfile
sudo mkdir -p /var/log/caddy && sudo chown caddy:caddy /var/log/caddy
sudo systemctl reload caddy
```
Caddy 会自动申请并续期证书（需要 80 端口可达）。

### 2.6 每日备份

```bash
sudo cp deploy/backup.sh /opt/qisu/deploy/ && sudo chmod +x /opt/qisu/deploy/backup.sh
sudo cp deploy/qisu-backup.{service,timer} /etc/systemd/system/
sudo systemctl enable --now qisu-backup.timer
sudo systemctl start qisu-backup.service   # 立刻跑一次
sudo -u qisu QISU_BACKUP_DIR=/var/backups/qisu /opt/qisu/deploy/backup.sh --verify /var/backups/qisu/<最新>.tar.gz
```

### 2.7 验收

```bash
BASE_URL=https://qisu.example.com QISU_USER=<管理员> QISU_PASS=<密码> ./deploy/smoke.sh
```
12 项全绿才算上线。逐项含义见文末。

---

## 3. 路径 B：Cloudflare Tunnel（有域名、无公网 IP）

不需要开放任何端口，出站隧道即可。

```bash
brew install cloudflared                     # 或官网 deb
cloudflared tunnel login                     # 浏览器授权，选你的域名
cloudflared tunnel create qisu
cloudflared tunnel route dns qisu qisu.example.com
```

`~/.cloudflared/config.yml`：
```yaml
tunnel: qisu
credentials-file: /Users/<你>/.cloudflared/<tunnel-id>.json
ingress:
  - hostname: qisu.example.com
    service: http://127.0.0.1:8080
  - service: http_status:404
```

```bash
cloudflared tunnel run qisu          # 前台试跑
sudo cloudflared service install     # 装成开机自启
```

要点：
- Cloudflare 会终止 TLS 并转发，**默认保留 Host、并带 `X-Forwarded-Proto: https`**，符合第 0 节约束。
- 必须用 `http://127.0.0.1:8080`（不是 https），否则回源握手失败。
- 想要额外一层保护：Cloudflare Access 加邮箱白名单，未授权者连登录页都看不到。
- 本机磁盘加密 + FileVault 必开：数据在家里的 Mac 上。

---

## 4. 路径 C：Tailscale（今天就能用，最快）

本机已装 `tailscale 1.94.2`（`/usr/local/bin/tailscale`），当前是 `Stopped`。

```bash
sudo tailscale up                     # 浏览器登录一次（Google/GitHub 账号即可）
tailscale status                      # 拿到 100.x.y.z 与本机 DNS 名
```

拿到 `https://<机器名>.<tailnet>.ts.net` 的证书访问（**这是真证书，不是自签**）：

```bash
tailscale serve --bg --https=443 http://127.0.0.1:8080
tailscale serve status
```

然后：
- 手机装 Tailscale 并登录同一账号 → 直接打开 `https://<机器名>.<tailnet>.ts.net`
- 电脑同样
- 该域名只在 tailnet 内解析，**不暴露公网**

限制（必须知道）：
1. Mac 休眠即断，长期入口不可靠；
2. 每个使用者都必须装客户端并加入 tailnet——**外部专家不方便**；
3. `tailscale serve` 只绑 127.0.0.1，比直接开 8080 更安全，但仍是"把工作机当服务器"。

> `tailscale serve` 会传 `X-Forwarded-Proto: https`，Cookie 会自动带 `Secure`；同时保留 Host，写操作正常。这一点已在本地用 Caddy 等价验证过（见第 6 节）。

---

## 5. 备份与恢复

```bash
deploy/backup.sh                     # 立即备份（默认 ../backups/daily，保留 30 份）
deploy/backup.sh --verify <文件>      # 恢复演练：解包 → integrity_check → 计数比对
```

- 用 `sqlite3 .backup` 取一致性快照，**不是 `cp`**（`cp` 在写入中会拿到撕裂的库）
- 快照先过 `pragma integrity_check`，坏档不入库
- 每次追加 `SHA256SUMS`，可校验是否被篡改
- 生产建议：`QISU_BACKUP_DIR` 指到独立磁盘，**再加一层异地**（`rclone`/对象存储），并把密钥与备份分开存放

**恢复步骤**
```bash
sudo systemctl stop qisu
tar -xzf /var/backups/qisu/qisu-YYYYmmdd-HHMMSS.tar.gz -C /opt/qisu/data --strip-components=0
# 包内是 research.sqlite3 + manifest.txt，直接覆盖
sudo chown qisu:qisu /opt/qisu/data/research.sqlite3
sudo systemctl start qisu
curl -s localhost:8080/api/health
```

---

## 6. 本地已完成的验证（不是纸面推演）

在本机用 Caddy 2.11.9 起了一个真实 HTTPS 反代（`localhost:8443`，内部 CA），跑通：

| 验证项 | 结果 |
|---|---|
| Caddyfile 语法与指令顺序 | `caddy validate` → Valid configuration |
| HTTP/2 + 自动 TLS | `HTTP/2 200`，`curl -k` 可访问 |
| 安全响应头 | HSTS / nosniff / X-Frame-Options: DENY / Referrer-Policy 全部命中，`Server` 未暴露 |
| 登录经反代 | `jiahao` → owner，空间 `f81cc59b` |
| **Cookie 带 Secure** | `qisushuo_session=…; HttpOnly; SameSite=lax; Secure` |
| **Host 被保留** | 写操作 `POST /api/imports` → 200（未触发同源 403） |
| 跨站写入 | `Origin: https://evil.example.com` → **403** |
| 未登录 | `/api/bootstrap` → **401** |
| 静态首页 | 登录页正常渲染 |
| 备份 | 412 条 / 8 空间 / 4 账号，`integrity=ok`，恢复演练通过 |
| 自检脚本 | HTTPS 入口 12/12、直连入口 8/8 |

---

## 7. 回滚

| 场景 | 操作 |
|---|---|
| 应用起不来 | `systemctl status qisu` → 看 `/var/log/qisu/app.err.log`；`git -C /opt/qisu/app checkout <上一个 commit>` 后重启 |
| 反代配置坏 | `sudo cp /etc/caddy/Caddyfile.bak /etc/caddy/Caddyfile && sudo systemctl reload caddy`（改前先备份） |
| 数据损坏 | 停服务 → 用最近备份覆盖 `research.sqlite3` → 起服务 → 跑 `smoke.sh` |
| 完全回退到局域网 | `systemctl stop caddy`，直接用 `http://<内网IP>:8080`（仅限信任网络） |

---

## 8. 待确认（决定走哪条路）

1. **有没有域名？**（有 → A 或 B；没有 → C，或先买一个）
2. **有没有云主机？** 在哪家、什么配置、能否备案
3. **使用范围**：只你和同事（3–8 人）→ C 够用；要给外部专家发链接 → 必须 A 或 B
4. **数据合规**：文保与专家资料是否允许放在第三方云；若不允许，只能自建（A）或留在本机（C）

在这四个问题有答案前，路径 C 是唯一"今天就能拿到 HTTPS 远程访问"的方案，且不需要你买任何东西。
