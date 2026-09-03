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
3. 把当前 Pi runtime 注册为 `main` room 的唯一 host；
4. 让 `http://127.0.0.1:37891/` 显示实时 transcript、thinking、工具状态、文件和历史会话。

不想让某次 Pi 自动连接，可以使用：

```powershell
$env:PI_COLLAB_ENABLED = "0"
pi
```

也可以在 Pi 内执行 `/collab-disconnect`。

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

loopback 页面自动使用本地开发 client token。默认 token 不能用于 LAN 或公网。

## LAN test

在 package 目录使用显式高熵 token 启动：

```powershell
cd C:\Users\dp\Documents\cafecodework-pi-packages\packages\pi-cafe-space
.\scripts\start-relay.ps1 `
  -Bind "0.0.0.0" `
  -HostToken "真实随机 host token" `
  -ClientToken "真实随机 client token"
```

手机打开电脑的局域网地址，例如 `http://192.168.1.20:37891/`。远程部署应使用 HTTPS/WSS、反向代理或 Cloudflare Tunnel。

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
- 同一个 room 只允许一个 Pi host。
- Web 客户端不持有 Pi API Key，也不直接调用模型 provider。
- 文件和历史命令由 relay 转发给当前 Pi extension；relay 本身不访问电脑磁盘。
- prompt 回执是 `dispatched`，不是 provider 完成回执，因为 Pi 0.84.4 的 `sendUserMessage()` 返回 `void`。
- relay 状态保存在单进程内存中，不承诺跨 relay 重启的 exactly-once。
- daemon 不是当前运行模式，不能与原生 Pi CLI 同时拥有同一个 session。
