# 换机器继续开发

## 当前实现与边界

- 开发包：`packages/pi-cafe-space`。当前远程版入口见 [REMOTE_ACCESS](REMOTE_ACCESS.md) 和 [本轮验收](refactor/REMOTE_ACCEPTANCE.md)；[PROGRESS §57](refactor/PROGRESS.md) 保留此前本地版本的历史记录。
- 当前方向是 **Go Relay + React / assistant-ui Web**，不是旧 `web/public` 客户端。Café 风格、严格 CSP、房间 Hash URL、原生消息/工具、`/` 命令、`@` 文件引用、左侧统一会话管理已经接入。
- 左侧新建会话启动独立原生 Pi RPC，不切换现有客户端；后台实例支持关闭/重开，Pi 负责模型、工具和 JSONL，Relay 仅管理其自行创建的进程及登记。
- 后台进程所有权已包含 Windows Job Object 与 macOS/Linux POSIX supervisor 实现。本轮在 macOS arm64 实测了两个原生 Pi 0.99.1 实例的独立创建、改名、关闭与重开；Linux/Windows 新远程版仍需在目标平台进行运行验收。交叉编译不等于运行验收。
- 本轮 Mac 远程版：主 TS 504、Web 121、Go 全部及 remote/managed/service race 通过；真实 Chrome 多客户端、WebRTC 直连、权限/控制接管/撤销通过。主包使用包内 Vitest 4.1.11，不使用根目录旧版本。此前 Windows 的 Web 101、37 项 Node guards 等是历史记录，不冒充本轮结果。
- 历史 PROGRESS 曾记录外部 provider 请求 HTTP 403 后停止。本轮未发送真实 provider 请求，也不将其他报告目录自动纳入本轮结论。生产切换 R19、真实 provider 调用、自动修改全局 Pi 配置均不属于拉取后的默认操作。

## 从干净仓库构建

本轮 Mac 工具链：Node **24.0.2**、Go **1.26.2**、TypeScript **5.9.3**、包内 Vitest **4.1.11**、Vite **6.4.3**。历史 Windows 工具链为 Node **22.23.2**、npm **11.16.0**、Go **1.24.2**。Windows 使用本机 Git/Node/Go，不把 WSL 工具链混入同一 Windows 工作树。新机器自行安装工具链；仓库不含原电脑 `.refactor/toolchains`。

```sh
# 仓库根目录：使用根 package-lock.json 安装整个 npm workspace
npm ci

cd packages/pi-cafe-space
npm run check
npm test -- --maxWorkers=2
npm run refactor:web:check
npm run refactor:web:test -- --maxWorkers=2

cd relay
go test ./...
cd ..

# 正确的 Go + React 候选构建/打包入口
npm run refactor:pack
```

`refactor:pack` 会构建 React、生成嵌入资源、运行 webembed Go 测试、构建当前平台 Relay、编译扩展并检查精确发行文件清单。结果在 `.refactor/release/package/` 和新生成的 `.refactor/release/pack-*/`；本机试用不自动部署。

不要用旧的 `npm run build`/根 `pi-cafe-space:build` 代替：它们仍保留 TS Relay/旧静态 Web 的生产入口。不要单独用 `vite build` 绕开发行构建：候选依赖构建脚本注入的 HashRouter-only 检查。生成文件不提交，修改源文件后重新构建。

Windows 的额外确定性检查（先完成 pack）：

```sh
node --test --test-concurrency=1 scripts/refactor/*.test.mjs scripts/refactor/local-registration/*.test.mjs
```

其中 launcher 测试会启动并清理自有测试进程，source-build 测试会执行隔离源码构建。Go `-race` 需要配置本机兼容 C 编译器；可参考 `scripts/refactor/verify.ps1` 的 `-Compiler`/`-NodeDirectory` 参数。真实 Pi loader 回归可显式设置 `PI_CAFE_TEST_PI_ROOT`，未设置则该项 skip。

