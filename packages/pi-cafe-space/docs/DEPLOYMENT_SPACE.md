# space.cafecode.work 部署状态

## 用户指定范围

使用既有服务器 `152.53.90.186`，SSH端口 `2012`、账户 `root`；域名为 `space.cafecode.work`，用户已在Cloudflare设置，服务器已有Caddy。要求用Docker部署云端Café Space，复用既有Caddy而不是覆盖其他站点。手机、笔记本希望同网、异地和蜂窝均可访问。密码不保存在此文档、源码或部署文件中。

## 当前运行版本：Café统一账号登录已上线

2026-10-05按用户要求直接完成测试环境代码发布，不等待真实账号手动验收。主站SSO单独提交`79ccaaa1ad8259aedfea6630c94bfd014351f717`已推送至`Shirtiny/edel-garden/main`；Space的SSO及本记录同批提交，具体版本查看当前Git记录。运行服务仍是下述已上线版本，提交不会代替线上核验，也不需要为相同字节重复重启。主站其余52个修改文件未夹带、未覆盖，详情见CAFE_SSO.md末尾发布记录。

主站www.cafecode.work复用原账号登录/2FA，Space首次进入可选择Café账号或访客，扫码登录完成或取消都返回原房间。账号登录不代替房间密码、不提升为房主，也不自动继承其他设备的控制权。完整行为、安全边界、验收和回退记录见[CAFE_SSO.md](CAFE_SSO.md)。

本机与cloud均为`0.1.0-cafe-sso-20261004`，JS`assets/index-O6Lt3U16.js`、CSS`assets/index-pSHAdXQk.css`。两端仅增加固定`accountIssuer=https://space.cafecode.work/api/identity`，原房间密码、身份与审批选择保持；Pi扩展登记和模型配置未改，不需要/reload。自定义思考菜单已随此版本在公共网页生效，下面此前发布受阻仅为历史记录。

主站新增独立容器edel-garden-identity，原项目`/opt/stacks/edel-garden/services/identity`，Compose在deploy/identity。它只监听127.0.0.1:20124，使用Node24.21.0 LTS固定镜像和私有加密会话存储。主站Control/Gateway/数据库与TURN没有重启；Caddy只平滑reload目标路由。实际主站新入口JS为index-DXT-MdS7.js，静态目录`/opt/stacks/caddy/config/cafe-console/cafe-sso-20261004`。

当前Caddy SHA`071cc7d4c30c732f64cf2f6ed5c1aa0455a585dbc218fd29f56eae1f54eaafc0`；Space Compose SHA`72c4b519be0023eb44863a93a4e75c23314f7fbeb09fb3fde4fac6a8eca04f77`，cloud配置SHA`5515d231648aa6459bb19bce532a8e067caa48d5ef20c96528c613cca8cff89a`。Space回执cafe-sso-deployment.json，备份backups/before-cafe-sso-20261004；主站备份data/sso-backups/cafe-sso-20261004。配置原子替换曾遗漏65532所有权，造成短时cloud不可读，已按日志恢复65532:65532和0400后重新部署并完成公网检查；回退同样必须保留所有者，详细经过留在CAFE_SSO.md。

10项实际OIDC/存储测试在LTS镜像中通过、236项Space网页及Go完整并发测试通过。实际主站React/标准OP-RP/真实Go房间的9组完整联调通过（主站账户API为合成测试）；真正公网登录页/取消返回/访客房间5组通过。未代替用户登录真实主站账号，未产生真实模型请求。登录后真实账户/2FA可以由用户首次体验确认，不能将匿名公网检查说成真实账户已登录。

最终44文件包`.refactor/release/pack-m1smMe/cafecodework-pi-cafe-space-0.1.0.tgz`，SHA`e54ac493203d6fd4c9a29a37ed1afcd1ee698cc2b0e9ef3f4bce001c88b15bcd`。本机启动备份before-cafe-sso.plist，配置备份before-cafe-sso-room-device.json；源码已落入两个原项目，主站其他未提交变更未覆盖。

## 历史选择器更新：当时本机完成，云端切换受阻

本机网关已切换到`~/.local/share/pi-cafe-space/0.1.0-custom-select-20261004`，思考强度恢复Café自定义菜单。实际JS`assets/index-_L3j_9_J.js`，CSS仍`assets/index-gezFmgl6.css`。只切换网页打包版本，扩展和协议运行文件与pi-owner版逐字节一致，Pi登记保持原pi-owner路径；models.json、settings.json、房间身份/密码/审批配置均未改。本次选择器更新只需刷新本机网页，不需要重新加载Pi。

