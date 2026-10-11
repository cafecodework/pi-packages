# Café Space · @cafecodework/pi-cafe-space

在手机、笔记本和协作者的浏览器中使用办公电脑上的原生 Pi。一台办公电脑的网关对应一个房间，房间里可以同时连接多个 Pi 实例；分享链接或二维码后，访客输入房间密码进入。

**当前实现是 Go Relay + React 网页 + Pi 扩展，不是终端画面转播。** 模型和工具由办公端 Pi 执行，网页接收结构化消息和状态。

[安装与自托管](docs/INSTALL.md) · [房间与二维码](docs/ROOMS.md) · [服务器部署记录](docs/DEPLOYMENT_SPACE.md) · [Café 账号与 SSO](docs/CAFE_SSO.md) · [开发交接](docs/DEVELOPMENT_HANDOFF.md)

## 使用方式

办公电脑安装 Pi、Café Space 扩展和房间网关，并保持网关在线。在 Pi 中输入 `/cafe` 或 `/cafe share`，即可复制房间链接、展示二维码；`/cafe open` 打开本机分享与设置页面。默认本机地址是 `http://127.0.0.1:37891/`，这个地址不是手机的远程入口。

手机或笔记本打开分享链接，例如 `https://space.cafecode.work/#/room/<roomKey>`。首次可以选择 Café 账号或访客，随后输入独立的房间密码。账号登录复用 cafecode.work，不需要再注册 Space 账号；登录或取消都会返回原房间。

**账号身份、房间密码和控制权审批是三件独立的事。** 账号登录不免除房间密码，也不自动赋予房主权限。审批默认关闭，通过房间密码的访客可以直接操作；房主开启审批后，在本机「分享房间 → 房间设置」或 Pi 的 `/cafe approvals` 中处理申请。批准不会自动发送访客草稿。

房间链接不含密码。昵称以 `昵称#ID` 显示；刷新、切换身份和批准恢复的具体规则见[房间指南](docs/ROOMS.md)。网页更新后刷新页面；扩展更新后，已有 Pi 在空闲时 `/reload`，不必结束正在执行的任务。安装扩展不会自动升级全局 Pi，事件能力取决于实际运行的 Pi 版本。

## 架构与职责

```text
手机／笔记本浏览器
  │
  ├─ HTTPS ─► Caddy
  │              ├─ Space 网页、房间登记、信令 ─► Go cloud
  │              └─ Café 登录、OIDC、应用会话 ──► identity
  │
  └─ WebRTC DataChannel ───────────────────────► 办公端 Go 网关
       直连优先；必要时经 TURN 转发加密流量              │
                                                   ├─ WebSocket ─► Pi 扩展 A ─► 原生 Pi 会话 A
                                                   └─ WebSocket ─► Pi 扩展 B ─► 原生 Pi 会话 B
```

| 组件 | 职责 | 不负责什么 |
|---|---|---|
| React 网页 | 会话呈现、文件浏览、模型设置、操作意图 | 不直接持有模型 API Key 或调用模型 |
| 云端 Go cloud | 提供嵌入的网页资源、房间登记与 WebRTC 信令 | 不在服务器执行办公端 Pi 任务，不存储房间密码 |
| identity | 复用主站账号，处理 OIDC、Space 会话和身份声明 | 不代替房间验密或房主审批 |
| TURN | 直连受限时辅助 WebRTC 传输 | 不执行模型任务，不代替登录或房间授权 |
| 办公端 Go 网关 | 验密、校验身份、审批与命令准入，连接本机 Pi | 不自行改写 Pi 会话历史 |
| Pi 扩展与原生 Pi | 上报真实消息／状态，执行命令；Pi 管理模型、工具和会话 | 不从终端屏幕或 OSC 文本推测执行结果 |

当前云端采用单实例、内存房间登记。已有 WebRTC 连接仍依赖信令与授权生命周期，cloud 重启会影响房间连接，客户端需要重连；不要把 P2P 理解为服务器可以任意停机而连接完全不受影响。

## 从源码构建与安装

源码构建需要 Node.js `>=22.19.0`、npm，以及满足 [`relay/go.mod`](relay/go.mod) 要求的 Go 工具链。预构建 Go 程序本身无需 Node／Go 运行时；Pi 扩展仍需要 Node 和单独安装的 Pi CLI。

从仓库根目录安装锁定依赖，再进入包目录：

```sh
npm ci --ignore-scripts
cd packages/pi-cafe-space
npm run build
```

`build` 生成当前平台的可安装目录 `.refactor/release/package`。需要交付归档，或同时构建服务器与其他办公端平台时：

```sh
npm run pack -- --platforms linux-amd64,windows-amd64
```

