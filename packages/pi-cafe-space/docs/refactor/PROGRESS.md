# 重构执行进度

> 当前状态：**R00/R01 已完成；按用户最新“落地功能”指令连续实施，R02–R04 已完成；R05 已通过原生 Windows race 验收，工具链阻塞已解除；R06/R07 已完成，R08 已完成真实 HTTP/WS/hub 的 v1 验收；R09 已按用户批准修复依赖并完成隔离Web骨架/构建/测试；R10连接层、R11 CollabStore/CommandGateway已完成，当前进入R12 parts契约证据核对。剩余范围授权仍有效。**
>
> 授权范围：完成 R01 遗留项后依次实施 R02–R17 及 R18.1 确定性验收，不需逐项重新授权；不含真实 Pi/Chrome/模型额度/candidate 安装专项权限、R19 生产切换或全局配置操作。用户后续“提交和push”单独授权提交、推送当前已完成的改动，不扩展运行/切换权限。规则见 [执行入口](../REFACTOR_EXECUTION.md)。

## 1. 状态定义

- `todo`：未开始，不代表前置条件已满足。
- `doing`：已获授权并有进行中的修改，尚未通过全部验收。
- `blocked`：缺工具、基线失败、协议差异、未获授权等，不能自动绕过。
- `needs_review`：存在需要用户/外部决策的实质未决事项，不用于普通自检检查点。
- `done`：任务验收及内置检查通过并有证据；不要求逐项人工批准。

## 2. 任务表

| ID | 任务 | 状态 | 证据 / review |
| --- | --- | --- | --- |
| R00 | 现场与基线 | done | [BASELINE.md](./BASELINE.md)；三项现有检查退出码均为 0，65 tests passed |
| R01 | 版本/API 核对 | done | [VERSIONS.md](./VERSIONS.md) 第 8 节；28 个精确版本 tarball 字节与 registry SRI 全部一致 |
| R02 | v1 fixtures | done | 307 pure fixtures + 17 traces + coverage assertion；325 新测试通过；原 65 项不回退 |
| R03 | Go 配置/纯协议 | done | Go module/config/codec/reducer；307 shared fixtures、Go tests/vet 通过；fuzz 845418 次无失败 |
| R04 | Gin HTTP | done | HTTP/headers/assets/admission、44 个 TS 来源 Origin 用例、Go tests/vet 与 TS 回归通过 |
| R05 | WebSocket transport | done | 普通 tests/vet；Windows 全量 race 与 transport race 重复 30 次均退出 0 |
| R06 | room/host 投影 | done | 四条 frozen host traces；admission/expiry/compaction/queue tests；全量 race 与 hub race 10 次通过 |
| R07 | command/cache | done | 14 条共享 hub traces、命令预算/容量/竞态测试、全量及 hub 10 次 race 通过 |
| R08 | Go v1 验收 | done | TS synthetic peers 对真实 Go HTTP/WS 跑17 traces，普通/race均18 tests通过；全量race/fuzz/lifecycle通过 |
| R09 | Web 骨架 | done | Node22/Vitest4、workspace audit0、Web check/2 smoke/build、旧391 tests通过 |
| R10 | RelayClient | done | generation/认证/重连/HTTP/storage/StrictMode；Web6 files11 tests通过 |
| R11 | store/Gateway | done | Web9 files28 tests、原391+325 contracts、Node22/Vitest4真实Go race traces18 tests通过 |
| R12 | parts 契约审查 | doing | 先核对已安装Pi源码/types/最小无模型事件实验；尚无新producer |
| R13 | parts 投影链 | todo | 未实施 |
| R14 | assistant-ui 对话 | todo | 未实施 |
| R15 | Composer/页面 | todo | 未实施 |
| R16 | embed/build/package | todo | 无新二进制/发行候选 |
| R17 | 本地启动迁移 | todo | 旧默认启动路径未改变 |
| R18 | 全链路验收 | todo | 无新版本真实 Pi 验收证据 |
| R19 | 显式生产切换 | todo | 未授权；旧实例不得自动停止 |

## 3. 已知条件与未决事项

1. 当前生产默认入口仍是原生 DOM Web + Node/TypeScript Relay + 原生 Pi TypeScript extension；Go Relay和React客户端在隔离迁移目录实施，尚未生产切换。
2. R03/R09已实际安装、锁定并验证Go/Web依赖；R09经用户批准调整了安全修复版本和隔离Node/npm工具链，历史R01候选证据仍保留但不是当前全部安装版本。
3. 有序 parts 默认方案仍需 R12 检查已安装 Pi 事件字段与次序；这是审查门槛，不让执行 AI 自行猜测后跳过。
4. 旧工作已有测试和提交记录，但不能代替 R00 当前基线或 R18 新产物证据。
5. GitHub push 此前受认证限制；本规划不授权 commit/push，不处理凭据。
6. 历史 native Pi / 模拟 host 验收只代表当时产物；没有自动继承到 React/Go 版本。
7. 所有进程 PID/启动时间必须运行时重新核对。本表故意不提供可以直接拿来 kill 的历史 PID。

## 4. R01 原交接记录（历史）

