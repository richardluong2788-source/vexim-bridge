/**
 * Minimal in-process sliding-window rate limiter — zero dependencies.
 *
 * WHY THIS EXISTS
 * ---------------
 * Public form endpoints (`/api/consultation`, and every marketing form added
 * in the US-buyer phase) are the only write paths reachable by anonymous
 * traffic. Before this, the sole defence was a honeypot field: any script that
 * ignores the form could POST unlimited submissions and (a) burn SMTP quota /
 * reputation on the Zoho mailbox and (b) bury the team in duplicate emails.
 *
 * WHAT THIS IS *NOT*
 * ------------------
 * The app runs on serverless, so this map is **per instance**: two warm lambdas
 * = two counters, and a cold start resets them. Treat it as a cheap first gate
 * that makes brute-forcing expensive, not as a quota guarantee. The durable
 * backstops are (1) zod validation, (2) the honeypot, and (3) the partial
 * unique index `marketing_leads_open_dedupe_idx` (migration 082) which keeps
 * the queue at one open row per (email, source) no matter how many instances
 * exist.
 *
 * If a burst ever needs a real distributed limit, swap the store for
 * `@upstash/ratelimit` — the call sites only use `checkRateLimit()`, so the
 * swap is confined to this file.
 */

export interface RateRule {
  /** Maximum number of hits allowed inside `windowMs`. */
  limit: number
  /** Sliding window size in milliseconds. */
  windowMs: number
}

export interface RateVerdict {
  allowed: boolean
  /** 0 when allowed; otherwise how long the caller should wait (seconds). */
  retryAfterSeconds: number
  /** Hits left in the current window (0 once blocked). */
  remaining: number
}

interface Bucket {
  /** Hit timestamps (ms) inside the window, oldest first. */
  hits: number[]
}

const buckets = new Map<string, Bucket>()

/** Guard against unbounded growth when someone sprays unique keys. */
const MAX_KEYS = 20_000
const SWEEP_INTERVAL_MS = 60_000

let lastSweepAt = 0

function sweep(now: number, keepWindowMs: number): void {
  // Drop empty/expired buckets. O(keys) but runs at most once a minute.
  for (const [key, bucket] of buckets) {
    const fresh = bucket.hits.filter((t) => now - t < keepWindowMs)
    if (fresh.length === 0) buckets.delete(key)
    else bucket.hits = fresh
  }
  lastSweepAt = now
}

/**
 * Record a hit for `key` and report whether it is inside `rule`.
 *
 * A blocked hit is still recorded — repeated abuse therefore keeps the bucket
 * full and extends the lockout instead of sliding it back to zero.
 */
export function checkRateLimit(
  key: string,
  rule: RateRule,
  now: number = Date.now(),
): RateVerdict {
  const { limit, windowMs } = rule

  if (buckets.size >= MAX_KEYS || now - lastSweepAt > SWEEP_INTERVAL_MS) {
    sweep(now, windowMs)
  }

  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { hits: [] }
    buckets.set(key, bucket)
  }

  const withinWindow = bucket.hits.filter((t) => now - t < windowMs)
  withinWindow.push(now)
  bucket.hits = withinWindow

  if (withinWindow.length > limit) {
    const oldest = withinWindow[withinWindow.length - limit - 1] ?? now
    const waitMs = Math.max(0, oldest + windowMs - now)
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(waitMs / 1000)),
      remaining: 0,
    }
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: Math.max(0, limit - withinWindow.length),
  }
}

/**
 * Peek without consuming — used when we want to reject only after cheaper
 * checks (validation / honeypot) have already run.
 */
export function peekRateLimit(key: string, rule: RateRule, now: number = Date.now()): RateVerdict {
  const bucket = buckets.get(key)
  const hits = (bucket?.hits ?? []).filter((t) => now - t < rule.windowMs)
  if (hits.length >= rule.limit) {
    const oldest = hits[hits.length - rule.limit] ?? now
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(Math.max(0, oldest + rule.windowMs - now) / 1000)),
      remaining: 0,
    }
  }
  return { allowed: true, retryAfterSeconds: 0, remaining: Math.max(0, rule.limit - hits.length) }
}

/** Test helper — forget recorded hits (all, or only keys starting with `prefix`). */
export function resetRateLimits(prefix?: string): void {
  if (!prefix) {
    buckets.clear()
    lastSweepAt = 0
    return
  }
  for (const key of buckets.keys()) {
    if (key.startsWith(prefix)) buckets.delete(key)
  }
}
