'use strict'

/**
 * dsh-token-monitor — Host half (v2: simplified)
 *
 * Jobs:
 *  1. Listen to the `llm/stream` waterfall and fold every real model call's
 *     provider-reported TokenUsage into in-memory daily buckets.
 *  2. Backfill historical usage from the session corpus via `sessionQuery`
 *     (`assistant/message` usage events), so the dashboard shows today / 7 /
 *     30 days even for usage that predates this plugin's install.
 *  3. Track conversation counts per workspace (top-level sessions only,
 *     `delegationDepth === 0`, grouped by header `cwd`).
 *  4. Persist buckets to $DSH_HOME/plugins/token-monitor/data.json so history
 *     survives restarts (daily buckets kept 91 days).
 *  5. Serve /token-monitor/snapshot through the `webServer` service for the
 *     browser half (static-bundle pattern: plain fetch, no harness.handle).
 */

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const DAILY_KEEP_MS = 91 * 86400 * 1000

function dataFile() {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  return path.join(home, 'plugins', 'token-monitor', 'data.json')
}

/** Pre-rename storage path (plugin id was `token-usage`); migrated once on first load. */
function legacyDataFile() {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  return path.join(home, 'plugins', 'token-usage', 'data.json')
}

function dayKey(ts) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function emptyBucket(ts) {
  return {
    ts,
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
  }
}

