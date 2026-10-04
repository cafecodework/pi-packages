# space.cafecode.work 部署状态

## 用户指定范围

使用既有服务器 `152.53.90.186`，SSH端口 `2012`、账户 `root`；域名为 `space.cafecode.work`，用户已在Cloudflare设置，服务器已有Caddy。要求用Docker部署云端Café Space，复用既有Caddy而不是覆盖其他站点。手机、笔记本希望同网、异地和蜂窝均可访问。密码不保存在此文档、源码或部署文件中。

## 当前公共界面与Pi扩展：手机体验升级已发布

用户已经反馈手机连通。本轮公共cloud和Pi扩展更新为`0.1.0-mobile-ux-20261004`：手机精简实例/文件/更多入口、真实工作状态和可展开代码diff；主动发送时自动申请空闲控制权，他人占用则保留草稿不抢占；短重连只更新状态，同一故障只通知一次，恢复连续稳定60秒后再通知。

**办公端网关仍使用已连通的dc-ready-fix版，本轮未重启。** 新Pi扩展安装在`~/.local/share/pi-cafe-space/0.1.0-mobile-ux-20261004`并已登记，旧dc-ready-fix目录保留供网关运行。安装前后PID、LaunchAgent及身份/凭据/配置摘要不变。手机刷新原房间页面；已有Pi空闲时/reload一次加载新的提醒逻辑，不必重启网关。localhost工作台页面仍为前版，公共手机界面已更新。

公开资源`assets/index-CPJVxifv.js`，cloud镜像`pi-cafe-space-cloud:0.1.0-mobile-ux-20261004`；只重建cloud，Caddy/TURN的配置和启动时间保持。当前Compose SHA`e6baba3a26e4c1adb8620259c07141261287d17b48222b2aa6917ad11786a4c7`，回执`mobile-ux-deployment.json`，回退`backups/before-mobile-ux-20261004`。cloud配置SHA仍`a4e2f01142a3451608b15961dee65055718890715e59717ddfa4f64673d07fb9`。

540项主包、205项Web及类型检查通过；本机和实际公开站点各13组手机/双访客完整流程通过，provider请求0。包含320/390/430宽度、键盘高度模拟、真实思考事件、diff、自动控制权、草稿保护和原密码/重置/重启流程；实际iPhone键盘和锁屏仍需真机体验确认。详细测试范围与截图见[MOBILE_UX.md](MOBILE_UX.md)。

最终41文件包`.refactor/release/pack-QkL4Tj/cafecodework-pi-cafe-space-0.1.0.tgz`，SHA`cdce9b527f659b69dd52d8e90f32196bb18436294c914c204ba68f174f7d991b`。尚未commit/push或发布远端release。

## 当前网关与前序扩展：通道就绪竞争修复已启用

Mac网关和Pi登记为`~/.local/share/pi-cafe-space/0.1.0-dc-ready-fix-20261004`。修复了真实可复现的时序错误：浏览器收到DCEP确认已open，但办公端接收回调尚未完成时，旧代码会把select判为无效并主动关闭。现在只保存待选择意图，由本机OnOpen完成确认；不提前开放业务或跳过密码验证，不阻塞其他访客信令。

修复前两种受控Pion顺序均失败，修复后race重复5轮通过；remote/service完整race与vet、打包Go测试及公开临时房间认证/welcome通过。用户日志的channelOpened=true与该路径一致，但未取得物理手机成功结果，不能宣称唯一根因完全确认。详情见`refactor/PHONE_CONNECTION_ACCEPTANCE.md`顶部。

仅重载办公网关，没有结束用户Pi；房间key、密码与配置安装前后摘要不变。原LaunchAgent备份`~/.local/share/pi-cafe-space/deploy-space-20261003/before-dc-ready-fix.plist`，新SHA `414ab150bff4825ee7c45089f5bf93d8b9a6c98b6ce813e7142b33e043a30e7d`。安装/运行二进制SHA `2af0e0103d466dbb542dc7db66252eae7325d2751fc0500ee45a6501df931093`，健康接口正常。手机使用原页面和密码重新连接，无需再次刷新网页或重启Pi。

cloud仍为sctp-observe，公开资源仍`assets/index-5Ug4D_9U.js`，本轮Caddy/TURN/服务器均未部署变化。最新包`.refactor/release/pack-jGmxZH/cafecodework-pi-cafe-space-0.1.0.tgz`，41文件，SHA `67e1e778546f96c94ee6289b08abd908b254d15b11ab9ccc243c209c96b91e9f`。未commit/push或发布远端release。

## 当前云端与前序办公端：诊断复制与短时握手记录

