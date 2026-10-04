/**
 * Meta (Facebook) Pixel + Conversions API configuration.
 *
 * One module answers three questions, and every call site asks it instead of
 * reading `process.env` on its own:
 *
 *   1. Which pixel/dataset are we talking to?          -> `metaPixelId()`
 *   2. Should we be tracking at all right now?          -> `isMetaPixelEnabled()`
 *   3. Is this URL one we want in the ad data?          -> `isMetaTrackedPath()`
 *
 * Keeping it central is what makes the pixel switchable: turning it off (or
 * pointing it at a second dataset for an A/B test) is an env change plus a
 * redeploy, not a grep-and-delete across the app.
 *
 * ---------------------------------------------------------------------------
 * Environment variables (Vercel -> Project -> Settings -> Environment Variables)
 * ---------------------------------------------------------------------------
 * Client-visible (NEXT_PUBLIC_* is inlined into the browser bundle AT BUILD
 * TIME, so changing one requires a redeploy, not just a restart):
 *
 *   NEXT_PUBLIC_META_PIXEL_ID        Dataset/Pixel ID, e.g. "1234567890123456".
 *                                    Empty/unset = the whole integration is off.
 *   NEXT_PUBLIC_META_PIXEL_ENABLED   "true"/"false" to override the default
 *                                    (default: fire in production only, so
 *                                    preview deploys and `next dev` don't feed
 *                                    your own QA clicks into the ad account).
 *   NEXT_PUBLIC_META_LEAD_VALUE      Optional numeric value attached to every
 *                                    Lead event, e.g. 25 (USD). Only set this
 *                                    once you want value-based optimisation —
 *                                    a made-up number trains Meta's bidding on
 *                                    a made-up signal.
 *   NEXT_PUBLIC_META_LEAD_CURRENCY   ISO currency for the above (default "USD").
 *
 * Server-only (never reach the browser):
 *
 *   META_CAPI_ACCESS_TOKEN           System-user token with `ads_management`
 *                                    (or the dataset's "Generate access token"
 *                                    button in Events Manager). Unset = the
 *                                    browser pixel alone, no server events.
 *   META_CAPI_TEST_EVENT_CODE        e.g. "TEST12345" — shows events under
 *                                    Events Manager -> Test Events. Set it only
 *                                    while validating, then remove it.
 *   META_CAPI_API_VERSION            Graph API version (default "v26.0"). Meta
 *                                    supports each version for ~2 years; bump
 *                                    this when they retire one.
 */

import { isNoIndexPath, isPublicPath, splitLocalePrefix } from "@/lib/i18n/routing"

/**
 * Dataset/Pixel ID as configured, or "" when the integration is not wired up.
 *
 * The id is interpolated into an inline <script>, so it is validated as digits
 * only: a typo (or a pasted URL instead of an id) disables the pixel instead of
 * injecting arbitrary text into the document. Meta dataset ids are 15-16 digits.
 */
export function metaPixelId(): string {
  const raw = (process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "").trim()
  return /^\d{1,20}$/.test(raw) ? raw : ""
}

/**
 * Whether the browser pixel should be injected.
 *
 * The default is production-only, mirroring how `<Analytics />` from Vercel is
 * gated in app/layout.tsx: dev and preview traffic is ours, and Meta would
 * otherwise build lookalike/retargeting audiences out of the team's own clicks.
 * `NEXT_PUBLIC_META_PIXEL_ENABLED=true` overrides that so a staging deploy can
 * be validated with Meta Pixel Helper before the real one goes out.
 */
export function isMetaPixelEnabled(): boolean {
  if (!metaPixelId()) return false

  const flag = (process.env.NEXT_PUBLIC_META_PIXEL_ENABLED ?? "").trim().toLowerCase()
  if (flag === "false" || flag === "0" || flag === "off") return false
  if (flag === "true" || flag === "1" || flag === "on") return true

  return process.env.NODE_ENV === "production"
}

/**
 * Optional value/currency pair attached to every Lead event (browser and CAPI
 * use the same numbers, so the two copies of the event agree).
 *
 * Empty unless `NEXT_PUBLIC_META_LEAD_VALUE` is set: Meta only accepts a
 * currency *together with* a value, so sending "USD" alone would be noise in the
 * event breakdown. Both fields are left out until value-based optimisation is
 * actually wanted — see the note in docs/META_PIXEL_SETUP.md about not inventing
 * a number just to have one.
 */
export function metaLeadValue(): { value?: number; currency?: string } {
  const raw = Number.parseFloat((process.env.NEXT_PUBLIC_META_LEAD_VALUE ?? "").trim())
  if (!Number.isFinite(raw) || raw <= 0) return {}

  const currency = (process.env.NEXT_PUBLIC_META_LEAD_CURRENCY ?? "USD").trim().toUpperCase() || "USD"
  return { value: raw, currency }
}

/**
 * Is this pathname one we want Meta to see?
 *
 * Tracked: the marketing surfaces an ad can actually land on — `/`, `/products`,
 * `/products/[id]`, `/profile/[slug]`, `/legal`, and their `/vi` twins.
 *
 * Not tracked:
 *   - the signed-in app (`/admin`, `/client`, `/settings`, `/notifications`,
 *     `/auth`, `/api`) — staff and existing customers browsing their dashboard
 *     would inflate PageView, pollute the retargeting pool and quietly make
 *     every "unique visitors" number in Ads Manager a lie;
 *   - token-addressed pages (`/share/[token]`, `/shortlist/[token]`,
 *     `/invoice/[token]`, `/unsubscribe/[token]`) — these are emailed to one
 *     named recipient, are `noindex`, and `/unsubscribe` is hit by Gmail's
 *     one-click RFC 8058 POST as well as by humans;
 *   - `/client-intake/[token]` — supplier onboarding, again email-token only.
 *
 * The noindex list is reused deliberately: the pages we don't want Google to
 * crawl are exactly the pages we don't want to advertise against, and deriving
 * one from the other keeps the two from drifting apart.
 */
export function isMetaTrackedPath(pathname: string): boolean {
  // `/vi/products` -> `/products`; the pixel doesn't care about the locale
  // prefix, but the public/private decision is made on the unprefixed path.
  const { pathname: bare } = splitLocalePrefix(pathname)

  if (!isPublicPath(bare)) return false
  if (isNoIndexPath(bare)) return false

  const [head = ""] = bare.replace(/^\//, "").split("/")
  return head !== "client-intake"
}
