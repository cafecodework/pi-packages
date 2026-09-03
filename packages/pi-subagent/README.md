# @cafecodework/pi-subagent

一个轻量的 Pi 扩展，通过 `subagent` 工具把独立任务交给新的 Pi 子进程执行。

## 能力

- `spawn`：启动隔离的子 agent 或指定预设角色，并立即返回 job ID；
- `status`：查看运行状态和最新输出；
- `wait`：等待任务完成；
- `kill`：终止运行中的任务；
- 支持定义 Agent 角色（如 `~/.pi/agent/agents/*.md` 或项目 `.pi/agents/*.md`），自动绑定低成本模型与只读工具；
- 子 agent 完成后，会通过 steering message 把最终报告交回当前会话；
- 最多同时运行 4 个子 agent；
- 子进程默认只启用 `read,bash,grep,find,ls`，需要修改文件时再显式传入 `write,edit`。

子 agent 使用临时的无会话 Pi 进程运行，不会把中间过程写入当前会话，也默认禁用 skills、prompt templates 和 context files，避免递归和上下文膨胀。

## 安装

从 monorepo 安装：

```text
pi install git:github.com/cafecodework/pi-packages
```

也可以安装本地 package：

```text
pi install C:\path\to\pi-packages\packages\pi-subagent
```

## 角色定义（如 quick_explorer）

在 `~/.pi/agent/agents/quick_explorer.md`（或项目 `.pi/agents/quick_explorer.md`）中定义：

```markdown
---
name: quick_explorer
description: Bounded, low-ambiguity, read-only checks with independently verifiable results.
model: gpt-5.6-luna
tools:
  - read
  - bash
  - grep
  - find
  - ls
---

You are quick_explorer.
Handle deterministic searches, inventories, comparisons, and mechanical verification.
Do not edit files. Return concise findings with evidence and file references.
Escalate ambiguity to the parent agent instead of expanding scope.
```

调用时直接指定 `agent: "quick_explorer"` 即可自动使用轻量模型与只读工具：

```text
subagent({
  "action": "spawn",
  "agent": "quick_explorer",
  "task": "搜索项目中所有包含 auth token 的文件路径"
})
```

```text
subagent({
  "action": "spawn",
  "task": "检查当前项目的测试失败原因，并给出修复建议",
  "tools": "read,bash,grep,find,ls"
})
```

然后使用返回的 `jobId` 查询或等待：

```text
subagent({ "action": "status", "jobId": "sa-1" })
subagent({ "action": "wait", "jobId": "sa-1" })
```

`spawn` 参数：

- `task`：要交给子 agent 的完整任务；
- `tools`：逗号分隔的工具名，默认 `read,bash,grep,find,ls`；
- `cwd`：子 agent 的工作目录，默认当前会话目录；
- `model`：可选模型 ID；
- `timeoutSec`：超时时间，默认 600 秒。

`wait`、`status` 和 `kill` 使用 `jobId`；省略时会选择最近的运行中任务。

## 开发

```bash
npm install
npm run typecheck
```