Mac网关/Pi登记和cloud均为`0.1.0-sctp-observe-20261004`，公共网页资源`assets/index-5Ug4D_9U.js`。手机新增“复制诊断日志”，只复制固定安全状态字段；剪贴板拒绝时提供可手动选中的文本。办公端记录最多24次/每次32事件、5分钟过期，只有原loopback host认证接口可读，没有对公共浏览器放开，也不上传到cloud。

本轮并未修改DTLS/SCTP握手参数。用户实机自动及TURN/TCP均在13–14秒报告sctp-failure，具体关闭原因尚未确定。生产本机认证诊断读取被OpenAI工具安全检查拦截，未换路径绕过；因此发布观察版不等于连接已修复。188项Web、类型检查、4项Go诊断race/权限/真实握手回归和三平台构建通过。详见`refactor/PHONE_CONNECTION_ACCEPTANCE.md`最新段。

原房间identity/credentials/配置安装前后摘要一致，仅重载受管网关和cloud，未结束用户Pi，Caddy/TURN未改或重启。Mac旧服务备份`~/.local/share/pi-cafe-space/deploy-space-20261003/before-sctp-observe.plist`，新plist SHA `2e35b01e8c2759ac85bb2524803e53c5116686f7c2e4e83cfc971d002f4ca814`。服务器回执`sctp-observe-deployment.json`、备份`backups/before-sctp-observe-20261004`，Compose SHA `3c8bcb1f8f60a9df1d8be48737519ef0c3bf04445d5b65a4fa8b05e3bf4feaa4`。新归档`pack-mqy2jV/cafecodework-pi-cafe-space-0.1.0.tgz`，SHA `95dc1fc01cd590a440be645a41081f09793a758de49a8a61020443310bdf96eb`，41文件。未commit/push或发布远端release。

## 前序公共站点：传输错误区分与可选兼容连接

公共cloud已更新为`pi-cafe-space-cloud:0.1.0-transport-recovery-20261004`，实际资源`assets/index-DzbJT9ym.js`。密码页新增“兼容连接（强制中继）”，默认关闭，选择后浏览器只使用已配置TURN/TCP；没有加入业务WSS降级、没有放开房间权限。密码前的数据通道关闭不再注入UNAUTHORIZED，因此不再误报“认证失败”；详情保存清理前的ICE/DTLS/SCTP/数据通道状态和有限标准错误号。

本轮只升级cloud网页资源，办公端协议未改，Mac仍为`0.1.0-signal-init-20261003`，未重启网关或用户Pi。原房间身份、密码、代理、模型配置不变；Caddy与TURN的配置/启动时间保持。Compose SHA-256 `a6450a696c5a51a419804490fce1fd099d7edfc65cadfd85998b1482dddcc11c`，回执`transport-recovery-deployment.json`，备份`backups/before-transport-recovery-20261004`。当前localhost页面为前一版不属于遗漏；手机应刷新公开站点。

网页182项完整回归加1项新增开关测试、本机真实Chrome10组流程通过。系统WebKit在本轮修改前默认/强制TURN均跑通完整认证；修改后的WebKit UI测试有停滞/超时并观察到页面hidden，因果关系未证明，未将其算作手机验收。最后无窗口Chrome实际勾选公开UI开关，relay-only策略、relay→relay选中候选对、密码认证与welcome及持续连接均通过；未通过测试注入替代应用配置。完整范围与最终探测结果见`refactor/PHONE_CONNECTION_ACCEPTANCE.md`当前段。物理手机的断开原因仍未唯一定位；建议明确尝试兼容选项，并使用新诊断区分后续故障。

新包`.refactor/release/pack-vXuAZf/cafecodework-pi-cafe-space-0.1.0.tgz`，41文件，SHA-256 `625d9cd00106a3df00603f1f9566069bf538772f619be3692fdc3db09970e3eb`。未commit/push或发布远端release。

## 前序运行版本：信令初始化诊断与精确本站WSS策略

当前本机安装/网关和Pi登记为`0.1.0-signal-init-20261003`，云端镜像`pi-cafe-space-cloud:0.1.0-signal-init-20261003`，实际本机/公网asset均为`assets/index-x9XpvC15.js`。公网HTML CSP已明确加入`wss://space.cafecode.work`，没有放开通配符或其他站点；初始化错误显示固定步骤和标准异常名称，不再把所有同步异常都归为网络拦截。

176项Web、相关Go race/vet、本机10组浏览器流程通过，系统WebKit三组正反策略对照通过；部署后系统WebKit实际打开本站WSS。当前系统WebKit在旧self策略下也能连接，因此兼容修订不是对用户iPhone唯一根因的证明。用户需完整刷新手机原链接，若仍失败提供新增初始化步骤/异常类型。无须改密码/代理或关闭浏览器安全保护。