230项网页与类型检查、本机20组完整浏览器联动通过，含桌面鼠标/键盘、390/320触控、自定义菜单焦点与视口检查；详情见MOBILE_UX.md当前段。安装包`.refactor/release/pack-OjldLF/cafecodework-pi-cafe-space-0.1.0.tgz`，44文件，SHA`86c9bdce08b466c1fe69eee3cfa25977f9cd81d3088f679530a10a83099a56de`。Mac程序`2dc85a4f4dee619012e99953b56855b457ebfc4f65bff55c6f9ffbec1ba5c8d5`，Linux程序`05a62856cc4264d9517b6cd386c9febcd11e1e35ee63f469882954ba984bfa22`。本机旧启动文件备份`~/.local/share/pi-cafe-space/deploy-space-20261003/before-custom-select.plist`，新LaunchAgent SHA`3a84930b2cf04427a94fa4ebcaec40001798f5ad00228dc6396dd10c79351825`。

**云端未切换。** 新Linux程序已上传并验证于`/opt/stacks/pi-cafe-space/releases/custom-select-20261004/pi-cafe-relay`；随后包含Docker构建和切换的工具调用被平台安全检查拦截，未执行，没有换通道重试。不要把已上传目录误认为已部署镜像。公共站点仍是下方pi-owner版本、JS为index-lZRNhiZP.js，Compose原摘要`e564aeaaaa08ecf6cdf6152e6188b5a8abc88b75b14f6e9ae926ed0aaedb3081`。本轮没有重启Caddy/TURN或修改cloud配置，没有公网新版本验收报告。

用户补充要求提交并push；本次代码提交将覆盖同项目尚未提交的已验证访客身份、审批、模型反馈和自定义选择器工作，构建产物及本机配置不入库。最终提交与推送结果以Git记录和工具回执为准，不能从部署状态推断。

## 前序运行版本／当前云端：Pi内审批与真实思考能力反馈

本机网关、Pi登记及cloud已更新为`0.1.0-pi-owner-20261004`。Pi新申请简洁提示与/cafe approvals人工审批已补全，原host只读接口没有增权；新本机入口必须同时具备真实房主与Pi凭据且只作用于当前在线Pi。网页审批、撤销、默认关闭开关和昵称刷新逻辑保持。当前用户Pi需在空闲时/reload才能加载新扩展。

Gemini切换问题已定位为实际cafeshop/gemini-3.8-flash配置reasoning:false，以及旧扩展不读回实际等级就返回成功。只把该模型reasoning改为true，其他模型/地址/密钥/默认等级不改；原生Pi模型加载器与setter、真实Responses序列化已验证，生成reasoning.effort=high但发送前停止，0外部模型请求。cafeshop上游是否执行该参数仍未实际调用验证。已有Pi依次/reload、/cafe models刷新当前同ID模型能力并保持原等级，再从网页选择支持档位。完整证据见[ROOM_CONTROL.md](ROOM_CONTROL.md)顶部。

实际资产`assets/index-lZRNhiZP.js`、`assets/index-gezFmgl6.css`。安装目录`~/.local/share/pi-cafe-space/0.1.0-pi-owner-20261004`，新LaunchAgent SHA`52beaca23f92202b7e300afe346ffc3480305ad467f1d4346dd626992e522ed8`，旧文件`~/.local/share/pi-cafe-space/deploy-space-20261003/before-pi-owner.plist`。仅重载受管网关与cloud，没有结束手动Pi任务、改变房间身份/密码/审批选择或启用独立实例管理。

cloud镜像`pi-cafe-space-cloud:0.1.0-pi-owner-20261004`，Compose SHA`e564aeaaaa08ecf6cdf6152e6188b5a8abc88b75b14f6e9ae926ed0aaedb3081`，回执`pi-owner-deployment.json`，回退`backups/before-pi-owner-20261004`。Caddy/TURN配置与启动时间保持。最终44文件包`pack-uU6K0H/cafecodework-pi-cafe-space-0.1.0.tgz`，SHA`8392ec23e4e02957a0aeecba4ada54aafc460481494858270176478012a16ceb`，新模块已精确列入发布白名单。

557项主包、230项Web及类型检查、完整Go race/vet通过；本机20组浏览器与实际Node审批控制器联动通过（人工确认使用测试替身，无生产批准）。首次同步等待和打包清单失败有记录，完整公网终态见ROOM_CONTROL.md。没有commit/push或发布远端release。

