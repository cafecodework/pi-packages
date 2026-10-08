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
const EDIT_TOOLS = new Set(["edit", "write"]);

interface RouterState {
	phase: "planning" | "implementation";
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
	state?: RouterState,
): ModelRoute<RouterState> {
	const model = ctx.modelRegistry.find(PROVIDER, id);
	if (!model) throw new Error(`Model ${PROVIDER}/${id} is not in the catalog`);
	const thinkingLevel = MODEL_THINKING[id] ?? request.thinkingLevel;
	if (request.reason !== "direct") {
		// Custom spinners repaint the working message; send them structured route data too.
		pi.events.emit("pi-jev-router:route", { provider: PROVIDER, model: id, thinkingLevel });
		ctx.ui.setWorkingMessage(`Thinking with ${thinkingLevel} effort · ${PROVIDER}/${id}`);
	}
	return { model, thinkingLevel, state };
}

function lastUserText(messages: RouterRequest["messages"]): string {
	const content = messages.filter((message) => message.role === "user").at(-1)?.content ?? "";
	if (typeof content === "string") return content;
	return content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("\n");
}

function editedThisTurn(messages: RouterRequest["messages"]): boolean {
	const lastUser = messages.findLastIndex((message) => message.role === "user");
	return messages
		.slice(lastUser + 1)
		.some((message) => message.role === "toolResult" && EDIT_TOOLS.has(message.toolName) && !message.isError);
}

async function choosePlanningModel(request: RouterRequest, ctx: ExtensionContext): Promise<string> {
	const previous = request.previous?.model;
	if (previous?.provider === PROVIDER && [ASTRA, SOL, LUNA].includes(previous.id)) return previous.id;

	const jev = ctx.modelRegistry.findOfType("classifier", "typesafe", "jev-latest");
	if (!jev) return SOL;
	const result = await ctx.modelRegistry.classify(
		jev,
		{
			state: { prompt: lastUserText(request.messages).slice(0, 16_000) },
			questions: {
				complexity: {
					type: "choice",
					instructions: "Classify the complexity level of the task requested in `prompt`:",
					criteria: {
						high: "High complexity: Architecture design, complex algorithms, subtle bugs, or security/critical refactoring",
						medium: "Medium complexity: Standard features, common bug fixes, or general code modifications",
						low: "Low complexity: Minor tweaks, trivial typos, simple formatting, or short answers",
					},
				},
			},
		},
		{ signal: request.signal },
	);

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
			if (request.reason === "direct") return routeTo(pi, request, ctx, LUNA);
			if (!request.state) {
				const model = await choosePlanningModel(request, ctx);
				return routeTo(pi, request, ctx, model, { phase: "planning", model });
			}
			if (request.state.phase === "planning" && editedThisTurn(request.messages)) {
				return routeTo(pi, request, ctx, LUNA, { phase: "implementation", model: LUNA });
			}
			return routeTo(pi, request, ctx, request.state.model);
		},
	});
}
