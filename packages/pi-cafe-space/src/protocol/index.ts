export const PROTOCOL_VERSION = 1 as const;
export const MAX_FRAME_BYTES = 256 * 1024;

export type PeerRole = "host" | "client";
export type DeliveryMode = "steer" | "followUp";
export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
export type AgentPhase = "idle" | "running" | "waiting_local_ui";
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface ModelRef {
  provider: string;
  id: string;
}

export interface TranscriptMessage {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  text: string;
  thinking: string;
  timestamp: number;
  status: "streaming" | "complete" | "error";
  toolName: string | null;
  toolCallId: string | null;
}

export interface ToolExecution {
  toolCallId: string;
  toolName: string;
  argsText: string;
  output: string;
  status: "running" | "complete" | "error";
}

export interface SessionSnapshot {
  protocolVersion: typeof PROTOCOL_VERSION;
  streamId: string;
  sessionId: string;
  sessionName: string | null;
  cwd: string;
  activeLeafId: string | null;
  model: ModelRef | null;
  thinkingLevel: ThinkingLevel;
  phase: AgentPhase;
  hasPendingMessages: boolean;
  messages: TranscriptMessage[];
  historyTruncated: boolean;
  tools: ToolExecution[];
  lastEventSeq: number;
}

export type CollabEvent =
  | { kind: "session_state"; phase: AgentPhase; hasPendingMessages: boolean }
  | { kind: "message_started"; message: TranscriptMessage }
  | { kind: "message_delta"; messageId: string; channel: "text" | "thinking"; delta: string }
  | { kind: "message_finished"; message: TranscriptMessage }
  | { kind: "tool_started"; tool: ToolExecution }
  | { kind: "tool_updated"; toolCallId: string; output: string }
  | { kind: "tool_finished"; tool: ToolExecution }
  | { kind: "model_changed"; model: ModelRef | null }
  | { kind: "thinking_changed"; level: ThinkingLevel }
  | { kind: "ui_wait"; waiting: boolean; title: string | null }
  | { kind: "notice"; level: "info" | "warning" | "error"; message: string };

export interface EventEnvelope {
  type: "event";
  streamId: string;
  sessionId: string;
  seq: number;
  emittedAt: string;
  event: CollabEvent;
}

export interface HelloMessage {
  type: "hello";
  protocolVersion: typeof PROTOCOL_VERSION;
  peerRole: PeerRole;
  peerId: string;
  roomId: string;
  token: string;
}

export interface WelcomeMessage {
  type: "welcome";
  protocolVersion: typeof PROTOCOL_VERSION;
  connectionId: string;
  peerRole: PeerRole;
  roomId: string;
  hostConnected: boolean;
}

export interface HostStatusMessage {
  type: "host_status";
  connected: boolean;
  streamId: string | null;
  sessionId: string | null;
}

export interface SnapshotMessage {
  type: "snapshot";
  snapshot: SessionSnapshot;
}

export type CommandPayload =
  | { name: "prompt"; content: string; delivery?: DeliveryMode }
  | { name: "abort" }
  | { name: "set_thinking"; level: ThinkingLevel }
  | { name: "set_model"; provider: string; modelId: string }
  | { name: "list_dir"; path: string }
  | { name: "read_file"; path: string; offset?: number; limit?: number }
  | { name: "list_sessions" }
  | { name: "get_session"; sessionId: string };

export interface ClientCommandMessage {
  type: "command";
  requestId: string;
  expectedStreamId: string;
  payload: CommandPayload;
}

export interface RoutedCommandMessage {
  type: "routed_command";
  relayRequestId: string;
  clientRequestId: string;
  sourcePeerId: string;
  expectedStreamId: string;
  payload: CommandPayload;
}

export type CommandStatus = "dispatched" | "applied" | "rejected";

export interface HostCommandResultMessage {
  type: "host_command_result";
  relayRequestId: string;
  status: CommandStatus;
  code: string | null;
  message: string | null;
  data?: JsonValue;
}

export interface CommandResultMessage {
  type: "command_result";
  requestId: string;
  status: CommandStatus;
  code: string | null;
  message: string | null;
  data?: JsonValue;
}

export interface ErrorMessage {
  type: "error";
  code: string;
  message: string;
}

export type WireMessage =
  | HelloMessage
  | WelcomeMessage
  | HostStatusMessage
  | SnapshotMessage
  | EventEnvelope
  | ClientCommandMessage
  | RoutedCommandMessage
  | HostCommandResultMessage
  | CommandResultMessage
  | ErrorMessage;

export class ProtocolDecodeError extends Error {
  readonly code = "INVALID_MESSAGE";

