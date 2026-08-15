/* dsh-token-monitor — Client half v2.4 (web bundle, built by hand to
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
 * counts, a 30-day per-model stacked bar chart (hover/click a day to pin the
 * breakdown card, styled after temp/tooltip.png), and a model usage ranking
 * fixed to the 30-day window (top-4 cards in a 2×2 grid: rank number on its
 * own line, model + token total, provider + usage share — no color swatch).
 * Visual language follows the DSH theme tokens (--dsw-alias-*): flat cards,
 * 1px hairline borders, 8-12px radii, no shadows — and it adapts
 * automatically to DSH light and dark themes.
 */
window.__ModuleLoader__.load({
  id: "dsh-token-monitor",
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" })
    var React = require("react")

    var SNAPSHOT_URL = "/token-monitor/snapshot"
    var NO_DATA_MSG = "暂无模型用量数据——插件升级后点一次「回填历史」即可。"
    var MS = 86400000
    var MODEL_WINDOW = 30
    // chart plot height in px, shared by the CSS and the segment height math
    var BAR_HEIGHT = 116
    // Per-model palette (pink → orange), assigned in usage-rank order.
    var MODEL_COLORS = [
      "#f472b6",
      "#a78bfa",
      "#60a5fa",
      "#22d3ee",
      "#2dd4bf",
      "#4ade80",
      "#a3e635",
      "#facc15",
      "#fb923c"
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
      ".tu-tip { position:fixed; z-index:1000; visibility:hidden; box-sizing:border-box; width:210px; background:var(--dsw-alias-bg-layer-2, #fff); border:1px solid var(--dsw-alias-border-l2, #e5e5e5); border-radius:10px; box-shadow:var(--dsw-shadow-lv2, 0 2px 8px rgba(0,0,0,.08)); padding:12px 14px; pointer-events:none; animation:tu-tip-in .14s ease-out; }",
      ".tu-tip-arrow { position:absolute; width:8px; height:8px; background:var(--dsw-alias-bg-layer-2, #fff); }",
      ".tu-tip-arrow-down { bottom:-4px; transform:rotate(45deg); border-right:1px solid var(--dsw-alias-border-l2, #e5e5e5); border-bottom:1px solid var(--dsw-alias-border-l2, #e5e5e5); }",
      ".tu-tip-arrow-up { top:-4px; transform:rotate(45deg); border-left:1px solid var(--dsw-alias-border-l2, #e5e5e5); border-top:1px solid var(--dsw-alias-border-l2, #e5e5e5); }",
      ".tu-tip-date { font-size:12px; color:var(--dsw-alias-label-tertiary, rgba(0,0,0,.55)); }",
      ".tu-tip-total { font-size:18px; font-weight:600; line-height:1.25; margin:2px 0 8px; letter-spacing:-.01em; color:var(--dsw-alias-label-primary, #1a1a1a); }",
      ".tu-tip-unit { font-size:12px; font-weight:400; color:var(--dsw-alias-label-tertiary, rgba(0,0,0,.55)); margin-left:5px; }",
      ".tu-tip-rows { display:flex; flex-direction:column; gap:4px; }",
      ".tu-tip-row { display:flex; justify-content:space-between; gap:14px; font-size:13px; line-height:16px; }",
      ".tu-tip-row-label { display:flex; align-items:center; gap:6px; color:var(--dsw-alias-label-secondary, rgba(0,0,0,.6)); white-space:nowrap; }",
      ".tu-tip-row-value { color:var(--dsw-alias-label-primary, #1a1a1a); font-variant-numeric:tabular-nums; }",
      ".tu-tip-dot { width:8px; height:8px; border-radius:2px; flex:none; }",
      ".tu-tip-empty { font-size:12px; color:var(--dsw-alias-label-tertiary, rgba(0,0,0,.55)); }",
      ".tu-msec { display:flex; flex-direction:column; gap:8px; }",
      ".tu-mchart { border:1px solid var(--dsw-alias-border-l2, #e5e5e5); border-radius:10px; padding:16px 16px 10px; background:var(--dsw-alias-bg-layer-1, #fff); }",
      ".tu-mbars { display:flex; gap:2px; align-items:flex-end; height:" + BAR_HEIGHT + "px; cursor:pointer; }",
      ".tu-mcol { flex:1; min-width:0; display:flex; flex-direction:column; justify-content:flex-end; height:100%; background-image:radial-gradient(circle, rgba(127,127,127,.3) 1px, transparent 1.5px); background-size:13px 13px; background-position:center; }",
      ".tu-mseg { width:100%; }",
      ".tu-mlabels { display:flex; gap:2px; margin-top:4px; font-size:10px; color:var(--dsw-alias-label-tertiary, rgba(0,0,0,.55)); }",
      ".tu-mlabel { flex:1; min-width:0; overflow:visible; white-space:nowrap; }",
      ".tu-mrank { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }",
      ".tu-rank { border:1px solid var(--dsw-alias-border-l2, #e5e5e5); border-radius:10px; padding:12px 16px 14px; background:var(--dsw-alias-bg-layer-1, #fff); display:flex; flex-direction:column; gap:7px; transition:transform .12s ease, border-color .12s ease; }",
      ".tu-rank:hover { transform:scale(1.02); border-color:rgba(79,140,255,.55); }",
      ".tu-rank-num { font-size:12px; font-weight:600; color:var(--dsw-alias-label-tertiary, rgba(0,0,0,.45)); font-variant-numeric:tabular-nums; letter-spacing:.08em; }",
      ".tu-rank-main { display:flex; justify-content:space-between; align-items:baseline; gap:10px; min-width:0; }",
      ".tu-rank-name { font-size:15px; font-weight:600; color:var(--dsw-alias-label-primary, #1a1a1a); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }",
      ".tu-rank-total { font-size:18px; font-weight:700; letter-spacing:-.02em; color:var(--dsw-alias-label-primary, #1a1a1a); line-height:1.15; flex:none; font-variant-numeric:tabular-nums; }",
      ".tu-rank-sub { display:flex; justify-content:space-between; align-items:baseline; gap:10px; min-width:0; font-size:12px; color:var(--dsw-alias-label-tertiary, rgba(0,0,0,.55)); white-space:nowrap; }",
      ".tu-rank-vendor { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; }",
      ".tu-rank-share { flex:none; font-weight:600; color:var(--dsw-alias-label-secondary, rgba(0,0,0,.65)); font-variant-numeric:tabular-nums; }",
      "@keyframes tu-tip-in { from { opacity:0; transform:translateY(3px) scale(.98); } to { opacity:1; transform:none; } }",
      ".tu-err { border:1px solid rgba(239,68,68,.5); background:rgba(239,68,68,.08); border-radius:8px; padding:8px 12px; font-size:12px; color:var(--dsw-alias-state-error-primary, #ef4444); }"
    ].join("\n")

    function fmtTokens(n) {
      if (n === null || n === undefined || isNaN(n)) return "—"
      if (n >= 1e12) {
        var t = n / 1e12
        return (t >= 100 ? Math.round(t) : t.toFixed(1)) + "T"
      }
      if (n >= 1e9) {
        var b = n / 1e9
        return (b >= 100 ? Math.round(b) : b.toFixed(1)) + "B"
      }
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
    function fmtMD(ts) {
      var d = new Date(ts)
      return (d.getMonth() + 1) + "/" + d.getDate()
    }
    function dayStart(ts) {
      var d = new Date(ts)
      d.setHours(0, 0, 0, 0)
      return d.getTime()
    }
    function modelName(key) {
      return key.slice(key.indexOf(":") + 1)
    }
    function cardTotals(b) {
      if (!b) return 0
      return b.inputTokens + b.outputTokens + b.cacheReadTokens + b.cacheWriteTokens
    }

    // Tooltip card (style follows temp/tooltip.png): date row, big total with
    // a small "总计" suffix, then one colored-swatch row per model with
    // right-aligned values and no separators. Positioned imperatively
    // (position:fixed) in a useEffect, flipping above/below the hovered bar.
    function TipCard(tip, tipRef, mGrid) {
      var col = null
      for (var i = 0; i < mGrid.cols.length; i++) {
        if (mGrid.cols[i].ts === tip.ts) { col = mGrid.cols[i]; break }
      }
      var kids = [
        React.createElement("span", { key: "ar", className: "tu-tip-arrow" }),
        React.createElement("div", { key: "d", className: "tu-tip-date" }, fmtDayCN(tip.ts)),
        React.createElement("div", { key: "t", className: "tu-tip-total" },
          fmtTokens(col ? col.total : 0),
          React.createElement("span", { className: "tu-tip-unit" }, "总计")
        )
      ]
      var rows = []
      if (col && col.segs.length > 0) {
        for (var s = 0; s < col.segs.length; s++) {
          var seg = col.segs[s]
          rows.push(React.createElement("div", { key: seg.key, className: "tu-tip-row" },
            React.createElement("span", { className: "tu-tip-row-label" },
              React.createElement("span", { className: "tu-tip-dot", style: { backgroundColor: seg.color } }),
              seg.name
            ),
            React.createElement("span", { className: "tu-tip-row-value" }, fmtTokens(seg.total))
          ))
        }
      } else {
        rows.push(React.createElement("div", { key: "e", className: "tu-tip-empty" }, "当日无模型调用"))
      }
      kids.push(React.createElement("div", { key: "r", className: "tu-tip-rows" }, rows))
      return React.createElement("div", { ref: tipRef, className: "tu-tip", role: "tooltip" }, kids)
    }

    // 30-day stacked chart grid: fixed day columns, one colored segment per
    // model. segs stay sorted by that day's usage DESCENDING (heaviest first)
    // for the tooltip rows; the column renderer reverses them so the heaviest
    // sits at the bottom. Colors are fixed by the 30-day usage rank
    // (`colorOrder`).
    function buildModelGrid(colorOrder, modelDaily30, now) {
      var todayStart = dayStart(now)
      var map = {}
      for (var i = 0; i < modelDaily30.length; i++) map[modelDaily30[i].ts] = modelDaily30[i].models
      var order = []
      var seen = {}
      for (var i = 0; i < colorOrder.length; i++) {
        if (!seen[colorOrder[i].key]) { seen[colorOrder[i].key] = true; order.push(colorOrder[i].key) }
      }
      for (var i = 0; i < modelDaily30.length; i++) {
        var ms = modelDaily30[i].models
        for (var k in ms) if (!seen[k]) { seen[k] = true; order.push(k) }
      }
      var colorOf = {}
      for (var i = 0; i < order.length; i++) colorOf[order[i]] = MODEL_COLORS[i % MODEL_COLORS.length]
      var cols = []
      var max = 0
      for (var d = 0; d < MODEL_WINDOW; d++) {
        var ts = todayStart - (MODEL_WINDOW - 1 - d) * MS
        var dayModels = map[ts] || null
        var segs = []
        var total = 0
        if (dayModels) {
          for (var oi = 0; oi < order.length; oi++) {
            var key = order[oi]
            var mm = dayModels[key]
            if (!mm) continue
            var t = mm.inputTokens + mm.outputTokens + mm.cacheReadTokens + mm.cacheWriteTokens
            if (t > 0) segs.push({ key: key, name: modelName(key), total: t, color: colorOf[key] })
          }
          segs.sort(function (a, b) { return b.total - a.total })
          for (var s = 0; s < segs.length; s++) total += segs[s].total
        }
        if (total > max) max = total
        cols.push({ ts: ts, total: total, segs: segs })
      }
      return { cols: cols, max: max }
    }

    // One metric card: label, big value, optional small sub-line.
    function Card(label, value, sub) {
      return React.createElement("div", { className: "tu-card" },
        React.createElement("div", { className: "tu-card-label" }, label),
        React.createElement("div", { className: "tu-card-value" }, value),
        sub ? React.createElement("div", { className: "tu-card-sub" }, sub) : null
      )
    }

    // One ranking card: rank number on its own line, then model + token total,
    // then provider + usage share (no color swatch, per user preference).
    function RankCard(m, i, rankSum) {
      var share = rankSum > 0 ? (m.total / rankSum) * 100 : 0
      var shareTxt = (share >= 10 ? share.toFixed(1) : share.toFixed(2)) + "%"
      return React.createElement("div", { key: m.key, className: "tu-rank" },
        React.createElement("div", { className: "tu-rank-num" }, String(i + 1).padStart(2, "0")),
        React.createElement("div", { className: "tu-rank-main" },
          React.createElement("span", { className: "tu-rank-name" }, m.model),
          React.createElement("span", { className: "tu-rank-total" }, fmtTokens(m.total))
        ),
        React.createElement("div", { className: "tu-rank-sub" },
          React.createElement("span", { className: "tu-rank-vendor" }, m.provider),
          React.createElement("span", { className: "tu-rank-share" }, shareTxt)
        )
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
      // pinned breakdown card: { ts, rect, pinned }
      var mTipState = React.useState(null)
      var mTip = mTipState[0]
      var setMTip = mTipState[1]
      var mTipRef = React.useRef(null)

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

      // chart interaction: hovering a bar shows the breakdown card, clicking
      // pins it (clicking again unpins); no highlight/scale effects on bars.
      var onBarEnter = function (c, e) {
        var t = e.currentTarget.getBoundingClientRect()
        setMTip({ ts: c.ts, rect: { left: t.left, top: t.top, width: t.width, height: t.height }, pinned: false })
      }
      var onBarLeave = function () {
        setMTip(function (cur) { return cur && cur.pinned ? cur : null })
      }
      var onBarClick = function (c, e) {
        var t = e.currentTarget.getBoundingClientRect()
        setMTip(function (cur) {
          if (cur && cur.ts === c.ts) return cur.pinned ? null : { ts: c.ts, rect: cur.rect, pinned: true }
          return { ts: c.ts, rect: { left: t.left, top: t.top, width: t.width, height: t.height }, pinned: true }
        })
      }

      // position the fixed tooltip card against the hovered element's rect:
      // flip above/below, clamp to the viewport, point the arrow at it
      function positionTip(tip, ref) {
        var el = ref.current
        if (!el) return
        var r = el.getBoundingClientRect()
        var c = tip.rect
        var gap = 8
        var vw = window.innerWidth
        var left = c.left + c.width / 2 - r.width / 2
        left = Math.max(8, Math.min(left, Math.max(8, vw - r.width - 8)))
        var above = c.top - gap - r.height >= 8
        var top = above ? c.top - gap - r.height : c.bottom + gap
        el.style.left = Math.round(left) + "px"
        el.style.top = Math.round(top) + "px"
        el.style.animation = "none"
        void el.offsetWidth
        el.style.animation = ""
        el.style.visibility = "visible"
        var arrow = el.querySelector(".tu-tip-arrow")
        if (arrow) {
          arrow.className = "tu-tip-arrow " + (above ? "tu-tip-arrow-down" : "tu-tip-arrow-up")
          arrow.style.left = Math.max(8, Math.min(c.left + c.width / 2 - left, r.width - 16)) + "px"
        }
      }

      React.useEffect(function () {
        if (mTip) positionTip(mTip, mTipRef)
      }, [mTip])

      // the tip is positioned against the viewport: hide it on scroll/resize
      React.useEffect(function () {
        if (!mTip) return
        var hide = function () { setMTip(null) }
        window.addEventListener("scroll", hide, true)
        window.addEventListener("resize", hide)
        return function () {
          window.removeEventListener("scroll", hide, true)
          window.removeEventListener("resize", hide)
        }
      }, [mTip])

      var totals = snap ? snap.totals : null
      var sessions = snap ? snap.sessions : null
      // ranking is fixed to the 30-day window (no base switcher)
      var rank = snap && snap.modelRank ? snap.modelRank.d30 : []
      // sum of all models in the 30-day window, for the per-card usage share
      var rankSum = 0
      for (var ri = 0; ri < rank.length; ri++) rankSum += rank[ri].total
      // chart color order is fixed by the 30-day rank so colors stay stable
      // across polls
      var mGrid = snap ? buildModelGrid(snap.modelRank.d30, snap.modelDaily30 || [], snap.now) : null

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
        React.createElement("div", { className: "tu-msec" },
          React.createElement("div", { className: "tu-head" },
            React.createElement("span", { className: "tu-title" }, "近 30 天模型使用情况")
          ),
          mGrid && (mGrid.max === 0
            ? React.createElement("div", { className: "tu-meta" }, NO_DATA_MSG)
            : React.createElement("div", { className: "tu-mchart" },
                React.createElement("div", { className: "tu-mbars" },
                  mGrid.cols.map(function (c, i) {
                    var kids = []
                    if (c.total > 0) {
                      // segs are sorted desc (heaviest first) for the tooltip;
                      // render them in REVERSE so the heaviest segment sits at
                      // the bottom of the column (flex-end aligns the group to
                      // the bottom but preserves document order)
                      for (var s = c.segs.length - 1; s >= 0; s--) {
                        var seg = c.segs[s]
                        var h = Math.max(2, Math.round(seg.total / mGrid.max * BAR_HEIGHT))
                        kids.push(React.createElement("div", { key: seg.key, className: "tu-mseg", style: { backgroundColor: seg.color, height: h + "px" } }))
                      }
                    }
                    return React.createElement("div", {
                      key: i,
                      className: "tu-mcol",
                      onMouseEnter: function (e) { onBarEnter(c, e) },
                      onMouseLeave: onBarLeave,
                      onClick: function (e) { onBarClick(c, e) }
                    }, kids)
                  })
                ),
                React.createElement("div", { className: "tu-mlabels" },
                  mGrid.cols.map(function (c, i) {
                    // baseline labels: Mondays only
                    var show = new Date(c.ts).getDay() === 1
                    return React.createElement("span", { key: i, className: "tu-mlabel" }, show ? fmtMD(c.ts) : "")
                  })
                )
              )
          )
        ),
        rank.length === 0
          ? React.createElement("div", { className: "tu-meta" }, NO_DATA_MSG)
          : React.createElement("div", { className: "tu-mrank" },
              rank.slice(0, 4).map(function (m, i) { return RankCard(m, i, rankSum) })
            ),
        mTip && mGrid && TipCard(mTip, mTipRef, mGrid)
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
