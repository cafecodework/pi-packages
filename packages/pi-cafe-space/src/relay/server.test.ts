import { MAX_FRAME_BYTES } from "../protocol/index.js";
import { afterEach, describe, expect, it } from "vitest";
import WebSocket, { type RawData } from "ws";
import { createRelayServer, type RunningRelayServer } from "./server.js";

const hostToken = "host-token";
const clientToken = "client-token";
let running: RunningRelayServer | undefined;
const sockets: WebSocket[] = [];

class Inbox {
  private readonly messages: Record<string, unknown>[] = [];
  private readonly waiters: Array<{
    predicate: (message: Record<string, unknown>) => boolean;
    resolve: (message: Record<string, unknown>) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }> = [];

  constructor(private readonly socket: WebSocket) {
    socket.on("message", (data: RawData, isBinary: boolean) => {
      if (isBinary) return;
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(data.toString()) as Record<string, unknown>;
      } catch {
        return;
      }
      const index = this.waiters.findIndex((waiter) => waiter.predicate(message));
      if (index >= 0) {
        const waiter = this.waiters.splice(index, 1)[0];
        if (waiter) {
          clearTimeout(waiter.timer);
          waiter.resolve(message);
        }
      } else {
        this.messages.push(message);
      }
    });
  }

  wait(predicate: (message: Record<string, unknown>) => boolean): Promise<Record<string, unknown>> {
    const index = this.messages.findIndex(predicate);
    if (index >= 0) {
      const message = this.messages.splice(index, 1)[0];
      return Promise.resolve(message as Record<string, unknown>);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const waiterIndex = this.waiters.findIndex((waiter) => waiter.timer === timer);
        if (waiterIndex >= 0) this.waiters.splice(waiterIndex, 1);
        reject(new Error("Timed out waiting for WebSocket message"));
      }, 3_000);
      this.waiters.push({ predicate, resolve, reject, timer });
    });
  }
}

function connect(url: string): Promise<WebSocket> {
  const socket = new WebSocket(`${url.replace(/^http/, "ws")}/ws`);
  sockets.push(socket);
  return new Promise((resolve, reject) => {
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
  });
}