原身份/凭据/配置未改，用户Pi未结束；只重载本项目网关/cloud，Caddy/TURN配置及启动时间保持。Compose SHA-256 `0180712abc16b41676b0e6a6c11cc726ae3bbb15cf0abc06391313ce5672f6bc`；服务器回执`signal-init-deployment.json`、备份`backups/before-signal-init-20261003`，本机旧服务文件`~/.local/share/pi-cafe-space/deploy-space-20261003/before-signal-init.plist`。41文件包`pack-HgtE3m/cafecodework-pi-cafe-space-0.1.0.tgz`，SHA-256 `a23567a6aac2ff4bfe1b60c7ff12629ebef5095e64713b886af146c59b4b62e3`。详细证据见`refactor/PHONE_CONNECTION_ACCEPTANCE.md`最新段。

## 前序运行版本：手机连接阶段与ICE等待修复

本机网关、Pi登记和云端cloud已更新到`0.1.0-phone-connect-20261003`。Mac目录`~/.local/share/pi-cafe-space/0.1.0-phone-connect-20261003`，cloud镜像`pi-cafe-space-cloud:0.1.0-phone-connect-20261003`。实际本机/公开资源为`assets/index-C4-pbOfB.js`。原房间key/密码/配置未变，Caddy/TURN未改动或重启；只重载本次管理的网关，没有结束用户Pi。

双方已取得TURN候选后不再各等满8秒；初次失败停止无限connection lost循环，显示阶段、错误码和无密码诊断；可见性事件不再销毁正在进行的连接。手机需刷新原页面，不是只在Pi里reload。

166项Web与类型检查、Go race/vet、本机10组浏览器流程通过；已部署强制公网TURN/TCP的临时房间实际完成房间认证和welcome，并保持连接。用户手机浏览器/网络尚未确认，默认模式公开探测另一次在页面导航阶段超时，因此不能声称手机故障已彻底解决。证据和精确范围见`refactor/PHONE_CONNECTION_ACCEPTANCE.md`。

当前Compose SHA-256 `36e8b4dad13da84cab035f50c36b06bbf04ebd0c1d34bc80acc575cad08d853a`，服务器回执`phone-connect-deployment.json`，备份`backups/before-phone-connect-20261003`；Mac备份`~/.local/share/pi-cafe-space/deploy-space-20261003/before-phone-connect.plist`。最新归档`pack-MrcsgG/cafecodework-pi-cafe-space-0.1.0.tgz`，SHA-256 `f327ce00560839dd778cd0c4a81b9d2e163fffa816b38561cb2c8e499d51cb21`。没有commit/push或发布远端release。

## 前序扩展：二维码可扫描性修复已安装

当前Pi扩展登记为`~/.local/share/pi-cafe-space/0.1.0-cafe-qr-fix-20261003`。Apple Terminal默认实心背景格二维码，避免字体白缝切断定位框；96×36放不下时按P或直接/cafe qr打开本机高清SVG，无需登录，不含密码或外部资源。已有Pi空闲时/reload。房间URL/key/密码、代理设置和LaunchAgent均未改变；后端二进制与当前运行网关相同，因此未重启网关或更新云端。

537项主包回归、13项二维码栅格/预览测试、3种实际浏览器PNG截图解码、8组Apple模式真实Pi伪终端通过。物理手机相机没有由本来源实测；扫码后的connection lost也没有因本次渲染修改而解决，失败阶段/手机网络信息尚未取得，详见`refactor/CAFE_TERMINAL_ACCEPTANCE.md`。新包`.refactor/release/pack-9gIjlg/cafecodework-pi-cafe-space-0.1.0.tgz`，SHA-256 `a8a26eb4eb93dc24d4d009b8effd8585795d798998378e6a8fa63ae7bd6c5a9b`。未commit/push或发布远端release。

## 前序扩展修复：/cafe本机请求不再受Pi全局HTTP代理影响

Pi扩展登记已更新为`~/.local/share/pi-cafe-space/0.1.0-cafe-proxy-fix-20261003`，旧扩展登记移除，旧目录保留。修复前真实带代理Pi复现“暂时无法读取本机网关”，但网关本身和房间在线；修复后7组真实代理场景测试与531项主包回归通过。当前Pi需Esc返回、空闲时/reload，再/cafe share。无需修改用户代理、密码或房间链接。

本次仅更新扩展的本机HTTP传输与错误分类，Go二进制、网页、云端及LaunchAgent均没有变化；网关仍从下列cafe-terminal目录运行，未被重启。不要为目录名不同重复安装网关。新包为`.refactor/release/pack-psy2VK/cafecodework-pi-cafe-space-0.1.0.tgz`，SHA-256 `5bdd7899ea91925cc42e21fe80fcf7aea41a49d4b3c476e0e1e843dd5180fe3f`。详细范围见`refactor/CAFE_TERMINAL_ACCEPTANCE.md`最新修复段。

