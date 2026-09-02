import {
  buildSessionContext,
  estimateTokens,
  type ExtensionAPI,
  type ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { Box, Text } from "@earendil-works/pi-tui";

type Row = { name: string; tokens: number };
type ContextSnapshot = {
  used: number | null;
  limit: number;
  percent: number | null;
  systemPrompt: number;
  rows: Row[];
};

const ENTRY_KIND = "cafecodework:pi-context";

function compactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return `${value}`;
}

function addCount(map: Map<string, number>, name: string, value: number): void {
  if (value > 0) map.set(name, (map.get(name) ?? 0) + value);
}

function snapshot(ctx: ExtensionCommandContext): ContextSnapshot {
  const usage = ctx.getContextUsage();
  const limit = usage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
  const counts = new Map<string, number>();

  const systemPrompt = Math.ceil(ctx.getSystemPrompt().length / 4);
  const context = buildSessionContext(ctx.sessionManager.buildContextEntries());

  for (const message of context.messages) {
    switch (message.role) {
      case "user":
        addCount(counts, "User messages", estimateTokens(message));
        break;
      case "assistant": {
        let text = 0;
        let thinking = 0;
        let tools = 0;
        for (const part of message.content) {
          if (part.type === "text") text += part.text.length;
          if (part.type === "thinking") thinking += part.thinking.length;
          if (part.type === "toolCall") {
            tools += part.name.length + JSON.stringify(part.arguments).length;
          }
        }
        addCount(counts, "Assistant text", Math.ceil(text / 4));
        addCount(counts, "Thinking", Math.ceil(thinking / 4));
        addCount(counts, "Tool calls", Math.ceil(tools / 4));
        break;
      }
      case "toolResult":
        addCount(counts, "Tool results", estimateTokens(message));
        break;
      case "bashExecution":
        addCount(counts, "Bash executions", estimateTokens(message));
        break;
      case "branchSummary":
      case "compactionSummary":
        addCount(counts, "Summaries", estimateTokens(message));
        break;
      case "custom":
        addCount(counts, "Extension messages", estimateTokens(message));
        break;
      default:
        addCount(counts, "Other", estimateTokens(message));
    }
  }

  return {
    used: usage?.tokens ?? null,
    limit,
    percent: usage?.percent ?? null,
    systemPrompt,
    rows: [...counts.entries()]
      .map(([name, tokens]) => ({ name, tokens }))
      .sort((a, b) => b.tokens - a.tokens),
  };
}

export default function registerPiContext(pi: ExtensionAPI): void {
  pi.registerEntryRenderer<ContextSnapshot>(ENTRY_KIND, (entry, _options, theme) => {
    const data = entry.data;
    if (!data) return undefined;

    const box = new Box(1, 1, (value) => theme.bg("customMessageBg", value));
    const used = data.used === null ? "?" : compactNumber(data.used);
    const limit = data.limit > 0 ? compactNumber(data.limit) : "?";
    const percent = data.percent === null ? "?" : `${data.percent.toFixed(1)}%`;

    box.addChild(new Text(`${theme.fg("accent", "[context]")} ${used} / ${limit} tokens (${percent})`, 0, 0));

    const total = data.systemPrompt + data.rows.reduce((sum, row) => sum + row.tokens, 0);
    const note = data.used === null
      ? "estimated composition; measured usage is not available yet"
      : `composition estimate (~${compactNumber(total)} tokens)`;
    box.addChild(new Text(theme.fg("dim", note), 0, 0));

    const rows = [{ name: "System prompt", tokens: data.systemPrompt }, ...data.rows];
    const width = Math.max(...rows.map((row) => row.name.length));
    const barSize = 16;

    for (const row of rows) {
      if (row.tokens <= 0) continue;
      const ratio = total > 0 ? row.tokens / total : 0;
      const filled = Math.max(1, Math.round(ratio * barSize));
      const bar = theme.fg("accent", "█".repeat(filled)) + theme.fg("dim", "░".repeat(barSize - filled));
      const name = row.name.padEnd(width);
      const amount = compactNumber(row.tokens).padStart(7);
      const share = `${(ratio * 100).toFixed(1)}%`.padStart(6);
      box.addChild(new Text(`  ${name} ${theme.fg("dim", amount)} ${bar} ${share}`, 0, 0));
    }

    return box;
  });

  pi.registerCommand("context", {
    description: "Show context-window usage and composition",
    handler: async (_args, ctx) => {
      const data = snapshot(ctx);
      pi.appendEntry<ContextSnapshot>(ENTRY_KIND, data);

      if (ctx.mode !== "tui" && ctx.hasUI) {
        const used = data.used === null ? "?" : compactNumber(data.used);
        const limit = data.limit > 0 ? compactNumber(data.limit) : "?";
        const percent = data.percent === null ? "?" : `${data.percent.toFixed(1)}%`;
        ctx.ui.notify(`Context: ${used} / ${limit} tokens (${percent})`, "info");
      }
    },
  });
}
