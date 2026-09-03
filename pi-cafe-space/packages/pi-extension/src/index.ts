import { SessionManager, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  MAX_FRAME_BYTES,
  PROTOCOL_VERSION,
  applyEvent,
  type CollabEvent,
  type EventEnvelope,
  type HostCommandResultMessage,
  type JsonValue,
  type RoutedCommandMessage,
  type SessionSnapshot,
  type ToolExecution,
  type TranscriptMessage,
} from "@pi-collab/protocol";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { FileCommandError, listProjectDirectory, readProjectFile } from "./file-commands.js";
import { ensureLocalRelay } from "./local-relay.js";

const DEVELOPMENT_HOST_TOKEN = "local-dev-host-token";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const MAX_RETRY_DELAY_MS = 10_000;
const MAX_COMMAND_RESULTS = 1_000;
const MAX_TEXT_LENGTH = 32_000;
const MAX_SNAPSHOT_TOOLS = 24;
const MAX_RETAINED_TOOLS = 100;
const SNAPSHOT_FRAME_BUDGET = MAX_FRAME_BYTES - 1024;

type UnknownRecord = Record<string, unknown>;

interface HostConfig {
  relayUrl: string;
  roomId: string;
  token: string;
  peerId: string;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function truncate(value: string, max = MAX_TEXT_LENGTH): string {
  return value.length <= max ? value : `${value.slice(0, max)}\n… [truncated]`;
}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => {
    if (!isRecord(part)) return "";
    if (part.type === "text" && typeof part.text === "string") return part.text;
    if (part.type === "image") return "[image]";
    if (part.type === "toolCall" && typeof part.name === "string") return `[tool call: ${part.name}]`;
    return "";
  }).filter(Boolean).join("\n");
}

function thinkingFromContent(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content.map((part) => isRecord(part) && part.type === "thinking" && typeof part.thinking === "string" ? part.thinking : "")
    .filter(Boolean).join("\n");
}

function safeJson(value: unknown, max = 32_000): string {
  try {
    const seen = new WeakSet<object>();
    const encoded = JSON.stringify(value, (_key, current: unknown) => {
      if (typeof current === "bigint") return `${current}n`;
      if (typeof current === "object" && current !== null) {
        if (seen.has(current)) return "[Circular]";
        seen.add(current);
      }
      return current;
    });
    return truncate(encoded ?? String(value), max);
  } catch {
    return "[unserializable]";
  }
}

function modelRef(model: unknown): SessionSnapshot["model"] {
  if (!isRecord(model) || typeof model.provider !== "string" || typeof model.id !== "string") return null;
  return { provider: model.provider, id: model.id };
}

function roleForMessage(role: unknown): TranscriptMessage["role"] | null {
  if (role === "user") return "user";
  if (role === "assistant") return "assistant";
  if (role === "toolResult") return "tool";
  return null;
}

function messageProjection(message: unknown, id: string, status: TranscriptMessage["status"]): TranscriptMessage | null {
  if (!isRecord(message)) return null;
  const role = roleForMessage(message.role);
  if (!role) return null;
  const content = message.content;
  const toolCall = Array.isArray(content)
    ? content.find((part) => isRecord(part) && part.type === "toolCall")
    : undefined;
  const toolCallRecord = isRecord(toolCall) ? toolCall : undefined;
  const timestamp = typeof message.timestamp === "number" && Number.isFinite(message.timestamp) ? message.timestamp : Date.now();
  return {
    id,
    role,
    text: truncate(textFromContent(content)),
    thinking: truncate(thinkingFromContent(content)),
    timestamp,
    status,
    toolName: typeof message.toolName === "string"
      ? message.toolName
      : typeof toolCallRecord?.name === "string" ? toolCallRecord.name : null,
    toolCallId: typeof message.toolCallId === "string"
      ? message.toolCallId
      : typeof toolCallRecord?.id === "string" ? toolCallRecord.id : null,
  };
}

