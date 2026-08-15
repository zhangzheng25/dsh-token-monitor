# AGENTS.md

DSH (DeepSeek Harness) plugin: a token-usage dashboard rendered as a Settings page (Settings → Token 用量). The host half captures token usage from model calls and session logs; the browser half draws the UI.

## Layout

- `src/index.js` — host (Node) half, a Cordis plugin (`module.exports = { name, inject, apply(ctx) }`). Package entry (`package.json` → `main`).
- `client/bundle.js` — browser half, a **hand-written** bundle following the client-modules protocol (`window.__ModuleLoader__.load({ id, factory(require) })`). Exported as the `./client` subpath and served by the web shell via `dsh.client.platform: "web"`.
- `cordis.patch.yml` — `dsh.bundle.patch`: inserts the `token-monitor` row into the **host** composition when installed via `dsh plugin add`. Must stay host-plane (it reads host services `sessionQuery`, `timer`, `webServer`) — never move it into an agent preset. Keep the id in sync with the plugin `name` and the client bundle (slot id, `data-plugin` attr).
- `README.md` — Chinese, the default GitHub landing page; `README.en.md` — English mirror (GitHub auto-shows it to English-locale browsers). Update both together.

## Build / verify

No build step and no dependency install — plain CommonJS, Node ≥ 20:

```bash
npm run check   # node --check on both halves (syntax only; there are no tests)
```

The client bundle must stay hand-written ES5-style (no JSX, no imports; `React.createElement` + `var`, `require("react")` from the factory) — there is no bundler and no source-to-bundle step.

## Running / testing

Not runnable standalone — it only works inside a live DSH host. Install into a profile, restart DSH, then open Settings → Token 用量:

```bash
dsh plugin --profile web add E:\path\to\dsh-token-monitor
```

The host registers the HTTP route `/token-monitor/snapshot` via `webServer.register({ kind: 'exact', path, handler })`; the browser half fetches it with `{ cache: 'no-store' }` and polls every 30 s (`?backfill=1` triggers a session-corpus backfill).

## Contracts that must not break

- `ctx.on('llm/stream', (options, next) => ...)` is a **waterfall**: the handler must call `next()` and yield every chunk through untouched, or model calls break. Accounting code is wrapped in try/catch so it can never throw into the stream.
- `sessionQuery` is fetched via `ctx.get('sessionQuery')` and may be `undefined` — guard it. `listSessions()` returns records with `header` (`id`, `createdAt`, `delegationDepth`); `readSession(id)` returns `log.events` (`type: 'assistant/message'`, `data.usage`, `time`). Sessions are not woken; zstd decoding is internal. Only `delegationDepth === 0` sessions count as conversations.
- Persistence: daily buckets keyed by local-midnight `ts` (`dayKey`), kept 91 days (`DAILY_KEEP_MS`), written to `$DSH_HOME/plugins/token-monitor/data.json` (or the `DSH_HOME` env var) — debounced 5 s, flushed every 60 s and on dispose via `ctx.effect`.
- One-time migration: on first load, the pre-rename path `$DSH_HOME/plugins/token-usage/data.json` (plugin id was `token-usage`) is renamed to the new path — keep it.

## Style conventions

- Client visuals must use DSH theme tokens (`--dsw-alias-*`, e.g. `--dsw-alias-label-primary`, `--dsw-alias-border-l2`, `--dsw-alias-bg-layer-1`) with fallbacks so light and dark themes both work: flat cards, 1px hairline borders, 8–10 px radii, no shadows. The bundle injects and removes its own `<style>` element (tagged `data-plugin`).
- UI strings are Chinese ("Token 用量", "刷新", "回填历史"); token numbers use 万 / 亿 units.
- The contribution-graph hover tooltip is hand-rolled (not the primitives `Tooltip`, which takes only a label): a `position:fixed` card positioned imperatively in a `useEffect` (flip above/below the cell, clamp to viewport, arrow aligned to the cell), hidden on scroll/resize, `pointer-events:none`; surfaces use `--dsw-alias-bg-layer-2` + `--dsw-shadow-lv2` so it reads correctly in light and dark themes. Keep this pattern if extending it.
- Cross-check host API contracts against the installed harness's `node_modules/@deepseek-ai/dsh-*` sources (`dsh-llm`, `dsh-session-query`, `dsh-host-webserver`, `dsh-cordis-client-runner` slot docs) rather than guessing.
