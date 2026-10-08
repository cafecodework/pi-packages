import assert from "node:assert/strict";
import { test } from "node:test";
import { InMemoryCredentialStore } from "@earendil-works/pi-ai";
import { classify } from "@earendil-works/pi-ai/api/typesafe-system-one";
import { ModelRegistry, ModelRuntime } from "@earendil-works/pi-coding-agent";
import register from "../src/index.ts";

const user = (content) => ({ role: "user", content });
const physical = (id) => ({ model: { provider: "cafe", id } });
const request = { reason: "user", thinkingLevel: "medium", messages: [user("task")] };

function setup({ classification = "medium", stopReason = "stop" } = {}) {
  let router;
  const statuses = [];
  const routes = [];
  const calls = [];
  register({
    registerVirtualModel: (definition) => { router = definition; },
    on: () => {},
    events: { emit: (channel, route) => routes.push({ channel, ...route }) },
  });
  const ctx = {
    ui: { setWorkingMessage: (value) => statuses.push(value) },
    modelRegistry: {
      find: (provider, id) => ({ provider, id, reasoning: true, thinkingLevelMap: { xhigh: "xhigh", max: "max" } }),
      findOfType: () => ({ provider: "typesafe", id: "jev-latest" }),
      classify: async (_model, input, options) => {
        calls.push({ input, options });
        return {
          stopReason,
          answers: { complexity: { type: "choice", choice: classification } },
        };
      },
    },
  };
  return { router, ctx, statuses, routes, calls };
}

test("classifies difficulty and maps model to thinking level", async () => {
  for (const [classification, model, thinkingLevel] of [
    ["high", "gpt-6-astra", "xhigh"],
    ["medium", "gpt-6.1-sol", "high"],
    ["low", "gpt-6-luna", "max"],
  ]) {
    const s = setup({ classification });
    const result = await s.router.route(request, s.ctx);
    assert.equal(result.model.id, model);
    assert.equal(result.thinkingLevel, thinkingLevel);
    assert.deepEqual(result.state, { model });
    assert.equal(s.calls.length, 1);
  }
});

test("classification rubric reserves Luna for mechanical work and favors Sol at the low/medium boundary", async () => {
  const s = setup();
  await s.router.route(request, s.ctx);
  const { instructions, criteria } = s.calls[0].input.questions.complexity;
  assert.match(instructions, /borderline between low and medium.*choose medium/);
  assert.match(criteria.medium, /default for ordinary work/);
  for (const task of ["routine debugging", "code reviews", "technical explanations", "configuration changes"]) {
    assert.ok(criteria.medium.includes(task), task);
  }
  assert.match(criteria.low, /Clearly specified mechanical tasks/);
  assert.match(criteria.low, /short prompt or a small diff alone does not qualify/);
  assert.equal(criteria.high, "High complexity: Architecture design, complex algorithms, subtle bugs, or security/critical refactoring");
});

test("new user messages reclassify despite persisted state or the previous physical model", async () => {
  for (const [classification, oldModel, model] of [
    ["high", "gpt-6-luna", "gpt-6-astra"],
    ["low", "gpt-6-astra", "gpt-6-luna"],
  ]) {
    // Include state saved by the old extension, and switching into auto without state.
    for (const state of [undefined, { model: oldModel }, { phase: "implementation", model: oldModel }]) {
      const s = setup({ classification });
      const result = await s.router.route({ ...request, state, previous: physical(oldModel) }, s.ctx);
      assert.equal(result.model.id, model);
      assert.deepEqual(result.state, { model });
      assert.equal(s.calls.length, 1);
    }
  }
});

test("successful file edits keep the current model without reclassification or duplicate state", async () => {
  for (const toolName of ["edit", "write", "powershell", "codemode"]) {
    for (const state of [{ model: "gpt-6-astra" }, { phase: "planning", model: "gpt-6-astra" }]) {
      const s = setup({ classification: "low" });
      const result = await s.router.route({
        ...request, reason: "continuation", state,
        previous: physical("gpt-6-luna"),
        messages: [user("task"), { role: "toolResult", toolName, isError: false }],
      }, s.ctx);
      assert.equal(result.model.id, "gpt-6-astra");
      assert.equal(result.thinkingLevel, "xhigh");
      assert.equal(result.state, undefined, "Pi retains the existing state");
      assert.equal(s.calls.length, 0);
    }
  }
});