function historicalMessages(entries: readonly unknown[], maxMessages = 100): { messages: TranscriptMessage[]; truncated: boolean } {
  const messages: TranscriptMessage[] = [];
  for (const entry of entries) {
    if (!isRecord(entry) || entry.type !== "message") continue;
    const projection = messageProjection(entry.message, typeof entry.id === "string" ? entry.id : randomUUID(), "complete");
    if (projection) messages.push(projection);
  }
  let selected = messages.length > maxMessages ? messages.slice(-maxMessages) : [...messages];
  let truncated = selected.length < messages.length;
  const frameBudget = MAX_FRAME_BYTES - 16 * 1024;
  while (selected.length > 1 && Buffer.byteLength(JSON.stringify(selected), "utf8") > frameBudget) {
    selected = selected.slice(1);
    truncated = true;
  }
  return { messages: selected, truncated };
}

function transcriptMessageJson(message: TranscriptMessage): JsonValue {
  return {
    id: message.id,
    role: message.role,
    text: message.text,
    thinking: message.thinking,
    timestamp: message.timestamp,
    status: message.status,
    toolName: message.toolName,
    toolCallId: message.toolCallId,
  };
}

function historicalSnapshot(pi: ExtensionAPI, ctx: ExtensionContext, streamId: string, lastEventSeq: number): SessionSnapshot {
  const historical = historicalMessages(ctx.sessionManager.getBranch());
  return {
    protocolVersion: PROTOCOL_VERSION,
    streamId,
    sessionId: ctx.sessionManager.getSessionId(),
    sessionName: pi.getSessionName() ?? null,
    cwd: ctx.cwd,
    activeLeafId: ctx.sessionManager.getLeafId() ?? null,
    model: modelRef(ctx.model),
    thinkingLevel: pi.getThinkingLevel(),
    phase: ctx.isIdle() ? "idle" : "running",
    hasPendingMessages: ctx.hasPendingMessages(),
    messages: historical.messages,
    historyTruncated: historical.truncated,
    tools: [],
    lastEventSeq,
  };
}

function snapshotFrameSize(snapshot: SessionSnapshot): number {
  return Buffer.byteLength(JSON.stringify({ type: "snapshot", snapshot }), "utf8");
}

export function compactSnapshot(snapshot: SessionSnapshot): SessionSnapshot {
  let messages = snapshot.messages.length > 100 ? snapshot.messages.slice(-100) : [...snapshot.messages];
  let historyTruncated = snapshot.historyTruncated || messages.length < snapshot.messages.length;
  let tools = snapshot.tools.slice(-MAX_SNAPSHOT_TOOLS).map((tool) => ({
    ...tool,
    argsText: truncate(tool.argsText, 4_096),
    output: truncate(tool.output, 8_192),
  }));
  const makeSnapshot = (): SessionSnapshot => ({ ...snapshot, messages, historyTruncated, tools });

  while (messages.length > 1 && snapshotFrameSize(makeSnapshot()) > SNAPSHOT_FRAME_BUDGET) {
    messages = messages.slice(1);
    historyTruncated = true;
  }
  while (tools.length > 0 && snapshotFrameSize(makeSnapshot()) > SNAPSHOT_FRAME_BUDGET) {
    tools = tools.slice(1);
  }
  if (snapshotFrameSize(makeSnapshot()) > SNAPSHOT_FRAME_BUDGET) {
    messages = messages.map((message) => ({
      ...message,
      text: truncate(message.text, 4_096),
      thinking: truncate(message.thinking, 4_096),
    }));
    tools = tools.map((tool) => ({
      ...tool,
      argsText: truncate(tool.argsText, 1_024),
      output: truncate(tool.output, 2_048),
    }));
  }
  while (messages.length > 1 && snapshotFrameSize(makeSnapshot()) > SNAPSHOT_FRAME_BUDGET) {
    messages = messages.slice(1);
    historyTruncated = true;
  }
  while (tools.length > 0 && snapshotFrameSize(makeSnapshot()) > SNAPSHOT_FRAME_BUDGET) {
    tools = tools.slice(1);
  }
  if (snapshotFrameSize(makeSnapshot()) > SNAPSHOT_FRAME_BUDGET) {
    const latest = messages.at(-1);
    messages = latest ? [{ ...latest, text: truncate(latest.text, 1_024), thinking: truncate(latest.thinking, 1_024) }] : [];
    tools = [];
    historyTruncated = true;
  }
  if (snapshotFrameSize(makeSnapshot()) > SNAPSHOT_FRAME_BUDGET) {
    messages = [];
    tools = [];
    historyTruncated = true;
  }
  const compacted = makeSnapshot();
  return snapshotFrameSize(compacted) <= SNAPSHOT_FRAME_BUDGET ? compacted : {
    ...snapshot,
    messages: [],
    historyTruncated: true,
    tools: [],
  };
}

function normalizeRelayUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol === "http:") url.protocol = "ws:";
  if (url.protocol === "https:") url.protocol = "wss:";
  if (url.protocol !== "ws:" && url.protocol !== "wss:") throw new Error("Relay URL must use ws:// or wss://");
  if (!url.pathname || url.pathname === "/") url.pathname = "/ws";
  return url.toString();
}

function isLoopbackRelay(value: string): boolean {
  try {
    return LOOPBACK_HOSTS.has(new URL(value).hostname);
  } catch {
    return false;
  }
}

function configuration(pi: ExtensionAPI): HostConfig {
  const flagRelay = pi.getFlag("collab-relay");
  const flagRoom = pi.getFlag("collab-room");
  const relayUrl = normalizeRelayUrl(
    typeof flagRelay === "string" ? flagRelay : process.env.PI_COLLAB_RELAY_URL ?? "ws://127.0.0.1:37891/ws",
  );
  const token = process.env.PI_COLLAB_HOST_TOKEN ?? (isLoopbackRelay(relayUrl) ? DEVELOPMENT_HOST_TOKEN : "");
  if (!token) throw new Error("PI_COLLAB_HOST_TOKEN is required for a non-loopback relay");
  const roomId = typeof flagRoom === "string" && flagRoom ? flagRoom : process.env.PI_COLLAB_ROOM ?? "main";
  return { relayUrl, roomId, token, peerId: `pi-host-${process.pid}-${roomId}` };
}

class PiCollabHost {
  private socket: WebSocket | null = null;
  private stopped = false;
  private welcomed = false;
  private retryTimer: NodeJS.Timeout | null = null;
  private retryDelay = 500;
  private commandTail: Promise<void> = Promise.resolve();
  private currentContext: ExtensionContext;
  private snapshot: SessionSnapshot;
  private sequence = 0;
  private activeAssistantId: string | null = null;
  private snapshotReady = false;
  private messageIds = new Map<string, string>();
  private tools = new Map<string, ToolExecution>();
  private commandResults = new Map<string, HostCommandResultMessage>();
  private activeCommands = new Set<string>();

