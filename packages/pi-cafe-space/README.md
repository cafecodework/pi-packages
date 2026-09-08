# @cafecodework/pi-cafe-space

Pi Cafe Space 让电脑上的原生 Pi CLI 和手机或桌面浏览器通过 HTTP/WebSocket relay 参与同一个实时 Pi 会话。

relay 只负责连接、认证、房间、事件转发和短期内存状态，不创建第二个 Pi runtime，也不读取或写入 Pi session JSONL。

```text
Web/PWA ---- WebSocket ---- Pi Cafe Space relay
                                |
                                | WebSocket
                                v
                         Pi extension host
                                |
                         current Pi session
```

## Package layout

这是父仓库 `packages/*` 下的自包含 Pi package，也是 `pi install` 的直接目标：

```text
packages/pi-cafe-space/
|-- src/
|   |-- extension/       Pi host extension
|   |-- protocol/        shared wire protocol
|   `-- relay/           HTTP/WebSocket relay
|-- web/public/          static Web/PWA client
|-- scripts/             Windows start/stop helpers
|-- docs/                architecture and component notes
|-- package.json         Pi package manifest
|-- LICENSE              package license
`-- tsconfig.json
```

构建后会生成：

```text
dist/extension/index.js  Pi 实际加载的扩展
dist/relay/index.js      extension 可自动拉起的 relay
dist/relay/public/       relay 提供的 Web/PWA
```

`package.json` 的 `pi.extensions` 只加载 `dist/extension/index.js`。relay、协议和 Web 随同一个 package 构建，是为了让默认本地模式不依赖仓库外部路径。

详细架构和限制见 [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)。

## Install

要求 Node.js `>=22.19.0`。在父仓库根目录执行：

```powershell
cd C:\Users\dp\Documents\cafecodework-pi-packages
npm install
npm run pi-cafe-space:build
pi install C:\Users\dp\Documents\cafecodework-pi-packages\packages\pi-cafe-space
```

随后在任意项目目录运行普通 `pi`。扩展默认会：

1. 检查 `ws://127.0.0.1:37891/ws` 对应的本地 relay；
2. relay 不存在时，以 detached 后台进程启动 package 内的 `dist/relay/index.js`；
3. 把当前 Pi runtime 注册为 `main` room 的一个独立 host；同一个 room 可以同时运行多个 Pi 实例；
4. 让 `http://127.0.0.1:37891/` 显示实时 transcript、thinking、工具状态、文件和历史会话。

不想让某次 Pi 自动连接，可以使用：

```powershell
$env:PI_COLLAB_ENABLED = "0"
pi
```

也可以在 Pi 内执行 `/collab-disconnect`。relay 暂时不可用时扩展会继续自动重连，但相同的连接 warning 最多每 60 秒提示一次，避免 `ECONNREFUSED` 反复刷屏；Pi 状态栏仍会显示连接状态。

`start-pi.ps1` 会在传给 `pi` 的参数前加入 `--collab`，脚本参数之后的其余 `PiArgs`（例如 `--resume "session id"` 或其他 Pi CLI 选项）会继续转发；Pi 的退出码会传回调用方，脚本也会恢复调用前的 `PI_COLLAB_*` 环境变量。

## Local relay

通常由普通 `pi` 自动启动。也可以手动操作：

```powershell
cd C:\Users\dp\Documents\cafecodework-pi-packages
npm run pi-cafe-space:relay:start
npm run pi-cafe-space:relay:stop
```

默认页面：

```text
http://127.0.0.1:37891/
```