## 当前网关版本：/cafe终端分享入口已启用（2026-10-03）

Mac安装 `/Users/air/.local/share/pi-cafe-space/0.1.0-cafe-terminal-20261003` 已登记Pi扩展并启用新网关LaunchAgent。新启动Pi直接输入`/cafe`或`/cafe share`，已有Pi在空闲时`/reload`即可。原房间身份、本机凭据和模型配置保持；未结束用户Pi。终端二维码/复制链接不再要求用户知道本地端口，网页登录会保留分享意图。

云端镜像 `pi-cafe-space-cloud:0.1.0-cafe-terminal-20261003` 已运行，只重建cloud。Caddy配置及启动时间、TURN启动时间保持。当前Compose SHA-256 `54697565ee0f344588f41004f01e6c92684158f9a6ae7c8a33fac6f4bdb78954`，cloud配置仍为 `a4e2f01142a3451608b15961dee65055718890715e59717ddfa4f64673d07fb9`。服务器回执`cafe-terminal-deployment.json`，回退备份`backups/before-cafe-terminal-20261003`。Mac旧服务备份`~/.local/share/pi-cafe-space/deploy-space-20261003/before-cafe-terminal.plist`。

安装后已确认本机/公开页返回同一`assets/index-CnILNDwY.js`，终端只读接口和房间登记在线。独立实例代码经临时批准项目、真实浏览器和两个实际Pi验收；但当前用户房间`roomManagement`保持false，因为真实项目目录授权尚未给出。普通Pi新建会话与独立新实例入口已经分开，不会默认开放任意目录。

最新41文件归档`.refactor/release/pack-zsh7ue/cafecodework-pi-cafe-space-0.1.0.tgz`，43,526,173字节，SHA-256 `335e2d73ed48e329e38dc36843579607cfd3af99e1db7b5eae63ebbf2db83a6f`，已逐文件核对业务字节与实际安装一致。详细测试、公开站点重试范围和限制见`refactor/CAFE_TERMINAL_ACCEPTANCE.md`。没有commit/push或发布远端release。

## 历史修订：房间版安全与体验复核完成

当前Mac安装为 `/Users/air/.local/share/pi-cafe-space/0.1.0-rooms-reviewed-20261003`，LaunchAgent指向其room-run，Pi包登记已更新且旧登记移除，旧安装目录保留。房间配置、identity/room.json和本机credentials路径不变；没有重置密码、链接或结束Pi。

服务器cloud镜像为 `pi-cafe-space-cloud:0.1.0-rooms-reviewed-20261003`，版本目录 `releases/rooms-reviewed-20261003`。部署前独立端口冒烟、备份旧Compose并比较哈希，最后仅重建cloud。当前Compose SHA-256 `4bb4c923c9a29ee557ba20bf7902f702c0d2f32d1fc9d385c2eb990d89e4e25b`，cloud配置仍为 `a4e2f01142a3451608b15961dee65055718890715e59717ddfa4f64673d07fb9`。Caddy字节及TURN启动时间均保持，回执 `rooms-reviewed-deployment.json`，备份 `backups/before-rooms-reviewed-20261003`。

本轮定向复核复现并修复无效HTTP消耗全站连接预算及错误阶段提示两项问题，分享面板明确访客可以申请控制Pi。详细能力/权限矩阵和未解决取舍见ROOM_REVIEW.md。156项网页测试及Go remote/service race、vet通过；最终本机和公开首页都返回 `index-SJV32FT8.js`。

最新37文件归档为 `.refactor/release/pack-C3K5RL/cafecodework-pi-cafe-space-0.1.0.tgz`，43,412,799字节，SHA-256 `5d5359acfaa2cca4ba38c1b2c88517685bcfbe358ce1fc2f3fd9575ab302dba8`，仍包含INSTALL.md、AI_INSTALL.md及全部安装工具。公开房间流程与验收结论见refactor/ROOM_ACCEPTANCE.md。本次没有commit/push或发布远端release。

## 房间模式初次上线记录（以下版本路径为历史）

当前产品入口已改为用户要求的房间模式：公共主页只接收房间链接/key，不列出电脑或房间；办公电脑一个房间，内含多个Pi。访客打开/扫码房间URL后输入6–20位密码，验证通过后进入WebRTC。**旧remote-space/login.txt云端访问密钥不再是新访客入口，不要继续要求用户先查找设备或选择air-mac/main。**

### 当前使用方式

办公电脑浏览器打开 `http://127.0.0.1:37891/`，使用原本机登录令牌进入工作台，点击顶部“分享房间”。二维码和复制链接编码同一个 `https://space.cafecode.work/#/room/<roomKey>`，不包含密码。手机用系统相机扫码或笔记本打开链接，输入房间密码即可。首次迁移的房间密码沿用原本机登录令牌，之后在分享抽屉可独立修改；修改密码不改变URL，重置链接才使旧URL/二维码失效。两种变更都不终止Pi任务。

