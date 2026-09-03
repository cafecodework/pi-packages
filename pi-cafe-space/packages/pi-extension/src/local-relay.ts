import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const DEVELOPMENT_CLIENT_TOKEN = "local-dev-client-token";

export interface LocalRelayConfig {
  relayUrl: string;
  hostToken: string;
}

export type LocalRelayStatus = "already_running" | "started" | "remote" | "unavailable";

function healthUrl(relayUrl: URL): URL {
  const url = new URL(relayUrl);
  url.protocol = "http:";
  url.pathname = "/healthz";
  url.search = "";
  url.hash = "";
  return url;
}

async function healthy(url: URL): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(700), cache: "no-store" });
    if (!response.ok) return false;
    const body = await response.json() as { ok?: unknown };
    return body.ok === true;
  } catch {
    return false;
  }
}

export async function ensureLocalRelay(config: LocalRelayConfig): Promise<LocalRelayStatus> {
  const relayUrl = new URL(config.relayUrl);
  if (relayUrl.protocol !== "ws:" || !LOOPBACK_HOSTS.has(relayUrl.hostname)) return "remote";

  const checkUrl = healthUrl(relayUrl);
  if (await healthy(checkUrl)) return "already_running";

  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const projectRoot = resolve(moduleDir, "../../..");
  const relayEntry = resolve(projectRoot, "apps/relay-server/dist/index.js");
  if (!existsSync(relayEntry)) return "unavailable";

  const port = relayUrl.port || "80";
  const bindHost = relayUrl.hostname === "localhost" ? "127.0.0.1" : relayUrl.hostname.replace(/^\[|\]$/g, "");
  const child = spawn(process.execPath, [relayEntry], {
    cwd: projectRoot,
    detached: true,
    windowsHide: true,
    stdio: "ignore",
    env: {
      ...process.env,
      PI_COLLAB_HOST: bindHost,
      PI_COLLAB_PORT: port,
      PI_COLLAB_HOST_TOKEN: config.hostToken,
      PI_COLLAB_CLIENT_TOKEN: process.env.PI_COLLAB_CLIENT_TOKEN || DEVELOPMENT_CLIENT_TOKEN,
    },
  });
  child.unref();

  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
    if (await healthy(checkUrl)) {
      if (child.exitCode === null && child.pid) {
        try {
          const runtimeDir = resolve(projectRoot, ".runtime");
          mkdirSync(runtimeDir, { recursive: true });
          writeFileSync(resolve(runtimeDir, "relay.pid"), String(child.pid), "utf8");
        } catch {
          // The relay can still run if writing the convenience PID file fails.
        }
        return "started";
      }
      return "already_running";
    }
    if (child.exitCode !== null) break;
  }
  return "unavailable";
}
