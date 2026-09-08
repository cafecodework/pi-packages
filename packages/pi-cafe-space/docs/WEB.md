# Web client

当前是一个零构建依赖的静态移动 Web 客户端，源码位于 `web/public/`，构建时复制到 `dist/relay/public/` 并由 package 内的 relay 提供。

功能：

- token 登录（token 优先放在当前 tab 的 `sessionStorage`，若浏览器策略禁止 storage 则只保留在当前页面内存；loopback 页面仅在没有已保存 token 时自动使用本地开发 token，旧 tab 中的自定义 token 会被保留）；room ID 不接受前后空白
- 连接指定 room，并在同一 room 的多个 Pi 实例之间切换；每个实例的 snapshot、事件、命令和结果都按 `hostId` 隔离
- 查看所选 Pi 实例的 snapshot、assistant/text/thinking/tool 事件
- 向所选 Pi 实例发送 prompt、steer、follow-up
- abort 和 thinking level 设置
- 断线自动重连并以 snapshot 恢复；host 替换期间显示“连接中”，不会使用尚未同步的新 session；若命令恰好撞上 relay 的 `HOST_NOT_READY` ready gate，客户端只保留该明确标记的请求，收到新的权威 snapshot 后更新 fence 再重试，不会隐式重放普通写命令
- 通过 relay 请求当前 Pi 项目中的目录和文本文件（服务端不直接读电脑磁盘）
- 查看当前项目的历史 Pi 会话和历史 transcript；host 断开后可继续读取 relay 内存中已经缓存的历史结果（relay 重启或 30 分钟缓存过期后需重新启动 Pi 刷新）

当前客户端不直接连接 Pi，也不包含任何 Pi API Key。命令携带 stream/session/project-root fence，结果带目标 `hostId`，因此切换实例、项目目录或页面重连后不会把旧结果渲染到当前实例。`PI_COLLAB_ALLOWED_ORIGINS` 只用于增加跨源浏览器 Origin；同源和兼容性的无 `Origin` 连接仍依赖 client token 认证。后续可替换为 React/Vue
等构建型前端，但必须保持同一 wire protocol。
