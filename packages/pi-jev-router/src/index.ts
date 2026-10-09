import { clampThinkingLevel } from "@earendil-works/pi-ai";
import type {
	ExtensionAPI,
	ExtensionContext,
	ModelRoute,
	ModelRouteRequest,
} from "@earendil-works/pi-coding-agent";

import { DEFAULT_CONFIG, loadConfig, type RouterConfig, type RouteTarget, type Tier } from "./config.ts";

interface RouterState {
	model: string;
	// Optional only for sessions saved before user configuration was supported.
	provider?: string;
	thinkingLevel?: RouteTarget["thinkingLevel"];
}

type RouterRequest = ModelRouteRequest<RouterState>;

function savedRoute(request: RouterRequest): RouteTarget | undefined {
	const state = request.state;
	if (!state) return undefined;
	const provider = state.provider ?? "cafe";
	const legacy = Object.values(DEFAULT_CONFIG.routes).find((r) => r.provider === provider && r.model === state.model);
	return { provider, model: state.model, thinkingLevel: state.thinkingLevel ?? legacy?.thinkingLevel ?? request.thinkingLevel };
}

function routeTo(
	pi: ExtensionAPI,
	request: RouterRequest,
	ctx: ExtensionContext,
	target: RouteTarget,
): ModelRoute<RouterState> {
	request.signal?.throwIfAborted();
	const { provider, model: id } = target;
	const model = ctx.modelRegistry.find(provider, id);
	if (!model) throw new Error(`[pi-jev-router] Model ${provider}/${id} is not in the catalog`);
	if (model.api === "pi-virtual") throw new Error(`[pi-jev-router] ${provider}/${id} must be a physical model`);
	const thinkingLevel = clampThinkingLevel(model, target.thinkingLevel);
	if (request.reason !== "direct") {
		// Custom spinners repaint the working message; send them structured route data too.
		pi.events.emit("pi-jev-router:route", { provider, model: id, thinkingLevel });
		ctx.ui.setWorkingMessage(`Thinking with ${thinkingLevel} effort · ${provider}/${id}`);
	}
	// Pi retains the current state when undefined is returned; avoid duplicate session entries.
	const unchanged = request.state?.provider === provider && request.state.model === id && request.state.thinkingLevel === thinkingLevel;
	const state = request.reason !== "direct" && !unchanged ? { provider, model: id, thinkingLevel } : undefined;
	return { model, thinkingLevel, state };
}

function messageText(message: RouterRequest["messages"][number]): string {
	const { content } = message;
	if (typeof content === "string") return content;
	return content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("\n");
}

async function chooseTier(request: RouterRequest, ctx: ExtensionContext, config: RouterConfig): Promise<Tier> {
	const jev = ctx.modelRegistry.findOfType("classifier", config.classifier.provider, config.classifier.model);
	if (!jev) return "medium";
	const lastUser = request.messages.findLastIndex((message) => message.role === "user");
	if (lastUser < 0) return "medium";
	const prompt = messageText(request.messages[lastUser]).slice(0, 16_000);
	if (!prompt.trim()) return "medium";
	// ponytail: last four text messages only; add a task summary if longer-range references need routing.
	const recentMessages = request.messages.slice(0, lastUser)
		.filter((message) => message.role === "user" || message.role === "assistant")
		.map((message) => ({ role: message.role, content: messageText(message) }))
		.filter((message) => message.content.trim())
		.slice(-4)
		.map((message) => ({ ...message, content: message.content.slice(-2_000) }));
	const result = await ctx.modelRegistry.classify(
		jev,
		{
			state: { prompt, recentMessages },
			questions: {
				complexity: {
					type: "choice",
					instructions: config.instructions,
					criteria: config.criteria,
				},
			},
		},
		{ signal: request.signal, timeoutMs: 5_000, maxRetries: 0 },
	);

	request.signal?.throwIfAborted();
	if (result.stopReason === "aborted") throw new DOMException("Classification aborted", "AbortError");
	const answer = result.stopReason === "stop" ? result.answers.complexity : undefined;
	if (answer?.type === "choice") {
		if (answer.choice === "high" || answer.choice === "low") return answer.choice;
	}
	return "medium";
}

export default function (pi: ExtensionAPI): void {
	const config = loadConfig();
	pi.on("model_select", (_event, ctx) => ctx.ui.setWorkingMessage());

	pi.registerVirtualModel<RouterState>({
		provider: "jev",
		id: "auto",
		name: "Auto (Jev)",
		thinkingLevels: ["low", "medium", "high", "xhigh"],
		contextWindow: 272_000,
		maxTokens: 128_000,
		async route(request, ctx) {
			request.signal?.throwIfAborted();
			if (request.reason === "direct") return routeTo(pi, request, ctx, config.routes.low);
			if (request.reason !== "user") {
				const saved = savedRoute(request);
				const recover = (response: RouterRequest["previous"]): RouteTarget | undefined => {
					if (!response) return undefined;
					const target = [saved, config.routes.medium, config.routes.high, config.routes.low].find(
						(r) => r?.provider === response.model.provider && r.model === response.model.id,
					);
					return target && { ...target, thinkingLevel: response.thinkingLevel ?? target.thinkingLevel };
				};
				const failed = request.reason === "retry" ? recover(request.failed) : undefined;
				const target = failed ?? saved ?? recover(request.previous);
				if (target) return routeTo(pi, request, ctx, target);
			}
			const tier = await chooseTier(request, ctx, config);
			return routeTo(pi, request, ctx, config.routes[tier]);
		},
	});
}
