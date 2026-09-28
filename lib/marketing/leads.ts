/**
 * Marketing lead capture — the single write path from public forms into
 * `public.marketing_leads` (migration 082).
 *
 * Two rules this module encodes, both of which used to be missing:
 *
 *  1. **Persist first, notify second.** The DB row is the system of record;
 *     the internal email is a notification about it. A route that only emails
 *     loses the lead the moment SMTP hiccups or the mail lands in spam.
 *  2. **Never store more than we need.** Contact fields are what the team
 *     needs to call back; the client IP is stored only as a salted,
 *     date-rotated hash so we can throttle abuse without building a profile
 *     of who submitted a form (matters once we point US traffic here).
 *
 * Everything here is best-effort by design: a failure to write returns
 * `{ ok: false }` and the caller decides whether to still email — we must
 * never turn a captured enquiry into an error page because of infra.
 */

import { createHash, randomBytes } from "node:crypto"
import { createAdminClient } from "@/lib/supabase/admin"

export type MarketingAudience = "supplier" | "buyer" | "other"

export interface MarketingLeadAttribution {
  /** Path the form was submitted from, e.g. "/en#consultation". */
  pagePath?: string | null
  referrer?: string | null
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  utmContent?: string | null
  utmTerm?: string | null
  gclid?: string | null
  userAgent?: string | null
  /** Raw client IP — hashed here, never persisted as-is. */
  ip?: string | null
}

export interface MarketingLeadInput {
  audience: MarketingAudience
  source: string
  fullName?: string | null
  email?: string | null
  phone?: string | null
  company?: string | null
  industry?: string | null
  preferredTime?: string | null
  message?: string | null
  locale?: "vi" | "en" | null
  attribution?: MarketingLeadAttribution
  /** Validated payload as received — keeps future form fields from being lost. */
  rawPayload?: Record<string, unknown>
}

export interface MarketingLeadOutcome {
  /** A row now exists for this submission (inserted, or already open). */
  stored: boolean
  /** True when we reused an existing open row instead of creating one. */
  duplicate: boolean
  id: string | null
  reference: string | null
  /** Machine-readable reason when `stored` is false. */
  error?: "db_unconfigured" | "table_missing" | "insert_failed"
}

const TABLE_MISSING_CODES = new Set(["42P01", "PGRST205", "PGRST404"])

/** Short, human-quotable id for chat/email triage ("lead VX-9F3C2A71"). */
export function newLeadReference(): string {
  return `VX-${randomBytes(4).toString("hex").toUpperCase()}`
}

/**
 * Hash a client IP for abuse control.
 *
 * Salt + UTC date make the value useless for cross-day correlation while still
 * stable inside one day, which is exactly the window the throttle needs.
 */
let saltWarned = false

export function hashClientIp(ip: string | null | undefined, now: Date = new Date()): string | null {
  const trimmed = ip?.trim()
  if (!trimmed || trimmed === "unknown") return null

  // The fallback keeps the feature working in dev, but a known constant salt
  // makes the hash brute-forceable (the input space is just "some IPv4 + some
  // date"), so say once, loudly, that production should set the env var.
  const salt = process.env.MARKETING_LEAD_IP_SALT
  if (!salt && !saltWarned) {
    saltWarned = true
    console.warn(
      "[marketing_leads] MARKETING_LEAD_IP_SALT is not set — storing IP hashes " +
        "derived from a public constant. Set a private value in production.",
    )
  }
  const day = now.toISOString().slice(0, 10)
  return createHash("sha256")
    .update(`${salt ?? "vexim-marketing-lead"}|${trimmed.toLowerCase()}|${day}`)
    .digest("hex")
    .slice(0, 32)
}

/**
 * Best-effort client IP behind Vercel's proxy. `x-forwarded-for` is a list —
 * the first entry is the client; everything after it is added by hops we don't
 * control, so we never trust anything else here.
 */
export function clientIpFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  return headers.get("x-real-ip")?.trim() || null
}

function clean(value: string | null | undefined, max = 300): string | null {
  const v = value?.trim()
  if (!v) return null
  return v.length > max ? `${v.slice(0, max)}…` : v
}

/**
 * Insert one marketing lead.
 *
 * Dedupe strategy: an "open" row (status='new') for the same (email, source)
 * short-circuits the insert, because a second submission from the same person
 * within the same triage state carries no new information — and answering it
 * with a second auto-reply is worse than not answering it at all. The partial
 * unique index in 082 is the race-proof backstop for the same rule.
 */
export async function recordMarketingLead(input: MarketingLeadInput): Promise<MarketingLeadOutcome> {
  const email = clean(input.email, 160)?.toLowerCase() ?? null
  const attribution = input.attribution ?? {}

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    // Preview/deploy environments without SUPABASE_SERVICE_ROLE_KEY: the form
    // must still be able to email the team.
    return { stored: false, duplicate: false, id: null, reference: null, error: "db_unconfigured" }
  }

  const reference = newLeadReference()
  const payload = {
    audience: input.audience,
    source: input.source,
    status: "new",
    reference,
    full_name: clean(input.fullName, 120),
    email,
    phone: clean(input.phone, 20),
    company_name: clean(input.company, 160),
    industry: clean(input.industry, 80),
    preferred_time: clean(input.preferredTime, 40),
    message: clean(input.message, 2000),
    locale: input.locale ?? null,
    page_path: clean(attribution.pagePath, 200),
    referrer: clean(attribution.referrer, 300),
    utm_source: clean(attribution.utmSource, 120),
    utm_medium: clean(attribution.utmMedium, 120),
    utm_campaign: clean(attribution.utmCampaign, 200),
    utm_content: clean(attribution.utmContent, 200),
    utm_term: clean(attribution.utmTerm, 200),
    gclid: clean(attribution.gclid, 120),
    user_agent: clean(attribution.userAgent, 300),
    ip_hash: hashClientIp(attribution.ip),
    raw_payload: input.rawPayload ?? {},
  }

  const { data, error } = await admin.from("marketing_leads").insert(payload).select("id, reference").maybeSingle()

  if (!error && data?.id) {
    return {
      stored: true,
      duplicate: false,
      id: String(data.id),
      reference: (data.reference as string | null) ?? reference,
    }
  }

  if (error && error.code === "23505") {
    // An open row for this (email, source) already exists — the partial unique
    // index in 082 did its job. Hand back that row so the caller can still show
    // a reference, and so no second auto-reply is sent.
    let existingId: string | null = null
    let existingReference: string | null = null
    if (email) {
      const { data: found } = await admin
        .from("marketing_leads")
        .select("id, reference")
        .eq("email", email)
        .eq("source", input.source)
        .eq("status", "new")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (found) {
        existingId = String(found.id)
        existingReference = (found.reference as string | null) ?? null
      }
    }

    return { stored: true, duplicate: true, id: existingId, reference: existingReference }
  }

  if (error && TABLE_MISSING_CODES.has(error.code)) {
    console.error(
      "[marketing_leads] insert skipped — table public.marketing_leads does not exist yet. " +
        "Run scripts/082_marketing_leads.sql in Supabase (SQL editor or `supabase db push`).",
    )
    return { stored: false, duplicate: false, id: null, reference: null, error: "table_missing" }
  }

  console.error("[marketing_leads] insert failed:", error?.code, error?.message)
  return { stored: false, duplicate: false, id: null, reference: null, error: "insert_failed" }
}