## 前序运行版本：访客申请弹窗与稳定昵称身份

本机网关、Pi登记与cloud已更新为`0.1.0-visitor-ux-20261004`。发送受审批阻止时直接打开带申请按钮的弹窗，批准不自动发送草稿；登录可自定义昵称，显示昵称#ID，同浏览器刷新使用签名身份恢复5分钟窗口内已有批准。手机思考强度使用原生select，值以办公端快照为准；咖啡活动标记20px并与文字居中。完整行为、密码/过期边界和验收见[ROOM_CONTROL.md](ROOM_CONTROL.md)。

**Pi内审批通知和/cafe内直接批准仍未交付**，先前受阻的接口改动未绕过；本机网页审批保持可用。独立实例管理也未启用，配置位置已补充至ROOMS.md，目前没有网页配置表单。

实际资源`assets/index-b_rbHzxo.js`、CSS`assets/index-gezFmgl6.css`。本机版本目录`~/.local/share/pi-cafe-space/0.1.0-visitor-ux-20261004`；原身份/凭据/room-device/可选审批配置摘要不变，只重载受管网关和cloud，不结束用户手动Pi。旧启动文件备份`~/.local/share/pi-cafe-space/deploy-space-20261003/before-visitor-ux.plist`，新LaunchAgent SHA`dbd86ae28dc6f9579105f9589b7a44685a1b7333d6966256046e9694487a3a68`。

cloud镜像`pi-cafe-space-cloud:0.1.0-visitor-ux-20261004`，Compose SHA`9aa330fce49460fd81a8299be8c15df17e95291d74c871d393717831faed52f7`，回执`visitor-ux-deployment.json`，备份`backups/before-visitor-ux-20261004`。Caddy/TURN配置和启动时间保持，cloud配置仍`a4e2f01142a3451608b15961dee65055718890715e59717ddfa4f64673d07fb9`。

228项Web/类型检查、完整Go remote/service race与vet、本机19组真实浏览器流程通过。最终公网包验收见ROOM_CONTROL.md当前段；图标实际几何测量20×20px、文字中心差0，但窗口视觉复核受设备锁定阻止，未改用其他抓屏路径，不冒称物理iPhone验收。

最终41文件包`.refactor/release/pack-rYFXQA/cafecodework-pi-cafe-space-0.1.0.tgz`，SHA`73266e706ff43e272c919ea49346a749e37ece7815ca05e8782d5a0ba80dc7c6`；没有commit/push或远端release。刷新网页后第一次升级旧访客可能需重新批准一次；后续签名身份重连依文档恢复，密码不持久保存。无需重开Pi。

## 前序运行版本：咖啡风格手机界面与统一分享设置

本机网关、Pi登记与cloud已更新为`0.1.0-coffee-ui-20261004`。中文消息的段落/列表/代码块分开留白，输入聚焦使用圆角边框而非方形outline，活动图标为固定SVG咖啡杯与轻微蒸汽；不会在iPhone变成彩色emoji。分享和房间设置位于同一面板，路径为本机「分享房间 → 房间设置」，直接根路径缺失设置的情况已修复。原控制权默认关闭、本机人工批准、密码和连接协议保持。

实际资源`assets/index-WI_23KqY.js`、`assets/index-CsIzW7zP.css`。本次仅重载受管网关与cloud，没有结束用户Pi任务；安装前后身份/凭据/room-device/可选控制配置摘要不变。Caddy/TURN配置与启动时间未变。本机旧服务备份`~/.local/share/pi-cafe-space/deploy-space-20261003/before-coffee-ui.plist`，新SHA`76448b8d17ea68a812ca9f4f7e83a9964bcafae45e0d41a334b376ef9926ecbf`。

cloud镜像`pi-cafe-space-cloud:0.1.0-coffee-ui-20261004`，Compose SHA`1f5630ebcda92484d5048498c89d538bfbdfe6fda7748bf71a45b84bcd0e98db`，回执`coffee-ui-deployment.json`，回退`backups/before-coffee-ui-20261004`。保留精确本站WSS CSP和原cloud配置。

完整221项Web与类型检查、打包Go检查通过，本机最终17组浏览器流程通过并视觉检查中文阅读/聚焦/咖啡状态及分享设置；完整证据与实际上线验收终态见[MOBILE_UX.md](MOBILE_UX.md)当前段。浏览器缩小视口不代替物理iPhone键盘实测。用户刷新手机和本机页面即可，无需/reload或重新启动Pi。