## 启动与后台配置

- 普通 UI/Relay 调试可直接启动刚构建的 `.refactor/release/package/dist/relay/bin/windows-amd64/pi-cafe-relay.exe`。入口配置为 `PI_COLLAB_HOST/PORT/HOST_TOKEN/CLIENT_TOKEN/ALLOWED_ORIGINS`；不要复用公开开发 token 做后台管理。
- 独立新建需要另设 **`PI_COLLAB_MANAGED_CONFIG`**，按 [配置文档](MANAGED_SESSIONS.md) 填写新机器的 Node、Pi CLI、候选扩展、agent/state 目录和项目白名单。原生 Pi **0.99.1** 已验证；workspace 锁定的 SDK 版本不代表后台 CLI 支持相同参数。
- 在新机器原生 Pi 中自行配置 provider/凭据。设置文件、密钥、会话、后台登记不是源码，也不会随 Git 迁移。不要把它们放入已跟踪文件。
- 如需真实原生后台专项测试：完成 pack 后，在 Windows 显式执行 `node scripts/refactor/managed-native.mjs --allow-native --pi-root <本机Pi包目录>`。它使用临时项目/agent/state、随机 token/端口和离线合成 provider。
- `cafe-ui-browser.mjs` 是原电脑的显式浏览器验收脚本，依赖 Chrome SxS、独立调试端口和本机试用 HTTP/CSP；不是通用的一键新机器安装器。运行前检查路径、端口和独立 context 约束，不附着用户浏览器。

## 哪些内容不会随 Git 迁移

被忽略的 `.refactor/`、`.runtime*/`、`dist/`、`relay/internal/webui/assets/`、依赖目录和本机 `.env` 均不提交。因此：

- PROGRESS/CANDIDATE 内的 `pack-*`、部署 receipt、截图、日志和 PID 是原电脑历史证据，不会在新 clone 中出现；新机器重新构建会生成自己的候选包和摘要。
- `scripts/refactor/` 中的构建、测试、fixture 和接线源码已提交，但实际试用目录、provider 密钥、client/host token、Chrome profile、Pi 历史与全局 `.pi/agent` 不提交。
- **不要直接运行 `manual-install.mjs` 或 `local-registration/setup.mjs prepare/activate` 来迁移。** 它们保留了原电脑的一次性安装路径/旧包哈希和 owner 前置条件，不是可重复的通用安装命令；`local-registration/smoke.mjs` 也需先检查本机路径。
- 项目级 `.pi/skills/shadcn`、`.pi/skills/migrate-radix-to-base` 与 `skills-lock.json` 是已安装的开发参考，随源码保留；原电脑全局 Café/assistant-ui 等 skills 不在本仓库。

## 接下来从哪里看

| 范围 | 入口 |
| --- | --- |
| 后台进程、锁、配置/API 边界 | `relay/internal/managed/` |
| HTTP/WS 服务组装 | `relay/internal/service/service.go`、`relay/internal/httpserver/server.go` |
| 左侧新建/关闭/重开及结果过期保护 | `web/src/features/history/ManagedSessions.tsx`、`web/src/services/http/workspace.ts` |
| 原生会话/命令/文件能力 | `src/extension/index.ts`、`src/extension/file-commands.ts` |
| 协议与测试向量 | `src/protocol/`、`relay/internal/protocol/`、`protocol/fixtures/` |
| 候选发行与精确文件清单 | `scripts/refactor/build.mjs`、`release.mjs`、`pack.mjs` |

尚未实现：会话删除、未加载历史直接改名、跨会话草稿保留、`#` 输入能力。远程版跨平台进程所有权已有实现，实际验收范围以 REMOTE_ACCEPTANCE 为准。后台上限为 8 个运行实例 / 100 项登记，不自动淘汰；修改上限或删除语义前要保留幂等创建、原生持久化和进程所有权边界。
