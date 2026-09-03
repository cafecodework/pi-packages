# Relay server

`src/relay/` 是 Pi extension 与浏览器客户端之间的传输边界。它不拥有 `AgentSession`，也不读取或写入 Pi session JSONL。当前版本在内存中保存 room、最新 snapshot、命令去重状态和 host 返回的历史查询结果；历史缓存 30 分钟后过期。

## Local start

从父仓库根目录执行：

```powershell
cd C:\Users\dp\Documents\cafecodework-pi-packages
npm install
npm run pi-cafe-space:build
npm run pi-cafe-space:relay:start
```

relay 默认监听 `127.0.0.1:37891`，并从 `dist/relay/public/` 提供 Web 客户端。package 安装到 Pi 后，普通 `pi` 也会检查该地址，并在需要时启动 relay。

Pi extension 使用 `PI_COLLAB_RELAY_URL`、`PI_COLLAB_ROOM` 和 `PI_COLLAB_HOST_TOKEN`。浏览器使用登录表单中的 client token。LAN 或公网部署必须设置非默认高熵 token，并显式配置 `PI_COLLAB_HOST` 和 `PI_COLLAB_ALLOWED_ORIGINS`。