密码只通过URL公钥验证后的WebRTC DataChannel交给办公端，云端信令不传密码/业务正文。新模式不再自动回退到普通业务WSS，无法直连时可用已配置TURN。云端网页脚本仍是信任边界，不能宣称恶意网页也接触不到密码。

### 实际安装和服务器

Mac稳定安装 `/Users/air/.local/share/pi-cafe-space/0.1.0-rooms-install-20261003`，Pi包登记已更新并移除上一版登记，旧文件目录保留。受管LaunchAgent已经重载到新room-run，房间状态固定在 `~/.config/pi-cafe-space/rooms-space`；原 `credentials-37891.json` 未被重置、上传或打印。没有停止用户Pi或修改provider。doctor已确认本机roomShare=true、云端roomAccess=true、房间配置一致、身份文件私有存在；这些检查不冒充手机P2P验证。

服务器仍使用 `/opt/stacks/pi-cafe-space`，cloud镜像现为 `pi-cafe-space-cloud:0.1.0-rooms-install-20261003`，Linux程序位于 `releases/rooms-install-20261003`。云端已开启动态公钥房间登记并移除Users/Devices列表；旧 `/api/remote/devices` 与 `/remote/connect` 返回404。保留TURN设置，仅重建cloud。Caddy配置哈希为 `f8355f9aeaa80ccd3a448473af73a03bfd57f6ff4e6d9ed5d5a616ea9920dd5e`，Caddy启动时间2026-08-23；TURN启动时间2026-10-03T05:37:11均在本轮切换中保持。

当前Compose哈希 `8c29740241e7f7956949a21bc11a0c5bb4b1b18b8a8ec7ee94e9fa3ca3b676b6`，cloud配置哈希 `a4e2f01142a3451608b15961dee65055718890715e59717ddfa4f64673d07fb9`。初次房间切换备份 `backups/before-rooms-20261003`，最后镜像升级备份 `backups/before-rooms-install-20261003`。每次先临时端口冒烟、比较旧摘要再替换，失败恢复；不覆写其它Caddy站点。

### 安装引导与验收入口

`docs/INSTALL.md`说明连接公共服务与自托管两条路径；`docs/AI_INSTALL.md`可以直接交给用户的AI。最终归档也带这两份文档及install-client/configure-server/doctor/room-bootstrap等工具。安装依赖、Pi登记和用户服务激活均有显式开关；新安装拒绝覆盖已有程序/服务，升级复用状态需明确参数。自托管生成器只生成私有Docker材料，不能把生成成功报告为远端已部署。

本轮511主包测试、155网页测试、Go测试与race、6项安装工具测试、4组隔离安装集成、6项发行/隔离源码重建通过。8组真实Chrome隔离房间流程通过，二维码由独立解码器核对。公开信令的临时房间最终结果与完整限制见 `docs/refactor/ROOM_ACCEPTANCE.md`，不要将本机直连测试当成手机蜂窝或所有公网网络通过。

最终归档 `.refactor/release/pack-w7Kcwf/cafecodework-pi-cafe-space-0.1.0.tgz`，37文件，SHA-256 `8f22ef021d8b61b1d0ca820af3e748851776bf416347f22c62ca5f4c11927d91`。尚未commit/push或发布npm/GitHub release，不能引用未存在的公开下载链接。

## 历史状态：WebRTC/TURN已部署，Mac设备在线（旧账号模型）

用户在本轮明确要求WebRTC也部署。已保留原HTTPS/WSS云端中继，开启云端与Mac端enableWebRTC。实际云端鉴权设备目录返回 `air-mac / airdeMacBook-Air / online:true / webRTC:true / main:admin`，不是仅凭本机healthz推断。Mac原生Pi、模型/provider配置与既有本机访问令牌没有改动。

### 已运行的TURN服务

服务器原Compose项目内新增 `pi-cafe-space-turn-1`。基于官方coturn4.18.0-r0固定摘要 `bbefd3e1fdfdc0d58770fe01b581fd8b00d9f3a5580d00acb77cf719a6bc78e3`，实际镜像 `pi-cafe-space-turn:4.18.0-unprivileged`。官方程序带低端口文件能力，与cap_drop=ALL组合导致首次exec失败；已停止该失败容器，派生镜像以相同程序字节新建无文件capability的inode，继续非root65534、只读根和零capabilities运行，不使用privileged或放宽全局安全策略。最终turn与cloud均running，restartCount=0。

