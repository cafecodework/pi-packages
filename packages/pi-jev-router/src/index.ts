import { clampThinkingLevel } from "@earendil-works/pi-ai";
import type {
	ExtensionAPI,
	ExtensionContext,
	ModelRoute,
	ModelRouteRequest,
} from "@earendil-works/pi-coding-agent";

const PROVIDER = "cafe";
const ASTRA = "gpt-6-astra";
const SOL = "gpt-6.1-sol";
const LUNA = "gpt-6-luna";

interface RouterState {
	model: string;
}

type RouterRequest = ModelRouteRequest<RouterState>;

const MODEL_THINKING: Partial<Record<string, ModelRoute<RouterState>["thinkingLevel"]>> = {
	[LUNA]: "max",
	[SOL]: "high",
	[ASTRA]: "xhigh",
};

function routeTo(
	pi: ExtensionAPI,
	request: RouterRequest,
	ctx: ExtensionContext,
	id: string,
): ModelRoute<RouterState> {
	request.signal?.throwIfAborted();
	const model = ctx.modelRegistry.find(PROVIDER, id);
	if (!model) throw new Error(`Model ${PROVIDER}/${id} is not in the catalog`);
	const thinkingLevel = clampThinkingLevel(model, MODEL_THINKING[id] ?? request.thinkingLevel);
	if (request.reason !== "direct") {
		// Custom spinners repaint the working message; send them structured route data too.
		pi.events.emit("pi-jev-router:route", { provider: PROVIDER, model: id, thinkingLevel });
		ctx.ui.setWorkingMessage(`Thinking with ${thinkingLevel} effort · ${PROVIDER}/${id}`);
	}
	// Pi retains the current state when undefined is returned; avoid duplicate session entries.
	const state = request.reason !== "direct" && request.state?.model !== id ? { model: id } : undefined;
	return { model, thinkingLevel, state };
}

function messageText(message: RouterRequest["messages"][number]): string {
	const { content } = message;
	if (typeof content === "string") return content;
	return content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("\n");
}

async function chooseModel(request: RouterRequest, ctx: ExtensionContext): Promise<string> {
	const jev = ctx.modelRegistry.findOfType("classifier", "typesafe", "jev-latest");
	if (!jev) return SOL;
	const lastUser = request.messages.findLastIndex((message) => message.role === "user");
	if (lastUser < 0) return SOL;
	const prompt = messageText(request.messages[lastUser]).slice(0, 16_000);
	if (!prompt.trim()) return SOL;
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
					instructions: "Classify the complexity of the task requested in `prompt`. Use `recentMessages` (oldest to newest) only to resolve references such as 'continue' or 'implement that plan'. Judge the underlying work, not the length of the reply; do not carry over the difficulty of unrelated earlier tasks. Reserve low for clearly mechanical tasks with an explicit outcome and no diagnosis, design, or code-behavior judgment. If a task is borderline between low and medium or its scope is unclear, choose medium; preserve high for genuinely demanding work.",
					criteria: {
						high: "High complexity: Architecture design, complex algorithms, subtle bugs, or security/critical refactoring",
						medium: "Medium complexity (default for ordinary work): Standard features, common bug fixes, routine debugging, code reviews, technical explanations, configuration changes, or general code modifications that require understanding behavior. Includes small changes and short questions needing analysis; also tasks whose scope is unclear but not clearly high complexity.",
						low: "Low complexity (narrow): Clearly specified mechanical tasks such as correcting a literal typo, formatting supplied text, or replacing an exact label/value without deciding what it should be. No diagnosis, code review, design, or reasoning about behavior. A short prompt or a small diff alone does not qualify.",
					},
				},
			},
		},
		{ signal: request.signal, timeoutMs: 5_000, maxRetries: 0 },
	);

	request.signal?.throwIfAborted();
	if (result.stopReason === "aborted") throw new DOMException("Classification aborted", "AbortError");
	const answer = result.stopReason === "stop" ? result.answers.complexity : undefined;
	if (answer?.type === "choice") {
		if (answer.choice === "high") return ASTRA;
		if (answer.choice === "low") return LUNA;
	}
	return SOL;
}

export default function (pi: ExtensionAPI): void {
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
			if (request.reason === "direct") return routeTo(pi, request, ctx, LUNA);
			if (request.reason !== "user") {
				const failed = request.reason === "retry" ? request.failed?.model : undefined;
				if (failed?.provider === PROVIDER && Object.hasOwn(MODEL_THINKING, failed.id)) {
					return routeTo(pi, request, ctx, failed.id);
				}
				if (request.state) return routeTo(pi, request, ctx, request.state.model);
				const previous = request.previous?.model;
				if (previous?.provider === PROVIDER && Object.hasOwn(MODEL_THINKING, previous.id)) {
					return routeTo(pi, request, ctx, previous.id);
				}
			}
			const model = await chooseModel(request, ctx);
			return routeTo(pi, request, ctx, model);
		},
	});
}
