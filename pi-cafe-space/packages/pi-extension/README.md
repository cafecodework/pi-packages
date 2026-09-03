# Pi Cafe Space Pi extension

This package connects the current native Pi runtime to the Pi Cafe Space relay.

After building the workspace, install it for the current Pi user:

```powershell
pnpm build
pi install C:\Users\dp\Documents\cafecodework-pi-packages\pi-cafe-space\packages\pi-extension
```

The extension is enabled by default for ordinary `pi` launches. For a loopback
relay it checks `ws://127.0.0.1:37891/ws` and starts the built relay as a
background process if it is not already healthy. Set `PI_COLLAB_ENABLED=0` to
opt out for one process. Use `PI_COLLAB_RELAY_URL`, `PI_COLLAB_ROOM`, and
`PI_COLLAB_HOST_TOKEN` for a remote or explicitly configured relay.
