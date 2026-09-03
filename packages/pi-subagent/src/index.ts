import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Type } from "typebox";
import { getPackageDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { discoverAgents, type AgentDefinition } from "./agents.js";

const MAX_CHILDREN = 4;
const DEFAULT_TOOL_SET = "read,bash,grep,find,ls";
const DEFAULT_TIMEOUT = 600;
const NOTIFICATION_LIMIT = 6000;
const WIDGET_ID = "cafecodework-subagents";

type JobState = "running" | "completed" | "failed" | "killed" | "timeout";

type Job = {
  id: string;
  task: string;
  agentName?: string;
  process: ChildProcess;
  startedAt: number;
  state: JobState;
  output: string;
  error?: string;
  usage?: { input: number; output: number };
  finished: Promise<void>;
};

type ChildMessage = {
  type?: string;
  message?: {
    role?: string;
    stopReason?: string;
    usage?: { input?: number; output?: number };
    content?: Array<{ type?: string; text?: string }>;
  };
};

function result(text: string) {
  return { content: [{ type: "text" as const, text }], details: {} };
}

function piCommand(): { command: string; prefix: string[] } {
  try {
    const directory = getPackageDir();
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, "package.json"), "utf8")) as {
      bin?: { pi?: string } | string;
    };
    const entry = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.pi;
    if (entry) return { command: process.execPath, prefix: [path.join(directory, entry)] };
  } catch {
    // The installed executable is the normal fallback.
  }
  return { command: "pi", prefix: [] };
}

