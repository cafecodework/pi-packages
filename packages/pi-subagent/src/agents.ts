import * as fs from "node:fs";
import * as path from "node:path";
import { CONFIG_DIR_NAME, getAgentDir, parseFrontmatter } from "@earendil-works/pi-coding-agent";

export interface AgentDefinition {
  name: string;
  description: string;
  tools?: string[];
  model?: string;
  systemPrompt: string;
  source: "user" | "project";
  filePath: string;
}

type AgentFrontmatter = {
  name?: unknown;
  description?: unknown;
  tools?: unknown;
  model?: unknown;
};

function parseToolList(value: unknown): string[] | undefined {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const tools = raw
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim())
    .filter(Boolean);
  return tools.length > 0 ? tools : undefined;
}

function loadAgentsFromDir(dir: string, source: "user" | "project"): AgentDefinition[] {
  const agents: AgentDefinition[] = [];
  if (!fs.existsSync(dir)) return agents;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return agents;
  }

  for (const entry of entries) {
    if (!entry.name.endsWith(".md")) continue;
    if (!entry.isFile() && !entry.isSymbolicLink()) continue;

    const filePath = path.join(dir, entry.name);
    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    const { frontmatter, body } = parseFrontmatter<AgentFrontmatter>(content);
    if (typeof frontmatter.name !== "string" || typeof frontmatter.description !== "string") {
      continue;
    }

    agents.push({
      name: frontmatter.name,
      description: frontmatter.description,
      tools: parseToolList(frontmatter.tools),
      model: typeof frontmatter.model === "string" ? frontmatter.model : undefined,
      systemPrompt: body.trim(),
      source,
      filePath,
    });
  }

  return agents;
}

export function discoverAgents(cwd: string): AgentDefinition[] {
  const userDir = path.join(getAgentDir(), "agents");
  const projectDir = path.join(cwd, CONFIG_DIR_NAME, "agents");

  const userAgents = loadAgentsFromDir(userDir, "user");
  const projectAgents = loadAgentsFromDir(projectDir, "project");

  // Project-level agents take precedence over user-level agents
  const agentMap = new Map<string, AgentDefinition>();
  for (const agent of userAgents) {
    agentMap.set(agent.name, agent);
  }
  for (const agent of projectAgents) {
    agentMap.set(agent.name, agent);
  }

  return Array.from(agentMap.values());
}
