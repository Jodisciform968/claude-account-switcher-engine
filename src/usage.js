'use strict'

// Plan usage, read from Claude's own bookkeeping.
//
// Every profile carries `plan-usage-history.json`: `{version, samples}`, where
// each sample is `{t, org, u:{fh, sd}}` — a timestamp, an org UUID, and two
// integers from 0 to 100.
//
// The key names are suggestive but were not taken on trust. Across 25 days and
// 3283 samples of one profile, runs of non-zero `fh` cap at 4.83–5.14 hours and
// then drop to zero within a single 5-minute sampling interval — a fixed
// five-hour window that resets, not a rolling one. Runs of non-zero `sd` last
// 4.9–6.9 days. So `fh` is percent of the five-hour limit and `sd` percent of
// the weekly one.
//
// Read-only, and the file is Claude's to write. We never touch it.

const fs = require('node:fs')
const path = require('node:path')

const FIVE_HOURS = 5 * 60 * 60 * 1000
const ONE_WEEK = 7 * 24 * 60 * 60 * 1000

// The file is ~280 KB and is rewritten every five minutes, but the status poll
// runs every 2.5 seconds. Key the parse on mtime so it happens at Claude's rate.
const cache = new Map()

const pct = n => (typeof n === 'number' && n >= 0 ? Math.min(100, Math.round(n)) : 0)

/** The most recent sample in the file, whichever org it belongs to. */
function newest (file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
  const samples = Array.isArray(raw.samples) ? raw.samples : []
  let last = null
  for (const s of samples) {
    if (s && typeof s.t === 'number' && (!last || s.t > last.t)) last = s
  }
  return last ? { at: last.t, fh: pct(last.u?.fh), sd: pct(last.u?.sd) } : null
}

/**
 * A sample describes the moment it was taken, so it is only ever a statement
 * about the past. Once a whole window has passed since then, that window has
 * certainly reset and the figure is known to be zero; before that, all we can
 * honestly say is "this was the reading as of `at`".
 */
function asOfNow (v) {
  if (!v) return null
  const age = Date.now() - v.at
  return {
    at: v.at,
    age,
    fh: age >= FIVE_HOURS ? 0 : v.fh,
    sd: age >= ONE_WEEK ? 0 : v.sd
  }
}

/** Latest usage for a profile, or null if Claude has never recorded any. */
function read (dir) {
  const file = path.join(dir, 'plan-usage-history.json')
  let st
  try { st = fs.statSync(file) } catch { return null }

  const hit = cache.get(dir)
  if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return asOfNow(hit.value)

  let value = null
  try { value = newest(file) } catch {}
  cache.set(dir, { mtimeMs: st.mtimeMs, size: st.size, value })
  return asOfNow(value)
}

module.exports = { read, FIVE_HOURS, ONE_WEEK }
