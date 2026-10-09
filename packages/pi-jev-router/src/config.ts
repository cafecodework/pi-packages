import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ModelThinkingLevel } from "@earendil-works/pi-ai";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

export type Tier = "high" | "medium" | "low";
export type RouteTarget = { provider: string; model: string; thinkingLevel: ModelThinkingLevel };
export interface RouterConfig {
	classifier: { provider: string; model: string };
	routes: Record<Tier, RouteTarget>;
	instructions: string;
	criteria: Record<Tier, string>;
}

export const DEFAULT_CONFIG: RouterConfig = {
	classifier: { provider: "typesafe", model: "jev-latest" },
	routes: {
		high: { provider: "cafe", model: "gpt-6-astra", thinkingLevel: "xhigh" },
		medium: { provider: "cafe", model: "gpt-6.1-sol", thinkingLevel: "high" },
		low: { provider: "cafe", model: "gpt-6-luna", thinkingLevel: "max" },
	},
	instructions: "Choose the required reasoning tier for the task in `prompt`. Use `recentMessages` (oldest to newest) only to resolve references, not to inherit the tier of unrelated tasks. Evaluate high first: substantive engineering design, architecture review, solution trade-offs, or redesigning rules/configuration mechanisms belongs to high even if called a small feature or configuration change. A request to make model selection, reasoning levels, and classification criteria user-configurable involves configuration-mechanism design, not merely editing existing settings. Evaluate low only for fully specified mechanical work; otherwise choose medium for ordinary implementation, diagnosis, review, or explanation. Judge the underlying work, not prompt length, diff size, or the words 'design'/'review' alone. If a task is borderline between low and medium, choose medium; an unclear scope alone does not justify high.",
	criteria: {
		high: "High tier: Substantive architecture or feature design, architecture reviews, comparing engineering approaches and their trade-offs, or redesigning routing rules/workflows/configuration mechanisms (including schemas, defaults, overrides, and compatibility). Also complex algorithms, subtle bugs, security-sensitive work, or critical/cross-cutting refactoring. Requires deciding how the system should work, not just implementing an already-specified bounded solution.",
		medium: "Medium tier (default for ordinary work): Implement an already-specified bounded feature, common bug fixes, routine debugging, ordinary code reviews, technical explanations, existing configuration changes, or general code modifications that require understanding behavior but not substantive design or high-tier risks. Includes small changes and short questions needing analysis. Designing a new configuration mechanism or reviewing architecture is high, not medium.",
		low: "Low complexity (narrow): Clearly specified mechanical tasks such as correcting a literal typo, formatting supplied text, or replacing an exact label/value without deciding what it should be. No diagnosis, code review, design, or reasoning about behavior. A short prompt or a small diff alone does not qualify.",
	},
};

function object(value: unknown, keys: string[], field: string): Record<string, unknown> {
	if (value === undefined) return {};
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`${field} must be an object`);
	}
	for (const key of Object.keys(value)) {
		if (!keys.includes(key)) throw new Error(`Unknown field ${field}.${key}`);
	}
	return value as Record<string, unknown>;
}

function text(value: unknown, field: string): string {
	if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be a non-empty string`);
	return value.trim();
}

function strings<T extends Record<string, string>>(defaults: T, value: unknown, field: string): T {
	const result = { ...defaults };
	for (const [key, entry] of Object.entries(object(value, Object.keys(defaults), field))) {
		// Validate strings here; constrained values (thinking levels) are checked below.
		(result as Record<string, string>)[key] = text(entry, `${field}.${key}`);
	}
	return result;
}

export function parseConfig(value: unknown): RouterConfig {
	const input = object(value, Object.keys(DEFAULT_CONFIG), "config");
	const tiers = ["high", "medium", "low"] as const;
	const overrides = object(input.routes, [...tiers], "routes");
	const config: RouterConfig = {
		classifier: strings(DEFAULT_CONFIG.classifier, input.classifier, "classifier"),
		routes: { ...DEFAULT_CONFIG.routes },
		instructions: input.instructions === undefined ? DEFAULT_CONFIG.instructions : text(input.instructions, "instructions"),
		criteria: strings(DEFAULT_CONFIG.criteria, input.criteria, "criteria"),
	};
	for (const tier of tiers) {
		const target = strings(DEFAULT_CONFIG.routes[tier], overrides[tier], `routes.${tier}`);
		if (!["off", "minimal", "low", "medium", "high", "xhigh", "max"].includes(target.thinkingLevel)) {
			throw new Error(`routes.${tier}.thinkingLevel must be off, minimal, low, medium, high, xhigh or max`);
		}
		if (target.provider === "jev" && target.model === "auto") {
			throw new Error(`routes.${tier} must target a physical model, not jev/auto`);
		}
		config.routes[tier] = target;
	}
	return config;
}

export function loadConfig(path = join(getAgentDir(), "pi-jev-router.json")): RouterConfig {
	try {
		return parseConfig(JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, "")));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return parseConfig({});
		throw new Error(`[pi-jev-router] ${path}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
	}
}