以下保留当时状态与授权规则，不作为当前审批要求；后续 review 发现来源/integrity 记录未补齐。当前状态以任务表及第 7 节为准。

```text
任务/子步骤：R01 — 固定版本、API 和未决事项
授权来源：用户明确要求继续此前 R01；按执行入口只执行 R01
状态：needs_review
基线 HEAD/工作区情况：cf20beaf65097173b78a632a79df615b9576e5ce；main ahead of origin/main by 1；保留既有规划文档修改，未覆盖
修改文件：packages/pi-cafe-space/docs/refactor/VERSIONS.md；本文件
验证命令及退出码：文档结构/链接/敏感模式检查（0）；git diff --check -- packages/pi-cafe-space/docs/refactor/VERSIONS.md packages/pi-cafe-space/docs/refactor/PROGRESS.md（0）
实际测试数/失败数/skipped 数：无代码测试；R01 未安装依赖、未建 Go module、未 build、未启动服务
证据路径：packages/pi-cafe-space/docs/refactor/VERSIONS.md；R00 baseline 与临时 assistant-ui tarball/Go module cache（均为外部或既有证据，不提交）
未验证项：安装后的 npm peer resolution/lockfile；R09 本地 assistant-ui 类型；R03 实际 Go module/build；真实 Pi、浏览器、WS 故障矩阵；ordered parts 的真实 Pi 字段与顺序
进程/临时目录归属与清理：本轮未启动或停止进程；未修改 session、PID marker、dist、用户配置；assistant-ui tarball 与 Go module cache 位于仓库外
review：未完成；必须由 reviewer 确认版本/API 记录后才可授权 R02 或依赖安装任务
下一建议任务：等待 R01 review；review 通过后由用户单独授权 R02
```

## 5. 每轮更新模板

在本节追加脱敏记录，并同步任务表。不要复制完整聊天/工具输出或密钥：

```text
任务/子步骤：
授权来源：用户指定的单任务或连续范围；当前任务及剩余范围
状态：
基线 HEAD/工作区情况：
修改文件：
验证命令及退出码：
实际测试数/失败数/skipped 数：
证据路径：.refactor/reports/Rxx/...
未验证项：
进程/临时目录归属与清理：
检查点：自检/独立检查的实际方式、证据、结论及未决项（不冒称外部批准）
下一步：范围内继续的任务；或范围结束/需用户决定的阻塞
```

## 6. R00 交接记录（历史，当时采用单任务授权）

```text
任务/子步骤：R00
授权来源：用户消息“开始执行”；按入口解释为首个任务 R00
状态：done
基线 HEAD/工作区情况：cf20beaf65097173b78a632a79df615b9576e5ce；main ahead of origin/main by 1；R00 开始前已有规划文档未提交修改，未覆盖
修改文件：packages/pi-cafe-space/.gitignore（加入 .refactor/）；docs/refactor/BASELINE.md；本文件；.refactor/reports/R00/evidence.txt（ignored）
验证命令及退出码：npm.cmd run typecheck (0)；npm.cmd run pi-cafe-space:check (0)；npm.cmd run pi-cafe-space:test (0)
实际测试数/失败数/skipped 数：6 test files passed；65 passed；0 failed；0 skipped
证据路径：packages/pi-cafe-space/docs/refactor/BASELINE.md；packages/pi-cafe-space/.refactor/reports/R00/evidence.txt
未验证项：Go/Gin/Gorilla API parity；React/Vite/assistant-ui；真实 native Pi；新 Go/Web candidate；浏览器 E2E；远程/故障/发布矩阵
进程/临时目录归属与清理：本轮未启动或停止进程；未修改 session、PID marker、dist、用户配置；.refactor 报告为本轮生成并已被忽略
review：R00 无独立 review gate；R01 仍待用户授权
下一建议任务：R01（只建议，不自动执行）
```

## 7. 执行方式修订

- 授权来源：用户要求“改一下方案 不需要每次都中断去review”。本次仅调整规划文档，不实施 R01 证据修复、R02 或其他业务任务。
- 新规则：可一次授权连续范围，逐项实施、验证、完成内置检查并记录后继续；不因普通 review 检查点暂停。单任务授权仍只做一项。
- R01：此前 review 未通过，原因是 npm 来源/integrity 记录不完整；由 `needs_review` 改为 `doing` 表示仍有未完成工作，并非豁免问题或宣布通过。后续获准执行时先补证据、复验，再在授权范围内推进。
- 仍需停下：实质工具/测试阻塞、无法证明的 API 行为、协议/安全策略变化、越出授权范围。真实 Pi/Chrome/模型额度与 candidate 安装需专项授权；R19 切换/移除旧实现仍按两个明确授权检查点执行。
- 同步文档：执行入口、TASKS、CONTRACTS、PROGRESS、VERSIONS 的状态/交接措辞，以及 Web/Go 两份架构方案的执行说明；未调整技术选型、版本候选、协议、资源上限或测试验收项。
- 验证：Python 文档检查覆盖以上七份文件的严格 UTF-8、代码围栏、相对 Markdown 文件链接和尾随空白，退出码 0；`git diff --check` 退出码 0。旧审批措辞扫描仅在明确标为历史的 R01 交接中保留原要求，现行规则已改为内置检查。
- 无业务代码/manifest/lockfile 修改，无依赖安装、构建或代码测试，无服务/进程/配置操作，无 commit/push。

