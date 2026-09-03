# Pi Cafe Space Relay Server

The relay is the transport boundary between the Pi extension and browser clients.
It owns no `AgentSession` and never reads or writes Pi session JSONL. The first
version keeps rooms, the latest snapshot, command deduplication state, and host-returned history query results in memory (history cache entries expire after 30 minutes).

## Local start

From `D:\\sh\\pi-collab`:

```powershell
pnpm install
pnpm build
.\scripts\start-relay.ps1
```

The server listens on `127.0.0.1:37891` by default and serves the mobile web
client at `http://127.0.0.1:37891/`. Once the extension package is globally
registered with Pi, a normal `pi` launch checks this endpoint and starts the
loopback relay as a detached process when necessary.

The Pi extension uses `PI_COLLAB_RELAY_URL`, `PI_COLLAB_ROOM`, and
`PI_COLLAB_HOST_TOKEN`. The browser uses the client token entered in its login
form. For LAN or public deployment, set non-default high-entropy tokens and
explicitly set `PI_COLLAB_HOST` and `PI_COLLAB_ALLOWED_ORIGINS`.
