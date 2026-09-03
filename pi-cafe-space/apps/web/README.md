# Web client

当前是一个零构建依赖的静态移动 Web 客户端，文件位于 `public/`，由
`@pi-collab/relay-server` 提供。

功能：

- token 登录（token 只放在当前 tab 的 `sessionStorage`；loopback 页面自动使用本地开发 token）
- 连接指定 room
- 查看 snapshot、assistant/text/thinking/tool 事件
- 发送 prompt、steer、follow-up
- abort 和 thinking level 设置
- 断线自动重连并以 snapshot 恢复
- 通过 relay 请求当前 Pi 项目中的目录和文本文件（服务端不直接读电脑磁盘）
- 查看当前项目的历史 Pi 会话和历史 transcript；host 断开后可继续读取 relay 内存中已经缓存的历史结果（relay 重启或 30 分钟缓存过期后需重新启动 Pi 刷新）

当前客户端不直接连接 Pi，也不包含任何 Pi API Key。后续可替换为 React/Vue
等构建型前端，但必须保持同一 wire protocol。