## 8. 执行方案 review 问题收尾

- 授权来源：用户在方案 review 后要求“你直接落地和完成吧”；本轮落实两处规则修正，不扩大到业务实施。
- 修改文件：`docs/REFACTOR_EXECUTION.md`、`docs/refactor/TASKS.md`、本文件。
- 差异处理：TS/Go 不一致先按冻结基线与 fixtures 修复、复验；只有语义未决、无法兼容或需要协议/安全策略变化才请求用户决策，不改 golden 迁就实现。
- 切换权限：R18 专项权限与 R19.1 接线权限可提前授予；R19.2 必须在接线和新版本验证后取得用户可用性确认及清理同意，提前授权不能代替。
- 检查方式：执行者直接核对入口与任务卡的一致性，不冒称独立 reviewer 批准；此前辅助子代理超时，不作为审查通过证据。
- 验证结果：Python 检查七份方案文档的严格 UTF-8、代码围栏、相对文件链接、尾随空白及两项规则一致性，退出码 0；`git diff --check` 退出码 0。两项 review 问题已修正，方案修订完成，不再等待例行审批。
- 本轮只做文档修正，R01 仍有来源/integrity 证据待补，R02 及以后未实施。未安装依赖、运行构建/代码测试、操作服务或 commit/push。

## 9. 连续实施：R01 收尾 → R02

- 授权来源：用户澄清“我的意思是落地功能 而不是停在方案上”；进入功能实施，不再为普通 review 中断。剩余授权范围见顶部。
- R01（2026-09-18 UTC）：补齐 VERSIONS 的固定来源 URL 展开规则、28 行 SRI 与实际下载字节核对结果；Python urllib/hashlib 查询校验退出码 0。无依赖安装/lockfile/Go module 修改。执行者内置检查通过，不冒称外部审批。
- R02：只增加协议说明、共享 fixtures、TS fixtures runner 和 package 的 contracts test 脚本；原 TS/Node/DOM 实现只读，当前 dist/服务不动。

## 10. R02 验收（2026-09-18）

- 修改：`protocol/v1/{README.md,compatibility.md,limits.json}`；`protocol/fixtures/v1/{values,codec,reducer,budgets}.json` 与 17 条 traces；`src/protocol/fixtures.test.ts`；package 新增 `refactor:contracts:test`；本进度。
- 验证：原生 PowerShell 执行根 `npm.cmd run typecheck`、`npm.cmd run pi-cafe-space:check`、`npm.cmd run pi-cafe-space:test`、`npm.cmd run refactor:contracts:test --workspace=@cafecodework/pi-cafe-space`，全部退出 0。7 files / 390 tests passed，contracts 325 passed，0 failed/skipped。`git diff --check` 与 6 份基线源 SHA-256 核对通过。
- 证据：`.refactor/reports/R02/final.txt`；先失败证据 `red.txt`（缺 fixtures）及 `fixtures-first.txt`（节点预算计数更正，详 compatibility）；受控验证脚本 `check.ps1`。生成 helper 不作为更新 golden 的机制。
- 内置核对：逐项 schema、已知 JSON 差异、路由/缓存/替换/seq/超时 traces 与 TS 源对照；不让未来 Go 决定预期。辅助 inventory 子代理超时未产生结论，不作为证据。
- 未验证：Go parity/race、真实 Pi/Chrome、发布产物；这些是后续任务。不声称原生 DOM 所有边界已有 portable fixtures，limits 中区分来源盘点与已测层。
- 资源：仅测试自己的 loopback port 0 listeners/synthetic WS，finally 关闭；未操作现有 Pi/Relay/Chrome/dist/session/marker。
- 下一步：按已有连续授权进入 R03，无需用户再次 review。

## 11. R03 验收与环境缺口（2026-09-18）

- 修改：`relay/go.mod`/`go.sum`，纯 `internal/{protocol,config}` 及测试，`cmd/pi-cafe-relay/main.go` 最小入口。入口明确不启动尚未接好的 transport，不冒充成品。Gin 1.11.0 / Gorilla 1.5.3 的直接 module sums 已固定。
- 协议：独立 JSON parser 保留 JS duplicate-key/IEEE-754/isolated-surrogate 语义；迭代解析未知深嵌套避免递归栈及额外拒绝条件。已实现 DecodeWire/EncodeWire/ApplyEvent/FitCommandResult；不依赖 Node、Gin、Pi。
- 验证：原生 Go 1.24.2；`go test -v ./...`、`go vet ./...` 退出 0；307 pure fixtures 全部等价。`go test ./internal/protocol -run '^$' -fuzz '^FuzzDecodeWire$' -fuzztime 30s -parallel 2` 退出 0，845418 executions，无失败。结果不代表证明无漏洞。
- 证据：`.refactor/reports/R03/{check.txt,fuzz.txt,modules.txt}`；受控原生 PowerShell 脚本同目录。R03 没有运行服务。
- 提前探测 race：默认 `go test -race ./...` 退出 2，提示 requires cgo。以已安装 clang 仅在子进程设置 CGO_ENABLED=1/CC=clang 重试退出 1：MSVC target 不支持 `-mthreads`；gcc 不在 PATH。日志 `stress.txt`、`race-clang.txt`。未安装编译器、未改全局配置或降低测试要求。
- R03 规定的 test/vet/fixtures 已通过；R04 HTTP 可继续。R05/R08 race 验收仍需用户提供/允许安装受支持的 Windows C 工具链，不能把这项记为 pass。