TURN直接访问 `152.53.90.186:3478`，支持客户端UDP/TCP；中继端口49160–49259/UDP。仅追加三条UFW规则，限定eth0及此IPv4地址，SSH和原防火墙策略不变。host网络避免额外端口NAT，未把3478经Cloudflare普通HTTPS代理转发。Caddy文件哈希与其容器启动时间均保持不变；只有本项目cloud服务因单文件挂载配置原子更新而重新创建。

配置位于服务器 `turn/turnserver.conf`，使用独立shared secret和3600秒短期凭据。设置每用户12、总96分配配额，带宽预算与未授权请求限流；拒绝私网/loopback/multicast目标。没有无认证TURN服务。尚未启用TURN/TLS（5349）；受限网络仍有原WSS路径，不能宣称所有网络都可P2P或TURN。

服务器部署前备份在 `backups/before-turn-20261003/`。当前cloud.json哈希 `59241345459cd5c8a7a873757a609bfcc541445a886016947fd16bffa318f53f`，compose.yaml哈希 `7441a5b0b7d86be38b80ebb2e5710e5911630a206a1b5cc3d5b22993e40704fb`。未更换原owner访问密钥或设备身份。

### Mac接入已完成，不要重复运行旧启用脚本

用户先前的脚本只打印校验结果，随后检查时仍运行原本地服务；没有留下可用的完整失败输出，不能断言当时失败的唯一原因。本轮确认无脚本运行后，按WebRTC部署要求启用新device.json，并逐次执行launchctl卸载、确认服务不存在、加载，均取得实际回执。现LaunchAgent执行 `run-office.mjs`，本机healthz正常，云端实际发现设备在线。没有结束用户Pi。

当前device.json哈希 `29c86876be82b4679f32d87a63470efd1e5ac0f032c8b655198c1b244fdce700`，LaunchAgent哈希 `6ff6bab5ee413d5716c507be8bea2f5d58f23be6c6589d8b36fc5e52589d2d48`。原本机凭据文件未改，原启动配置备份保留。旧enable-cloud.sh针对旧配置有哈希保护，现在不应再次执行它；不是要求用户重复切换。

### 实际验证与未通过项

- 服务器内部独立TURN协议自检：短期临时凭据、TCP及UDP各两个真实分配、双向合成负载匹配、loopback目标拒绝，全部通过。结果在服务器 `turn/selfcheck-result.json`。这是同一服务器内部自检，不冒充手机或公网端到端。
- Mac经公网到3478/TCP的无凭据STUN Binding响应成功；无认证Allocate返回401，证实不是开放代理。信令/设备目录鉴权查询也成功。
- Mac到3478/UDP的初次真实分配失败；进一步无凭据Binding测试超时。route显示经utun1500、gateway198.18.0.1。测试时服务器UFW UDP3478计数未增加，说明当前路径未证实可达；隧道路径可能相关，但不能据此确定所有手机网络表现。未改用户VPN/代理或绕开其网络策略。
- 使用真实云端登录的生产浏览器自动化测试被平台安全检查拦截，未执行；没有改名或换渠道重试该测试。后续诊断增强版外部临时凭据测试也被拦截，未重放。独立服务器自检不需要生产用户登录，范围不同。
- 因而本轮可以报告部署/设备在线，不能报告已完成手机WebRTC直连、浏览器经公网TURN双向业务通信或蜂窝/后台恢复验收。没有发送prompt、调用provider或接管实例控制权。

用户入口保持 `https://space.cafecode.work`，使用原云端访问密钥（Mac私有 `~/.config/pi-cafe-space/remote-space/login.txt`），选择airdeMacBook-Air与main。建议连接方式为自动，使WebRTC不可用时保留WSS回退；WebRTC/TURN only不会回退WSS。密钥不要回贴聊天。服务器最终验证文件为 `/opt/stacks/pi-cafe-space/webrtc-final-verification.json`。

## 历史状态：云端Docker已上线，本机设备模式尚未启用（2026-10-03）

本轮直接执行用户给定的 `~/dev/ssh-servers/connect netcup uptime` 成功，退出0，服务器返回 `up 100 days`。随后所有服务器检查、上传、Docker构建启动和Caddy变更均由本来源直接通过该连接器完成，没有让用户代跑，也没有再次提交旧密码。此前“快捷配置不能连接”的推测不再作为当前结论。

### 已部署和验证

