import "server-only"

/**
 * Server-side Meta Conversions API (CAPI).
 *
 * Why this exists next to the browser pixel:
 *
 *   - Ad blockers, Safari/Firefox tracking protection and iOS ATT silently drop
 *     a meaningful slice of browser `fbq('track', ...)` calls. Meta's own
 *     guidance (and every post-2021 measurement study) puts the loss high
 *     enough that a pixel-only setup under-reports conversions.
 *   - Server-to-server events are not affected by any of that. Sending BOTH and
 *     letting Meta deduplicate on a shared `event_id` is the current standard
 *     setup — it recovers the blocked events without double-counting the ones
 *     that got through.
 *
 * The whole module is inert unless `META_CAPI_ACCESS_TOKEN` is set, so the app
 * behaves exactly as it did before until someone pastes a token into Vercel.
 *
 * PII rules (Meta's, not ours — they are enforced in `hashUserData`):
 *   - email / phone / name / city / country / external_id are SHA-256 hashed
 *     after normalisation, and sent as arrays;
 *   - `client_ip_address`, `client_user_agent`, `fbc` and `fbp` are sent in
 *     clear text (Meta needs them to match a browser session and explicitly
 *     asks that they NOT be hashed);
 *   - nothing is logged. The console lines below print counts and error codes
 *     only, never a payload.
 */

import { createHash, randomUUID } from "node:crypto"
import { metaPixelId } from "./config"

export type MetaActionSource = "website" | "app" | "email" | "phone_call" | "chat" | "physical_store" | "system_generated" | "other"

export interface MetaConversionUserData {
  email?: string | null
  phone?: string | null
  /** Full name as typed; split into family/given name below. */
  fullName?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  /** ISO-3166 alpha-2, e.g. "VN" or "US". */
  country?: string | null
  /** Our own user/lead id — hashed before it leaves the process. */
  externalId?: string | null
  clientIp?: string | null
  userAgent?: string | null
  /** `_fbc` cookie value, or nothing. See `metaClickIdsFromRequest`. */
  fbc?: string | null
  /** `_fbp` cookie value, or nothing. */
  fbp?: string | null
  /** Raw `fbclid` URL param — only used to synthesise `fbc` when the cookie is gone. */
  fbclid?: string | null
}

export interface MetaConversionInput {
  /** Standard or custom event name, e.g. "Lead". */
  eventName: string
  /**
   * Dedup key shared with the browser event. Pass the same string to
   * `trackMetaEvent(..., { eventID })`; Meta then counts the pair once.
   * Generated here when omitted (and returned so the caller can forward it).
   */
  eventId?: string
  userData?: MetaConversionUserData
  customData?: Record<string, string | number | boolean | readonly string[] | null | undefined>
  /** Defaults to now. Meta accepts events up to 7 days old. */
  eventTime?: Date
  /** Full URL the conversion happened on. */
  eventSourceUrl?: string | null
  actionSource?: MetaActionSource
}

export interface MetaConversionResult {
  /** True only when Meta answered 2xx and reported `events_received >= 1`. */
  ok: boolean
  /** Set when we did not even try (not configured, no usable identifiers). */
  skipped?: "not-configured" | "no-user-data" | "error"
  /** The event id that was sent — forward this to the browser for dedupe. */
  eventId: string
  eventsReceived?: number
  status?: number
  error?: string
}

/** Graph API version. Meta guarantees each release for ~2 years. */
const API_VERSION = (process.env.META_CAPI_API_VERSION ?? "v26.0").trim() || "v26.0"

/** How long we wait for Meta before giving up. Conversion reporting is never worth a slow form. */
const REQUEST_TIMEOUT_MS = 5000

export function isMetaCapiEnabled(): boolean {
  return Boolean(metaPixelId() && (process.env.META_CAPI_ACCESS_TOKEN ?? "").trim())
}

/**
 * Send one conversion to Meta.
 *
 * Never throws: a dead Graph API, a revoked token or a 400 must not turn a
 * captured lead into an error page. Callers get `{ ok: false, ... }` and carry
 * on — the same "best-effort by design" rule `lib/marketing/leads.ts` follows.
 */
