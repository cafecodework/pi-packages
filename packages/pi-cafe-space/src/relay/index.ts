import { createRelayServer } from "./server.js";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 37_891;
const DEFAULT_HOST_TOKEN = "local-dev-host-token";
const DEFAULT_CLIENT_TOKEN = "local-dev-client-token";

function parsePort(value: string | undefined): number {
  const port = value ? Number(value) : DEFAULT_PORT;
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error("PI_COLLAB_PORT must be a valid TCP port");
  }
  return port;
}

const host = process.env.PI_COLLAB_HOST ?? DEFAULT_HOST;
const hostToken = process.env.PI_COLLAB_HOST_TOKEN ?? DEFAULT_HOST_TOKEN;
const clientToken = process.env.PI_COLLAB_CLIENT_TOKEN ?? DEFAULT_CLIENT_TOKEN;
const isLoopback = host === "127.0.0.1" || host === "localhost" || host === "::1";

if (!isLoopback && (!process.env.PI_COLLAB_HOST_TOKEN || !process.env.PI_COLLAB_CLIENT_TOKEN ||
    hostToken === DEFAULT_HOST_TOKEN || clientToken === DEFAULT_CLIENT_TOKEN || hostToken.length < 16 || clientToken.length < 16)) {
  throw new Error("Explicit high-entropy non-default tokens (at least 16 characters) are required outside loopback mode");
}

const allowedOrigins = (process.env.PI_COLLAB_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const relay = createRelayServer({
  host,
  port: parsePort(process.env.PI_COLLAB_PORT),
  hostToken,
  clientToken,
  allowedOrigins,
});

const running = await relay.listen();

if (isLoopback && (!process.env.PI_COLLAB_HOST_TOKEN || !process.env.PI_COLLAB_CLIENT_TOKEN)) {
  console.warn("Using loopback-only development credentials. Set explicit tokens before LAN or server deployment.");
}

async function shutdown(): Promise<void> {
  await running.close();
  process.exit(0);
}

process.once("SIGINT", () => { void shutdown(); });
process.once("SIGTERM", () => { void shutdown(); });
