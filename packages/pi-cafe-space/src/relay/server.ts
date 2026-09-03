import {
  MAX_FRAME_BYTES,
  PROTOCOL_VERSION,
  applyEvent,
  decodeWireMessage,
  type ClientCommandMessage,
  type CommandResultMessage,
  type ErrorMessage,
  type EventEnvelope,
  type HelloMessage,
  type HostCommandResultMessage,
  type HostStatusMessage,
  type PeerRole,
  type RoutedCommandMessage,
  type SessionSnapshot,
  type SnapshotMessage,
  type ToolExecution,
  type WelcomeMessage,
} from "../protocol/index.js";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { type AddressInfo } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket, { WebSocketServer, type RawData } from "ws";

const MAX_BUFFERED_BYTES = 1024 * 1024;
const HANDSHAKE_TIMEOUT_MS = 5_000;
const COMMAND_TIMEOUT_MS = 15_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const MAX_CACHED_HISTORIES = 20;
const HISTORY_CACHE_TTL_MS = 30 * 60_000;
const ROOM_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const MAX_SNAPSHOT_MESSAGES = 100;
const MAX_SNAPSHOT_TOOLS = 24;
const SNAPSHOT_FRAME_BUDGET = MAX_FRAME_BYTES - 1024;

export interface RelayServerOptions {
  host: string;
  port: number;
  hostToken: string;
  clientToken: string;
  allowedOrigins: string[];
  webRoot?: string;
  logger?: Pick<Console, "info" | "warn" | "error">;
}

interface Connection {
  socket: WebSocket;
  connectionId: string;
  role: PeerRole | null;
  peerId: string | null;
  roomId: string | null;
  alive: boolean;
  snapshotWarningSent: boolean;
  handshakeTimer: NodeJS.Timeout;
}

interface PendingCommand {
  roomId: string;
  peerId: string;
  requestId: string;
  dedupeKey: string;
  timer: NodeJS.Timeout;
}

interface Room {
  id: string;
  host: Connection | null;
  clients: Map<string, Connection>;
  snapshot: SessionSnapshot | null;
  pending: Map<string, PendingCommand>;
  pendingByKey: Map<string, string>;
  results: Map<string, CommandResultMessage>;
  cachedSessionList: CommandResultMessage | null;
  cachedSessions: Map<string, CommandResultMessage>;
  historyCacheTimer: NodeJS.Timeout | null;
}

export interface RunningRelayServer {
  url: string;
  close(): Promise<void>;
}

export interface RelayServer {
  listen(): Promise<RunningRelayServer>;
}