function assistantText(message: ChildMessage["message"]): string {
  return (message?.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("\n")
    .trim();
}

function shorten(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit)}\n…(truncated)` : text;
}

export default function registerSubagent(pi: ExtensionAPI): void {
  const jobs = new Map<string, Job>();
  const executable = piCommand();
  let sequence = 0;
  let ui: { setWidget?: (id: string, lines: string[] | undefined, options?: unknown) => void } | undefined;
  let ticker: NodeJS.Timeout | undefined;

  const runningJobs = () => [...jobs.values()].filter((job) => job.state === "running");

  const refresh = () => {
    if (!ui?.setWidget) return;
    const active = runningJobs();
    const lines = active.length === 0
      ? undefined
      : [
          `● ${active.length} subagent${active.length === 1 ? "" : "s"} running`,
          ...active.map((job) => {
            const seconds = Math.floor((Date.now() - job.startedAt) / 1000);
            const tag = job.agentName ? `[${job.agentName}] ` : "";
            const label = `${tag}${job.task}`.replace(/\s+/g, " ");
            return `  └ ${job.id} · ${seconds}s · ${label.slice(0, 60)}${label.length > 60 ? "…" : ""}`;
          }),
        ];
    try {
      ui.setWidget(WIDGET_ID, lines, { placement: "belowEditor" });
    } catch {
      // A widget must never affect task execution.
    }
  };

  const startTicker = () => {
    if (ticker) return;
    ticker = setInterval(() => {
      if (runningJobs().length === 0) {
        clearInterval(ticker);
        ticker = undefined;
      }
      refresh();
    }, 1000);
    ticker.unref?.();
  };

  const notify = (job: Job) => {
    const body = job.output || job.error || "(no output)";
    const usage = job.usage ? ` (${job.usage.input}+${job.usage.output} tok)` : "";
    const agentPrefix = job.agentName ? `[${job.agentName}] ` : "";
    try {
      pi.sendMessage(
        {
          customType: "subagent-complete",
          content: `Subagent ${job.id} ${agentPrefix}${job.state}${usage}:\n\n${shorten(body, NOTIFICATION_LIMIT)}`,
          display: true,
          details: { jobId: job.id, status: job.state, agent: job.agentName },
        },
        { deliverAs: "steer", triggerTurn: true },
      );
    } catch {
      // Completion can still be retrieved with status or wait.
    }
  };

  const launch = (
    input: {
      task: string;
      agent?: string;
      tools?: string;
      cwd?: string;
      model?: string;
      timeoutSec?: number;
      systemPrompt?: string;
    },
    sessionCwd: string,
  ): Job => {
    const id = `sa-${++sequence}`;
    const tools = input.tools?.trim() || DEFAULT_TOOL_SET;
    const args = [
      ...executable.prefix,
      "--mode", "json", "-p", "--no-session", "-ne",
      "--no-skills", "--no-prompt-templates", "--no-context-files",
      "-t", tools,
    ];
    if (input.model?.trim()) args.push("-m", input.model.trim());
    if (input.systemPrompt?.trim()) args.push("-s", input.systemPrompt.trim());

    args.push(`Task: ${input.task.trim()}`);

    const child = spawn(executable.command, args, {
      cwd: input.cwd || sessionCwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let resolveFinished: () => void = () => undefined;
    const finished = new Promise<void>((resolve) => { resolveFinished = resolve; });
    const job: Job = {
      id,
      task: input.task,
      agentName: input.agent,
      process: child,
      startedAt: Date.now(),
      state: "running",
      output: "",
      finished,
    };
    let lastAssistant: { text: string; usage?: { input: number; output: number } } | undefined;
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (state: JobState, error?: string) => {
      if (settled) return;
      settled = true;
      job.state = state;
      job.error = error;
      job.output = lastAssistant?.text ?? "";
      job.usage = lastAssistant?.usage;
      notify(job);
      resolveFinished();
      refresh();
    };

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
      let newline = stdout.indexOf("\n");
      while (newline >= 0) {
        const line = stdout.slice(0, newline).trim();
        stdout = stdout.slice(newline + 1);
        if (line) {
          try {
            const event = JSON.parse(line) as ChildMessage;
            const message = event.message;
            if (event.type === "message_end" && message?.role === "assistant" && message.stopReason && message.stopReason !== "pending") {
              lastAssistant = {
                text: assistantText(message),
                usage: message.usage ? { input: message.usage.input ?? 0, output: message.usage.output ?? 0 } : undefined,
              };
            }
          } catch {
            // Ignore incomplete or non-JSON child output.
          }
        }
        newline = stdout.indexOf("\n");
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => { stderr = `${stderr}${chunk.toString()}`.slice(-1500); });
    child.once("error", (error) => finish("failed", `spawn failed: ${error.message}`));
    child.once("close", (code) => {
      if (settled) return;
      finish(code === 0 && lastAssistant ? "completed" : "failed", code === 0
        ? `no assistant output${stderr.trim() ? `: ${stderr.trim()}` : ""}`
        : `exit ${code}${stderr.trim() ? `: ${stderr.trim()}` : ""}`);
    });

    const timeout = input.timeoutSec ?? DEFAULT_TIMEOUT;
    const timer = setTimeout(() => {
      if (settled) return;
      child.kill("SIGTERM");
      setTimeout(() => { if (!child.killed) child.kill("SIGKILL"); }, 3000).unref();
      finish("timeout", `timed out after ${timeout}s`);
    }, timeout * 1000);
    timer.unref?.();

    jobs.set(id, job);
    refresh();
    startTicker();
    return job;
  };

  pi.on("session_start", async (_event, ctx) => { ui = ctx.ui as unknown as typeof ui; });
  pi.on("session_shutdown", async () => {
    if (ticker) clearInterval(ticker);
    for (const job of runningJobs()) {
      job.process.kill("SIGKILL");
      job.state = "killed";
    }
  });

  pi.registerTool({
    name: "subagent",
    label: "Subagent",
    description:
      "Delegate an isolated task to a child Pi process or predefined agent role (e.g., quick_explorer). Use spawn to start, then status or wait to retrieve the report; kill stops a running task.",
    promptSnippet: "Delegate self-contained work to an isolated child agent or agent role",
    promptGuidelines: [
      "Use 'quick_explorer' agent for cheap, bounded, read-only searches, inspections, and inventories to save tokens.",
      "Use read-only tools for investigation; only grant write/edit when the child should modify files.",
    ],
    parameters: Type.Object({
      action: Type.Union([Type.Literal("spawn"), Type.Literal("wait"), Type.Literal("status"), Type.Literal("kill")]),
      agent: Type.Optional(Type.String({ description: "Predefined agent role name (e.g. 'quick_explorer')" })),
      task: Type.Optional(Type.String({ description: "Task description for the agent" })),
      tools: Type.Optional(Type.String({ description: "Comma-separated tools list" })),
      cwd: Type.Optional(Type.String({ description: "Working directory" })),
      model: Type.Optional(Type.String({ description: "Model override (e.g. 'gpt-5.6-luna')" })),
      timeoutSec: Type.Optional(Type.Number({ description: "Timeout in seconds" })),
      jobId: Type.Optional(Type.String({ description: "Job ID for wait/status/kill" })),
    }),
    async execute(_callId, params, _signal, _update, ctx) {
      if (!ui) ui = ctx.ui as unknown as typeof ui;
      if (params.action === "spawn") {
        if (!params.task?.trim()) return result("spawn requires a non-empty task");
        if (runningJobs().length >= MAX_CHILDREN) return result(`concurrency limit reached (${MAX_CHILDREN})`);

        let effectiveModel = params.model;
        let effectiveTools = params.tools;
        let effectiveSystemPrompt: string | undefined = undefined;

        if (params.agent?.trim()) {
          const agents = discoverAgents(ctx.cwd);
          const found = agents.find((a) => a.name.toLowerCase() === params.agent!.trim().toLowerCase());
          if (found) {
            effectiveModel = effectiveModel || found.model;
            if (!effectiveTools && found.tools && found.tools.length > 0) {
              effectiveTools = found.tools.join(",");
            }
            effectiveSystemPrompt = found.systemPrompt;
          }
        }

        const job = launch({
          task: params.task,
          agent: params.agent,
          tools: effectiveTools,
          cwd: params.cwd,
          model: effectiveModel,
          systemPrompt: effectiveSystemPrompt,
          timeoutSec: params.timeoutSec,
        }, ctx.cwd);

        const agentInfo = params.agent ? ` role: '${params.agent}',` : "";
        const modelInfo = effectiveModel ? ` model: '${effectiveModel}',` : "";
        return result(`subagent ${job.id} started (${agentInfo}${modelInfo} tools: ${effectiveTools || DEFAULT_TOOL_SET}). Continue working; its completion report will arrive automatically.`);
      }

      const job = params.jobId
        ? jobs.get(params.jobId)
        : [...jobs.values()].reverse().find((candidate) => candidate.state === "running");
      if (!job) return result(`no matching subagent found: ${params.jobId ?? "latest"}`);
      if (params.action === "status") {
        const agentLabel = job.agentName ? ` [${job.agentName}]` : "";
        return result(`subagent ${job.id}${agentLabel}: ${job.state} (${Math.floor((Date.now() - job.startedAt) / 1000)}s)\n\n${shorten(job.output || job.error || "(still running)", 1500)}`);
      }
      if (params.action === "wait") {
        await Promise.race([job.finished, new Promise<void>((resolve) => setTimeout(resolve, 120000))]);
        const agentLabel = job.agentName ? ` [${job.agentName}]` : "";
        return result(`subagent ${job.id}${agentLabel}: ${job.state}\n\n${shorten(job.output || job.error || "(no output)", NOTIFICATION_LIMIT)}`);
      }
      if (job.state !== "running") return result(`subagent ${job.id} is already ${job.state}`);
      job.process.kill("SIGTERM");
      job.state = "killed";
      refresh();
      return result(`subagent ${job.id} killed`);
    },
  });
}
