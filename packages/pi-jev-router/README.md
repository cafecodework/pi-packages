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

At the start of a planning phase, Jev classifies the latest user message (up to 16,000 characters):

| Classification | Model | Thinking |
|---|---|---|
| High: architecture, complex algorithms, subtle bugs, security or critical refactoring | `cafe/gpt-6-astra` | `xhigh` |
| Medium: standard features, common fixes or general code changes | `cafe/gpt-6.1-sol` | `high` |
| Low: minor tweaks, typos, formatting or short answers | `cafe/gpt-6-luna` | `max` |

After the first successful `edit` or `write` during planning, subsequent requests use Luna. Direct requests also use Luna. Unmapped models retain the selected thinking level.

While generating, Pi's native working indicator shows the routed model and effort, for example `Thinking with xhigh effort · cafe/gpt-6-astra`. With `pi-theme-cafecode`, the same data is composed into its animated spinner: `Ebbing… (2m 15s · ↓ 3.9k tokens · thinking with xhigh effort · cafe/gpt-6-astra)`. The model label takes priority over time/token counters in narrow terminals.

The router emits `pi-jev-router:route` on Pi's shared extension event bus with `{ provider, model, thinkingLevel }` for main-loop requests. This lets the theme retain the route on every animation tick instead of overwriting a one-off working message. Direct requests (for example compaction) do not replace the main request's display.

If Jev is unavailable or returns no valid choice, the router falls back to Sol. When the previous physical model is already one of the configured Cafe models, it reuses that model rather than classifying again. Routing state is stored on the session branch.