export async function sendMetaConversionEvent(input: MetaConversionInput): Promise<MetaConversionResult> {
  const eventId = input.eventId?.trim() || randomUUID()
  const notSent = (skipped: MetaConversionResult["skipped"], error?: string): MetaConversionResult => ({
    ok: false,
    skipped,
    eventId,
    ...(error ? { error } : {}),
  })

  const pixelId = metaPixelId()
  const accessToken = (process.env.META_CAPI_ACCESS_TOKEN ?? "").trim()
  if (!pixelId || !accessToken) return notSent("not-configured")

  const userData = buildUserData(input.userData)
  // Meta requires at least one matchable identifier; an event with an empty
  // user_data is rejected outright, so don't spend the round trip.
  if (Object.keys(userData).length === 0) return notSent("no-user-data")

  const eventTime = input.eventTime ?? new Date()
  const body: Record<string, unknown> = {
    data: [
      {
        event_name: input.eventName,
        event_time: Math.floor(eventTime.getTime() / 1000),
        event_id: eventId,
        action_source: input.actionSource ?? "website",
        ...(input.eventSourceUrl ? { event_source_url: input.eventSourceUrl } : {}),
        user_data: userData,
        ...(input.customData ? { custom_data: cleanCustomData(input.customData) } : {}),
      },
    ],
    access_token: accessToken,
  }

  // Only while validating in Events Manager -> Test Events. Leaving a test code
  // on in production makes Meta treat the events as test data and drop them
  // from reporting.
  const testEventCode = (process.env.META_CAPI_TEST_EVENT_CODE ?? "").trim()
  if (testEventCode) body.test_event_code = testEventCode

  try {
    const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${pixelId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      // A conversion report is worth one retry-free attempt; the browser pixel
      // is the backstop, so never block the request pipeline on this.
      cache: "no-store",
    })

    const status = response.status
    const text = await response.text()

    if (!response.ok) {
      // Log the Graph error code/message (they are safe: no user data), which
      // is what tells you a token lost `ads_management` or a version expired.
      console.error("[meta-capi] rejected", { status, detail: text.slice(0, 400) })
      return { ...notSent("error", `HTTP ${status}`), status }
    }

    let eventsReceived: number | undefined
    try {
      const json = JSON.parse(text) as { events_received?: number; message?: string }
      eventsReceived = typeof json.events_received === "number" ? json.events_received : undefined
    } catch {
      // A 2xx with an unparseable body still counts as delivered.
    }

    if (eventsReceived === 0) {
      console.warn("[meta-capi] delivered but Meta counted 0 events", { detail: text.slice(0, 400) })
      return { ok: false, skipped: "error", eventId, status, eventsReceived, error: text.slice(0, 200) }
    }

    return { ok: true, eventId, status, eventsReceived }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // Timeout vs DNS vs TLS all look the same to the caller; the message is
    // enough to tell them apart in the Vercel logs.
    console.error("[meta-capi] request failed:", message)
    return notSent("error", message)
  }
}

/**
 * Pull `_fbc` / `_fbp` (and a `fbclid` fallback) out of a request.
 *
 * `_fbc` is the click id — the single strongest link between an ad click and
 * this conversion — and `_fbp` is the browser id the pixel set on first visit.
 * Both are ordinary JS cookies on our own origin, so a same-origin `fetch()`
 * from the form sends them along in the Cookie header and we read them here
 * rather than making the client copy them into the JSON body.
 *
 * `fbclid` only survives in the URL for a moment (Meta appends it to the click
 * through), and `_fbc` is written by the pixel on load — but if the pixel was
 * blocked, the URL param is still enough to reconstruct a valid `fbc`:
 * `fb.1.<timestamp>.<fbclid>`. That is Meta's documented fallback.
 */
export function metaClickIdsFromRequest(
  cookieHeader: string | null | undefined,
  options?: { fbclid?: string | null; url?: string | null; now?: number },
): { fbc?: string; fbp?: string } {
  const cookies = parseCookies(cookieHeader)
  const now = options?.now ?? Date.now()

  const fbc = cookies["_fbc"] || fbcFromFbclid(options?.fbclid ?? fbclidFromUrl(options?.url), now)
  const fbp = cookies["_fbp"]

  return {
    ...(fbc ? { fbc } : {}),
    ...(fbp ? { fbp } : {}),
  }
}

/** `fb.1.<creation-time>.<fbclid>` — Meta's own format for a derived click id. */
export function fbcFromFbclid(fbclid: string | null | undefined, now = Date.now()): string | undefined {
  const clean = (fbclid ?? "").trim()
  if (!clean) return undefined
  return `fb.1.${now}.${clean}`
}

function fbclidFromUrl(url?: string | null): string | undefined {
  if (!url) return undefined
  try {
    const parsed = new URL(url, "http://local")
    return parsed.searchParams.get("fbclid") ?? undefined
  } catch {
    return undefined
  }
}