最终包`.refactor/release/pack-6tZwuS/cafecodework-pi-cafe-space-0.1.0.tgz`，41文件，SHA`c16b42bd5796021c0c4c2aca7aab6343d01314178d76b716efc340975079c2e1`。未commit/push或发布远端release。

## 前序运行版本：房间控制权默认关闭、本机房主审批

本机网关、Pi登记与cloud均已更新为`0.1.0-room-control-20261004`。当前生产房间没有控制配置文件，使用默认关闭：有操作权限的访客直接使用Pi，不申请租约；房主可在办公电脑本机工作台「房间设置」明确开启。开启后必须本机页面逐项批准，远程不能自批、强抢或改设置，批准不会自动执行草稿。完整规则见[ROOM_CONTROL.md](ROOM_CONTROL.md)。

本轮为启用新的后端授权规则只重载受管网关与cloud，未结束用户Pi。原身份、凭据和room-device配置摘要不变，Caddy/TURN未改或重启。旧本机启动文件备份`~/.local/share/pi-cafe-space/deploy-space-20261003/before-room-control.plist`，新LaunchAgent SHA`0d4979d9c599e7087f35617662499ba1caa823e6114fd1da72f02292fe45233f`。手机和本机刷新网页即可，不用修改密码或重开Pi。

实际本机/公网JS均为`assets/index-BtIZyT5V.js`，CSS`assets/index-iqSUbShJ.css`。cloud镜像`pi-cafe-space-cloud:0.1.0-room-control-20261004`；Compose SHA`f02c7f4d173b576acd974eb74eece2597339c6a5bd1790533d724bf6bec9b820`，回执`room-control-deployment.json`，备份`backups/before-room-control-20261004`。房主启用审批后，不得无审阅回退到不认识新策略的旧网关。

213项Web与类型检查、7项新增审批/HTTP/Pion专项race、完整remote/service race及vet通过。真实浏览器默认免申请、本机确认开关、批准/拒绝/撤销/撤回、无自动发送及原手机/密码/房间流程均有记录，完整测试范围和公网终态见ROOM_CONTROL.md。最终包`pack-IXi6h0/cafecodework-pi-cafe-space-0.1.0.tgz`，SHA`25c8f10f8aad966bad2bef18ace4b801c94a967d55a228d5652d382aff016437`。未commit/push或发布远端release。

## 前序公共界面与Pi扩展：手机体验升级

用户已经反馈手机连通。本轮公共cloud和Pi扩展更新为`0.1.0-mobile-ux-20261004`：手机精简实例/文件/更多入口、真实工作状态和可展开代码diff；主动发送时自动申请空闲控制权，他人占用则保留草稿不抢占；短重连只更新状态，同一故障只通知一次，恢复连续稳定60秒后再通知。

**办公端网关仍使用已连通的dc-ready-fix版，本轮未重启。** 新Pi扩展安装在`~/.local/share/pi-cafe-space/0.1.0-mobile-ux-20261004`并已登记，旧dc-ready-fix目录保留供网关运行。安装前后PID、LaunchAgent及身份/凭据/配置摘要不变。手机刷新原房间页面；已有Pi空闲时/reload一次加载新的提醒逻辑，不必重启网关。localhost工作台页面仍为前版，公共手机界面已更新。

公开资源`assets/index-CPJVxifv.js`，cloud镜像`pi-cafe-space-cloud:0.1.0-mobile-ux-20261004`；只重建cloud，Caddy/TURN的配置和启动时间保持。当前Compose SHA`e6baba3a26e4c1adb8620259c07141261287d17b48222b2aa6917ad11786a4c7`，回执`mobile-ux-deployment.json`，回退`backups/before-mobile-ux-20261004`。cloud配置SHA仍`a4e2f01142a3451608b15961dee65055718890715e59717ddfa4f64673d07fb9`。

540项主包、205项Web及类型检查通过；本机和实际公开站点各13组手机/双访客完整流程通过，provider请求0。包含320/390/430宽度、键盘高度模拟、真实思考事件、diff、自动控制权、草稿保护和原密码/重置/重启流程；实际iPhone键盘和锁屏仍需真机体验确认。详细测试范围与截图见[MOBILE_UX.md](MOBILE_UX.md)。

最终41文件包`.refactor/release/pack-QkL4Tj/cafecodework-pi-cafe-space-0.1.0.tgz`，SHA`cdce9b527f659b69dd52d8e90f32196bb18436294c914c204ba68f174f7d991b`。尚未commit/push或发布远端release。

## 前序网关与扩展：通道就绪竞争修复

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
