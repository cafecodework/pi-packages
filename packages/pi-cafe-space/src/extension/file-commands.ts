import { open, readdir, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { JsonValue } from "../protocol/index.js";

export class FileCommandError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "FileCommandError";
  }
}

function isBlockedPath(requestedPath: string): boolean {
  return requestedPath.split(/[\\/]+/).some((segment) => {
    const lower = segment.toLowerCase();
    return lower === ".git" || lower === ".pi" || lower === ".env" || lower.startsWith(".env.") ||
      lower === ".npmrc" || lower === ".pypirc" || lower === "auth.json" || lower === "models.json" ||
      lower === "credentials.json" || lower.endsWith(".pem") || lower.endsWith(".key");
  });
}

async function projectPath(cwd: string, requestedPath: string): Promise<string> {
  if (isBlockedPath(requestedPath)) throw new FileCommandError("SENSITIVE_PATH", "This path is hidden from remote clients");
  const root = await realpath(cwd).catch(() => {
    throw new FileCommandError("PROJECT_UNAVAILABLE", "Project directory is unavailable");
  });
  if (isAbsolute(requestedPath)) throw new FileCommandError("PATH_NOT_ALLOWED", "Only paths inside the Pi project are allowed");
  const candidate = resolve(root, requestedPath || ".");
  const target = await realpath(candidate).catch(() => {
    throw new FileCommandError("PATH_NOT_FOUND", "The requested project path does not exist");
  });
  const outside = relative(root, target);
  if (outside === ".." || outside.startsWith(`..${sep}`) || isAbsolute(outside)) {
    throw new FileCommandError("PATH_NOT_ALLOWED", "The requested path is outside the Pi project");
  }
  if (isBlockedPath(outside)) throw new FileCommandError("SENSITIVE_PATH", "This path is hidden from remote clients");
  return target;
}

export async function listProjectDirectory(cwd: string, requestedPath: string): Promise<JsonValue> {
  const directory = await projectPath(cwd, requestedPath);
  const info = await stat(directory).catch(() => null);
  if (!info?.isDirectory()) throw new FileCommandError("NOT_DIRECTORY", "The requested path is not a directory");
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => {
    throw new FileCommandError("READ_DIRECTORY_FAILED", "Unable to read the project directory");
  });
  entries.sort((left, right) => {
    const leftDirectory = left.isDirectory() ? 0 : 1;
    const rightDirectory = right.isDirectory() ? 0 : 1;
    return leftDirectory - rightDirectory || left.name.localeCompare(right.name);
  });
  const visibleEntries = entries.filter((entry) => !isBlockedPath(entry.name));
  return {
    kind: "directory",
    path: requestedPath || ".",
    truncated: visibleEntries.length > 300,
    entries: visibleEntries.slice(0, 300).map((entry) => ({
      name: entry.name,
      kind: entry.isSymbolicLink() ? "link" : entry.isDirectory() ? "directory" : "file",
    })),
  };
}

export async function readProjectFile(cwd: string, requestedPath: string, offset = 0, requestedLimit = 64 * 1024): Promise<JsonValue> {
  const filePath = await projectPath(cwd, requestedPath);
  const info = await stat(filePath).catch(() => null);
  if (!info?.isFile()) throw new FileCommandError("NOT_FILE", "The requested path is not a file");
  const limit = Math.min(requestedLimit, 128 * 1024);
  const handle = await open(filePath, "r").catch(() => {
    throw new FileCommandError("READ_FILE_FAILED", "Unable to read the project file");
  });
  try {
    const buffer = Buffer.alloc(limit);
    const result = await handle.read(buffer, 0, limit, offset);
    const content = buffer.subarray(0, result.bytesRead);
    if (content.includes(0)) throw new FileCommandError("BINARY_FILE", "Binary files are not displayed in the Web client");
    return {
      kind: "file",
      path: requestedPath,
      offset,
      size: info.size,
      bytesRead: result.bytesRead,
      truncated: offset + result.bytesRead < info.size,
      content: content.toString("utf8"),
    };
  } finally {
    await handle.close();
  }
}
