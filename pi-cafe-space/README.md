# Pi Cafe Space

Pi Cafe Space 是一个 **Pi CLI + HTTP/WebSocket relay + Web/PWA** 项目。

目标是让电脑上的原生 Pi CLI 和手机浏览器通过一个 relay 参与同一个实时 Pi 会话。relay 只负责连接、认证和转发，不创建第二个 Pi runtime，也不读写 Pi session JSONL。

```text
手机 Web/PWA ──WebSocket──┐
                          ▼
                   Pi Cafe Space relay
                          ▲
                          │ WebSocket
                    Pi CLI extension
                          │
                    当前 Pi 会话
```

## 当前状态

已经落地本地 MVP 闭环：

- `apps/relay-server`：HTTP 静态文件服务 + WebSocket relay。
- `packages/pi-extension`：在原生 Pi 进程内作为 host 连接 relay。
- `apps/web/public`：无需前端构建的移动端 Web 客户端。
- `packages/protocol`：共享协议、运行时校验和 snapshot projection。

详细架构和限制见：[docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)

## 目录

```text
apps/relay-server/       本地/未来服务器 relay
apps/web/public/         移动 Web/PWA 静态客户端
apps/daemon/             后续可选 daemon 模式（当前不使用）
apps/cli/                后续可选 companion CLI
packages/protocol/       共享 wire protocol
packages/pi-extension/   Pi 原生扩展 host connector
packages/session-core/   后续抽取的会话核心
scripts/                  Windows 本地启动/停止脚本
```

## 普通 `pi` 自动模式

Pi Cafe Space 扩展已经安装到当前用户的 Pi packages（`pi list` 可以确认）。完成一次构建后，在任意项目目录直接运行普通命令即可：

```powershell
cd C:\Users\dp\Documents\cafecodework-pi-packages\pi-cafe-space
pnpm build
pi
```

扩展默认会：

1. 检查 `ws://127.0.0.1:37891/ws` 对应的本地 relay；
2. relay 不存在时以 detached 后台进程自动启动它；
3. 把当前这个 Pi runtime 注册为 `main` room 的唯一 host；
4. 让 `http://127.0.0.1:37891/` 显示实时 transcript、thinking、工具状态、当前会话和当前项目的历史会话。

本地 relay 会继续作为后台进程运行；需要停止时执行：

```powershell
pnpm relay:stop
```

不想让某次 Pi 连接 Pi Cafe Space，可以使用：

```powershell
$env:PI_COLLAB_ENABLED = "0"
pi
```

或者在 Pi 内执行 `/collab-disconnect`。`scripts\start-pi.ps1` 仍可用于显式指定 relay、room 和 host token，但它现在调用的也是普通 `pi`，不会再重复加载扩展。


## 手动/首次本地启动

要求 Node.js `>=22.19.0` 和 pnpm 10。首次准备项目并把扩展安装到 Pi：

```powershell
cd C:\Users\dp\Documents\cafecodework-pi-packages\pi-cafe-space
pnpm install
pnpm build
pi install C:\Users\dp\Documents\cafecodework-pi-packages\pi-cafe-space\packages\pi-extension
```

随后推荐直接使用上面的普通 `pi` 自动模式。也可以先手动启动 relay，再打开 Pi：

```powershell
.\scripts\start-relay.ps1
.\scripts\start-pi.ps1
```

默认页面：

```text
http://127.0.0.1:37891/
```

本机打开时页面自动使用 loopback 开发 client token；从手机或其他机器访问时必须输入显式 client token。

## 局域网测试

要让手机访问，relay 必须显式绑定局域网：

```powershell
.\scripts\start-relay.ps1 `
  -Bind "0.0.0.0" `
  -HostToken "真实随机 host token" `
  -ClientToken "真实随机 client token"
```

手机打开电脑的局域网地址，例如：

```text
http://192.168.1.20:37891/
```

默认 loopback 开发 token 不能用于 LAN 或公网。远程部署应使用 HTTPS/WSS、反向代理或 Cloudflare Tunnel。

远程或自定义 token 时，Pi 端也必须使用同一个 host token：

```powershell
.\scripts\start-pi.ps1 `
  -RelayUrl "wss://relay.example.com/ws" `
  -HostToken "同一个 host token"
```

## 验证命令

```powershell
pnpm check
pnpm test
pnpm build
```

当前包含协议单元测试和 relay WebSocket 集成测试。

## 重要边界

- relay 不拥有 Pi `AgentSession`。
- 同一个 room 只允许一个 Pi host。
- Web 客户端不会直接调用模型 provider。
- 历史会话由当前 Pi host 通过 `SessionManager` 提供；relay 不扫描电脑文件。Pi 退出后只保留 relay 已缓存的查询结果，relay 重启或缓存过期后需要再次启动 Pi 才能刷新。
- 当前 prompt 回执是 `dispatched`，不是 provider 完成回执，因为 Pi 0.84.4 的扩展 `sendUserMessage()` API 返回 `void`。
- relay 当前状态保存在内存中；relay 重启后不会承诺跨重启 exactly-once。
- daemon 不是当前目标，不能与原生 Pi CLI 同时作为同一个 session owner。