## 12. R04 验收（2026-09-18）

- 新增 `relay/internal/{httpserver,auth,webui}` 与测试：Gin 精确 HTTP routes/no redirect/no trusted proxies；GET/HEAD health/config；逐 URL 资产允许清单、4MiB/16MiB/256 限制；只读复制；header/body/time/512 connections admission；无资产明确 503，无磁盘 fallback。candidate main 接入 HTTP 和有界 shutdown，现有 launcher 不变。
- Origin：从未改动的 TS normalizeConfiguredOrigin 提取 44 个 synthetic 预期；Go 修复 IPv4 数字变体、IPv6 mapped、IDNA、转义 hostname 和 dot-segment normalization 后全部通过。配置层复用同一 pure normalizer，是范围内 R03 回归修复，不改 TS 行为。Go module 增加 Gin 的锁定传递依赖及 x/net 0.42.0（Gin 已要求）；Gin/Gorilla pin 未变。
- 验证：`go test -v ./...` / `go vet ./...` 均退出 0；原生 TS typecheck/check/test 和 contracts 均退出 0（7 files / 390 tests，contracts 325，0 failed/skipped）。`git diff --check` 通过，旧 runtime 与根 lockfile 无 diff。
- 证据：`.refactor/reports/R04/{check.txt,origins-red.txt,ts-regression.txt}`，来源提取 helper `origins.mjs`。测试仅创建/关闭自己的 loopback listener，不运行 candidate main 或现有服务。
- 新 HTTP 请求体拒绝/encoded asset path 拒绝/headers 超限为既定 Go 加固边界，不冒充旧 Node 每项行为；HTTP parser 层 431 由 net/http 发出，应用错误响应有完整安全头。
- 未验证：race（见 R03 工具链缺口）、WS/hub、生产 embed/React 页面。按授权继续 R05 实现与普通测试，race 未通过不得标 R05 done 或推进依赖任务。

## 13. R05 实施与实际阻塞（2026-09-18）

- 已新增 `relay/internal/transport/{session.go,session_test.go,failure_test.go}`：Gorilla upgrade、禁压缩、Origin gate、单 reader/data writer、128 个/1MiB 双限额（包括 in-flight）、入/出帧 256KiB 上限、分片累计检查、binary 1003/error、非法 UTF-8 1007、超帧 1009、5s hello gate、ping/pong、写 deadline、慢端 1013、关闭 watchdog 与队列额度回收。
- Gin 只通过显式注入 handler 接入 `/ws`；main 尚不注入协作 handler（room/hub/hello 业务仍属于后续任务），不能作为已完成的协作 Relay 使用。transport 不做房间/模型/工具操作，`MarkAuthenticated` 仅由 reader callback 在上层验证 hello 后调用。
- 真实 loopback Gorilla 测试覆盖空帧/刚好 256KiB、binary/非法 UTF-8/超帧、分片、hello deadline、并发 Send/Close 与资源结束。窄 connection 测试接口注入 blocked writer，验证写失败/重复 close/context cancel 均回收 reader/writer 和 pending bytes；生产仅创建 Gorilla connection。
- 原生 `go test -v ./...` 与 `go vet ./...` 退出 0，transport `go test ./internal/transport -count 30` 退出 0。后者只是重复性检查，**不是 race detector 的替代品**。日志 `.refactor/reports/R05/{final.txt,repeat.txt}`。
- 最终源码检查：50 个新增/相关文件 UTF-8、尾空白、JSON、Markdown links/fences 通过；六个旧 source SHA-256 与 R02 清单一致；28 个 SRI 值完整；`git diff --check` 通过。helper 为 `.refactor/reports/R05/verify.mjs`，不执行业务实现/更新 golden。
- **阻塞原因**：原生 Go `CGO_ENABLED=0`，无可用 GCC；只对测试子进程设置 CGO_ENABLED=1/CC=clang 后，现有 clang 的 Windows MSVC target 拒绝 `-mthreads`（R03 日志）。尚未安装编译器、改系统 PATH 或其他全局配置；R05 必需的 `go test -race` 没有通过，不标 done，不进入依赖它的 R06。
- **下一步所需外部操作**：用户允许在 `.refactor/toolchains/` 下载/解压兼容 Windows Go race 的便携式 MinGW-w64，并仅对测试子进程配置 CGO/CC；或者提供已安装且兼容的编译器路径。该问题是新增工具链操作授权，不是重新申请 R06–R17 的任务或 review 授权。
- 安全边界保持：没有启动真实 Pi/Chrome/candidate main，没有模型消耗，没有覆盖 dist/旧 launcher/进程标记，没有 candidate install、commit/push 或生产切换。React/room/hub/ordered-parts/embed 尚未实施，不能宣称范围内功能全完成。

