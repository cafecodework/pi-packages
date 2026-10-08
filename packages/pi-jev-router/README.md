# pi-jev-router

Jev-classifier virtual model router for Pi. Registers `jev/auto` and routes requests to configured Cafe models.

## Requirements

- Pi 0.99.0 or newer
- `TYPESAFE_API_KEY` available in Pi's process environment
- Authenticated `cafe` provider models: `gpt-6-astra`, `gpt-6.1-sol`, and `gpt-6-luna`

## Install

From the repository root:

```sh
pi install ./packages/pi-jev-router
```

Then choose `jev/auto` in Pi or start a session with:

```sh
pi --model jev/auto
```

Run `/reload` after installing or changing the extension.

## Routing

Every new user message (including steering and follow-ups) starts a fresh Jev classification, even if the session already has a route or a previous physical model. Jev receives:

- The latest user message, up to 16,000 characters.
- Up to four preceding non-empty user/assistant text messages, in chronological order, keeping the last 2,000 characters of each.

This bounds the supplied text to 24,000 characters. System prompts, tool results, tool-call arguments, thinking blocks and images are not sent to Jev. Recent dialogue resolves references such as “continue” or “implement that plan”; unrelated past tasks should not determine the current task’s difficulty. Longer-range references outside this window are not included. These limits apply only to classification, not the answering model’s conversation.

| Classification | Model | Thinking |
|---|---|---|
| High: architecture, complex algorithms, subtle bugs, security or critical refactoring | `cafe/gpt-6-astra` | `xhigh` |
| Medium (ordinary-work default): features, common fixes, routine debugging/reviews, technical explanations, configuration or behavior-related code changes | `cafe/gpt-6.1-sol` | `high` |
| Low (narrow): explicitly specified mechanical typo, formatting or exact label/value replacements; no diagnosis or behavior judgment | `cafe/gpt-6-luna` | `max` |

Small changes and short questions are not automatically low complexity. Borderline low/medium tasks and unclear ordinary tasks favor Sol; high-complexity criteria remain unchanged. This policy applies to classified user requests; direct requests such as compaction still use Luna.

The table lists requested efforts. The router uses Pi’s `clampThinkingLevel` to adapt them to the selected model’s supported levels before returning the route or updating the UI; the displayed effort therefore matches Pi’s dispatched effort.

Tool follow-ups keep the current round’s model: a successful `edit`, `write` or shell command does **not** trigger a downgrade. Retries prefer the configured Cafe model that failed, then the saved route. When no route is saved, continuations/retries reuse a previous configured Cafe model or classify if none is available. Direct requests (such as compaction) still use Luna and do not change the main route. Unmapped models retain the selected thinking level.

While generating, Pi's native working indicator shows the routed model and effort, for example `Thinking with xhigh effort · cafe/gpt-6-astra`. With `pi-theme-cafecode`, the same data is composed into its animated spinner: `Ebbing… (2m 15s · ↓ 3.9k tokens · thinking with xhigh effort · cafe/gpt-6-astra)`. The model label takes priority over time/token counters in narrow terminals.

The router emits `pi-jev-router:route` on Pi's shared extension event bus with `{ provider, model, thinkingLevel }` for main-loop requests. This lets the theme retain the route on every animation tick instead of overwriting a one-off working message. Direct requests (for example compaction) do not replace the main request's display.

Jev classification has a 5-second request timeout and no automatic retries. If Jev is unavailable, times out, reports an error, returns no valid choice, or the latest user message contains no text, the router falls back to Sol. User cancellation aborts routing rather than selecting a fallback, including cancellation while a fast fallback is pending; no route event or working-message update is emitted. Routing state is stored on the session branch, but never bypasses classification of a new user message. Existing sessions with old `{ phase, model }` state remain compatible; the phase is ignored.

## Checks

Development SDK dependencies are pinned to Pi 0.99.1 in the repository and lockfile; runtime SDKs remain host-provided peer dependencies requiring 0.99.0 or newer. Use Node.js 22.19+ LTS or 24 LTS for development.

From the repository root (tests make no external model calls):

```sh
npm ci
npm run pi-jev-router:check
npm run pi-jev-router:test
node --test packages/pi-theme-cafecode/test/spinner.test.mjs
```