loopback 页面在当前 tab 没有已保存 token 时会自动使用本地开发 client token；如果此前保存过自定义 token，页面会保留它，需要在登录表单中改回正确 token。`sessionStorage` 只是 best-effort convenience cache；如果浏览器策略禁止 storage，当前 tab 仍可登录，但刷新页面后不会保留 token。默认 token 不能用于 LAN 或公网。非 loopback relay 要求两个明确、彼此不同、非默认/placeholder 的 token；每个 token 长度为 16–4,096 个字符，并通过至少 8 个不同字符、单字符频率不超过 25%、Shannon entropy `>=3.0` 和估算总熵 `>=64 bit` 的启发式检查。该检查不是密码学来源证明，生产环境应使用密码学安全随机源生成 token。`PI_COLLAB_ALLOWED_ORIGINS` 只额外放行列出的跨源浏览器 Origin；列表最多 64 项、每项最多 2,048 个字符，原始环境变量文本也有总长度上限。实现允许与 relay 直接监听协议和 Host 完全匹配的同源升级；经 TLS 反向代理时应把公开的 HTTPS Origin 显式加入 allowlist。allowlist 项必须是没有凭据、路径、查询或 fragment 的 `http(s)` origin，并在 allowlist 为空时兼容无 `Origin` 的 extension/非浏览器客户端，所以 token 认证仍是必要安全边界。启动脚本和 extension 使用按 bind/port 区分的原子启动锁；启动脚本在只读安装目录时会回退到用户临时 runtime，extension 最差情况下无锁、无 PID convenience file 也会继续启动 relay。自动启动 relay 时只传递必要的 OS 启动变量和 `PI_COLLAB_*` 配置，不会把 Pi/provider 凭据环境传给 relay 子进程。

## LAN test

在 package 目录使用显式高熵 token 启动：

```powershell
cd C:\Users\dp\Documents\cafecodework-pi-packages\packages\pi-cafe-space
.\scripts\start-relay.ps1 `
  -Bind "0.0.0.0" `
  -HostToken "真实随机 host token" `
  -ClientToken "真实随机 client token"
```

手机打开电脑的局域网地址，例如 `http://192.168.1.20:37891/`；`-Bind 0.0.0.0` 只表示监听所有接口，启动脚本会明确提示使用实际 LAN IP，而不是把 `127.0.0.1` 当作手机地址。远程部署应使用 HTTPS/WSS、反向代理或 Cloudflare Tunnel。

远程或自定义 token 时，Pi 端也必须使用同一个 host token：

```powershell
.\scripts\start-pi.ps1 `
  -RelayUrl "wss://relay.example.com/ws" `
  -HostToken "同一个 host token"
```

## Verify

从父仓库根目录运行：

```powershell
npm run pi-cafe-space:check
npm run pi-cafe-space:test
npm run pi-cafe-space:build
```

当前测试覆盖协议校验、snapshot 压缩、受限文件访问和 relay WebSocket 流程。

## Boundaries

- relay 不拥有 Pi `AgentSession`。
- 同一个 room 可以有多个独立 Pi host；每个实例有自己的 stream/session，Web 端通过“Pi 实例”选择器决定命令发往哪一个实例。
- 同一个 `peerId` 的重连会替换旧连接，不同 Pi 实例不会互相踢出；默认 `peerId` 含进程内随机实例 ID，也可通过 `PI_COLLAB_PEER_ID` 显式指定。
- Web 客户端不持有 Pi API Key，也不直接调用模型 provider。
- 文件和历史命令由 relay 转发给当前 Pi extension；relay 本身不访问电脑磁盘。文件读取仅允许 canonical 项目根内的普通文件，隐藏常见凭据路径，并拒绝把文件系统根、用户主目录或其祖先当作远程文件浏览根。命令带 stream/session/project-root fence，避免上下文切换后复用旧请求。
- prompt 回执是 `dispatched`，不是 provider 完成回执，因为 Pi 0.84.4 的 `sendUserMessage()` 返回 `void`。
- relay 状态保存在单进程内存中，不承诺跨 relay 重启的 exactly-once。
- daemon 不是当前运行模式，不能与原生 Pi CLI 同时拥有同一个 session。
- 一个 room 最多保留 64 个 host state 和 256 个 browser client；relay 进程最多同时保留 256 个 room、512 个 WebSocket 连接，且未完成 hello 的连接最多 128 个（同一来源地址最多 32 个）。离线 host 和历史缓存默认保留 30 分钟；历史缓存读取会刷新相应的非活动计时器，host 重连会清理旧历史缓存并等待新 snapshot。单 host 的 pending command 也有数量上限。