## 14. R05 工具链解阻及验收（2026-09-18）

- 用户明确“允许”下载便携式 MinGW-w64 到 `.refactor/toolchains/`，仅供测试子进程，不授权全局配置变更。安装使用 WinLibs GCC 14.2.0 / MinGW-w64 UCRT 12.0.0 r3，来源 `https://github.com/brechtsanders/winlibs_mingw/releases/tag/14.2.0posix-12.0.0-ucrt-r3`，无 LLVM 的 x86_64 posix seh zip。
- 246962421 字节 zip 的 SHA-256 `88868d745b807f083a117ff69348d8bc021ad7389aa503379dbed1866efcaeb9` 及 SHA-512 均与同一官方 release 的 checksum 文件一致（来源一致性校验，不冒充独立签名/漏洞审计）；解压前逐项限制路径/符号链接/数量/总字节。
- 初次原始长目录下 GCC 无法查找其自带 header；只把本次解压目录改名到 `.refactor/toolchains/gcc14/` 后恢复。未修改系统长路径策略、PATH 或 go env 持久设置。旧失败日志保留 `race.txt`。
- 原生 PowerShell 子进程设置 `CGO_ENABLED=1`、CC 指向便携 gcc，局部 PATH 加其 bin 并在 finally 还原。`go test -race -count=1 ./...` 与 `go test -race -count=30 ./internal/transport` 均退出 0，无 race 报告、失败或 skip。
- 证据 `.refactor/reports/R05/{toolchain.py,toolchain.json,race.ps1,race-short-path.txt}`。编译器及 archive 均只在 ignored `.refactor/`，没有运行安装器或改当前服务。
- R05 验收缺口已关闭；按原连续授权直接进入 R06，不等待例行审批。后续 race 测试继续复用该隔离工具链。

## 15. R06 验收（2026-09-18）

- 新增 `relay/internal/hub/{hub,room,projection}.go` 及四份 tests：registry admission（512/128/32、rooms 256、hosts 64、clients 256）、每 room 单 writer、128 items/1MiB inbox、独立合并 close/control、128MiB 动态状态计账；Join/Handle/Leave/Close；注入 clock/ID；snapshot ready gate/replacement/旧连接隔离/seq fence/offline expiry/空 room 回收。
- 投影延续 Node 的 100 messages/24 tools/UTF-16 截断/261120 envelope budget、host 排序与 metadata 降级。为避免 Go UTF-8 字符串次序或 encoding/json 替换 isolated surrogate，protocol 只新增复用原算法的 ValueBytes/UTF16 工具，不改 codec 行为或 golden。压测发现反复全量序列化开销，改为同等 JSON 字节减计并复制保留 slices，避免保留已裁剪的 backing references。
- 同一四条纯 host traces（auth-and-role/duplicate-event-disconnect/snapshot-required-timeout/stale-snapshot）逐 FIFO/字段/绑定 ID/close 与 TS expected 对比；其余命令 traces 留 R07，binary/transport traces 留 R08 真实 WS 装配。不把 fake sender 当真实 Go WS 集成证据。
- 测试覆盖两个 room、多 host 同 session、replacement 旧 close、倒退 snapshot、context/seq 错误、snapshot timeout、offline TTL、room/host admission N+1、聚合状态预算、不可变投影、metadata 降级、并发 lifecycle、inbox count/bytes 饱和及 close/shutdown 配额释放。
- 原生 `go test -v ./...` / `go vet ./...` / `go test -race -count=1 ./...` / `go test -race -count=10 ./internal/hub` 均退出 0。首次未优化重复 race 外部 timeout 不是通过，确认没有遗留本次测试进程，优化后重新完整运行；最终证据 `.refactor/reports/R06/{final.txt,race-final.txt}`。
- TS typecheck/check/390 tests、325 contracts 回归退出 0（`ts-regression.txt`）。58 文件 UTF-8/JSON/Markdown/whitespace、六个 source digest、28 SRI 检查和 `git diff --check` 通过。sa-4 超时无可用结论，不作审查证据。
- R06 无真实服务/文件访问/模型操作；main 仍未接 hub。history 缓存失效/离线读取刷新和 pending 分支是 R07 工作；跨 room 全局缓存回收与实际 transport 计账在 R08 装配验收继续检查。
- 按连续授权进入 R07，不需新增任务授权。

## 16. R07 验收（2026-09-18）

