/* dsh-token-monitor — Client half v2.1 (web bundle, built by hand to
 * match the client-modules bundle protocol: window.__ModuleLoader__.load
 * registers a factory that receives a CommonJS require). This file is the
 * `./client` exports subpath declared in package.json.
 *
 * The bundle runs in the REAL page (no sandbox), so it uses native browser
 * APIs: `fetch` for the host snapshot route, `document` for styles. React is
 * resolved through require("react") like every other web plugin bundle.
 *
 * Registers a settings page ("Token 用量") into the root-scoped
 * `settings.section` slot: today / 7-day / 30-day token usage, conversation
 * counts and a GitHub-style 90-day contribution graph that stretches across
 * the full content width. Visual language follows the DSH theme tokens
 * (--dsw-alias-*): flat cards, 1px hairline borders, 8-12px radii, no
 * shadows — and it adapts automatically to DSH light and dark themes.
 */
window.__ModuleLoader__.load({
  id: "dsh-token-monitor",
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" })
    var React = require("react")

    var SNAPSHOT_URL = "/token-usage/snapshot"
    var MS = 86400000
    var GRAPH_DAYS = 90
    // DSH accent (#4f8cff family) with a neutral empty level.
    var LEVEL_COLORS = [
      "rgba(127,127,127,0.14)",
      "rgba(79,140,255,0.25)",
      "rgba(79,140,255,0.5)",
      "rgba(79,140,255,0.75)",
      "#4f8cff"
    ]

    var CSS = [
      ".tu-root { display:flex; flex-direction:column; gap:16px; padding:6px 2px; font-family: inherit; color:var(--dsw-alias-label-primary, #1a1a1a); }",
      ".tu-head { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; }",
      ".tu-title { font-size:16px; font-weight:600; margin:0; color:var(--dsw-alias-label-primary, #1a1a1a); }",
      ".tu-btn { border:1px solid var(--dsw-alias-border-l2, #d5d5d5); border-radius:8px; background:transparent; color:var(--dsw-alias-label-secondary, #333); padding:6px 14px; font-size:13px; cursor:pointer; transition:background .15s ease; }",
      ".tu-btn:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.08)); }",
      ".tu-btn:disabled { opacity:.5; cursor:default; }",
      ".tu-meta { font-size:12px; color:var(--dsw-alias-label-tertiary, rgba(0,0,0,.6)); }",
      ".tu-cards { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }",
      ".tu-card { border:1px solid var(--dsw-alias-border-l2, #e5e5e5); border-radius:10px; padding:14px 16px; background:var(--dsw-alias-bg-layer-1, #fff); }",
      ".tu-card-label { font-size:12px; color:var(--dsw-alias-label-secondary, rgba(0,0,0,.6)); }",
      ".tu-card-value { font-size:26px; font-weight:700; margin-top:4px; letter-spacing:-.02em; color:var(--dsw-alias-label-primary, #1a1a1a); line-height:1.15; }",
      ".tu-card-sub { font-size:11px; color:var(--dsw-alias-label-tertiary, rgba(0,0,0,.6)); margin-top:4px; }",
      ".tu-graph { display:flex; flex-direction:column; gap:6px; }",
      ".tu-graph-months { display:grid; gap:3px; margin-left:26px; }",
      ".tu-month { font-size:10px; color:var(--dsw-alias-label-tertiary, rgba(0,0,0,.6)); white-space:nowrap; overflow:visible; }",
      ".tu-graph-body { display:flex; gap:6px; }",
      ".tu-graph-labels { display:grid; grid-template-rows:repeat(7,1fr); gap:3px; width:20px; font-size:10px; color:var(--dsw-alias-label-tertiary, rgba(0,0,0,.55)); }",
      ".tu-graph-cells { display:grid; grid-auto-flow:column; grid-template-rows:repeat(7,auto); gap:3px; flex:1; width:100%; }",
      ".tu-cell { width:100%; aspect-ratio:1; border-radius:3px; }",
      ".tu-cell-future { visibility:hidden; }",
      ".tu-legend { display:flex; align-items:center; gap:4px; font-size:10px; color:var(--dsw-alias-label-tertiary, rgba(0,0,0,.6)); }",
      ".tu-swatch { width:10px; height:10px; border-radius:2px; }",
      ".tu-err { border:1px solid rgba(239,68,68,.5); background:rgba(239,68,68,.08); border-radius:8px; padding:8px 12px; font-size:12px; color:var(--dsw-alias-state-error-primary, #ef4444); }"
    ].join("\n")

    function fmtTokens(n) {
      if (n === null || n === undefined || isNaN(n)) return "—"
      if (n >= 1e8) return (n / 1e8).toFixed(2) + "亿"
      if (n >= 1e4) {
        var v = n / 1e4
        return (v >= 100 ? Math.round(v) : v.toFixed(1)) + "万"
      }
      return String(Math.round(n))
    }
    function fmtTime(ts) {
      if (!ts) return "—"
      var d = new Date(ts)
      var p = function (x) { return String(x).padStart(2, "0") }
      return p(d.getMonth() + 1) + "/" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes())
    }
    function fmtDay(ts) {
      var d = new Date(ts)
      return (d.getMonth() + 1) + "/" + d.getDate()
    }
    function cardTotals(b) {
      if (!b) return 0
      return b.inputTokens + b.outputTokens + b.cacheReadTokens + b.cacheWriteTokens
    }

    // GitHub-style grid: columns are weeks (Sunday start), rows are weekdays.
    function buildGraph(dailyList, now) {
      var today = new Date(now)
      today.setHours(0, 0, 0, 0)
      var todayStart = today.getTime()
      var start = todayStart - (GRAPH_DAYS - 1) * MS
      var gridStart = start - new Date(start).getDay() * MS
      var weeks = Math.ceil((todayStart - gridStart + 1) / (7 * MS))
      var map = {}
      for (var i = 0; i < dailyList.length; i++) map[dailyList[i].ts] = dailyList[i]
      var cells = []
      var max = 0
      for (var i = 0; i < weeks * 7; i++) {
        var ts = gridStart + i * MS
        var b = map[ts]
        var total = b ? cardTotals(b) : 0
        if (ts > todayStart) total = -1 // future cell in the last column
        if (total > max) max = total
        cells.push({ ts: ts, total: total, b: b })
      }
      var months = []
      var prev = -1
      for (var w = 0; w < weeks; w++) {
        var d = new Date(gridStart + w * 7 * MS)
        var m = d.getFullYear() * 100 + d.getMonth()
        months.push(m !== prev ? (d.getMonth() + 1) + "月" : "")
        prev = m
      }
      return { cells: cells, weeks: weeks, months: months, max: max }
    }
    function cellLevel(total, max) {
      if (total <= 0) return 0
      if (total >= max || max <= 0) return 4
      var r = total / max
      return r <= 0.25 ? 1 : r <= 0.5 ? 2 : r <= 0.75 ? 3 : 4
    }

    // One metric card: label, big value, optional small sub-line.
    function Card(label, value, sub) {
      return React.createElement("div", { className: "tu-card" },
        React.createElement("div", { className: "tu-card-label" }, label),
        React.createElement("div", { className: "tu-card-value" }, value),
        sub ? React.createElement("div", { className: "tu-card-sub" }, sub) : null
      )
    }

    function Panel() {
      var state = React.useState(null)
      var snap = state[0]
      var setSnap = state[1]
      var busyState = React.useState(false)
      var busy = busyState[0]
      var setBusy = busyState[1]
      var errState = React.useState(null)
      var error = errState[0]
      var setError = errState[1]

      var load = function (backfill) {
        setBusy(true)
        fetch(SNAPSHOT_URL + (backfill ? "?backfill=1" : ""), { cache: "no-store" })
          .then(function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status)
            return res.json()
          })
          .then(function (data) {
            setSnap(data)
            setError(null)
          })
          .catch(function (e) {
            setError(String((e && e.message) || e))
          })
          .then(function () { setBusy(false) })
      }

      React.useEffect(function () {
        load(false)
        var id = setInterval(function () { load(false) }, 30000)
        return function () { clearInterval(id) }
      }, [])

      var totals = snap ? snap.totals : null
      var sessions = snap ? snap.sessions : null
      var daily = snap ? snap.daily : []
      var graph = snap ? buildGraph(daily, snap.now) : null
      var weeks = graph ? graph.weeks : 0

      return React.createElement("div", { className: "tu-root" },
        React.createElement("div", { className: "tu-head" },
          React.createElement("h3", { className: "tu-title" }, "Token 用量"),
          React.createElement("div", null,
            React.createElement("button", { className: "tu-btn", disabled: busy, onClick: function () { load(false) } }, busy ? "刷新中…" : "刷新"),
            " ",
            React.createElement("button", { className: "tu-btn", disabled: busy, onClick: function () { load(true) } }, "回填历史")
          )
        ),
        snap && React.createElement("div", { className: "tu-meta" },
          "统计自 " + fmtTime(snap.trackingSince) + " · 历史回填至 " + fmtTime(snap.backfilledUntil)
        ),
        error && React.createElement("div", { className: "tu-err" }, error),
        totals && React.createElement("div", { className: "tu-cards" },
          Card("今日 Tokens", fmtTokens(cardTotals(totals.today))),
          Card("近 7 天 Tokens", fmtTokens(cardTotals(totals.d7))),
          Card("近 30 天 Tokens", fmtTokens(cardTotals(totals.d30)))
        ),
        sessions && React.createElement("div", { className: "tu-cards" },
          Card("今日会话", String(sessions.today), totals ? totals.today.requests + " 次请求" : ""),
          Card("近 7 天会话", String(sessions.d7), totals ? totals.d7.requests + " 次请求" : ""),
          Card("近 30 天会话", String(sessions.d30), totals ? totals.d30.requests + " 次请求" : "")
        ),
        React.createElement("div", { className: "tu-head" },
          React.createElement("span", { className: "tu-title" }, "近 90 天每日用量"),
          React.createElement("div", { className: "tu-legend" },
            React.createElement("span", null, "少"),
            [0, 1, 2, 3, 4].map(function (l) {
              return React.createElement("span", { key: l, className: "tu-swatch", style: { backgroundColor: LEVEL_COLORS[l] } })
            }),
            React.createElement("span", null, "多")
          )
        ),
        graph && (graph.max === 0
          ? React.createElement("div", { className: "tu-meta" }, "暂无用量数据——插件启动后（或点击「回填历史」后）的每次模型调用都会出现在这里。")
          : React.createElement("div", { className: "tu-graph" },
              React.createElement("div", { className: "tu-graph-months", style: { gridTemplateColumns: "repeat(" + weeks + ", minmax(8px, 1fr))" } },
                graph.months.map(function (m, w) {
                  return React.createElement("span", { key: w, className: "tu-month" }, m)
                })
              ),
              React.createElement("div", { className: "tu-graph-body" },
                React.createElement("div", { className: "tu-graph-labels" },
                  ["", "一", "", "三", "", "五", ""].map(function (lbl, r) {
                    return React.createElement("span", { key: r }, lbl)
                  })
                ),
                React.createElement("div", { className: "tu-graph-cells", style: { gridTemplateColumns: "repeat(" + weeks + ", minmax(8px, 1fr))" } },
                  graph.cells.map(function (c, i) {
                    var future = c.total < 0
                    return React.createElement("div", {
                      key: i,
                      className: "tu-cell" + (future ? " tu-cell-future" : ""),
                      style: future ? undefined : { backgroundColor: LEVEL_COLORS[cellLevel(c.total, graph.max)] },
                      title: future ? "" : fmtDay(c.ts) + " · " + fmtTokens(c.total) + " tokens" +
                        (c.b ? " · 输入 " + fmtTokens(c.b.inputTokens) + " · 输出 " + fmtTokens(c.b.outputTokens) +
                          " · 缓存 " + fmtTokens(c.b.cacheReadTokens + c.b.cacheWriteTokens) + " · " + c.b.requests + " 次请求" : "")
                    })
                  })
                )
              )
            )
        )
      )
    }

    var inject = ["slots"]

    function apply(ctx) {
      // bundle runs in the real page — inject a style element and remove it
      // when the plugin is disposed
      var style = document.createElement("style")
      style.setAttribute("data-plugin", "dsh-token-monitor")
      style.textContent = CSS
      document.head.append(style)
      ctx.effect(function () {
        return function () {
          if (style.parentNode) style.parentNode.removeChild(style)
        }
      })

      var slots = ctx.get("slots")
      if (slots === undefined) return
      slots.inject("settings.section", function () {
        return slots.register(
          { name: "settings.section", id: "token-usage", order: 30, label: "Token 用量" },
          function () { return React.createElement(Panel) }
        )
      })
    }

    exports.inject = inject
    exports.apply = apply
    return module.exports
  }
})