- 服务器目录 `/opt/stacks/pi-cafe-space`，Compose项目 `pi-cafe-space`，容器 `pi-cafe-space-cloud-1`；镜像 `pi-cafe-space-cloud:0.1.0-20261003`（镜像标识 `sha256:937ad977ca70fce10b795371e0ee706db846738565c83c227edf4f271308e0f2`）。从匹配已验证SHA-256的Linux amd64静态程序构建scratch镜像，实际在服务器运行。
- 容器UID/GID 65532、只读根目录、删除全部capabilities、no-new-privileges、512MiB限制、unless-stopped。只绑定 `127.0.0.1:37892`，不占用80/443，也不挂载Docker socket或本机项目。匿名访问设备目录返回401，旧本地 `/ws` 和 `/api/workspace` 均返回404，未公开本机初始化接口。
- Caddy确认host网络，配置挂载为 `/opt/stacks/caddy/config` → `/etc/caddy`。修改前已核对Caddyfile哈希和磁盘适配JSON与运行JSON完全一致，仅在原文件末尾添加 `space.cafecode.work { reverse_proxy 127.0.0.1:37892 }`。先validate后原子替换并reload。旧文件原字节保留，私有备份 `/opt/stacks/pi-cafe-space/backups/Caddyfile.before-space`；变更回执 `caddy-change.json`，服务器验收 `server-verification.json`。新Caddyfile哈希 `5cf05ed6ebaeabf4411d463204756f1043b10fff1916d07c1108aa26737fab0c`。
- 从Mac经过公开Cloudflare路径检查首页、healthz、api/config全部200，正确网页资源 `index-BYfuWciM.js`，remoteAccess=true。之前525已不再出现。服务器直接验证源站证书主机名和信任链成功，TLS1.3，证书notAfter为2027-01-01。Caddy容器原startedAt为2026-08-23且未改变；抽查sub2api、aether-app、resin、dockge、edel-graden-test-console、rapid-inbox两个服务容器身份/运行/启动时间均保留，不把reload当容器重启。

### 账户和设备范围

仅配置一个owner/admin用户，授权设备 `air-mac`（airdeMacBook-Air）、房间 `main`。云端存用户和设备tokenHash；原文云端访问密钥和设备密钥保留在Mac `~/.config/pi-cafe-space/remote-space/` 私有目录，登录说明 `login.txt`，原文未写入本文件或工具输出。本机既有 `credentials-37891.json` 未上传云端、未重置。公网用户密钥使用现有云端协议的独立随机43字符格式，不是本机初始化6–20位令牌。

本次只启用可靠HTTPS/WSS云端中继（enableWebRTC=false）；未部署TURN或验证公网P2P，不承诺它们可用。云端转发可信业务数据，不宣称对云端不可读的端到端加密。

### 本机接入的剩余步骤

已生成 `remote-space/device.json`、`run-office.mjs`、`relay-cloud.plist`。启动器 `--check` 已验证程序摘要、旧本机凭据及目标设备/房间范围，不打印秘密；正式启动会保留本机host/client令牌，仅通过独立设备凭据主动连接公网WSS。

但组合“凭据指纹检查＋重载LaunchAgent＋云端认证确认”的工具调用被安全检查拦截，没有执行回执。本轮没有重放或换渠道重试。只读核查原Relay仍运行于旧二进制，PID50924；已经把 `/Users/air/Library/LaunchAgents/com.cafecodework.pi-cafe-relay.plist` 恢复为原哈希 `3a126312bead8a48c475fb3aa93874136916bedce6f084e801bf4994907c2aeb`，使磁盘与运行态一致。Pi未被停止，provider未改，不能声称设备在线、手机已能看到Pi或完整公网认证交互已经验收。

用户亲自执行的待启用脚本：`sh ~/.config/pi-cafe-space/remote-space/enable-cloud.sh`。脚本包含原配置哈希检查、启动器校验、替换受管LaunchAgent、等待卸载、重载和本机健康检查；失败尽量恢复原配置。已准备但本来源未执行。运行后仍需在云端设备列表确认 `airdeMacBook-Air` 在线；本机healthz不能单独证明云端接通。云端登录说明可在本机使用 `cat ~/.config/pi-cafe-space/remote-space/login.txt` 查看，勿发回聊天或放入公开仓库。手机/笔记本访问 `https://space.cafecode.work` 并选择设备/房间。Mac需保持运行和联网。

官方运维依据：Caddy validate/reload https://caddyserver.com/docs/command-line ，Docker Compose服务参数 https://docs.docker.com/reference/compose-file/services/ ，Cloudflare WebSockets https://developers.cloudflare.com/network/websockets/ 。本次实际效果以上述工具回执为准，不以文档代替运行验收。

## 历史进展：用户已手动SSH成功，自动部署尚未执行

用户亲自执行只读检查并返回：Debian13/trixie、Linux amd64、Docker29.3.0、Compose5.1.1；名为`caddy`的容器使用`ghcr.io/caddy-dns/cloudflare:latest`，已运行5周，宿主机80/443由caddy进程监听。systemd未安装Caddy服务，这是容器部署的观测，不是服务损坏。其它容器包括sub2api、aether、resin、dockge等，必须保留，不能重建整套服务器或抢占80/443。

