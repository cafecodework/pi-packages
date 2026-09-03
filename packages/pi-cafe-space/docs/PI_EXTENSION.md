# Pi extension

`src/extension/` 是 Pi Cafe Space package 中由 Pi 加载的 host extension。构建后的入口是 `dist/extension/index.js`，并由 package 根目录 `package.json` 的 `pi.extensions` 声明。

在父仓库根目录构建并安装：

```powershell
cd C:\Users\dp\Documents\cafecodework-pi-packages
npm run pi-cafe-space:build
pi install C:\Users\dp\Documents\cafecodework-pi-packages\packages\pi-cafe-space
```

扩展默认在普通 `pi` 启动时连接 `ws://127.0.0.1:37891/ws`。如果 loopback relay 尚未运行，它会启动同一 package 中的 `dist/relay/index.js`。

使用 `PI_COLLAB_ENABLED=0` 可为单次进程关闭自动连接。远程或显式配置可使用 `PI_COLLAB_RELAY_URL`、`PI_COLLAB_ROOM` 和 `PI_COLLAB_HOST_TOKEN`。