module.exports = {
  name: 'token-monitor',
  inject: ['timer', 'webServer'],

  apply(ctx) {
    const daily = new Map()
    let trackingSince = Date.now()
    let backfilledUntil = 0
    let dirty = false
    let saveTimer = null

    // ── load persisted buckets (one-time migration from the legacy path) ──
    const file = dataFile()
    if (!fs.existsSync(file)) {
      const legacy = legacyDataFile()
      try {
        if (fs.existsSync(legacy)) {
          fs.mkdirSync(path.dirname(file), { recursive: true })
          fs.renameSync(legacy, file)
        }
      } catch {
        /* best-effort: a fresh start is fine */
      }
    }
    try {
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (saved && typeof saved === 'object') {
        for (const b of saved.daily || []) if (b && b.ts) daily.set(b.ts, b)
        if (saved.trackingSince) trackingSince = saved.trackingSince
        if (saved.backfilledUntil) backfilledUntil = saved.backfilledUntil
      }
    } catch {
      /* first run — start fresh */
    }

    function prune() {
      const now = Date.now()
      for (const k of daily.keys()) if (k < now - DAILY_KEEP_MS) daily.delete(k)
    }

    function recordUsage(usage, ts) {
      const at = ts || Date.now()
      const dk = dayKey(at)
      let d = daily.get(dk)
      if (!d) {
        d = emptyBucket(dk)
        daily.set(dk, d)
      }
      d.requests += 1
      d.inputTokens += usage.inputTokens || 0
      d.outputTokens += usage.outputTokens || 0
      d.cacheReadTokens += usage.cacheReadTokens || 0
      d.cacheWriteTokens += usage.cacheWriteTokens || 0
      d.reasoningTokens += usage.reasoningTokens || 0
      prune()
      scheduleSave()
    }

    // ── live capture: every real model call ────────────────────────────────
    // Waterfall event: MUST call next() and forward the stream untouched,
    // otherwise the model call breaks.
    ctx.on('llm/stream', (_options, next) => {
      const inner = next()
      return (async function* () {
        for await (const chunk of inner) {
          if (chunk && chunk.type === 'usage' && chunk.usage) {
            try {
              recordUsage(chunk.usage)
            } catch {
              // accounting must never break the stream
            }
          }
          yield chunk
        }
      })()
    })

    // ── backfill from the session corpus ───────────────────────────────────
    async function backfill() {
      const query = ctx.get('sessionQuery')
      if (!query) return
      const windowStart = Date.now() - DAILY_KEEP_MS
      try {
        const sessions = await query.listSessions()
        for (const rec of sessions) {
          const header = rec && rec.header
          if (!header || !header.id || !header.createdAt) continue
          // skip sessions that cannot hold in-window events (header + 7d slack)
          if (header.createdAt < windowStart - 7 * 86400 * 1000) continue
          let log
          try {
            log = await query.readSession(header.id)
          } catch {
            continue
          }
          if (!log || !Array.isArray(log.events)) continue
          for (const ev of log.events) {
            if (!ev || ev.time <= backfilledUntil) continue
            if (ev.type === 'assistant/message' && ev.data && ev.data.usage) {
              try {
                recordUsage(ev.data.usage, ev.time)
              } catch {
                // keep going
              }
            }
          }
        }
        backfilledUntil = Date.now()
        dirty = true
      } catch {
        // backfill is best-effort; live capture keeps working
      }
    }

    // ── persistence (debounced; flush on dispose and every 60 s) ───────────
    function persist() {
      if (!dirty) return
      dirty = false
      try {
        const now = Date.now()
        const file = dataFile()
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(
          file,
          JSON.stringify({
            trackingSince,
            backfilledUntil,
            daily: [...daily.values()].filter((b) => b.ts >= now - DAILY_KEEP_MS),
          }),
        )
      } catch (e) {
        if (ctx.logger) ctx.logger.warn('token-monitor persist failed: ' + String((e && e.message) || e))
      }
    }

    function scheduleSave() {
      dirty = true
      if (saveTimer) return
      saveTimer = ctx.timeout(() => {
        saveTimer = null
        persist()
      }, 5000)
    }

    const flushTimer = ctx.interval(() => persist(), 60000)
    ctx.effect(() => () => {
      if (saveTimer) {
        try {
          saveTimer.dispose()
        } catch {
          /* ignore */
        }
        saveTimer = null
      }
      flushTimer.dispose()
      persist()
    })

    // ── conversation stats (top-level sessions only) ──────────────────────
    // Cached 20 s: the session corpus only changes when sessions are created
    // or persisted, so re-listing on every snapshot poll is wasteful.
    let sessionsCache = null
    let sessionsCacheAt = 0

    async function buildSessionStats() {
      const now = Date.now()
      if (sessionsCache && now - sessionsCacheAt < 20000) return sessionsCache
      const query = ctx.get('sessionQuery')
      const result = { today: 0, d7: 0, d30: 0 }
      if (!query) {
        sessionsCache = result
        sessionsCacheAt = now
        return result
      }
      const todayStart = dayKey(now)
      try {
        const sessions = await query.listSessions()
        for (const rec of sessions) {
          const header = rec && rec.header
          if (!header || !header.id || header.delegationDepth !== 0) continue
          const createdAt = header.createdAt
          if (!createdAt) continue
          if (createdAt >= todayStart) result.today += 1
          if (createdAt >= todayStart - 6 * 86400 * 1000) result.d7 += 1
          if (createdAt >= todayStart - 29 * 86400 * 1000) result.d30 += 1
        }
      } catch {
        /* best-effort */
      }
      sessionsCache = result
      sessionsCacheAt = now
      return result
    }

    // ── snapshot assembly ──────────────────────────────────────────────────
    function sumBuckets(buckets) {
      const t = emptyBucket(0)
      for (const b of buckets) {
        t.requests += b.requests
        t.inputTokens += b.inputTokens
        t.outputTokens += b.outputTokens
        t.cacheReadTokens += b.cacheReadTokens
        t.cacheWriteTokens += b.cacheWriteTokens
        t.reasoningTokens += b.reasoningTokens
      }
      return t
    }

    async function buildSnapshot() {
      const now = Date.now()
      const todayStart = dayKey(now)
      const buckets = [...daily.values()]
      const today = sumBuckets(buckets.filter((b) => b.ts === todayStart))
      const d7 = sumBuckets(buckets.filter((b) => b.ts >= todayStart - 6 * 86400 * 1000))
      const d30 = sumBuckets(buckets.filter((b) => b.ts >= todayStart - 29 * 86400 * 1000))
      const dailyList = buckets
        .filter((b) => b.ts >= todayStart - 89 * 86400 * 1000)
        .sort((a, b) => a.ts - b.ts)
      return {
        ok: true,
        now,
        trackingSince,
        backfilledUntil,
        totals: { today, d7, d30 },
        daily: dailyList,
        sessions: await buildSessionStats(),
      }
    }

    // ── HTTP route for the Client half ─────────────────────────────────────
    // ?backfill=1 triggers a session-corpus backfill before serving.
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact',
      path: '/token-monitor/snapshot',
      handler: async (req, res) => {
        try {
          const url = new URL(req.url || '/', 'http://dsh.local')
          if (url.searchParams.get('backfill') === '1') await backfill()
          const body = JSON.stringify(await buildSnapshot())
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(body)
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: String((e && e.message) || e) }))
        }
      },
    }))

    // ── startup: backfill once in the background ───────────────────────────
    ctx.timeout(() => {
      backfill().catch(() => {})
    }, 3000)
  },
}