- 新增 `relay/internal/hub/{command,cache}.go`、command tests；补 room snapshot/event/replacement/disconnect 的 cache/pending hooks。路由目标/legacy 选择/上下文 fences、tuple dedupe、client/host generation、15s pending、REQUEST_PENDING、128/32 pending 限额、路由后 bytes check、result fitting 均已实现。
- history 仅由 list/get 的匹配结果写入，按 projection revision 隔离；identity/branch/rename 变化清理，状态-only event 不误清；离线命中刷新两项 TTL，结果 replay 与 history cache 保留原顺序语义。results 1000/8MiB FIFO，history 20 项；缓存全局 64MiB 子预算，所有 pending/result/history 同时计入动态 128MiB，关闭释放有断言。
- 共享 fixtures：14 条 hub traces FIFO/严格字段/绑定 ID/close 全通过（其余3条仅 transport，由 R08 接入）。增加 per-host/per-client pending N+1、COMMAND_TOO_LARGE/RESULT_TOO_LARGE、history revision 与 client delivery fence、cache count/bytes/FIFO/清理、result/close/timeout 20 轮竞态只完成一次。
- 原生 `go test -v ./...`、`go vet ./...`、全量 `go test -race -count=1 ./...`、`go test -race -count=10 ./internal/hub` 退出 0，无 race 报告。证据 `.refactor/reports/R07/{red.txt,final.txt,race.txt}`。61 文件结构检查/六个旧 source digests/28 SRI/`git diff --check` 通过。
- 下一步 R08：装配真实 WS，检查 control/error 发出次序、聚合 queue 预算/全局回收与 shutdown，不能把 fake sender trace 通过说成完整 Relay 已验证。旧服务、dist、launchers 未动。

## 17. R08 装配、差异核对与验收（2026-09-18）

- 新增 `relay/internal/service/` 装配 HTTP/Origin/pre-upgrade admission/transport/hub，main 接入候选服务（仅测试调用 run 使用 owned port 0/冲突端口，未运行 main 或默认37891）。新增 service/main lifecycle tests、transport queue/error ordering tests、`src/protocol/go-relay.test.ts` 和 `scripts/refactor/test-go-traces.ps1`。
- 对齐发现：transport close 原先可能丢掉已排队协议 error；修复为在1s close deadline内 best-effort flush 已 admitted 数据再 close，1013过载不强行 drain。增加测试明确 error 在 close 前到达。queue bytes 现与 hub 的128MiB动态预算统一，独立64MiB cache子预算不重复分配。全局容量失败用合并epoch触发各 room 回收可淘汰 cache/offline projections，不跨actor锁内等待；失败 admission仍明确拒绝，不丢 pending。
- 每条 trace 都启动专用 Go test binary 的 ephemeral loopback服务；TS 使用真实 ws 接口，严格 FIFO/全部字段/ID binding/close reason，对比未修改 R02 JSON；stdin测试clock控制仅编译在 `_test.go`，没有生产 HTTP 管理接口。finally关闭本轮 sockets/test child；测试binary验证shutdown后connections/rooms/bytes全零。普通TS测试不隐式构建/启动Go，独立script显式开启17条。
- 行为核对：307 pure codec/reducer/budget fixtures通过；17/17 WS traces通过：auth/role、binary、bad UTF-8、hello/snapshot timeout、duplicate event、stale snapshot、multi-host/room isolation、target/cwd fence、client/host replacement、command timeout、history dedupe/offline TTL/revision/result binding、防写命令污染缓存。TS与Go golden无更改、无已知fixture差异。
- 额外计划边界（非旧Node逐字节等价承诺）：HTTP body/header/path严格拒绝；application队列128项、room inbox128项/1MiB、全局64MiB cache/128MiB动态预算及压力回收；有界Go shutdown。JSON对象key排列不是wire语义；UTF-16身份排序已使用专用比较。未承诺全域WHATWG/任意JSON fuzz等价，只声明已测基线。
- 生命周期/压力测试：预upgrade32地址限额、恶意Origin/精确路径/失败upgrade无quota泄漏；8个hijack sockets shutdown收到1001；owned listen冲突不影响原listener；取消run退出；inbox饱和close可达；跨room压力回收；result/close/timeout竞态；所有测试只操作自己资源。
- 验证：原生 `go test -v ./...`/`go vet ./...`/全量`go test -race -count=1 ./...`；hub/transport/service/main `-race -count=10` 全部退出0。普通及race Go test binary各运行18个TS集成测试（17 traces+入口校验），全部通过。
- Fuzz `go test ./internal/protocol -run '^$' -fuzz '^FuzzDecodeWire$' -fuzztime 30s -parallel 2` 退出0，1343816 executions（不等于无漏洞证明）。原TS回归8 files/391 tests和325 contracts、root typecheck/package check全通过，0失败/skip。
- 证据 `.refactor/reports/R08/{final.txt,race.txt,runner.txt,fuzz.txt,ts-regression.txt}`；受控持久runner为 `scripts/refactor/test-go-traces.ps1 [-Race -Compiler <portable-gcc>]`。无provider/Pi session/项目文件读取；无浏览器/模型/生产launchers操作。
- 内置检查完成，进入R09。React/ordered parts/embed/真实Pi仍未完成或未验证，不把当前候选当最终成品。

## 18. R09 安装结果与新实质阻塞（2026-09-18）

