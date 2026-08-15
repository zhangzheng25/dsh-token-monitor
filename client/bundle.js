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

    var SNAPSHOT_URL = "/token-monitor/snapshot"
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
      ".tu-cell-hover { outline:2px solid rgba(79,140,255,.85); outline-offset:1px; }",
      ".tu-legend { display:flex; align-items:center; gap:4px; font-size:10px; color:var(--dsw-alias-label-tertiary, rgba(0,0,0,.6)); }",
      ".tu-swatch { width:10px; height:10px; border-radius:2px; }",
      ".tu-tip { position:fixed; z-index:1000; visibility:hidden; box-sizing:border-box; width:184px; background:var(--dsw-alias-bg-layer-2, #fff); border:1px solid var(--dsw-alias-border-l2, #e5e5e5); border-radius:10px; box-shadow:var(--dsw-shadow-lv2, 0 2px 8px rgba(0,0,0,.12)); padding:10px 12px 9px; pointer-events:none; animation:tu-tip-in .14s ease-out; }",
      ".tu-tip-arrow { position:absolute; width:8px; height:8px; background:var(--dsw-alias-bg-layer-2, #fff); }",
      ".tu-tip-arrow-down { bottom:-4px; transform:rotate(45deg); border-right:1px solid var(--dsw-alias-border-l2, #e5e5e5); border-bottom:1px solid var(--dsw-alias-border-l2, #e5e5e5); }",
      ".tu-tip-arrow-up { top:-4px; transform:rotate(45deg); border-left:1px solid var(--dsw-alias-border-l2, #e5e5e5); border-top:1px solid var(--dsw-alias-border-l2, #e5e5e5); }",
      ".tu-tip-date { font-size:11px; color:var(--dsw-alias-label-tertiary, rgba(0,0,0,.6)); }",
      ".tu-tip-total { font-size:20px; font-weight:700; line-height:1.25; margin:2px 0 8px; letter-spacing:-.01em; color:var(--dsw-alias-label-primary, #1a1a1a); }",
      ".tu-tip-unit { font-size:12px; font-weight:400; color:var(--dsw-alias-label-secondary, rgba(0,0,0,.6)); margin-left:5px; }",
      ".tu-tip-rows { border-top:1px solid var(--dsw-alias-border-l1, #e8e8e8); padding-top:6px; display:flex; flex-direction:column; gap:3px; }",
      ".tu-tip-row { display:flex; justify-content:space-between; gap:14px; font-size:12px; line-height:16px; }",
      ".tu-tip-row-label { color:var(--dsw-alias-label-secondary, rgba(0,0,0,.6)); white-space:nowrap; }",
      ".tu-tip-row-value { color:var(--dsw-alias-label-primary, #1a1a1a); font-variant-numeric:tabular-nums; }",
      ".tu-tip-foot { margin-top:6px; font-size:11px; color:var(--dsw-alias-label-tertiary, rgba(0,0,0,.55)); }",
      ".tu-tip-empty { font-size:12px; color:var(--dsw-alias-label-tertiary, rgba(0,0,0,.55)); }",
      "@keyframes tu-tip-in { from { opacity:0; transform:translateY(3px) scale(.98); } to { opacity:1; transform:none; } }",
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
    function fmtDayCN(ts) {
      var d = new Date(ts)
      return (d.getMonth() + 1) + "月" + d.getDate() + "日 · 周" + "日一二三四五六".charAt(d.getDay())
    }
    // One row inside the hover tooltip: label left, value right.
    function tipRow(label, value, key) {
      return React.createElement("div", { key: key, className: "tu-tip-row" },
        React.createElement("span", { className: "tu-tip-row-label" }, label),
        React.createElement("span", { className: "tu-tip-row-value" }, value)
      )
    }
    // Hover tooltip card: date, total, then input / output / requests.
    // Positioned imperatively (position:fixed) in a useEffect after mount, so
    // it can flip above/below the cell and stay inside the viewport.
    function TipCard(tip, tipRef) {
      var c = tip.cell
      var kids = [
        React.createElement("span", { key: "ar", className: "tu-tip-arrow" }),
        React.createElement("div", { key: "d", className: "tu-tip-date" }, fmtDayCN(c.ts)),
        React.createElement("div", { key: "t", className: "tu-tip-total" },
          fmtTokens(cardTotals(c.b)),
          React.createElement("span", { className: "tu-tip-unit" }, "tokens")
        )
      ]
      if (c.b) {
        var rows = [
          tipRow("输入", fmtTokens(c.b.inputTokens), 0),
          tipRow("输出", fmtTokens(c.b.outputTokens), 1)
        ]
        rows.push(React.createElement("div", { key: "f", className: "tu-tip-foot" }, c.b.requests + " 次请求"))
        kids.push(React.createElement("div", { key: "r", className: "tu-tip-rows" }, rows))
      } else {
        kids.push(React.createElement("div", { key: "e", className: "tu-tip-empty" }, "当日无模型调用"))
      }
      return React.createElement("div", { ref: tipRef, className: "tu-tip", role: "tooltip" }, kids)
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
      var tipState = React.useState(null)
      var tip = tipState[0]
      var setTip = tipState[1]
      var tipRef = React.useRef(null)

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

      // hover tooltip: remember the cell and its screen rect; TipCard
      // positions itself from these numbers once mounted
      var onCellEnter = function (c, e) {
        var t = e.currentTarget.getBoundingClientRect()
        setTip({ cell: c, rect: { left: t.left, top: t.top, width: t.width, height: t.height } })
      }
      var onCellLeave = function () { setTip(null) }

      React.useEffect(function () {
        if (!tip) return
        var el = tipRef.current
        if (!el) return
        var r = el.getBoundingClientRect()
        var c = tip.rect
        var gap = 8
        var vw = window.innerWidth
        var left = c.left + c.width / 2 - r.width / 2
        left = Math.max(8, Math.min(left, Math.max(8, vw - r.width - 8)))
        // flip below the cell when there is no room above it
        var above = c.top - gap - r.height >= 8
        var top = above ? c.top - gap - r.height : c.bottom + gap
        el.style.left = Math.round(left) + "px"
        el.style.top = Math.round(top) + "px"
        // re-trigger the fade-in so it plays from the moment of showing
        el.style.animation = "none"
        void el.offsetWidth
        el.style.animation = ""
        el.style.visibility = "visible"
        // point the arrow at the hovered cell, keeping it inside the card
        var arrow = el.querySelector(".tu-tip-arrow")
        if (arrow) {
          arrow.className = "tu-tip-arrow " + (above ? "tu-tip-arrow-down" : "tu-tip-arrow-up")
          arrow.style.left = Math.max(8, Math.min(c.left + c.width / 2 - left, r.width - 16)) + "px"
        }
      }, [tip])

      // the tip is positioned against the viewport: hide it on scroll/resize
      React.useEffect(function () {
        if (!tip) return
        var hide = function () { setTip(null) }
        window.addEventListener("scroll", hide, true)
        window.addEventListener("resize", hide)
        return function () {
          window.removeEventListener("scroll", hide, true)
          window.removeEventListener("resize", hide)
        }
      }, [tip])

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
                      className: "tu-cell" + (future ? " tu-cell-future" : "") + (tip && tip.cell.ts === c.ts ? " tu-cell-hover" : ""),
                      style: future ? undefined : { backgroundColor: LEVEL_COLORS[cellLevel(c.total, graph.max)] },
                      onMouseEnter: future ? null : function (e) { onCellEnter(c, e) },
                      onMouseLeave: future ? null : onCellLeave
                    })
                  })
                )
              )
            )
        ),
        tip && TipCard(tip, tipRef)
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
          { name: "settings.section", id: "token-monitor", order: 30, label: "Token 用量" },
          function () { return React.createElement(Panel) }
        )
      })
    }

    exports.inject = inject
    exports.apply = apply
    return module.exports
  }
})