const baseSnapshot = {
  protocolVersion: 1,
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

afterEach(async () => {
  for (const socket of sockets) socket.close();
  sockets.length = 0;
  await running?.close();
  running = undefined;
});

describe("relay server", () => {
  it("routes a client command to the single host and broadcasts events", async () => {
    const relay = createRelayServer({
      host: "127.0.0.1",
      port: 0,
      hostToken,
      clientToken,
      allowedOrigins: [],
      logger: { info() {}, warn() {}, error() {} },
    });
    running = await relay.listen();

    const host = await connect(running.url);
    const hostInbox = new Inbox(host);
    host.send(JSON.stringify({ type: "hello", protocolVersion: 1, peerRole: "host", peerId: "pi-1", roomId: "main", token: hostToken }));
    await hostInbox.wait((message) => message.type === "welcome");
    host.send(JSON.stringify({ type: "snapshot", snapshot: baseSnapshot }));

    const client = await connect(running.url);
    const clientInbox = new Inbox(client);
    client.send(JSON.stringify({ type: "hello", protocolVersion: 1, peerRole: "client", peerId: "web-1", roomId: "main", token: clientToken }));
    await clientInbox.wait((message) => message.type === "welcome");
    await clientInbox.wait((message) => message.type === "snapshot");

    client.send(JSON.stringify({
      type: "command",
      requestId: "request-1",
      expectedStreamId: "stream-1",
      payload: { name: "prompt", content: "Hello from phone" },
    }));
    const routed = await hostInbox.wait((message) => message.type === "routed_command");
    expect(routed.sourcePeerId).toBe("web-1");
    expect((routed.payload as Record<string, unknown>).name).toBe("prompt");

    host.send(JSON.stringify({
      type: "host_command_result",
      relayRequestId: routed.relayRequestId,
      status: "dispatched",
      code: null,
      message: "Prompt dispatched to Pi",
      data: { kind: "ack", relay: true },
    }));
    const result = await clientInbox.wait((message) => message.type === "command_result");
    expect(result.requestId).toBe("request-1");
    expect(result.status).toBe("dispatched");
    expect(result.data).toEqual({ kind: "ack", relay: true });

    host.send(JSON.stringify({
      type: "event",
      streamId: "stream-1",
      sessionId: "session-1",
      seq: 1,
      emittedAt: new Date().toISOString(),
      event: { kind: "session_state", phase: "running", hasPendingMessages: false },
    }));
    const event = await clientInbox.wait((message) => message.type === "event");
    expect(event.seq).toBe(1);
  });

  it("keeps the relay's projected snapshot bounded after many events", async () => {
    const relay = createRelayServer({
      host: "127.0.0.1",
      port: 0,
      hostToken,
      clientToken,
      allowedOrigins: [],
      logger: { info() {}, warn() {}, error() {} },
    });
    running = await relay.listen();

    const host = await connect(running.url);
    const hostInbox = new Inbox(host);
    host.send(JSON.stringify({ type: "hello", protocolVersion: 1, peerRole: "host", peerId: "pi-large", roomId: "large-room", token: hostToken }));
    await hostInbox.wait((message) => message.type === "welcome");
    host.send(JSON.stringify({ type: "snapshot", snapshot: { ...baseSnapshot, streamId: "large-stream", sessionId: "large-session" } }));

    const client = await connect(running.url);
    const clientInbox = new Inbox(client);
    client.send(JSON.stringify({ type: "hello", protocolVersion: 1, peerRole: "client", peerId: "web-large", roomId: "large-room", token: clientToken }));
    await clientInbox.wait((message) => message.type === "snapshot");

    for (let seq = 1; seq <= 140; seq++) {
      host.send(JSON.stringify({
        type: "event",
        streamId: "large-stream",
        sessionId: "large-session",
        seq,
        emittedAt: new Date().toISOString(),
        event: {
          kind: "message_started",
          message: {
            id: `large-message-${seq}`,
            role: "assistant",
            text: "x".repeat(4_096),
            thinking: "r".repeat(4_096),
            timestamp: seq,
            status: "complete",
            toolName: null,
            toolCallId: null,
          },
        },
      }));
    }
    await clientInbox.wait((message) => message.type === "event" && message.seq === 140);

    const reconnect = await connect(running.url);
    const reconnectInbox = new Inbox(reconnect);
    reconnect.send(JSON.stringify({ type: "hello", protocolVersion: 1, peerRole: "client", peerId: "web-large-reconnect", roomId: "large-room", token: clientToken }));
    const snapshotMessage = await reconnectInbox.wait((message) => message.type === "snapshot");
    const bytes = Buffer.byteLength(JSON.stringify(snapshotMessage), "utf8");
    expect(bytes).toBeLessThan(MAX_FRAME_BYTES);
    expect(((snapshotMessage.snapshot as Record<string, unknown>).messages as unknown[]).length).toBeLessThanOrEqual(100);
  });

  it("serves cached history after the Pi host disconnects", async () => {
    const relay = createRelayServer({
      host: "127.0.0.1",
      port: 0,
      hostToken,
      clientToken,
      allowedOrigins: [],
      logger: { info() {}, warn() {}, error() {} },
    });
    running = await relay.listen();

    const host = await connect(running.url);
    const hostInbox = new Inbox(host);
    host.send(JSON.stringify({ type: "hello", protocolVersion: 1, peerRole: "host", peerId: "pi-cache", roomId: "cache-room", token: hostToken }));
    await hostInbox.wait((message) => message.type === "welcome");
    host.send(JSON.stringify({ type: "snapshot", snapshot: { ...baseSnapshot, streamId: "cache-stream", sessionId: "cache-session" } }));

    const client = await connect(running.url);
    const clientInbox = new Inbox(client);
    client.send(JSON.stringify({ type: "hello", protocolVersion: 1, peerRole: "client", peerId: "web-cache", roomId: "cache-room", token: clientToken }));
    await clientInbox.wait((message) => message.type === "snapshot");
    client.send(JSON.stringify({
      type: "command",
      requestId: "cache-list-1",
      expectedStreamId: "cache-stream",
      payload: { name: "list_sessions" },
    }));
    const routed = await hostInbox.wait((message) => message.type === "routed_command");
    host.send(JSON.stringify({
      type: "host_command_result",
      relayRequestId: routed.relayRequestId,
      status: "applied",
      code: null,
      message: null,
      data: { kind: "sessions", currentSessionId: "cache-session", sessions: [] },
    }));
    await clientInbox.wait((message) => message.type === "command_result" && message.requestId === "cache-list-1");

    host.close();
    await clientInbox.wait((message) => message.type === "host_status" && message.connected === false);
    client.close();

    const reconnect = await connect(running.url);
    const reconnectInbox = new Inbox(reconnect);
    reconnect.send(JSON.stringify({ type: "hello", protocolVersion: 1, peerRole: "client", peerId: "web-cache-reconnect", roomId: "cache-room", token: clientToken }));
    await reconnectInbox.wait((message) => message.type === "snapshot");
    reconnect.send(JSON.stringify({
      type: "command",
      requestId: "cache-list-2",
      expectedStreamId: "cache-stream",
      payload: { name: "list_sessions" },
    }));
    const cached = await reconnectInbox.wait((message) => message.type === "command_result" && message.requestId === "cache-list-2");
    expect(cached.status).toBe("applied");
    expect(cached.message).toBe("Served from relay cache");
    expect(cached.data).toEqual({ kind: "sessions", currentSessionId: "cache-session", sessions: [] });
  });

  it("rejects a client with the wrong token", async () => {
    const relay = createRelayServer({
      host: "127.0.0.1",
      port: 0,
      hostToken,
      clientToken,
      allowedOrigins: [],
      logger: { info() {}, warn() {}, error() {} },
    });
    running = await relay.listen();
    const client = await connect(running.url);
    const inbox = new Inbox(client);
    client.send(JSON.stringify({ type: "hello", protocolVersion: 1, peerRole: "client", peerId: "web-1", roomId: "main", token: "wrong" }));
    const error = await inbox.wait((message) => message.type === "error");
    expect(error.code).toBe("UNAUTHORIZED");
  });
});
