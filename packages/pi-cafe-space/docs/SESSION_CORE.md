# Session core（后续）

当前 MVP 的 room、snapshot 和命令去重逻辑在 relay 内部。后续可将协议无关的事件投影、命令幂等、重放和 host fencing 抽到此包，供本地 relay 与服务器 relay 共用。