- 使用原R01精确pins，原生npm默认peer resolver + `--save-exact --ignore-scripts`，未使用force/legacy-peer-deps，未运行workspace lifecycle/prepack/build。两次安装退出0；`npm ls --workspace=@cafecodework/pi-cafe-space --all --json` 退出0，非peer conflict。
- 安装改变package manifest及根唯一lockfile。本次367个新lock entries（含平台optional条目）均有registry HTTPS来源/integrity及许可证（MIT/ISC/MIT-0/Apache-2.0/CC-BY-4.0/BSD-2-Clause/BSD-3-Clause/0BSD）。既有依赖无版本更新/删除；npm顺带同步pi-subagent lock版本一项已精确恢复原值，其他变动仅为必要dev/peer分类。未修改其他workspace业务文件。
- **engine阻塞**：`@assistant-ui/core@0.3.19` 和 `assistant-stream@0.3.43` 各要求 `nanoid ^6.0.1`，其engine为 `^22 || ^24 || >=26`，不含现场Node23.11.0。即使锁回R01 core0.3.17/stream0.3.41也要求nanoid6，不能假称锁传递版本即可解决。Node22满足原最低22.19.0要求；建议仅测试子进程用便携Node22.23.2，不改系统Node/PATH、项目最低版本或跨major强制override。
- **audit阻塞**：当前7条汇总（1 moderate/5 high/1 critical），不是7个已证明可利用漏洞。新直接依赖axios/lodash-es/nanoid/react-router/vite均有advisories；critical来自原有Vitest3.2.4（GHSA-5xrq-8626-4rwp，<3.2.6）。旧Vitest3及其mocker还报告moderate，完全修复需>=4.1.11。没有自动运行npm audit fix。
- 待授权最小版本建议（只查registry，尚未安装/宣称兼容通过）：axios1.13.6→1.18.0，lodash-es4.17.23→4.18.1，nanoid5.1.6→5.1.16，react-router7.13.0→7.18.2，vite6.4.1→6.4.3；均在当前audit所有对应direct受影响range之外，保留major/技术栈。Vitest3.2.4→3.2.7可修critical并保持major，但moderate须显式记录/限定run模式（不开放测试UI/API/dev mock服务）；若要求这项也修复，应另准该package升级4.1.11并重跑测试，不能顺手升级其他workspace。
- **根lockfile跟踪缺口**：既有根`.gitignore:7`忽略`package-lock.json`，当前lock未跟踪，故git status不显示它。R09只授权根lockfile、不含根.gitignore；建议额外允许只将这条改为`**/package-lock.json`并加`!/package-lock.json`，保留根唯一lockfile可提交（仍不执行git add/commit/push）。未擅改忽略策略。
- 回归仍通过：安装后root typecheck/package check/8 files391 tests及325 contracts退出0；31个当前dist/旧Web文件SHA-256不变，六个旧源digest不变，67相关文件结构检查及git diff --check通过。没有Web config/shell/build，没有启动真实Pi/Chrome/生产Relay。
- 证据 `.refactor/reports/R09/{install.txt,dependencies.txt,tree.json,audit.json,added-dependencies.json,protected-digests.json,ts-regression.txt}`。audit JSON仅作为来源证据，PowerShell stdout转码有个别非ASCII乱码，不修改它来伪造结果。现有安装状态保留供后续精确调整，不回滚用户文件或清空node_modules。
- 需要用户确认上面版本/隔离Node/根.gitignore额外范围后继续原R09–R17/R18.1授权；不是例行review审批。assistant-ui安装后API验证、Web smoke/build仍未执行。

## 19. R09 解阻与Web骨架验收（2026-09-18）

- 用户“允许”批准第18节建议，选择Vitest4.1.11；只改package manifest、根唯一lockfile、根.gitignore锁文件例外、web新目录及进度/版本说明。Node22.23.2放ignored `.refactor/toolchains/`，SHA256匹配官方SHASUMS，系统Node/PATH未改。
- npm10.9.8/10.9.2遇Arborist null edgesOut（不是peer拒绝），使用隔离npm11.16.0且校验registry SRI，默认peer resolver成功。一次prefer-dedupe尝试导致根Vite/esbuild重hoist，已恢复原根7.3.6/0.28.2，批准Vite6.4.3局限package；npm重同步pi-subagent lock版本已精确恢复旧值。被移除的旧lightningcss为不再需要的optional graph，不改其他workspace manifest/runtime。
- assistant-ui smoke发现最新core0.3.19的optional-cloud导入失败；锁回R01已核对core0.3.17（仍满足react^0.3.17），将原依赖assistant-cloud0.1.43共享hoist后普通npm再次安装/peer tree通过。未添加应用Cloud服务或私有API。实际类型+渲染证明公共runtime/parts等导出可用，不只读取声明。
- 新增web/index、Vite/Vitest/tsconfig、React StrictMode+HashRouter、SCSS Modules/normalize、zh-CN/en i18n、独立web/static；2个DOM smoke验证语言切换/样式/不连接WS及assistant-ui公共API。所有产物到`.refactor/web`，旧public不变。package test补`--exclude web/**`防Vitest substring src筛入DOM套件，Web有独立runner，未删/skip旧测试。
- 验证：隔离Node22原生`refactor:web:check/test/build`退出0（2 files/2 tests，hashed JS/CSS，无maps）；root typecheck/package check/8 files391 tests/325 contracts退出0。workspace npm ls退出0，audit0；根其他workspace保留2 moderate，不冒称全仓安全清零。
- 31个旧dist/public文件SHA256不变、六个旧源digest不变；bundle扫描无node:fs/PiSDK/服务端ws/host token，根lock可被git跟踪但未add/commit。证据`.refactor/reports/R09/{node-toolchain.json,npm-installer.json,integrity-approved.json,web-api-final2.txt,final-regression2.txt,audit-approved.json,audit-root.json,check-bundle.mjs}`。
- R09完成，连续进入R10。页面目前明确显示未连接，不冒充完整聊天；没有真实Pi/Chrome/现有服务或模型操作。