命令输出实际归档路径与摘要；目标二进制位于分发目录的 `dist/relay/bin/<platform>/`。交叉编译成功不等于所有目标系统已经实机验收。当前安装与验收边界以[开发交接](docs/DEVELOPMENT_HANDOFF.md)和[部署记录](docs/DEPLOYMENT_SPACE.md)为准。

**安装使用生成的分发目录或 `.tgz`，不要将源码 checkout 中的旧 `dist` 当成发行包。** 源码目录内直接执行 `npm pack` 会提示正确入口 `npm run pack`。现有 `refactor:pack`／`remote:pack` 只是兼容别名。

房间版安装器负责独立程序目录、持久状态与扩展登记；在包目录可先查看参数，再按[安装指南](docs/INSTALL.md)配置：

```sh
node .refactor/release/package/scripts/remote/install-client.mjs --help
```

程序目录与房间状态分开，升级复用原状态，不删除密码、身份或模型配置。`npm start`／`npm run relay` 仅启动已构建的 Go Relay，不自动替你完成云端房间配置；已有网关服务时不要再占用同一端口。仓库根提供 `pi-cafe-space:build`、`pi-cafe-space:pack`、`pi-cafe-space:start` 对应入口。

### 源码与分发目录

```text
packages/pi-cafe-space/
├── src/extension/                 Pi 扩展
├── src/protocol/                  TypeScript 协议与归约
├── relay/                         正式 Go Relay、协议、房间与托管进程
├── web/src/                       React 网页
├── scripts/                       构建、安装、诊断与发行工具
├── docs/                          安装、身份、部署与历史说明
└── .refactor/release/package/      构建产物，不入 Git
    ├── dist/extension/index.js
    ├── dist/protocol/
    ├── dist/relay/build.json
    ├── dist/relay/bin/<platform>/pi-cafe-relay[.exe]
    └── scripts/remote/
```

旧 `src/relay`、`web/public` 和 Windows 脚本说明已移到[历史 TS Relay 文档](docs/LEGACY_TS_RELAY.md)，不再作为当前安装或生产部署步骤。

## 服务器部署：现有 netcup 环境

以下描述既有 `space.cafecode.work` 部署，**不是覆盖一台新服务器的安装脚本**。自建域名和新服务器见[安装指南的公共服务部署](docs/INSTALL.md)。本节保留稳定的职责、目录与运维入口；当前提交、镜像版本、摘要、验收结果和回退路径集中记录在 [DEPLOYMENT_SPACE.md](docs/DEPLOYMENT_SPACE.md)。

### 容器与 Compose

| 服务 | Compose 项目／服务 | 宿主机网络入口 | 部署文件 |
|---|---|---|---|
| Space 网页与信令 | `pi-cafe-space`／`cloud` | `127.0.0.1:37892`，由 Caddy 反代 | `/opt/stacks/pi-cafe-space/compose.yaml` |
| TURN | `pi-cafe-space`／`turn` | Host 网络；3478 TCP/UDP、49160–49259 UDP | 同上，配置在 `turn/turnserver.conf` |
| 身份服务 | `cafe-identity`／`identity` | Host 网络；程序监听 `127.0.0.1:20124` | `/opt/stacks/edel-garden/deploy/identity/compose.yaml` |
| HTTPS 入口 | 现有 `caddy` 项目 | Host 网络；统一接收 HTTPS | `/opt/stacks/caddy/compose.yaml` |

Space 是 **React 构建资源嵌入 Go 单程序**，不是独立运行 Vite／Node 的前端容器。Linux 程序放在版本化的 `releases/<release>/` 中，服务器使用 `FROM scratch` 的 Dockerfile 将它装入镜像。cloud 容器只发布回环端口，并只读挂载 `cloud.json`。

身份服务属于另一个仓库 `edel-garden` 的 `services/identity`，单独使用 Node 多阶段 Docker 构建；构建阶段安装锁定依赖并执行身份测试。它复用主站账号验证，不另建 Space 注册／密码数据库。两个业务服务与 TURN 均配置 `restart: unless-stopped`，不需要把整个主站一起重建。

### 域名与 Caddy 路由

Caddy 配置文件为 `/opt/stacks/caddy/config/Caddyfile`。现有路径分流如下：

| 域名／路径 | 上游 |
|---|---|
| `space.cafecode.work/api/identity/*` | `127.0.0.1:20124`，Space 登录会话与身份接口 |
| `space.cafecode.work` 其他请求 | `127.0.0.1:37892`，网页、房间登记与信令 |
| `www.cafecode.work/oidc`、`/oidc/*`、SSO 与退出相关路径 | 同一个 `127.0.0.1:20124` 身份服务 |
| 主站其他页面与业务 | 沿用原有主站部署 |