  constructor(message: string) {
    super(message);
    this.name = "ProtocolDecodeError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown, depth = 0): value is JsonValue {
  if (depth > 8) return false;
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") return true;
  if (Array.isArray(value)) return value.length <= 500 && value.every((item) => isJsonValue(item, depth + 1));
  if (isRecord(value)) return Object.keys(value).length <= 500 && Object.values(value).every((item) => isJsonValue(item, depth + 1));
  return false;
}

function isString(value: unknown, maxLength = 16_384): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function isNullableString(value: unknown, maxLength = 16_384): value is string | null {
  return value === null || isString(value, maxLength);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function isThinkingLevel(value: unknown): value is ThinkingLevel {
  return value === "off" || value === "minimal" || value === "low" || value === "medium" ||
    value === "high" || value === "xhigh" || value === "max";
}

export function isPeerRole(value: unknown): value is PeerRole {
  return value === "host" || value === "client";
}

function isModelRef(value: unknown): value is ModelRef | null {
  return value === null || (isRecord(value) && isString(value.provider, 128) && isString(value.id, 256));
}

function isTranscriptMessage(value: unknown): value is TranscriptMessage {
  if (!isRecord(value)) return false;
  return isString(value.id, 128) &&
    (value.role === "user" || value.role === "assistant" || value.role === "tool" || value.role === "system") &&
    typeof value.text === "string" && typeof value.thinking === "string" &&
    typeof value.timestamp === "number" && Number.isFinite(value.timestamp) &&
    (value.status === "streaming" || value.status === "complete" || value.status === "error") &&
    isNullableString(value.toolName, 256) && isNullableString(value.toolCallId, 256);
}

function isToolExecution(value: unknown): value is ToolExecution {
  if (!isRecord(value)) return false;
  return isString(value.toolCallId, 256) && isString(value.toolName, 256) &&
    typeof value.argsText === "string" && typeof value.output === "string" &&
    (value.status === "running" || value.status === "complete" || value.status === "error");
}

export function isSessionSnapshot(value: unknown): value is SessionSnapshot {
  if (!isRecord(value)) return false;
  return value.protocolVersion === PROTOCOL_VERSION && isString(value.streamId, 128) &&
    isString(value.sessionId, 256) && isNullableString(value.sessionName, 256) &&
    typeof value.cwd === "string" && isNullableString(value.activeLeafId, 128) &&
    isModelRef(value.model) && isThinkingLevel(value.thinkingLevel) &&
    (value.phase === "idle" || value.phase === "running" || value.phase === "waiting_local_ui") &&
    typeof value.hasPendingMessages === "boolean" && Array.isArray(value.messages) &&
    value.messages.every(isTranscriptMessage) && (value.historyTruncated === undefined || typeof value.historyTruncated === "boolean") && Array.isArray(value.tools) &&
    value.tools.every(isToolExecution) && isNonNegativeInteger(value.lastEventSeq);
}

function isCommandPayload(value: unknown): value is CommandPayload {
  if (!isRecord(value)) return false;
  if (value.name === "prompt") {
    return isString(value.content, 64 * 1024) &&
      (value.delivery === undefined || value.delivery === "steer" || value.delivery === "followUp");
  }
  if (value.name === "abort") return true;
  if (value.name === "set_thinking") return isThinkingLevel(value.level);
  if (value.name === "set_model") return isString(value.provider, 128) && isString(value.modelId, 256);
  if (value.name === "list_dir") return typeof value.path === "string" && value.path.length <= 4_096;
  if (value.name === "read_file") {
    return typeof value.path === "string" && value.path.length <= 4_096 &&
      (value.offset === undefined || (isNonNegativeInteger(value.offset) && value.offset <= 100_000_000)) &&
      (value.limit === undefined || (isNonNegativeInteger(value.limit) && value.limit > 0 && value.limit <= 256 * 1024));
  }
  if (value.name === "list_sessions") return true;
  if (value.name === "get_session") return isString(value.sessionId, 256);
  return false;
}

function isCollabEvent(value: unknown): value is CollabEvent {
  if (!isRecord(value)) return false;
  switch (value.kind) {
    case "session_state":
      return (value.phase === "idle" || value.phase === "running" || value.phase === "waiting_local_ui") &&
        typeof value.hasPendingMessages === "boolean";
    case "message_started":
    case "message_finished":
      return isTranscriptMessage(value.message);
    case "message_delta":
      return isString(value.messageId, 128) && (value.channel === "text" || value.channel === "thinking") &&
        typeof value.delta === "string";
    case "tool_started":
    case "tool_finished":
      return isToolExecution(value.tool);
    case "tool_updated":
      return isString(value.toolCallId, 256) && typeof value.output === "string";
    case "model_changed":
      return isModelRef(value.model);
    case "thinking_changed":
      return isThinkingLevel(value.level);
    case "ui_wait":
      return typeof value.waiting === "boolean" && isNullableString(value.title, 512);
    case "notice":
      return (value.level === "info" || value.level === "warning" || value.level === "error") &&
        isString(value.message, 16_384);
    default:
      return false;
  }
}

export function decodeWireMessage(raw: string): WireMessage {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ProtocolDecodeError("Message is not valid JSON");
  }
  if (!isRecord(value) || !isString(value.type, 64)) {
    throw new ProtocolDecodeError("Message must be an object with a type");
  }

  let valid = false;
  switch (value.type) {
    case "hello":
      valid = value.protocolVersion === PROTOCOL_VERSION && isPeerRole(value.peerRole) &&
        isString(value.peerId, 128) && isString(value.roomId, 128) && isString(value.token, 4096);
      break;
    case "welcome":
      valid = value.protocolVersion === PROTOCOL_VERSION && isString(value.connectionId, 128) &&
        isPeerRole(value.peerRole) && isString(value.roomId, 128) && typeof value.hostConnected === "boolean";
      break;
    case "host_status":
      valid = typeof value.connected === "boolean" && isNullableString(value.streamId, 128) &&
        isNullableString(value.sessionId, 256);
      break;
    case "snapshot":
      valid = isSessionSnapshot(value.snapshot);
      break;
    case "event":
      valid = isString(value.streamId, 128) && isString(value.sessionId, 256) &&
        isNonNegativeInteger(value.seq) && isString(value.emittedAt, 64) && isCollabEvent(value.event);
      break;
    case "command":
      valid = isString(value.requestId, 128) && isString(value.expectedStreamId, 128) &&
        isCommandPayload(value.payload);
      break;
    case "routed_command":
      valid = isString(value.relayRequestId, 128) && isString(value.clientRequestId, 128) &&
        isString(value.sourcePeerId, 128) && isString(value.expectedStreamId, 128) &&
        isCommandPayload(value.payload);
      break;
    case "host_command_result":
      valid = isString(value.relayRequestId, 128) &&
        (value.status === "dispatched" || value.status === "applied" || value.status === "rejected") &&
        isNullableString(value.code, 128) && isNullableString(value.message, 2048) &&
        (value.data === undefined || isJsonValue(value.data));
      break;
    case "command_result":
      valid = isString(value.requestId, 128) &&
        (value.status === "dispatched" || value.status === "applied" || value.status === "rejected") &&
        isNullableString(value.code, 128) && isNullableString(value.message, 2048) &&
        (value.data === undefined || isJsonValue(value.data));
      break;
    case "error":
      valid = isString(value.code, 128) && isString(value.message, 2048);
      break;
  }

  if (!valid) throw new ProtocolDecodeError(`Invalid ${value.type} message`);
  if (value.type === "snapshot" && isRecord(value.snapshot) && value.snapshot.historyTruncated === undefined) {
    value.snapshot = { ...value.snapshot, historyTruncated: false };
  }
  return value as unknown as WireMessage;
}

function upsertMessage(messages: TranscriptMessage[], message: TranscriptMessage): TranscriptMessage[] {
  const index = messages.findIndex((item) => item.id === message.id);
  if (index === -1) return [...messages, message];
  const next = [...messages];
  next[index] = message;
  return next;
}

function upsertTool(tools: ToolExecution[], tool: ToolExecution): ToolExecution[] {
  const index = tools.findIndex((item) => item.toolCallId === tool.toolCallId);
  if (index === -1) return [...tools, tool];
  const next = [...tools];
  next[index] = tool;
  return next;
}

export function applyEvent(snapshot: SessionSnapshot, envelope: EventEnvelope): SessionSnapshot {
  if (snapshot.streamId !== envelope.streamId || snapshot.sessionId !== envelope.sessionId) {
    throw new Error("Event does not belong to this snapshot");
  }
  if (envelope.seq !== snapshot.lastEventSeq + 1) {
    throw new Error(`Event sequence gap: expected ${snapshot.lastEventSeq + 1}, received ${envelope.seq}`);
  }

  const next: SessionSnapshot = { ...snapshot, lastEventSeq: envelope.seq };
  const event = envelope.event;
  switch (event.kind) {
    case "session_state":
      return { ...next, phase: event.phase, hasPendingMessages: event.hasPendingMessages };
    case "message_started":
    case "message_finished":
      return { ...next, messages: upsertMessage(next.messages, event.message) };
    case "message_delta": {
      const message = next.messages.find((item) => item.id === event.messageId);
      if (!message) return next;
      const updated = event.channel === "text"
        ? { ...message, text: message.text + event.delta }
        : { ...message, thinking: message.thinking + event.delta };
      return { ...next, messages: upsertMessage(next.messages, updated) };
    }
    case "tool_started":
    case "tool_finished":
      return { ...next, tools: upsertTool(next.tools, event.tool) };
    case "tool_updated": {
      const tool = next.tools.find((item) => item.toolCallId === event.toolCallId);
      return tool
        ? { ...next, tools: upsertTool(next.tools, { ...tool, output: event.output }) }
        : next;
    }
    case "model_changed":
      return { ...next, model: event.model };
    case "thinking_changed":
      return { ...next, thinkingLevel: event.level };
    case "ui_wait":
      return { ...next, phase: event.waiting ? "waiting_local_ui" : "running" };
    case "notice":
      return next;
  }
}
