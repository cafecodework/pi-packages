# @cafecodework/pi-theme-cafecode

面向 Pi 的 Claude 风格主题和界面扩展，作为 `cafecodework` 的独立主题项目维护。

## 包含内容

- 深色、浅色、ANSI 和色觉友好主题变体；
- 启动欢迎横幅；
- 模型、目录和 Git 分支状态栏；
- Claude 风格 spinner 和回合摘要；
- 工具调用的紧凑渲染、连续调用分组和 diff 展示；
- Thinking 内容的折叠显示；
- `❯` 风格的输入提示符；
- `/cc-theme`、`/cc-tools` 和 `/cc-spinner` 命令。

这是一个独立维护的基础版本，后续会在此基础上继续调整颜色、布局和交互细节。

## 安装

从 monorepo 安装：

```text
pi install git:github.com/cafecodework/pi-packages
```

也可以安装本地目录：

```text
pi install C:\path\to\pi-packages\packages\pi-theme-cafecode
```

如果使用扩展自己的欢迎横幅，可以在 `~/.pi/agent/settings.json` 中关闭 Pi 默认启动头部：

```json
{ "quietStartup": true }
```

## 使用

安装后可通过 `/themes` 浏览主题，并使用以下命令进行配置：

```text
/cc-theme
/cc-tools
/cc-spinner
```

主题资源位于 `theme/`，界面扩展位于 `extension/`，后续修改这两个目录即可继续定制。

## 开发

```bash
npm install
npm run typecheck
```

## 许可

MIT
