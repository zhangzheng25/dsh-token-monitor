# dsh-token-monitor

<p align="center">
  <a href="README.md">简体中文</a> | <strong>English</strong>
</p>

> 🤖 **AI-generated disclaimer**: This project was generated with AI assistance and is provided for learning and technical research only — no commercial warranty or support is implied.

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that shows your **token usage and conversation stats** as a native settings page (**Settings → Token 用量 / Token Usage**): today / 7-day / 30-day token totals, a 30-day per-model stacked usage chart, a 30-day per-model usage ranking (fixed window), and conversation counts.

![Token Usage settings page](screenshot.png)

## Features

- 📊 **Metric cards** — today / 7 days / 30 days token totals with Chinese units (万 / 亿), big-number only, no clutter.
- 📊 **30-day model usage** — a 30-day stacked bar chart: each bar is stacked per model by color (the day's heaviest model at the bottom; colors fixed by the 30-day rank). The chart area has a full grey dot-grid background (roughly two dot columns per day, top to bottom, per `temp/model-usage.png`), with bars drawn on top of the dots; the axis shows only the weekly Monday baseline dates; hover/click a day to pin the breakdown card (date / total / per-model swatch rows, styled after `temp/tooltip.png`) — no highlight/dim effects and no label above the bar.
- 🏆 **Model usage ranking** — fixed 30-day window: top-4 models in a **2×2** grid (rank number on its own line / model + token total / provider + right-aligned usage share — no swatch, no growth or unit labels); cards scale slightly on hover.
- 💬 **Conversation stats** — top-level conversations opened today / 7 days / 30 days (subagent sessions excluded), with the corresponding model request counts.
- 🔄 **Auto refresh** — 30 s polling (with an idempotent re-scan that self-corrects the numbers) plus manual "刷新 / Refresh" and "回填历史 / Backfill" buttons.
- 💾 **Persistence** — buckets are written to `$DSH_HOME/plugins/token-monitor/data.json` and survive restarts (181-day daily buckets; per-model breakdown inside each bucket).
- 🕘 **Historical backfill** — session logs are the single source of truth: on startup, on the "回填历史 / Backfill" button, and on every 30 s poll the plugin folds the whole in-window corpus into a fresh bucket map and swaps it in atomically, so usage from *before* the plugin was installed is included too, repeated runs never double-count, and stale buckets self-heal.
- 🎨 **DSH-native styling** — light theme, 1 px hairline cards, 8–10 px radii, no shadows; colors use `--dsw-alias-*` theme variables so it follows DSH's dark theme as well.

## Install

From this repository:

```bash
dsh plugin --profile web add github:zhangzheng25/dsh-token-monitor
```

Or from a local checkout:

```bash
dsh plugin --profile web add E:\path\to\dsh-token-monitor
```

`dsh plugin` forwards to pnpm inside the profile directory and reconciles `dsh.profile.bundles`; the package's `dsh.bundle.patch` (`cordis.patch.yml`) inserts the plugin row into the host composition, and `dsh.client.platform: "web"` makes the web shell serve `client/bundle.js`.

**Restart DSH**, then open **Settings → Token 用量** (Token Usage).

## How it works

```
┌────────────────────────── Host (Node.js) ──────────────────────────┐
│ src/index.js                                                       │
│  • backfill()               ← session logs are the SINGLE source    │
│      of truth (idempotent full rebuild: sessionQuery is            │
│      live-preferred — in-memory sessions and persisted logs both    │
│      count; each run folds every in-window assistant/message       │
│      usage event into a FRESH bucket map and swaps it in           │
│      atomically, so repeated runs never double-count; runs on      │
│      startup / "回填历史" button / 30 s polls)                      │
│      (input / output / cache read / cache write / reasoning,       │
│      split by day AND model via message.source; 181-day window)    │
│  • buildSessionStats()      ← top-level conversation counts        │
│      (delegationDepth === 0), 20 s cache                           │
│  • persist()                ← debounced JSON write (schema v3,     │
│      per-day AND per-model buckets, 181 days kept) to             │
│      $DSH_HOME/plugins/token-monitor/data.json                     │
│  • webServer.register('/token-monitor/snapshot') ← HTTP route      │
│      consumed by the browser half (static-bundle pattern; serves   │
│      modelRank aggregates + modelDaily30)                            │
└─────────────────────────────────────────────────────────────────────┘
                          │ fetch('/token-monitor/snapshot')
                          ▼
┌────────────────────────── Client (browser) ────────────────────────┐
│ client/bundle.js — hand-built web bundle following the             │
│ client-modules protocol (window.__ModuleLoader__.load)             │
│  • slots.inject('settings.section') → settings page "Token 用量"   │
│  • metric cards + conversation cards + 30-day stacked chart +      │
│    model usage ranking                                             │
│  • 30 s polling, refresh / backfill buttons                        │
└─────────────────────────────────────────────────────────────────────┘
```

## Data sources

- **Single source of truth = session logs**: `assistant/message` usage events in session logs, attributed via the event's `message.source` (`provider` / `model`), read through `ctx.sessionQuery` (zstd decoding handled internally; sessions are not woken). `sessionQuery` is live-preferred — in-memory active sessions and persisted logs are both readable, so in-flight calls are counted too and no `llm/stream` hook is needed (older versions ran waterfall live capture *and* log backfill at once; the overlap counted every call twice and inflated the numbers — v3 removed the live path and rebuilds idempotently instead).
- **Conversations**: `sessionQuery.listSessions()` headers (`cwd`, `createdAt`, `delegationDepth`); only top-level sessions (`delegationDepth === 0`) count as conversations.

## Development

```bash
node --check src/index.js      # host half
node --check client/bundle.js  # client bundle
```

The client bundle is written by hand to match the `client-modules` bundle protocol — no build step required.

## License

[MIT](./LICENSE)
