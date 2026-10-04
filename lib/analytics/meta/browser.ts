/**
 * Browser-side Meta Pixel helper.
 *
 * The pixel's own snippet (injected by `components/analytics/meta-pixel.tsx`)
 * defines `window.fbq` as a *queueing function*: calls made before
 * `fbevents.js` finishes downloading are pushed onto `fbq.queue` and replayed,
 * so nothing here has to wait for a load callback.
 *
 * Every function in this module is a no-op when:
 *   - it runs on the server (no `window`), or
 *   - the pixel is not configured / disabled for this environment, or
 *   - `window.fbq` is missing (ad blocker, or an untracked route where we never
 *     injected the snippet).
 *
 * That last point is the important one: calling `trackMetaEvent()` from any
 * component is always safe, so a conversion call site never needs its own
 * "is the pixel on?" branch.
 */

import { isMetaPixelEnabled } from "./config"

/** Meta's standard events. Anything else is allowed as a custom event name. */
export type MetaStandardEvent =
  | "PageView"
  | "ViewContent"
  | "Search"
  | "Lead"
  | "Contact"
  | "CompleteRegistration"
  | "AddToCart"
  | "AddToWishlist"
  | "InitiateCheckout"
  | "AddPaymentInfo"
  | "Purchase"
  | "Schedule"
  | "StartTrial"
  | "SubmitApplication"

/** Parameters Meta accepts on `fbq('track', ...)`. Arrays are for content_ids. */
export type MetaEventParams = Record<
  string,
  string | number | boolean | readonly string[] | null | undefined
>

export interface MetaTrackOptions {
  /**
   * Shared deduplication id. When the browser event and the server-side
   * Conversions API event carry the same `eventID`, Meta counts them as one
   * conversion instead of two. The server generates it (it has to send it
   * first) and hands it back in the API response — see
   * `lib/analytics/meta/server.ts` and `app/api/consultation/route.ts`.
   */
  eventID?: string
}

/** Minimal shape of the queueing function the pixel snippet installs. */
type FbqFn = ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean }

declare global {
  interface Window {
    fbq?: FbqFn
    _fbq?: FbqFn
  }
}

/**
 * Keys of events already sent during this page session, used by
 * `trackMetaEventOnce()`. Module-scoped (not per-component) because the same
 * event can be requested by a page and by a dialog inside it.
 */
const fired = new Set<string>()

/**
 * Fire an event on the pixel.
 *
 * Values that are `undefined`/`null`/`""` are dropped first: Meta rejects an
 * event whose parameter object contains a null-ish field, and an optional
 * param (a product with no published price, say) must not force every caller
 * to build its own filtered literal.
 */
export function trackMetaEvent(
  eventName: MetaStandardEvent | (string & {}),
  params?: MetaEventParams,
  options?: MetaTrackOptions,
): void {
  if (!isMetaPixelEnabled()) return
  if (typeof window === "undefined") return

  // No `window.fbq` means the base snippet never ran (an ad blocker stripped it,
  // or this is an untracked route where we deliberately never injected it).
  // Dropping the call is correct here — and do NOT "fix" it by creating Meta's
  // queue stub ourselves: the official snippet starts with `if (f.fbq) return`,
  // so a pre-existing `window.fbq` would stop it from ever loading
  // `fbevents.js`, and *every* event would queue into a stub that nothing drains.
  // Conversions on this route are still covered server-side by the Conversions
  // API, which is exactly what that second channel is for.
  const fbq = window.fbq
  if (typeof fbq !== "function") return

  const cleaned = cleanParams(params)
  const hasParams = Object.keys(cleaned).length > 0
  const third = options?.eventID ? { eventID: options.eventID } : undefined

  if (hasParams && third) fbq("track", eventName, cleaned, third)
  else if (hasParams) fbq("track", eventName, cleaned)
  else if (third) fbq("track", eventName, {}, third)
  else fbq("track", eventName)
}

/**
 * Fire an event at most once per page session for a given key.
 *
 * Why this exists: React runs effects twice in StrictMode (dev) and App Router
 * re-mounts a page component when the user navigates back to it, so a plain
 * `useEffect(() => track('ViewContent'))` happily reports the same product view
 * three times. Ad data you can't trust is worse than no data — Meta optimises
 * towards whatever you feed it.
 *
 * The key should include what makes two events genuinely different
 * (`/products/9` vs `/products/12`, or `?q=coffee` vs `?q=tea`), which is what
 * the `dedupeKey` prop of `<MetaPageEvent />` is for.
 */
export function trackMetaEventOnce(
  key: string,
  eventName: MetaStandardEvent | (string & {}),
  params?: MetaEventParams,
  options?: MetaTrackOptions,
): void {
  if (fired.has(key)) return
  fired.add(key)
  trackMetaEvent(eventName, params, options)
}

/**
 * A fresh id for the browser/server event pair.
 *
 * Only needed when the browser has to invent the id itself (a conversion that
 * never touches our API — e.g. the quote dialog's server action path). When the
 * server returns one, always prefer that: the pair only dedupes if both sides
 * send the *same* string.
 */
export function newMetaEventId(): string {
  const cryptoObj = typeof crypto !== "undefined" ? crypto : undefined
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") return cryptoObj.randomUUID()
  // Ancient Safari / insecure context fallback. Uniqueness is all Meta needs.
  return `vx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function cleanParams(params?: MetaEventParams): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (!params) return out

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    if (typeof value === "string" && value.trim() === "") continue
    if (Array.isArray(value) && value.length === 0) continue
    out[key] = Array.isArray(value) ? value.slice(0, 10) : value
  }
  return out
}
