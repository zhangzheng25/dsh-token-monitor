# AGENTS.md

DSH (DeepSeek Harness) plugin: a token-usage dashboard rendered as a Settings page (Settings → Token 用量). The host half captures token usage from model calls and session logs; the browser half draws the UI.

## Design Reference

基于参考设计图 `temp/model-usage.png`（OpenCode Go 仪表盘）：

### 布局结构
1. **顶部说明文字**：灰色小字，描述页面用途
2. **中部主图表区**：堆叠柱状图（按模型分色） + 悬浮 Tooltip
3. **底部排名卡片行**：3 张横向排列的模型排名卡片

### 关键组件
- **堆叠柱状图**：X 轴为日期（按周标签），每根柱子按模型堆叠不同颜色，支持 Tooltip 悬浮显示详情
- **模型颜色映射表**：为每个模型分配固定颜色（粉色、淡紫色、蓝色、浅青色、青绿色、绿色、黄绿色、黄色、橙色）
- **排名卡片组件**：展示 Top N 模型，包含排名编号、厂商图标/名、模型名、总使用量、增长率
- **Tooltip 组件**：白色背景、圆角、阴影，左侧颜色图例 + 模型名 + 数值，数值右对齐

### 单位换算
- 支持 T（万亿）、B（十亿）、万 等多种单位显示
- 当前实现使用万/亿单位

> 注：180 天热力图已按用户要求移除，改为 30 天按模型堆叠柱状图 + 模型使用排行（见下方 Style conventions）；本节的 Tooltip 描述与参考图一致（tooltip.png）。

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

- `ctx.on('llm/stream', (options, next) => ...)` is a **waterfall**: the handler must call `next()` and yield every chunk through untouched, or model calls break. Accounting code is wrapped in try/catch so it can never throw into the stream. The `options` object carries the model route (`provider`, `model`) — that is the live path's model attribution (`liveModelKey`).
- `sessionQuery` is fetched via `ctx.get('sessionQuery')` and may be `undefined` — guard it. `listSessions()` returns records with `header` (`id`, `createdAt`, `delegationDepth`); `readSession(id)` returns `log.events` (`type: 'assistant/message'`, `data.usage`, `data.message.source` → `{ provider, model }`, `time`). Sessions are not woken; zstd decoding is internal. Only `delegationDepth === 0` sessions count as conversations. Model attribution for backfilled events comes from `message.source` (`sourceModelKey`, fallback `"unknown"`).
- Persistence: daily buckets keyed by local-midnight `ts` (`dayKey`), kept 181 days (`DAILY_KEEP_MS`), written to `$DSH_HOME/plugins/token-monitor/data.json` (or the `DSH_HOME` env var) — debounced 5 s, flushed every 60 s and on dispose via `ctx.effect`. Schema version is `SAVED_VERSION` (3): each bucket has a `models` map (`"provider:model"` → per-model `emptyModelBucket()`).
- Schema migrations: on load, `saved.version !== SAVED_VERSION` discards the old daily buckets and resets `backfilledUntil = 0` so the startup backfill rebuilds everything (v1/v2 → v3 widened the retention window to 181 days). The pre-rename path `$DSH_HOME/plugins/token-usage/data.json` (plugin id was `token-usage`) is still renamed to the new path on first load — keep both.
- Snapshot route `/token-monitor/snapshot` returns `totals` (`today`/`d7`/`d30`), `sessions`, plus `modelRank` (per-window model rankings keyed `today` / `d7` / `d30`, built by `buildModelRank`, each an array sorted desc by `total` with `key`/`provider`/`model`/`requests`/`inputTokens`/`outputTokens`/`cacheReadTokens`/`cacheWriteTokens`/`reasoningTokens`/`total`/`growth` — `growth` is a ratio vs the immediately previous window of the same length or `null` for new models) and `modelDaily30` (non-empty days only: `{ ts, models }` with the same per-model field shape, feeding the 30-day stacked chart).

## Style conventions

- Client visuals must use DSH theme tokens (`--dsw-alias-*`, e.g. `--dsw-alias-label-primary`, `--dsw-alias-border-l2`, `--dsw-alias-bg-layer-1`) with fallbacks so light and dark themes both work: flat cards, 1px hairline borders, 8–10 px radii, no shadows. The bundle injects and removes its own `<style>` element (tagged `data-plugin`).
- UI strings are Chinese ("Token 用量", "刷新", "回填历史"); token numbers use 万 / 亿 units.
- The tooltip card is hand-rolled (not the primitives `Tooltip`, which takes only a label): a `position:fixed` card positioned imperatively in a `useEffect` (flip above/below the hovered element, clamp to viewport, arrow aligned to it), hidden on scroll/resize, `pointer-events:none`; surfaces use `--dsw-alias-bg-layer-2` + `--dsw-shadow-lv2` so it reads correctly in light and dark themes. Styled after `temp/tooltip.png`: date row, big total + small "总计" suffix, then colored-swatch rows (model name left, value right-aligned) with no separators and no request counts.
- The 30-day model chart (`buildModelGrid`) renders one column per day (fixed 30-day window, `MODEL_WINDOW`) with one colored segment per model. `segs` are kept sorted by that day's usage **descending** (heaviest first) for the tooltip rows; the column renderer iterates them **in reverse** so the heaviest segment sits at the bottom of the bar (flex-end aligns the group to the bottom but preserves document order — do not rely on it to reverse). Colors are fixed by the 30-day rank (`colorOrder` = `modelRank.d30`, `MODEL_COLORS` palette pink → orange) so they stay stable. The plot area has a grey dot-grid background drawn **per column** (`.tu-mcol` radial-gradient, 13px grid, `background-position:center`) so the dot columns align with and are centered under each bar column (per `temp/model-usage.png`); empty days and the space behind bars are both dotted. Interaction has **no highlight/dim/scale effects and no label above the bar**: hovering a bar shows the breakdown card, clicking pins it, clicking again unpins; baseline axis labels show Mondays only (`new Date(c.ts).getDay() === 1`, `fmtMD`).
- The model ranking section is fixed to the 30-day window (`modelRank.d30`) with **no title and no base switcher** (`.tu-seg` removed): it renders the top 4 models in a **2×2 grid** (`.tu-mrank`, `repeat(2,1fr)`), each card a vertical stack — rank number alone on its own line (`.tu-rank-num`, 12px semibold), then model name (15px semibold) + token total (18px bold, right-aligned, baseline-aligned) on the second line (`.tu-rank-main`), then provider + usage share on the third (`.tu-rank-sub`, `space-between`: provider left with ellipsis, bare percentage right-aligned — no "占比"/"·" label text, share semibold). **No color swatch element, no growth, no "总计" unit, no "新增" labels**; the usage share is computed client-side as `m.total / Σ modelRank.d30 totals` (the host sends no percent field); cards scale slightly on hover.
- Cross-check host API contracts against the installed harness's `node_modules/@deepseek-ai/dsh-*` sources (`dsh-llm`, `dsh-session-query`, `dsh-host-webserver`, `dsh-cordis-client-runner` slot docs) rather than guessing.
