import assert from "node:assert/strict";
import { test } from "node:test";
import register from "../src/index.ts";

function setup({ previous, classification = "medium", stopReason = "stop" } = {}) {
  let router;
  const messages = [];
  const statuses = [];
  const routes = [];
  register({
    registerVirtualModel: (definition) => { router = definition; },
    on: (event, handler) => messages.push([event, handler]),
    events: { emit: (channel, route) => routes.push({ channel, ...route }) },
  });
  const ctx = {
    ui: { setWorkingMessage: (value) => statuses.push(value) },
    modelRegistry: {
      find: (provider, id) => ({ provider, id }),
      findOfType: () => ({ provider: "typesafe", id: "jev-latest" }),
      classify: async (_model, input) => {
        assert.ok(input.state.prompt);
        return {
          stopReason,
          answers: { complexity: { type: "choice", choice: classification } },
        };
      },
    },
  };
  return { router, getRouter: () => router, ctx, messages, statuses, routes, previous };
}

test("classifies difficulty and maps model to thinking level", async () => {
  for (const [classification, model, thinkingLevel] of [
    ["high", "gpt-6-astra", "xhigh"],
    ["medium", "gpt-6.1-sol", "high"],
    ["low", "gpt-6-luna", "max"],
  ]) {
    const state = setup({ classification });
    const result = await state.getRouter().route({
      reason: "user", thinkingLevel: "medium", messages: [{ role: "user", content: "task" }],
    }, state.ctx);
    assert.equal(result.model.id, model);
    assert.equal(result.thinkingLevel, thinkingLevel);
    assert.equal(result.state.model, model);
  }
});

test("falls back to Sol when Jev has no valid result", async () => {
  const state = setup({ stopReason: "error" });
  state.ctx.modelRegistry.findOfType = () => undefined;
  const result = await state.getRouter().route({
    reason: "user", thinkingLevel: "medium", messages: [{ role: "user", content: "task" }],
  }, state.ctx);
  assert.equal(result.model.id, "gpt-6.1-sol");
  assert.equal(result.thinkingLevel, "high");
});

test("switches to Luna after the first successful file edit", async () => {
  const state = setup();
  const result = await state.getRouter().route({
    reason: "continuation",
    thinkingLevel: "high",
    messages: [
      { role: "user", content: "task" },
      { role: "toolResult", toolName: "edit", isError: false },
    ],
    state: { phase: "planning", model: "gpt-6-astra" },
  }, state.ctx);
  assert.equal(result.model.id, "gpt-6-luna");
  assert.equal(result.thinkingLevel, "max");
  assert.equal(result.state.phase, "implementation");
});

test("notifies custom spinners and retains the native working indicator fallback", async () => {
  const state = setup({ classification: "high" });
  await state.getRouter().route({
    reason: "user", thinkingLevel: "medium", messages: [{ role: "user", content: "task" }],
  }, state.ctx);
  assert.deepEqual(state.routes.at(-1), {
    channel: "pi-jev-router:route", provider: "cafe", model: "gpt-6-astra", thinkingLevel: "xhigh",
  });
  assert.equal(state.statuses.at(-1), "Thinking with xhigh effort · cafe/gpt-6-astra");
  await state.router.route({ reason: "direct", thinkingLevel: "high" }, state.ctx);
  assert.equal(state.routes.length, 1, "compaction/side requests must not replace the main route display");
  assert.equal(state.statuses.length, 1);
});
