import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listProjectDirectory, readProjectFile } from "./file-commands.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("project file commands", () => {
  it("lists and reads files inside the project root", async () => {
    const root = await mkdtemp(join(tmpdir(), "pi-collab-"));
    roots.push(root);
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src", "index.ts"), "export const value = 1;\n");

    const listing = await listProjectDirectory(root, "src") as Record<string, unknown>;
    expect(listing.kind).toBe("directory");
    expect(listing.entries).toEqual([{ name: "index.ts", kind: "file" }]);

    const file = await readProjectFile(root, "src/index.ts") as Record<string, unknown>;
    expect(file.content).toBe("export const value = 1;\n");
  });

  it("rejects traversal and sensitive files", async () => {
    const root = await mkdtemp(join(tmpdir(), "pi-collab-"));
    roots.push(root);
    await writeFile(join(root, ".env"), "SECRET=value\n");

    await expect(listProjectDirectory(root, "..")).rejects.toMatchObject({ code: "PATH_NOT_ALLOWED" });
    await expect(readProjectFile(root, ".env")).rejects.toMatchObject({ code: "SENSITIVE_PATH" });
  });
});