当前尚未确认Caddy NetworkMode、配置/证书挂载、实际Caddyfile参数、import片段和目标域名站点。`docker ps`未显示端口映射不足以单独证明host网络。需要这些信息才能决定loopback反代或共享Docker网络，也不能仅凭镜像名断言DNS挑战已正确配置。

用户新建`/Users/air/dev/ssh-servers/connect`，入口是`ssh -F <同目录config> "$@"`；配置确认`netcup`指向上述服务器/端口/root。只读核对入口与配置，没有读取私钥或执行连接，也没有改用此包装重新提交之前被拦截的密码。该配置是别名，不能证明本来源拥有已认证的远端会话。

已在本机准备`~/.local/share/pi-cafe-space/deploy-space-20261003/inspect-caddy.py`，用户可在Mac执行`~/dev/ssh-servers/connect netcup 'python3 -' < ~/.local/share/pi-cafe-space/deploy-space-20261003/inspect-caddy.py`。脚本只读Docker指定字段及有界Caddy配置结构，隐藏环境值/认证头/证书内容；本地模拟Docker测试验证元数据、直接import片段和模拟密钥脱敏，退出0。它不执行SSH、不写远端文件、不reload/restart。此脚本还未在目标服务器运行；不保证全配置覆盖，输出明确标记未展开或受限内容。

同目录`cloud-image/`已准备Linux amd64静态Relay与scratch Dockerfile；程序SHA-256为`b5b9a2e7d9dd0463fb7647e02f46be79691657aafa75cd92d602833bc3583c7b`，已检查ELF架构且无动态解释器。`compose.loopback.yaml.example`只是待确认Caddy使用host网络时的模板，固定loopback37892、非root、只读根、无额外capabilities，并要求独立cloud.json/cloud-runtime.env。还未生成正式云端账户配置、绑定办公电脑设备或构建Docker镜像，不能直接宣称手机可用。不要把本机credentials文件上传云端。

## 初次自动认证受阻记录

2026-10-03，本次自动SSH认证调用被OpenAI安全检查阻止，未收到SSH执行回执。本机部署控制套接字不存在。没有再次提交凭据、改用编码或其他自动认证手段；没有上传文件、启动Docker、修改Caddy或服务器防火墙。

公开HTTPS检查：`https://space.cafecode.work/healthz` 返回Cloudflare HTTP 525，响应 `error code: 525`。这表明Cloudflare到源站的TLS握手失败；尚未读到源站配置，不能断言是证书、监听端口或特定Caddy配置造成。官方说明：https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-525/

已准备只读诊断脚本 `/Users/air/.local/share/pi-cafe-space/deploy-space-20261003/inspect-server.sh`。它只打印OS/架构、Docker与Compose版本、容器名称/镜像/端口、Caddy服务元数据及配置文件位置，不输出环境变量、私钥或令牌，不改变服务器。语法检查通过；用户现已手动执行该第一阶段脚本并返回结果，如上。

后续必须先通过正常授权的SSH连接或用户亲自登录取得服务器实际Docker/Caddy状态，再决定Docker网络及反向代理接线。不能把本机loopback网址作为手机入口，不能把本机host密钥文件上传云端。未购买服务，未创建公共隧道。

## 前项误报告警已修复并安装

启动健康预检失败不再输出 `local relay is unavailable`，移除静态 `host connecting`。实时底部状态继续以有效host welcome为准。真实连接故障有3秒宽限期，同一故障节流60秒；成功会取消待发告警，先前已告警则另有恢复提示；停止/重载会取消旧定时器。

主包类型检查和511项测试通过。`startup-notification.test.ts` 在修复前实际复现握手成功后仍警告，修复后通过。`scripts/remote/connection-warning-test.mjs` 使用真实Pi0.99.1、真实GoRelay及仅破坏HTTP健康探测的临时loopback代理，3组验证通过：探测503但真实连接成功无误报、持续故障会提醒、恢复明确通知且不迟发旧告警。provider请求0。报告：`.refactor/reports/connection-warning-20261003/result.json`。

当前Pi用户包登记为 `/Users/air/.local/share/pi-cafe-space/0.1.0-connection-fix-20261003`；已与验收候选逐字节比较扩展入口和告警模块。运行中的GoRelay二进制与新包相同，无需重启，因此LaunchAgent保留原运行路径。用户Pi进程没有被结束；已有Pi需执行原生 `/reload` 才能换入新版扩展，或者下次启动自动加载。本机健康端点HTTP200，令牌和provider设置未变，旧安装目录保留，未commit/push。

另有用户补充问题“离线的实例还有显示的必要吗”尚未改变实现。建议默认在线列表为主，当前选中但刚离线的实例保留状态；不要把历史会话或可重新打开的受管实例直接删除。需要单独确认产品行为后再实现。