## 20. R10 验收（2026-09-18）

- 新增web services relay/RelayClient、storage、http/client及4个测试文件：显式start/stop/resync、不在import连接，token只发hello，固定同源/ws，5s握手deadline、500ms–30s退避、限频固定notice、auth失败停重试；generation/socket双门控清理旧回调，sendCommand只允许认证/current generation，无写重放队列。
- sessionStorage四个旧key保留，bounded值、get/set/remove异常回退内存，logout不复活旧token；axios固定/api/config和/healthz、XHR adapter/5s timeout/取消/受限响应，无任意URL或Authorization。
- 测试覆盖双start、open不等于authenticated、stop/start旧callback、room变更/resync、invalid token显式恢复、bad JSON/binary/超帧/错误类型、deadline、send fence/不重放、storage SecurityError/quota、HTTP取消/恶意wsPath、StrictMode真实mount-cleanup-remount只有1个活socket。
- 原生隔离Node22 `refactor:web:check/test/build`退出0：6 files/11 tests，0失败/skip；证据`.refactor/reports/R10/{first.txt,final.txt}`。bundle/31旧产物digest/root工具版本检查和git diff --check通过。
- 连接层尚未接UI owner（R15装配）；store投影/具体command能力gate属于R11。继续原授权，无真实服务操作。

## 21. R11 验收（2026-09-18）

- 新增`web/src/state/{CollabStore,selectors,useCollabStore,compactSnapshot}.ts`和store tests，以及`services/relay/CommandGateway.ts`/tests。同步Immer Map投影、稳定per-host引用、单microtask通知；host inventory/legacy、snapshot readiness、seq/context异常resync、100 messages/100 tools/261120-byte envelope compaction、100条notice、20份/4MiB全页面历史LRU。
- Gateway完整原值scope/fence、先登记waiter再send、精确request/host/generation/view/data kind绑定、文件新请求优先；256/每host32上限及abort预留、8MiB字节记账、20s原deadline、本地取消不暗发abort。只读HOST_NOT_READY后新权威snapshot最多重试一次，使用新requestId但不延长deadline。离线只允许缓存历史命令；写回执不改变phase，HOST_TIMEOUT/replacement/offline等不确定结果报告unknown、不重放。
- R10联动修复：原生socket listener显式清理、重入stop/state及旧retry timer代次门控；追加真正axios XHR abort测试（send被stub，无网络请求）、退避上限和emoji UTF-8超帧测试。
- 原生Node22.23.2完整验收：Web check/test/build退出0，9 files/28 tests；根typecheck、package check与8 files/391 tests、独立325 contracts均通过；使用现有便携GCC的真实Go race bridge17 traces+runner检查共18 tests通过。这也补齐Vitest4升级后的真实Go/TS runner复验。
- 证据`.refactor/reports/R11/{first.txt,check2.txt,verification.txt,verify.ps1}`；31个旧dist/public SHA256、root工具版本、bundle检查和git diff --check通过。只读sa-5超时未产生可用结论，不作为审查证据；本记录依据源码对照和实际测试。
- 未接真实服务/模型，UI app owner尚在R15；无Pi/Chrome操作，Go runner只创建并清理自己的ephemeral listener/子进程。未改旧Web、生产dist、默认启动或全局环境。下一步连续执行R12字段/事件证据，再进入R13；不跳过parts gate。

## 22. R12 当前断点（doing，未放行R13）

- 已重新核对CONTRACTS §6/7和R12任务卡。当前全局Pi包metadata为`0.85.1`（本会话developer指定的pnpm路径），仓库供类型检查使用的`node_modules/@earendil-works/pi-coding-agent`仍为`0.84.4`。没有升级/改动二者，也没有启动真实Pi。
- 下一步必须完整阅读相关Pi docs并核对两版event types/agent-loop/extension转发和session content；以受控、无provider调用的最小事件实验建立contentIndex/message_end/tool execution证据，再写`PARTS_REVIEW.md`及parts fixtures。版本差异不是已证实的兼容故障，不能以旧版研究替代新版本核对。
- 当前没有新parts生产逻辑或新协议字段；R12尚未验收，R13–R18.1授权继续有效，不需要例行重新审批。真实Pi/Chrome/模型/candidate安装和R19仍不在本轮权限内。

文档编码、链接或空白检查不等于实现测试通过。