test("retries prefer the failed model; follow-ups recover from state or previous responses", async () => {
  for (const [overrides, expected] of [
    [{ reason: "retry", failed: physical("gpt-6-astra"), state: { model: "gpt-6-luna" }, previous: physical("gpt-6.1-sol") }, "gpt-6-astra"],
    [{ reason: "retry", state: { model: "gpt-6-astra" }, previous: physical("gpt-6-luna") }, "gpt-6-astra"],
    [{ reason: "retry", failed: physical("gpt-6-astra"), previous: physical("gpt-6-luna") }, "gpt-6-astra"],
    [{ reason: "continuation", previous: physical("gpt-6.1-sol") }, "gpt-6.1-sol"],
  ]) {
    const s = setup({ classification: "low" });
    const result = await s.router.route({ ...request, ...overrides }, s.ctx);
    assert.equal(result.model.id, expected);
    assert.equal((result.state ?? overrides.state).model, expected);
    assert.equal(s.calls.length, 0);
  }
  const s = setup({ classification: "high" });
  const result = await s.router.route({ ...request, reason: "continuation" }, s.ctx);
  assert.equal(result.model.id, "gpt-6-astra");
  assert.equal(s.calls.length, 1, "classify when there is no recoverable route");
});

test("falls back to Sol for an unavailable classifier, errors, invalid choices or missing user text", async () => {
  for (const failure of ["missing", "error", "invalid", "empty", "image-only"]) {
    const s = setup({ classification: failure === "invalid" ? "unknown" : "high", stopReason: failure === "error" ? "error" : "stop" });
    if (failure === "missing") s.ctx.modelRegistry.findOfType = () => undefined;
    const messages = failure === "empty" ? []
      : failure === "image-only" ? [user([{ type: "image", data: "not-sent", mimeType: "image/png" }])]
      : request.messages;
    const result = await s.router.route({ ...request, messages }, s.ctx);
    assert.equal(result.model.id, "gpt-6.1-sol", failure);
    assert.equal(result.thinkingLevel, "high");
    assert.equal(s.calls.length, ["error", "invalid"].includes(failure) ? 1 : 0);
  }
});

test("classifier sees recent dialogue but not system prompts, tool output, images or thinking", async () => {
  const s = setup();
  await s.router.route({ ...request, messages: [
    { role: "system", content: "system-secret" },
    user("请重构整个权限系统"),
    { role: "assistant", content: [
      { type: "thinking", thinking: "private-reasoning" },
      { type: "text", text: "方案：先审计权限边界，再分阶段迁移。" },
      { type: "toolCall", id: "call-1", name: "read", arguments: { path: "private-file" } },
    ] },
    { role: "toolResult", content: [{ type: "text", text: "tool-secret" }] },
    user([{ type: "text", text: "好" }, { type: "image", data: "image-secret" }, { type: "text", text: "按上面方案实现" }]),
    { role: "assistant", content: [{ type: "text", text: "after-current-user" }] },
  ] }, s.ctx);
  assert.deepEqual(s.calls[0].input.state, {
    prompt: "好\n按上面方案实现",
    recentMessages: [
      { role: "user", content: "请重构整个权限系统" },
      { role: "assistant", content: "方案：先审计权限边界，再分阶段迁移。" },
    ],
  });
  assert.match(s.calls[0].input.questions.complexity.instructions, /recentMessages/);
});

test("classification text is bounded to 16000 prompt chars plus four 2000-char prior messages", async () => {
  const s = setup();
  const history = Array.from({ length: 8 }, (_, i) => user(String(i).repeat(3000)));
  const toolOnly = Array.from({ length: 8 }, () => ({ role: "assistant", content: [{ type: "toolCall", name: "read" }] }));
  await s.router.route({ ...request, messages: [...history, ...toolOnly, user("p".repeat(20000))] }, s.ctx);
  const { prompt, recentMessages } = s.calls[0].input.state;
  assert.equal(prompt, "p".repeat(16000));
  assert.deepEqual(recentMessages, history.slice(-4).map((m) => ({ ...m, content: m.content.slice(-2000) })));
  assert.equal(prompt.length + recentMessages.reduce((sum, m) => sum + m.content.length, 0), 24000);
});

test("cancellation does not choose a fallback or publish a route", async () => {
  for (const timing of ["before", "during", "result"]) {
    const controller = new AbortController();
    const s = setup({ stopReason: timing === "result" ? "aborted" : "stop" });
    if (timing === "before") controller.abort();
    if (timing === "during") {
      const classify = s.ctx.modelRegistry.classify;
      s.ctx.modelRegistry.classify = async (...args) => {
        const result = await classify(...args);
        controller.abort();
        return result;
      };
    }
    await assert.rejects(s.router.route({ ...request, signal: controller.signal }, s.ctx), { name: "AbortError" });
    assert.equal(s.calls.length, timing === "before" ? 0 : 1);
    if (s.calls.length) assert.equal(s.calls[0].options.signal, controller.signal);
    assert.deepEqual(s.routes, []);
    assert.deepEqual(s.statuses, []);
  }
});