function parseCookies(header?: string | null): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(";")) {
    const index = part.indexOf("=")
    if (index <= 0) continue
    const name = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()
    if (!name) continue
    try {
      out[name] = decodeURIComponent(value)
    } catch {
      out[name] = value
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// user_data construction + hashing
// ---------------------------------------------------------------------------

function buildUserData(user?: MetaConversionUserData): Record<string, unknown> {
  if (!user) return {}

  const out: Record<string, unknown> = {}
  const pushHashed = (field: string, value: string | null | undefined) => {
    const normalised = value ? normaliseForHash(field, value) : null
    if (normalised) out[field] = [sha256(normalised)]
  }

  pushHashed("em", user.email)
  pushHashed("ph", user.phone ? normalisePhone(user.phone) : null)

  // Vietnamese order is family-middle-given ("Nguyễn Văn A"). Meta's `fn` is the
  // given name and `ln` the family name, so the tokens are mapped accordingly —
  // sending fn="Nguyễn" would simply never match anything in their index.
  const { given, family } = splitVietnameseName(user.fullName)
  pushHashed("fn", given)
  pushHashed("ln", family)

  pushHashed("ct", user.city)
  pushHashed("st", user.state)
  pushHashed("zp", user.zip)
  pushHashed("country", user.country)
  pushHashed("external_id", user.externalId)

  // Sent in clear text on purpose — Meta matches on these directly.
  if (user.clientIp) out.client_ip_address = user.clientIp
  if (user.userAgent) out.client_user_agent = user.userAgent
  if (user.fbc) out.fbc = user.fbc
  if (user.fbp) out.fbp = user.fbp

  return out
}

function normaliseForHash(field: string, value: string): string | null {
  const raw = value.trim()
  if (!raw) return null

  switch (field) {
    case "em":
      // Meta: lowercase, trim. Nothing else — "Test@Example.COM" and
      // "test@example.com" must hash identically or the match is lost.
      return raw.toLowerCase()

    case "ph":
      // Already normalised by the caller (digits + country code); this only
      // strips stray separators.
      return raw.replace(/\D/g, "") || null

    case "country":
      return raw.toLowerCase().slice(0, 2)

    case "zp":
      // A postal code is digits (or digits + a separator). Running it through
      // the name rule below would delete the entire value.
      return raw.replace(/\s+/g, "").toLowerCase()

    case "external_id":
      // Our own identifier, hashed exactly as issued. Lowercasing or stripping
      // punctuation here would make "VX-9F3C2A71" unrecognisable to anything
      // that later tries to reconcile it with marketing_leads.reference.
      return raw

    default: {
      // Name-ish fields (fn, ln, ct, st). Meta: lowercase, remove digits and
      // punctuation, collapse whitespace. Diacritics stay — "Nguyễn" and
      // "Nguyen" are different strings in their index, and stripping accents
      // would be a guess we cannot undo.
      const cleaned = raw
        .toLowerCase()
        .replace(/[^\p{L}\p{M}\s]/gu, "")
        .replace(/\s+/g, " ")
        .trim()
      return cleaned || null
    }
  }
}

/**
 * Digits + country code, no "+", no spaces (Meta's E.164-without-punctuation).
 *
 * A leading-zero Vietnamese mobile ("0373 685 634") becomes "84373685634";
 * anything we can't place gets dropped rather than sent malformed, because a
 * wrong phone number doesn't just fail to match — it can match a stranger.
 */
export function normalisePhone(raw: string): string | null {
  let digits = raw.replace(/[^\d+]/g, "")
  if (digits.startsWith("+")) digits = digits.slice(1)
  if (digits.startsWith("00")) digits = digits.slice(2)
  if (!digits) return null

  if (digits.startsWith("0")) {
    // Local VN format: 0 + 9 digits (mobile) or 0 + 8-9 (landline with area code).
    if (digits.length < 9 || digits.length > 11) return null
    digits = `84${digits.slice(1)}`
  }

  if (digits.length < 8 || digits.length > 15) return null
  return digits
}

/** "Nguyễn Văn A" -> { given: "A", family: "Nguyễn" }. One token -> given only. */
export function splitVietnameseName(fullName?: string | null): { given?: string; family?: string } {
  const cleaned = (fullName ?? "").trim().replace(/\s+/g, " ")
  if (!cleaned) return {}

  const tokens = cleaned.split(" ")
  if (tokens.length === 1) return { given: tokens[0] }
  return { given: tokens[tokens.length - 1], family: tokens[0] }
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

function cleanCustomData(
  customData: Record<string, string | number | boolean | readonly string[] | null | undefined>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(customData)) {
    if (value === undefined || value === null) continue
    if (typeof value === "string" && value.trim() === "") continue
    out[key] = Array.isArray(value) ? value.slice(0, 10) : value
  }
  return out
}
