import { describe, expect, it } from "vitest";
import {
  PROTOCOL_VERSION,
  ProtocolDecodeError,
  applyEvent,
  decodeWireMessage,
  isPeerRole,
  isThinkingLevel,
  type EventEnvelope,
  type SessionSnapshot,
} from "./index.js";

const snapshot: SessionSnapshot = {
  protocolVersion: PROTOCOL_VERSION,
  streamId: "stream-1",
  sessionId: "session-1",
  sessionName: null,
  cwd: "D:/work",
  activeLeafId: null,
  model: { provider: "cafe", id: "gpt-5.6-sol" },
  thinkingLevel: "high",
  phase: "idle",
  hasPendingMessages: false,
  messages: [],
  historyTruncated: false,
  tools: [],
  lastEventSeq: 0,
};

describe("protocol decoding", () => {
  it("accepts a valid host hello", () => {
    const message = decodeWireMessage(JSON.stringify({
      type: "hello",
      protocolVersion: PROTOCOL_VERSION,
      peerRole: "host",
      peerId: "host-1",
      roomId: "main",
      token: "secret",
    }));
    expect(message.type).toBe("hello");
  });

  it("rejects unsupported prompt delivery modes", () => {
    expect(() => decodeWireMessage(JSON.stringify({
      type: "command",
      requestId: "request-1",
      expectedStreamId: "stream-1",
      payload: { name: "prompt", content: "hello", delivery: "nextTurn" },
    }))).toThrow(ProtocolDecodeError);
  });

  it("normalizes snapshots from an older extension without historyTruncated", () => {
    const legacy = { ...snapshot } as Partial<SessionSnapshot>;
    delete legacy.historyTruncated;
    const message = decodeWireMessage(JSON.stringify({ type: "snapshot", snapshot: legacy }));
    expect(message.type).toBe("snapshot");
    if (message.type === "snapshot") expect(message.snapshot.historyTruncated).toBe(false);
  });
  it("accepts read-only file commands and structured results", () => {
    expect(decodeWireMessage(JSON.stringify({
      type: "command",
      requestId: "file-1",
      expectedStreamId: "stream-1",
      payload: { name: "read_file", path: "README.md", offset: 0, limit: 1024 },
    }))).toMatchObject({ type: "command", payload: { name: "read_file" } });
    expect(decodeWireMessage(JSON.stringify({
      type: "command_result",
      requestId: "file-1",
      status: "applied",
      code: null,
      message: null,
      data: { kind: "file", path: "README.md", content: "hello", truncated: false },
    }))).toMatchObject({ type: "command_result", data: { kind: "file" } });
  });
});


describe("snapshot projection", () => {
  it("applies ordered message deltas", () => {
    const started: EventEnvelope = {
      type: "event",
      streamId: "stream-1",
      sessionId: "session-1",
      seq: 1,
      emittedAt: new Date(0).toISOString(),
      event: {
        kind: "message_started",
        message: {
          id: "assistant-1",
          role: "assistant",
          text: "",
          thinking: "",
          timestamp: 0,
          status: "streaming",
          toolName: null,
          toolCallId: null,
        },
      },
    };
    const delta: EventEnvelope = {
      ...started,
      seq: 2,
      event: { kind: "message_delta", messageId: "assistant-1", channel: "text", delta: "Hello" },
    };
    const next = applyEvent(applyEvent(snapshot, started), delta);
    expect(next.messages[0]?.text).toBe("Hello");
    expect(next.lastEventSeq).toBe(2);
  });

  it("rejects sequence gaps", () => {
    const event: EventEnvelope = {
      type: "event",
      streamId: "stream-1",
      sessionId: "session-1",
      seq: 2,
      emittedAt: new Date(0).toISOString(),
      event: { kind: "session_state", phase: "running", hasPendingMessages: false },
    };
    expect(() => applyEvent(snapshot, event)).toThrow("Event sequence gap");
  });
});

describe("protocol primitives", () => {
  it("accepts only supported values", () => {
    expect(isThinkingLevel("max")).toBe(true);
    expect(isThinkingLevel("turbo")).toBe(false);
    expect(isPeerRole("client")).toBe(true);
    expect(isPeerRole("admin")).toBe(false);
  });
});