test("cancellation during a fast fallback does not publish a route", async () => {
  for (const missingClassifier of [true, false]) {
    const s = setup();
    if (missingClassifier) s.ctx.modelRegistry.findOfType = () => undefined;
    const controller = new AbortController();
    const pending = s.router.route({
      ...request, messages: missingClassifier ? request.messages : [], signal: controller.signal,
    }, s.ctx);
    controller.abort();
    await assert.rejects(pending, { name: "AbortError" });
    assert.equal(s.calls.length, 0);
    assert.deepEqual(s.routes, []);
    assert.deepEqual(s.statuses, []);
  }
});

test("SDK classification timeout falls back to Sol without retries or cancelling the user", async (t) => {
  const deadlines = [];
  t.mock.method(AbortSignal, "timeout", (ms) => {
    deadlines.push(ms);
    return AbortSignal.abort(new DOMException("Test deadline", "TimeoutError"));
  });
  const s = setup({ classification: "high" });
  const controller = new AbortController();
  let fetches = 0;
  let receivedOptions;
  let sdkResult;
  s.ctx.modelRegistry.classify = async (_model, input, options) => {
    receivedOptions = options;
    sdkResult = await classify({
      provider: "typesafe", id: "jev-latest", api: "typesafe-system-one", baseUrl: "https://example.invalid/v1/",
    }, input, {
      ...options, apiKey: "test-only",
      fetch: async (_url, { signal }) => {
        fetches++;
        assert.equal(signal?.aborted, true);
        throw signal.reason;
      },
    });
    return sdkResult;
  };
  const result = await s.router.route({ ...request, signal: controller.signal }, s.ctx);
  assert.deepEqual(deadlines, [5000]);
  assert.equal(receivedOptions.maxRetries, 0);
  assert.equal(fetches, 1);
  assert.equal(sdkResult.stopReason, "error");
  assert.match(sdkResult.errorMessage, /timed out/i);
  assert.equal(controller.signal.aborted, false);
  assert.equal(result.model.id, "gpt-6.1-sol");
});

test("route events and native UI match the real Pi runtime's clamped effort", async () => {
  const runtime = await ModelRuntime.create({
    credentials: new InMemoryCredentialStore(), modelsPath: null, refreshOnCreate: false,
  });
  const cases = [
    ["gpt-6-astra", false, {}, "off"],
    ["gpt-6.1-sol", true, { high: null, xhigh: "xhigh" }, "xhigh"],
    ["gpt-6-luna", true, { max: null, xhigh: null }, "high"],
  ];
  runtime.registerProvider("cafe", {
    baseUrl: "https://example.invalid/v1/", api: "openai-responses", apiKey: "test-only",
    models: cases.map(([id, reasoning, thinkingLevelMap]) => ({
      id, name: id, reasoning, thinkingLevelMap, input: ["text"], contextWindow: 272000, maxTokens: 128000,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    })),
  });
  const s = setup();
  s.ctx.modelRegistry = new ModelRegistry(runtime);
  runtime.registerVirtualModel({ ...s.router, route: (r) => s.router.route(r, s.ctx) });
  for (const [model, , , effort] of cases) {
    const result = await runtime.resolveModel(runtime.getModel("jev", "auto"), request.messages, {
      reason: "continuation", thinkingLevel: "high", state: { model },
    });
    assert.equal(result.thinkingLevel, effort);
    assert.equal(s.routes.at(-1).thinkingLevel, effort);
    assert.equal(s.statuses.at(-1), `Thinking with ${effort} effort · cafe/${model}`);
  }
});

test("notifies custom spinners, retains the native fallback and isolates direct requests", async () => {
  const s = setup({ classification: "high" });
  await s.router.route(request, s.ctx);
  assert.deepEqual(s.routes.at(-1), {
    channel: "pi-jev-router:route", provider: "cafe", model: "gpt-6-astra", thinkingLevel: "xhigh",
  });
  assert.equal(s.statuses.at(-1), "Thinking with xhigh effort · cafe/gpt-6-astra");
  const direct = await s.router.route({ reason: "direct", thinkingLevel: "high", state: { model: "gpt-6-astra" } }, s.ctx);
  assert.equal(direct.model.id, "gpt-6-luna");
  assert.equal(direct.thinkingLevel, "max");
  assert.equal(direct.state, undefined);
  assert.equal(s.calls.length, 1);
  assert.equal(s.routes.length, 1, "compaction/side requests must not replace the main route display");
  assert.equal(s.statuses.length, 1);
});
