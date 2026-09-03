# Daemon（后续可选）

当前不参与本地 MVP。未来如果需要让 Pi 不占据前台，可以在此实现独立
`AgentSession` owner，并让 Web/companion CLI 作为 relay client。

它不能和 `packages/pi-extension` 同时拥有同一个 Pi session；也不能直接启动
第二个 `InteractiveMode` 来附着已有 session JSONL。