主站规范登录域名为 `www.cafecode.work`。身份服务内部连接原主站 API 的 `127.0.0.1:20120`。完整身份路径匹配与签发者配置见 [CAFE_SSO.md](docs/CAFE_SSO.md)，不要为增加 Space 路由覆盖其他 Caddy 站点。

TURN 的连接不经过 Caddy HTTP 反代或 Cloudflare 普通 HTTP 代理。当前部署没有提供 TURN/TLS 5349，受限网络能否连接需实际验证，不能根据网页能打开就认定 WebRTC 一定成功。

### 文件与持久化

```text
/opt/stacks/pi-cafe-space/
├── compose.yaml
├── cloud.json                     cloud 配置（只读挂载）
├── cloud-runtime.env              内部运行配置，勿公开或提交
├── releases/<release>/            已编译 Linux 程序与 Dockerfile
├── turn/turnserver.conf            TURN 配置，包含私密配置
├── backups/                       原配置与回退依据
└── practical-deployment.json       最近这批发布回执，后续名称见部署记录

/opt/stacks/edel-garden/
├── services/identity/             身份服务源码
├── deploy/identity/compose.yaml
├── .secrets/identity/keys.json      签名密钥，只读挂载，不入库
└── data/identity/                  SQLite 登录会话及旁路文件，持久化
```

房间私钥、密码校验值、Pi 模型配置和会话文件留在办公电脑。服务器身份库保存登录相关状态，不保存办公 Pi 的执行历史。升级容器保留原数据挂载和密钥，不通过重建用户身份来解决启动问题。

### 查看、更新与回退

以下命令在已有部署的服务器上运行。身份项目名必须显式使用 `cafe-identity`，不能按目录名误启动成另一个 `identity` 项目。

```sh
# 查看状态
docker compose -p pi-cafe-space -f /opt/stacks/pi-cafe-space/compose.yaml ps
docker compose -p cafe-identity -f /opt/stacks/edel-garden/deploy/identity/compose.yaml ps

# 查看目标服务最近日志（分享日志前检查敏感内容）
docker compose -p pi-cafe-space -f /opt/stacks/pi-cafe-space/compose.yaml logs --tail=80 cloud
docker compose -p cafe-identity -f /opt/stacks/edel-garden/deploy/identity/compose.yaml logs --tail=80 identity
```

当前发布流程是：测试并构建 Space 的 Linux 程序，上传新版本目录，在服务器构建镜像；身份服务在服务器从其源码构建。核对新镜像后更新对应 Compose 的镜像／构建目录，再只切换目标服务：

```sh
# 前提：新镜像已构建，Compose 已指向该版本，原配置／镜像已保留。
docker compose -p pi-cafe-space -f /opt/stacks/pi-cafe-space/compose.yaml up -d --no-build --no-deps cloud
docker compose -p cafe-identity -f /opt/stacks/edel-garden/deploy/identity/compose.yaml up -d --no-build --no-deps identity
```

**Git push 不等于部署成功。** 还需要验证实际网页资源、身份接口、正确／错误房间密码与第二个设备的 WebRTC 连接；`/healthz` 只能证明对应 HTTP 服务可用。一般业务更新不需要重启 Caddy／TURN。

回退恢复已记录的上一份 Compose 和程序版本，只操作对应服务，不删除房间状态、签名密钥或会话数据；准确的旧版本及文件位置见[部署记录](docs/DEPLOYMENT_SPACE.md)。办公端网关重启与手动 Pi 进程是不同生命周期；可选托管实例由网关拥有，不能把重启网关一概当作对任务无影响。

## 行为边界与进一步阅读

连接、当前活动和本轮结果分别呈现；“本轮结束”不是业务目标已验收，断线不会被当成成功。支持的 Pi 版本通过结构化事件提供取消、压缩和等待种类；缺少证据时保留未知，不解析终端文本补造状态。命令 `dispatched` 只表示已派发，不是模型完成。

共享文件仅限允许的项目范围，并过滤已知敏感路径和实际运行凭据；这不等于能识别任意文件中的所有秘密。Pi 操作能力沿用办公端原生工具权限，项目目录白名单不是操作系统沙箱。

[安装与自托管](docs/INSTALL.md)说明新办公电脑、服务配置和升级；[房间指南](docs/ROOMS.md)说明二维码、身份与审批；[独立实例配置](docs/MANAGED_SESSIONS.md)说明可选的本机托管 Pi；[SSO 设计](docs/CAFE_SSO.md)说明账号会话与有效期；[开发交接](docs/DEVELOPMENT_HANDOFF.md)记录实现与验证边界；[历史 TS Relay](docs/LEGACY_TS_RELAY.md)仅供旧实现维护。