function hashToken(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function tokenMatches(actual: string, expected: string): boolean {
  return timingSafeEqual(hashToken(actual), hashToken(expected));
}

function rawDataToString(data: RawData): string {
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  return Buffer.from(data).toString("utf8");
}

function truncateSnapshotText(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}\n… [truncated]`;
}

function compactRelaySnapshot(snapshot: SessionSnapshot): SessionSnapshot {
  let messages = snapshot.messages.slice(-MAX_SNAPSHOT_MESSAGES).map((message) => ({
    ...message,
    text: truncateSnapshotText(message.text, 8_192),
    thinking: truncateSnapshotText(message.thinking, 8_192),
  }));
  let tools: ToolExecution[] = snapshot.tools.slice(-MAX_SNAPSHOT_TOOLS).map((tool) => ({
    ...tool,
    argsText: truncateSnapshotText(tool.argsText, 2_048),
    output: truncateSnapshotText(tool.output, 4_096),
  }));
  let historyTruncated = snapshot.historyTruncated || messages.length < snapshot.messages.length;
  const makeSnapshot = (): SessionSnapshot => ({ ...snapshot, messages, tools, historyTruncated });
  const size = (): number => Buffer.byteLength(JSON.stringify({ type: "snapshot", snapshot: makeSnapshot() }), "utf8");
  while (messages.length > 1 && size() > SNAPSHOT_FRAME_BUDGET) {
    messages = messages.slice(1);
    historyTruncated = true;
  }
  while (tools.length > 0 && size() > SNAPSHOT_FRAME_BUDGET) tools = tools.slice(1);
  if (size() > SNAPSHOT_FRAME_BUDGET) {
    messages = messages.length ? [messages[messages.length - 1]!] : [];
    tools = [];
    historyTruncated = true;
  }
  return makeSnapshot();
}

function contentType(pathname: string): string {
  if (pathname.endsWith(".css")) return "text/css; charset=utf-8";
  if (pathname.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (pathname.endsWith(".webmanifest")) return "application/manifest+json; charset=utf-8";
  if (pathname.endsWith(".svg")) return "image/svg+xml";
  return "text/html; charset=utf-8";
}

function safeSend(connection: Connection, message: object): boolean {
  if (connection.socket.readyState !== WebSocket.OPEN) return false;
  let encoded: string;
  try {
    encoded = JSON.stringify(message);
  } catch {
    connection.socket.close(1011, "Message is not serializable");
    return false;
  }
  if (Buffer.byteLength(encoded, "utf8") > MAX_FRAME_BYTES) {
    connection.socket.close(1009, "Message is too large");
    return false;
  }
  if (connection.socket.bufferedAmount > MAX_BUFFERED_BYTES) {
    connection.socket.close(1013, "Client is too slow");
    return false;
  }
  connection.socket.send(encoded);
  return true;
}

function sendError(connection: Connection, code: string, message: string): void {
  const payload: ErrorMessage = { type: "error", code, message };
  safeSend(connection, payload);
}

function roomHostStatus(room: Room, connected: boolean): HostStatusMessage {
  return {
    type: "host_status",
    connected,
    streamId: room.snapshot?.streamId ?? null,
    sessionId: room.snapshot?.sessionId ?? null,
  };
}

function isAllowedOrigin(request: IncomingMessage, allowedOrigins: Set<string>): boolean {
  const origin = request.headers.origin;
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.host === request.headers.host;
  } catch {
    return false;
  }
}

export function createRelayServer(options: RelayServerOptions): RelayServer {
  const logger = options.logger ?? console;
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const bundledWebRoot = resolve(moduleDir, "public");
  const workspaceWebRoot = resolve(moduleDir, "../../web/public");
  const defaultWebRoot = existsSync(bundledWebRoot) ? bundledWebRoot : workspaceWebRoot;
  const webRoot = resolve(options.webRoot ?? defaultWebRoot);
  const allowedOrigins = new Set(options.allowedOrigins);
  const rooms = new Map<string, Room>();
  const connections = new Set<Connection>();

  function getRoom(roomId: string): Room {
    const existing = rooms.get(roomId);
    if (existing) return existing;
    const room: Room = {
      id: roomId,
      host: null,
      clients: new Map(),
      snapshot: null,
      pending: new Map(),
      pendingByKey: new Map(),
      results: new Map(),
      cachedSessionList: null,
      cachedSessions: new Map(),
      historyCacheTimer: null,
    };
    rooms.set(roomId, room);
    return room;
  }

  function broadcastClients(room: Room, message: object): void {
    for (const client of room.clients.values()) safeSend(client, message);
  }

  function trimResults(room: Room): void {
    while (room.results.size > 1_000) {
      const first = room.results.keys().next().value as string | undefined;
      if (!first) break;
      room.results.delete(first);
    }
  }

  function clearHistoryCache(room: Room): void {
    if (room.historyCacheTimer) clearTimeout(room.historyCacheTimer);
    room.historyCacheTimer = null;
    room.cachedSessionList = null;
    room.cachedSessions.clear();
  }

  function scheduleHistoryCacheExpiry(room: Room): void {
    if (room.historyCacheTimer) clearTimeout(room.historyCacheTimer);
    room.historyCacheTimer = setTimeout(() => {
      clearHistoryCache(room);
      if (!room.host && room.clients.size === 0 && room.pending.size === 0) rooms.delete(room.id);
    }, HISTORY_CACHE_TTL_MS);
    room.historyCacheTimer.unref();
  }

  function cacheHistoryResult(room: Room, result: CommandResultMessage): void {
    if (result.status !== "applied" || !result.data || typeof result.data !== "object" || Array.isArray(result.data)) return;
    const data = result.data as Record<string, unknown>;
    if (data.kind === "sessions") {
      room.cachedSessionList = { ...result, requestId: "" };
      scheduleHistoryCacheExpiry(room);
      return;
    }
    if (data.kind !== "session" || typeof data.sessionId !== "string") return;
    room.cachedSessions.set(data.sessionId, { ...result, requestId: "" });
    while (room.cachedSessions.size > MAX_CACHED_HISTORIES) {
      const first = room.cachedSessions.keys().next().value as string | undefined;
      if (!first) break;
      room.cachedSessions.delete(first);
    }
    scheduleHistoryCacheExpiry(room);
  }

  function cachedHistoryResult(room: Room, command: ClientCommandMessage): CommandResultMessage | null {
    let cached: CommandResultMessage | null = null;
    if (command.payload.name === "list_sessions") cached = room.cachedSessionList;
    else if (command.payload.name === "get_session") cached = room.cachedSessions.get(command.payload.sessionId) ?? null;
    if (!cached) return null;
    return { ...cached, requestId: command.requestId, message: "Served from relay cache" };
  }

  function roomHasCachedHistory(room: Room): boolean {
    return room.cachedSessionList !== null || room.cachedSessions.size > 0;
  }

  function removeConnection(connection: Connection): void {
    connections.delete(connection);
    clearTimeout(connection.handshakeTimer);
    if (!connection.roomId || !connection.role || !connection.peerId) return;
    const room = rooms.get(connection.roomId);
    if (!room) return;
    if (connection.role === "host" && room.host === connection) {
      room.host = null;
      broadcastClients(room, roomHostStatus(room, false));
      for (const relayRequestId of [...room.pending.keys()]) {
        completeCommand(room, relayRequestId, {
          type: "host_command_result",
          relayRequestId,
          status: "rejected",
          code: "HOST_OFFLINE",
          message: "The Pi host disconnected before acknowledging the command",
        });
      }
    } else if (connection.role === "client" && room.clients.get(connection.peerId) === connection) {
      room.clients.delete(connection.peerId);
    }
    if (!room.host && room.clients.size === 0 && room.pending.size === 0 && !roomHasCachedHistory(room)) rooms.delete(room.id);
  }

  function completeCommand(room: Room, relayRequestId: string, result: HostCommandResultMessage): void {
    const pending = room.pending.get(relayRequestId);
    if (!pending) return;
    clearTimeout(pending.timer);
    room.pending.delete(relayRequestId);
    room.pendingByKey.delete(pending.dedupeKey);
    const clientResult: CommandResultMessage = {
      type: "command_result",
      requestId: pending.requestId,
      status: result.status,
      code: result.code,
      message: result.message,
    };
    if (result.data !== undefined) clientResult.data = result.data;
    cacheHistoryResult(room, clientResult);
    room.results.set(pending.dedupeKey, clientResult);
    trimResults(room);
    const client = room.clients.get(pending.peerId);
    if (client) safeSend(client, clientResult);
  }

  function routeCommand(connection: Connection, room: Room, command: ClientCommandMessage): void {
    const dedupeKey = `${connection.peerId}:${command.requestId}`;
    const previous = room.results.get(dedupeKey);
    if (previous) {
      safeSend(connection, previous);
      return;
    }
    if (room.pendingByKey.has(dedupeKey)) {
      const pendingResult: CommandResultMessage = {
        type: "command_result",
        requestId: command.requestId,
        status: "dispatched",
        code: "REQUEST_PENDING",
        message: "This request is already pending",
      };
      safeSend(connection, pendingResult);
      return;
    }
    const cached = cachedHistoryResult(room, command);
    const activeHost = room.host;
    const activeSnapshot = room.snapshot;
    const hostAvailable = activeHost !== null && activeHost.socket.readyState === WebSocket.OPEN && activeSnapshot !== null;
    const cachedStreamMatches = activeSnapshot === null || command.expectedStreamId === activeSnapshot.streamId;
    if (!hostAvailable && cached && cachedStreamMatches) {
      safeSend(connection, cached);
      return;
    }
    if (!hostAvailable) {
      const offlineResult: CommandResultMessage = {
        type: "command_result",
        requestId: command.requestId,
        status: "rejected",
        code: "HOST_OFFLINE",
        message: "The Pi host is not connected",
      };
      safeSend(connection, offlineResult);
      return;
    }
    if (!activeHost || !activeSnapshot) return;
    if (command.expectedStreamId !== activeSnapshot.streamId) {
      const staleResult: CommandResultMessage = {
        type: "command_result",
        requestId: command.requestId,
        status: "rejected",
        code: "STALE_STREAM",
        message: "The active Pi session changed; refresh and retry",
      };
      safeSend(connection, staleResult);
      safeSend(connection, { type: "snapshot", snapshot: compactRelaySnapshot(activeSnapshot) } satisfies SnapshotMessage);
      return;
    }

    const relayRequestId = randomUUID();
    const routed: RoutedCommandMessage = {
      type: "routed_command",
      relayRequestId,
      clientRequestId: command.requestId,
      sourcePeerId: connection.peerId ?? "unknown",
      expectedStreamId: command.expectedStreamId,
      payload: command.payload,
    };
    const timer = setTimeout(() => {
      completeCommand(room, relayRequestId, {
        type: "host_command_result",
        relayRequestId,
        status: "rejected",
        code: "HOST_TIMEOUT",
        message: "The Pi host did not acknowledge the command",
      });
    }, COMMAND_TIMEOUT_MS);
    room.pending.set(relayRequestId, {
      roomId: room.id,
      peerId: connection.peerId ?? "unknown",
      requestId: command.requestId,
      dedupeKey,
      timer,
    });
    room.pendingByKey.set(dedupeKey, relayRequestId);
    safeSend(activeHost, routed);
  }

  function handleHostMessage(connection: Connection, room: Room, message: ReturnType<typeof decodeWireMessage>): void {
    if (message.type === "snapshot") {
      room.snapshot = compactRelaySnapshot(message.snapshot);
      connection.snapshotWarningSent = false;
      broadcastClients(room, { type: "snapshot", snapshot: room.snapshot } satisfies SnapshotMessage);
      broadcastClients(room, roomHostStatus(room, true));
      return;
    }
    if (message.type === "event") {
      if (!room.snapshot) {
        if (!connection.snapshotWarningSent) {
          sendError(connection, "SNAPSHOT_REQUIRED", "Send a snapshot before events");
          connection.snapshotWarningSent = true;
        }
        return;
      }
      try {
        room.snapshot = compactRelaySnapshot(applyEvent(room.snapshot, message));
      } catch (error) {
        sendError(connection, "EVENT_SEQUENCE", error instanceof Error ? error.message : String(error));
        return;
      }
      broadcastClients(room, message);
      return;
    }
    if (message.type === "host_command_result") {
      completeCommand(room, message.relayRequestId, message);
      return;
    }
    sendError(connection, "ROLE_VIOLATION", `Host cannot send ${message.type}`);
  }

  function handleClientMessage(connection: Connection, room: Room, message: ReturnType<typeof decodeWireMessage>): void {
    if (message.type === "command") {
      routeCommand(connection, room, message);
      return;
    }
    sendError(connection, "ROLE_VIOLATION", `Client cannot send ${message.type}`);
  }

  function handleHello(connection: Connection, hello: HelloMessage): void {
    if (!ROOM_ID_PATTERN.test(hello.roomId)) {
      sendError(connection, "INVALID_ROOM", "Room ID must use letters, numbers, underscore, or hyphen");
      connection.socket.close(1008, "Invalid room");
      return;
    }
    const expectedToken = hello.peerRole === "host" ? options.hostToken : options.clientToken;
    if (!tokenMatches(hello.token, expectedToken)) {
      sendError(connection, "UNAUTHORIZED", "Invalid credentials");
      connection.socket.close(1008, "Unauthorized");
      return;
    }

    const room = getRoom(hello.roomId);
    const sameHostReconnect = hello.peerRole === "host" && room.host?.peerId === hello.peerId;
    if (hello.peerRole === "host" && room.host?.socket.readyState === WebSocket.OPEN) {
      if (room.host.peerId === hello.peerId) {
        room.host.socket.close(1000, "Replaced by host reconnect");
      } else {
        sendError(connection, "HOST_EXISTS", "This room already has an active Pi host");
        connection.socket.close(1008, "Host already connected");
        return;
      }
    }

    clearTimeout(connection.handshakeTimer);
    connection.role = hello.peerRole;
    connection.peerId = hello.peerId;
    connection.roomId = hello.roomId;
    if (hello.peerRole === "host") {
      room.host = connection;
      if (!sameHostReconnect) {
        room.snapshot = null;
        clearHistoryCache(room);
      }
    } else {
      const previous = room.clients.get(hello.peerId);
      if (previous && previous !== connection) previous.socket.close(1000, "Replaced by reconnect");
      room.clients.set(hello.peerId, connection);
    }

    const welcome: WelcomeMessage = {
      type: "welcome",
      protocolVersion: PROTOCOL_VERSION,
      connectionId: connection.connectionId,
      peerRole: hello.peerRole,
      roomId: room.id,
      hostConnected: room.host !== null,
    };
    safeSend(connection, welcome);

    if (hello.peerRole === "host") {
      broadcastClients(room, roomHostStatus(room, true));
    } else {
      safeSend(connection, roomHostStatus(room, room.host !== null));
      if (room.snapshot) safeSend(connection, { type: "snapshot", snapshot: room.snapshot } satisfies SnapshotMessage);
    }
  }

  function handleSocketMessage(connection: Connection, data: RawData, isBinary: boolean): void {
    if (isBinary) {
      sendError(connection, "BINARY_UNSUPPORTED", "Only JSON text frames are supported");
      return;
    }
    let message: ReturnType<typeof decodeWireMessage>;
    try {
      message = decodeWireMessage(rawDataToString(data));
    } catch (error) {
      const text = error instanceof Error ? error.message : "Invalid message";
      sendError(connection, "INVALID_MESSAGE", text);
      return;
    }

    if (!connection.role) {
      if (message.type !== "hello") {
        sendError(connection, "HELLO_REQUIRED", "The first message must be hello");
        connection.socket.close(1008, "Hello required");
        return;
      }
      handleHello(connection, message);
      return;
    }

    if (!connection.roomId) return;
    const room = rooms.get(connection.roomId);
    if (!room) return;
    if (connection.role === "host" && room.host !== connection) {
      sendError(connection, "STALE_HOST", "This host connection is no longer active");
      return;
    }
    if (connection.role === "client" && connection.peerId && room.clients.get(connection.peerId) !== connection) {
      sendError(connection, "STALE_CLIENT", "This client connection is no longer active");
      return;
    }
    if (connection.role === "host") handleHostMessage(connection, room, message);
    else handleClientMessage(connection, room, message);
  }

  const staticFiles = new Map<string, string>([
    ["/", "index.html"],
    ["/index.html", "index.html"],
    ["/app.js", "app.js"],
    ["/styles.css", "styles.css"],
    ["/manifest.webmanifest", "manifest.webmanifest"],
  ]);

  async function handleHttp(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    );

    if (url.pathname === "/healthz") {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      response.end(JSON.stringify({ ok: true, protocolVersion: PROTOCOL_VERSION }));
      return;
    }
    if (url.pathname === "/api/config") {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      response.end(JSON.stringify({ protocolVersion: PROTOCOL_VERSION, wsPath: "/ws", defaultRoom: "main" }));
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end();
      return;
    }

    const relativePath = staticFiles.get(url.pathname);
    if (!relativePath) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    try {
      const body = await readFile(resolve(webRoot, relativePath));
      response.writeHead(200, {
        "Content-Type": contentType(relativePath),
        "Cache-Control": relativePath === "index.html" ? "no-store" : "public, max-age=300",
      });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch {
      response.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Web client is not installed");
    }
  }

  const httpServer: Server = createServer((request, response) => {
    void handleHttp(request, response).catch((error) => {
      logger.error("HTTP request failed", error);
      if (!response.headersSent) response.writeHead(500);
      response.end();
    });
  });
  const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME_BYTES, perMessageDeflate: false });

  httpServer.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    if (url.pathname !== "/ws" || !isAllowedOrigin(request, allowedOrigins)) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      webSocketServer.emit("connection", webSocket, request);
    });
  });

  webSocketServer.on("connection", (socket) => {
    const connection: Connection = {
      socket,
      connectionId: randomUUID(),
      role: null,
      peerId: null,
      roomId: null,
      alive: true,
      snapshotWarningSent: false,
      handshakeTimer: setTimeout(() => socket.close(1008, "Handshake timeout"), HANDSHAKE_TIMEOUT_MS),
    };
    connections.add(connection);
    socket.on("pong", () => { connection.alive = true; });
    socket.on("message", (data, isBinary) => handleSocketMessage(connection, data, isBinary));
    socket.on("close", () => removeConnection(connection));
    socket.on("error", (error) => logger.warn(`WebSocket ${connection.connectionId} error: ${error.message}`));
  });

  const heartbeat = setInterval(() => {
    for (const connection of connections) {
      if (!connection.alive) {
        connection.socket.terminate();
        continue;
      }
      connection.alive = false;
      connection.socket.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);
  heartbeat.unref();

  return {
    async listen(): Promise<RunningRelayServer> {
      await new Promise<void>((resolveListen, reject) => {
        const onError = (error: Error): void => reject(error);
        httpServer.once("error", onError);
        httpServer.listen(options.port, options.host, () => {
          httpServer.off("error", onError);
          resolveListen();
        });
      });
      const address = httpServer.address() as AddressInfo;
      const displayHost = address.address === "::" || address.address === "0.0.0.0" ? "127.0.0.1" : address.address;
      const url = `http://${displayHost}:${address.port}`;
      logger.info(`Pi Cafe Space relay listening on ${url}`);
      return {
        url,
        async close(): Promise<void> {
          clearInterval(heartbeat);
          for (const room of rooms.values()) clearHistoryCache(room);
          for (const connection of connections) connection.socket.close(1001, "Server shutting down");
          await new Promise<void>((resolveClose) => webSocketServer.close(() => resolveClose()));
          await new Promise<void>((resolveClose, reject) => {
            httpServer.close((error) => error ? reject(error) : resolveClose());
          });
        },
      };
    },
  };
}