  constructor(private readonly pi: ExtensionAPI, ctx: ExtensionContext, private readonly config: HostConfig) {
    this.currentContext = ctx;
    this.snapshot = historicalSnapshot(pi, ctx, randomUUID(), 0);
  }

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.welcomed = false;
    this.snapshotReady = false;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    const socket = this.socket;
    this.socket = null;
    if (socket) socket.close(1000, "Pi Cafe Space stopped");
    this.setStatus("disconnected", true);
  }

  status(): string {
    if (this.stopped) return "disabled";
    if (this.welcomed) return `connected (${this.config.roomId})`;
    if (this.socket) return "connecting";
    return "reconnecting";
  }

  private setStatus(value: string, force = false): void {
    if (this.stopped && !force) return;
    try {
      if (this.currentContext.hasUI) this.currentContext.ui.setStatus("pi-collab", `collab: ${value}`);
    } catch {
      // Pi may invalidate an extension context during shutdown/reload.
    }
  }

  private connect(): void {
    if (this.stopped || this.socket) return;
    this.setStatus("connecting");
    const socket = new WebSocket(this.config.relayUrl, { maxPayload: 256 * 1024 });
    this.socket = socket;
    socket.once("open", () => {
      this.retryDelay = 500;
      this.welcomed = false;
      socket.send(JSON.stringify({
        type: "hello",
        protocolVersion: PROTOCOL_VERSION,
        peerRole: "host",
        peerId: this.config.peerId,
        roomId: this.config.roomId,
        token: this.config.token,
      }));
      this.setStatus("authenticating");
    });
    socket.on("message", (data, isBinary) => {
      if (isBinary) return;
      try {
        const raw = typeof data === "string" ? data : data.toString();
        const message = JSON.parse(raw) as Record<string, unknown>;
        this.handleRelayMessage(message);
      } catch (error) {
        this.notify("error", `relay message error: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
    socket.once("error", (error) => {
      this.notify("warning", `relay connection: ${error.message}`);
    });
    socket.once("close", () => {
      if (this.socket === socket) this.socket = null;
      this.welcomed = false;
      this.snapshotReady = false;
      this.setStatus(this.stopped ? "disconnected" : "reconnecting");
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.retryTimer) return;
    const delay = this.retryDelay;
    this.retryDelay = Math.min(MAX_RETRY_DELAY_MS, this.retryDelay * 2);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, delay);
  }

  private handleRelayMessage(message: Record<string, unknown>): void {
    if (this.stopped) return;
    if (message.type === "welcome") {
      this.welcomed = true;
      this.setStatus("connected");
      this.snapshotReady = this.sendSnapshot();
      if (!this.snapshotReady) this.socket?.close(1011, "Unable to send Pi Cafe Space snapshot");
      return;
    }
    if (message.type === "routed_command") {
      if (!isRecord(message.payload) || typeof message.relayRequestId !== "string" ||
        typeof message.expectedStreamId !== "string" || typeof message.clientRequestId !== "string" ||
        typeof message.sourcePeerId !== "string") return;
      const command = message as unknown as RoutedCommandMessage;
      const previous = this.commandResults.get(command.relayRequestId);
      if (previous) {
        this.send(previous);
        return;
      }
      if (this.activeCommands.has(command.relayRequestId)) return;
      this.activeCommands.add(command.relayRequestId);
      this.commandTail = this.commandTail
        .then(() => this.executeCommand(command))
        .catch((error: unknown) => {
          this.sendCommandResult(command.relayRequestId, "rejected", "COMMAND_ERROR", error instanceof Error ? error.message : String(error));
        })
        .finally(() => {
          this.activeCommands.delete(command.relayRequestId);
        });
      return;
    }
    if (message.type === "error" && typeof message.message === "string") {
      this.notify("warning", `relay: ${message.message}`);
    }
  }

  private send(message: object): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    const encoded = JSON.stringify(message);
    if (Buffer.byteLength(encoded, "utf8") > MAX_FRAME_BYTES) {
      this.notify("error", "Pi Cafe Space message exceeds relay frame limit");
      return false;
    }
    this.socket.send(encoded);
    return true;
  }

  private sendSnapshot(): boolean {
    this.snapshot = compactSnapshot(this.snapshot);
    return this.send({ type: "snapshot", snapshot: this.snapshot });
  }

  private notify(level: "info" | "warning" | "error", message: string): void {
    if (this.stopped) return;
    try {
      if (this.currentContext.hasUI) this.currentContext.ui.notify(message, level === "warning" ? "warning" : level);
    } catch {
      // Pi may invalidate an extension context during shutdown/reload.
    }
  }

  private sendCommandResult(
    relayRequestId: string,
    status: HostCommandResultMessage["status"],
    code: string | null,
    message: string | null,
    data?: JsonValue,
  ): void {
    const result: HostCommandResultMessage = { type: "host_command_result", relayRequestId, status, code, message };
    if (data !== undefined) result.data = data;
    this.commandResults.set(relayRequestId, result);
    while (this.commandResults.size > MAX_COMMAND_RESULTS) {
      const first = this.commandResults.keys().next().value as string | undefined;
      if (!first) break;
      this.commandResults.delete(first);
    }
    this.send(result);
  }

  private async listSessions(ctx: ExtensionContext): Promise<JsonValue> {
    const sessions = await SessionManager.list(ctx.cwd);
    return {
      kind: "sessions",
      currentSessionId: ctx.sessionManager.getSessionId(),
      sessions: sessions
        .sort((left, right) => right.modified.getTime() - left.modified.getTime())
        .slice(0, 100)
        .map((session) => ({
          sessionId: session.id,
          name: session.name ?? null,
          cwd: session.cwd || ctx.cwd,
          created: session.created.toISOString(),
          modified: session.modified.toISOString(),
          messageCount: session.messageCount,
          firstMessage: truncate(session.firstMessage, 500),
        })),
    };
  }

  private async getHistoricalSession(ctx: ExtensionContext, sessionId: string): Promise<JsonValue> {
    const sessions = await SessionManager.list(ctx.cwd);
    const info = sessions.find((session) => session.id === sessionId);
    if (!info) throw new FileCommandError("SESSION_NOT_FOUND", "The requested session was not found in this project");
    const manager = SessionManager.open(info.path);
    const entries = manager.getBranch();
    let model: SessionSnapshot["model"] = null;
    let thinkingLevel: SessionSnapshot["thinkingLevel"] = "off";
    for (const entry of entries) {
      if (!isRecord(entry)) continue;
      if (entry.type === "model_change" && typeof entry.provider === "string" && typeof entry.modelId === "string") {
        model = { provider: entry.provider, id: entry.modelId };
      }
      if (entry.type === "thinking_level_change" && typeof entry.thinkingLevel === "string" &&
        (entry.thinkingLevel === "off" || entry.thinkingLevel === "minimal" || entry.thinkingLevel === "low" ||
          entry.thinkingLevel === "medium" || entry.thinkingLevel === "high" || entry.thinkingLevel === "xhigh" || entry.thinkingLevel === "max")) {
        thinkingLevel = entry.thinkingLevel;
      }
    }
    const historical = historicalMessages(entries);
    return {
      kind: "session",
      sessionId: info.id,
      name: info.name ?? null,
      cwd: info.cwd || ctx.cwd,
      activeLeafId: manager.getLeafId(),
      model: model ? { provider: model.provider, id: model.id } : null,
      thinkingLevel,
      messages: historical.messages.map(transcriptMessageJson),
      historyTruncated: historical.truncated,
      modified: info.modified.toISOString(),
    };
  }

  private async executeCommand(command: RoutedCommandMessage): Promise<void> {
    if (command.expectedStreamId !== this.snapshot.streamId) {
      this.sendCommandResult(command.relayRequestId, "rejected", "STALE_STREAM", "The active Pi session changed");
      return;
    }
    const ctx = this.currentContext;
    const payload = command.payload;
    if (this.stopped) {
      this.sendCommandResult(command.relayRequestId, "rejected", "HOST_STOPPING", "The Pi Cafe Space host is stopping");
      return;
    }
    try {
      switch (payload.name) {
        case "prompt": {
          if (!ctx.isIdle() && !payload.delivery) {
            this.sendCommandResult(command.relayRequestId, "rejected", "DELIVERY_REQUIRED", "Choose steer or followUp while Pi is running");
            return;
          }
          if (payload.delivery) {
            this.pi.sendUserMessage(payload.content, { deliverAs: payload.delivery });
          } else {
            this.pi.sendUserMessage(payload.content);
          }
          this.sendCommandResult(command.relayRequestId, "dispatched", null, "Prompt dispatched to Pi");
          return;
        }
        case "abort":
          ctx.abort();
          this.sendCommandResult(command.relayRequestId, "dispatched", null, "Abort dispatched to Pi");
          return;
        case "set_thinking":
          this.pi.setThinkingLevel(payload.level);
          this.sendCommandResult(command.relayRequestId, "applied", null, null);
          return;
        case "set_model": {
          const model = ctx.modelRegistry.find(payload.provider, payload.modelId);
          if (!model) {
            this.sendCommandResult(command.relayRequestId, "rejected", "MODEL_NOT_FOUND", "Model is not available in this Pi session");
            return;
          }
          const success = await this.pi.setModel(model);
          this.sendCommandResult(command.relayRequestId, success ? "applied" : "rejected", success ? null : "MODEL_AUTH", success ? null : "No usable authentication for this model");
          return;
        }
        case "list_dir": {
          const data = await listProjectDirectory(ctx.cwd, payload.path);
          this.sendCommandResult(command.relayRequestId, "applied", null, null, data);
          return;
        }
        case "read_file": {
          const data = await readProjectFile(ctx.cwd, payload.path, payload.offset, payload.limit);
          this.sendCommandResult(command.relayRequestId, "applied", null, null, data);
          return;
        }
        case "list_sessions": {
          const data = await this.listSessions(ctx);
          this.sendCommandResult(command.relayRequestId, "applied", null, null, data);
          return;
        }
        case "get_session": {
          const data = await this.getHistoricalSession(ctx, payload.sessionId);
          this.sendCommandResult(command.relayRequestId, "applied", null, null, data);
          return;
        }
      }
    } catch (error) {
      const code = error instanceof FileCommandError ? error.code : "COMMAND_ERROR";
      this.sendCommandResult(command.relayRequestId, "rejected", code, error instanceof Error ? error.message : String(error));
    }
  }

  private emit(event: CollabEvent): void {
    const envelope: EventEnvelope = {
      type: "event",
      streamId: this.snapshot.streamId,
      sessionId: this.snapshot.sessionId,
      seq: ++this.sequence,
      emittedAt: new Date().toISOString(),
      event,
    };
    try {
      this.snapshot = compactSnapshot(applyEvent(this.snapshot, envelope));
    } catch {
      this.snapshot = historicalSnapshot(this.pi, this.currentContext, this.snapshot.streamId, envelope.seq - 1);
      this.snapshot = compactSnapshot(applyEvent(this.snapshot, envelope));
    }
    if (!this.welcomed || !this.snapshotReady) return;
    this.send(envelope);
  }

  private refreshSnapshot(): void {
    this.snapshot = historicalSnapshot(this.pi, this.currentContext, this.snapshot.streamId, this.sequence);
    this.snapshot.tools = [...this.tools.values()];
    if (this.welcomed) this.snapshotReady = this.sendSnapshot();
  }

  private messageId(message: unknown): string {
    if (isRecord(message)) {
      const role = typeof message.role === "string" ? message.role : "unknown";
      const timestamp = typeof message.timestamp === "number" ? message.timestamp : 0;
      const toolCallId = typeof message.toolCallId === "string" ? message.toolCallId : "";
      const key = `${role}:${timestamp}:${toolCallId}`;
      const existing = this.messageIds.get(key);
      if (existing) return existing;
      const id = `m-${randomUUID()}`;
      this.messageIds.set(key, id);
      return id;
    }
    return `m-${randomUUID()}`;
  }

  onMessageStart(message: unknown, ctx: ExtensionContext): void {
    this.currentContext = ctx;
    const role = isRecord(message) ? message.role : undefined;
    const id = this.messageId(message);
    const status: TranscriptMessage["status"] = role === "assistant" ? "streaming" : "complete";
    const projection = messageProjection(message, id, status);
    if (!projection) return;
    if (role === "assistant") this.activeAssistantId = id;
    this.emit({ kind: "message_started", message: { ...projection, text: role === "assistant" ? "" : projection.text, thinking: role === "assistant" ? "" : projection.thinking } });
  }

  onMessageUpdate(message: unknown, assistantMessageEvent: unknown, ctx: ExtensionContext): void {
    this.currentContext = ctx;
    const event = isRecord(assistantMessageEvent) ? assistantMessageEvent : undefined;
    if (!event || (event.type !== "text_delta" && event.type !== "thinking_delta") || typeof event.delta !== "string") return;
    const id = this.activeAssistantId ?? this.messageId(message);
    if (!this.snapshot.messages.some((item) => item.id === id)) {
      const projection = messageProjection(message, id, "streaming");
      if (projection) this.emit({ kind: "message_started", message: { ...projection, text: "", thinking: "" } });
      this.activeAssistantId = id;
    }
    this.emit({ kind: "message_delta", messageId: id, channel: event.type === "text_delta" ? "text" : "thinking", delta: truncate(event.delta) });
  }

  onMessageEnd(message: unknown, ctx: ExtensionContext): void {
    this.currentContext = ctx;
    const role = isRecord(message) ? message.role : undefined;
    const id = role === "assistant" && this.activeAssistantId ? this.activeAssistantId : this.messageId(message);
    const error = isRecord(message) && message.stopReason === "error";
    const projection = messageProjection(message, id, error ? "error" : "complete");
    if (projection) this.emit({ kind: "message_finished", message: projection });
    if (role === "assistant") this.activeAssistantId = null;
  }

  private retainTool(tool: ToolExecution): void {
    this.tools.set(tool.toolCallId, tool);
    while (this.tools.size > MAX_RETAINED_TOOLS) {
      const first = this.tools.keys().next().value as string | undefined;
      if (!first) break;
      this.tools.delete(first);
    }
  }

  onToolStart(toolCallId: string, toolName: string, args: unknown, ctx: ExtensionContext): void {
    this.currentContext = ctx;
    const tool: ToolExecution = { toolCallId, toolName, argsText: safeJson(args), output: "", status: "running" };
    this.retainTool(tool);
    this.emit({ kind: "tool_started", tool });
  }

  onToolUpdate(toolCallId: string, partialResult: unknown, ctx: ExtensionContext): void {
    this.currentContext = ctx;
    const output = truncate(textFromContent(isRecord(partialResult) ? partialResult.content : partialResult));
    const existing = this.tools.get(toolCallId);
    if (existing) this.retainTool({ ...existing, output });
    this.emit({ kind: "tool_updated", toolCallId, output });
  }

  onToolEnd(toolCallId: string, toolName: string, result: unknown, isError: boolean, ctx: ExtensionContext): void {
    this.currentContext = ctx;
    const existing = this.tools.get(toolCallId) ?? { toolCallId, toolName, argsText: "", output: "", status: "running" as const };
    const tool: ToolExecution = { ...existing, toolName, output: truncate(textFromContent(isRecord(result) ? result.content : result)), status: isError ? "error" : "complete" };
    this.retainTool(tool);
    this.emit({ kind: "tool_finished", tool });
  }

  onAgentState(phase: SessionSnapshot["phase"], ctx: ExtensionContext): void {
    this.currentContext = ctx;
    this.emit({ kind: "session_state", phase, hasPendingMessages: ctx.hasPendingMessages() });
  }

  onUiWait(waiting: boolean, title: string | null, ctx: ExtensionContext): void {
    this.currentContext = ctx;
    this.emit({ kind: "ui_wait", waiting, title });
  }

  onModelChanged(model: unknown, ctx: ExtensionContext): void {
    this.currentContext = ctx;
    this.emit({ kind: "model_changed", model: modelRef(model) });
  }

  onThinkingChanged(level: string, ctx: ExtensionContext): void {
    this.currentContext = ctx;
    if (level === "off" || level === "minimal" || level === "low" || level === "medium" || level === "high" || level === "xhigh" || level === "max") {
      this.emit({ kind: "thinking_changed", level });
    }
  }

  onSessionChanged(ctx: ExtensionContext): void {
    this.currentContext = ctx;
    this.refreshSnapshot();
  }
}

function autoEnabled(pi: ExtensionAPI): boolean {
  const environment = (process.env.PI_COLLAB_ENABLED ?? "").toLowerCase();
  if (["0", "false", "no", "off"].includes(environment)) return false;
  if (["1", "true", "yes", "on"].includes(environment)) return true;
  return pi.getFlag("collab") !== false;
}

export default function registerPiCollabExtension(pi: ExtensionAPI): void {
  pi.registerFlag("collab", { type: "boolean", description: "Connect this Pi session to the Pi Cafe Space relay", default: true });
  pi.registerFlag("collab-relay", { type: "string", description: "Pi Cafe Space relay WebSocket URL" });
  pi.registerFlag("collab-room", { type: "string", description: "Pi Cafe Space room ID" });

  let host: PiCollabHost | null = null;
  let startPromise: Promise<void> | null = null;
  let lifecycleGeneration = 0;

  const start = (ctx: ExtensionContext): Promise<void> => {
    if (host) return Promise.resolve();
    if (startPromise) return startPromise;
    const generation = lifecycleGeneration;
    const pending = (async () => {
      try {
        const config = configuration(pi);
        const relayStatus = await ensureLocalRelay({ relayUrl: config.relayUrl, hostToken: config.token });
        if (generation !== lifecycleGeneration) return;
        if (relayStatus === "unavailable" && ctx.hasUI) {
          ctx.ui.notify("Pi Cafe Space local relay is unavailable; continuing with reconnect attempts", "warning");
        }
        host = new PiCollabHost(pi, ctx, config);
        host.start();
        if (ctx.hasUI && relayStatus === "started") ctx.ui.notify("Pi Cafe Space relay started automatically", "info");
        if (ctx.hasUI) ctx.ui.notify("Pi Cafe Space host connecting", "info");
      } catch (error) {
        if (generation !== lifecycleGeneration) return;
        try {
          if (ctx.hasUI) ctx.ui.notify(`Pi Cafe Space: ${error instanceof Error ? error.message : String(error)}`, "error");
        } catch {
          // Pi may invalidate the context while startup is in flight.
        }
      }
    })();
    startPromise = pending;
    void pending.finally(() => {
      if (startPromise === pending) startPromise = null;
    });
    return pending;
  };

  pi.on("session_start", async (_event, ctx) => {
    if (autoEnabled(pi)) await start(ctx);
  });

  pi.on("session_shutdown", () => {
    lifecycleGeneration++;
    startPromise = null;
    host?.stop();
    host = null;
  });

  pi.registerCommand("collab-connect", {
    description: "Connect the current Pi session to Pi Cafe Space",
    handler: async (_args, ctx) => {
      await start(ctx);
    },
  });

  pi.registerCommand("collab-disconnect", {
    description: "Disconnect the current Pi session from Pi Cafe Space",
    handler: async (_args, ctx) => {
      lifecycleGeneration++;
      startPromise = null;
      host?.stop();
      host = null;
      ctx.ui.notify("Pi Cafe Space disconnected", "info");
    },
  });

  pi.registerCommand("collab-status", {
    description: "Show Pi Cafe Space connection status",
    handler: async (_args, ctx) => {
      ctx.ui.notify(`Pi Cafe Space: ${host?.status() ?? "disabled"}`, "info");
    },
  });

  pi.on("message_start", (event, ctx) => host?.onMessageStart(event.message, ctx));
  pi.on("message_update", (event, ctx) => host?.onMessageUpdate(event.message, event.assistantMessageEvent, ctx));
  pi.on("message_end", (event, ctx) => host?.onMessageEnd(event.message, ctx));
  pi.on("tool_execution_start", (event, ctx) => host?.onToolStart(event.toolCallId, event.toolName, event.args, ctx));
  pi.on("tool_execution_update", (event, ctx) => host?.onToolUpdate(event.toolCallId, event.partialResult, ctx));
  pi.on("tool_execution_end", (event, ctx) => host?.onToolEnd(event.toolCallId, event.toolName, event.result, event.isError, ctx));
  pi.on("agent_start", (_event, ctx) => host?.onAgentState("running", ctx));
  pi.on("agent_settled", (_event, ctx) => host?.onAgentState("idle", ctx));
  pi.on("ui_prompt_start", (event, ctx) => host?.onUiWait(true, event.title ?? null, ctx));
  pi.on("ui_prompt_end", (event, ctx) => host?.onUiWait(false, event.title ?? null, ctx));
  pi.on("model_select", (event, ctx) => host?.onModelChanged(event.model, ctx));
  pi.on("thinking_level_select", (event, ctx) => host?.onThinkingChanged(event.level, ctx));
  pi.on("session_tree", (_event, ctx) => host?.onSessionChanged(ctx));
  pi.on("session_compact", (_event, ctx) => host?.onSessionChanged(ctx));
  pi.on("session_info_changed", (_event, ctx) => host?.onSessionChanged(ctx));
}
