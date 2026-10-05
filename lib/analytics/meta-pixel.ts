"use client"

import { isPublicPath, NOINDEX_SEGMENTS, PRIVATE_SEGMENTS } from "@/lib/i18n/routing"

const DEFAULT_META_PIXEL_ID = "4532386106980064"
const configuredPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? DEFAULT_META_PIXEL_ID
const normalizedPixelId = configuredPixelId.trim()

/** A Meta Pixel ID is public and safe to ship to the browser. */
export const META_PIXEL_ID = /^\d+$/.test(normalizedPixelId) ? normalizedPixelId : null

// Versioned so visitors who previously consented only to the Meta Pixel are
// asked again now that GA4 is being added to optional measurement.
export const OPTIONAL_TRACKING_CONSENT_KEY = "vexim-optional-tracking-consent-v2"
export const OPEN_COOKIE_PREFERENCES_EVENT = "vexim:open-cookie-preferences"

export type OptionalTrackingConsent = "granted" | "denied" | null
export type MetaPixelEvent = "PageView" | "Contact" | "Lead"

type PixelArgument = string | boolean | Record<string, string | number>
type FbqFunction = ((...args: PixelArgument[]) => void) & {
  callMethod?: (...args: PixelArgument[]) => void
  queue?: PixelArgument[][]
  push?: (...args: PixelArgument[]) => void
  loaded?: boolean
  version?: string
}

declare global {
  interface Window {
    fbq?: FbqFunction
    _fbq?: FbqFunction
  }
}

const excludedPathSegments = new Set([
  ...PRIVATE_SEGMENTS,
  ...NOINDEX_SEGMENTS,
  // These public-link routes contain bearer tokens or customer-supplied data.
  "client-intake",
  "product-intake",
])

const allowedQueryKeys = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
])

const sensitiveQueryKeys = new Set([
  "email",
  "phone",
  "mobile",
  "token",
  "access_token",
  "refresh_token",
  "auth",
  "code",
  "password",
  "secret",
  "key",
  "session",
  "signature",
  "sig",
  "jwt",
  "ref",
])

const initializedPixelIds = new Set<string>()
let inMemoryConsent: OptionalTrackingConsent = null

/**
 * Do not send page views for private areas or token-addressed links. Strip a
 * locale prefix first because Vietnamese marketing URLs use `/vi/...`.
 */
export function isMetaPixelExcludedPath(pathname: string): boolean {
  const unprefixedPath = pathname.replace(/^\/(?:en|vi)(?=\/|$)/, "") || "/"
  const firstSegment = unprefixedPath.replace(/^\//, "").split("/")[0]?.toLowerCase() ?? ""
  return excludedPathSegments.has(firstSegment)
}

export function readOptionalTrackingConsent(): OptionalTrackingConsent {
  if (typeof window === "undefined") return null

  try {
    const storedChoice = window.localStorage.getItem(OPTIONAL_TRACKING_CONSENT_KEY)
    if (storedChoice === "granted" || storedChoice === "denied") {
      inMemoryConsent = storedChoice
      return storedChoice
    }
    if (storedChoice === null) return inMemoryConsent
  } catch {
    // Continue with the in-memory choice if storage is unavailable.
  }

  return inMemoryConsent
}

export function setOptionalTrackingConsent(choice: Exclude<OptionalTrackingConsent, null>): void {
  inMemoryConsent = choice
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(OPTIONAL_TRACKING_CONSENT_KEY, choice)
  } catch {
    // The current tab still honors the choice if persistent storage is blocked.
  }

  if (choice === "denied") {
    try {
      window.fbq?.("consent", "revoke")
    } catch {
      // A blocked Pixel must not prevent the rest of the consent choice.
    }
    try {
      clearMetaPixelCookies()
    } catch {
      // Analytics is best-effort and must never interrupt normal site behavior.
    }
  }
}

function clearMetaPixelCookies(): void {
  const host = window.location.hostname
  const domains = ["", `; domain=${host}`, `; domain=.${host}`]
  const expired = "=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax"

  for (const name of ["_fbp", "_fbc"]) {
    for (const domain of domains) {
      document.cookie = `${name}${expired}${domain}`
    }
  }
}

function hasOnlyApprovedQueryParameters(): boolean {
  if (typeof window === "undefined") return false

  try {
    for (const key of new URL(window.location.href).searchParams.keys()) {
      if (!allowedQueryKeys.has(key.toLowerCase())) return false
    }
    return true
  } catch {
    return false
  }
}

function referrerContainsSensitiveData(): boolean {
  if (!document.referrer) return false

  try {
    const referrer = new URL(document.referrer)
    for (const key of referrer.searchParams.keys()) {
      if (sensitiveQueryKeys.has(key.toLowerCase())) return true
    }
    return referrer.origin === window.location.origin && isMetaPixelExcludedPath(referrer.pathname)
  } catch {
    return true
  }
}

export function isOptionalTrackingAllowedOnCurrentPage(): boolean {
  if (typeof window === "undefined") return false

  const pathname = window.location.pathname
  const unprefixedPath = pathname.replace(/^\/(?:en|vi)(?=\/|$)/, "") || "/"
  if (!isPublicPath(unprefixedPath) || isMetaPixelExcludedPath(pathname)) return false
  // Pixel's automatic URL metadata includes the current URL. Avoid sending
  // arbitrary query values or referrers that could contain tokens or PII.
  return hasOnlyApprovedQueryParameters() && !referrerContainsSensitiveData()
}

function getFbq(): FbqFunction | null {
  if (typeof window === "undefined" || !META_PIXEL_ID) return null

  let fbq = window.fbq ?? window._fbq
  if (!fbq) {
    const queuedFbq: FbqFunction = (...args) => {
      if (queuedFbq.callMethod) {
        queuedFbq.callMethod(...args)
      } else {
        queuedFbq.queue?.push(args)
      }
    }
    queuedFbq.push = queuedFbq
    queuedFbq.loaded = true
    queuedFbq.version = "2.0"
    queuedFbq.queue = []
    window.fbq = queuedFbq
    window._fbq = queuedFbq
    fbq = queuedFbq

    const script = document.createElement("script")
    script.async = true
    script.src = "https://connect.facebook.net/en_US/fbevents.js"
    const firstScript = document.getElementsByTagName("script")[0]
    if (firstScript?.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript)
    } else {
      document.head.appendChild(script)
    }
  }

  if (!initializedPixelIds.has(META_PIXEL_ID)) {
    // Opt-in consent is explicit; disable Meta's automatic event discovery and
    // advanced matching so only the events we deliberately send are recorded.
    fbq("consent", "grant")
    fbq("set", "autoConfig", false, META_PIXEL_ID)
    fbq("init", META_PIXEL_ID)
    initializedPixelIds.add(META_PIXEL_ID)
  } else {
    fbq("consent", "grant")
  }

  return fbq
}

/** Send a privacy-minimized browser event after optional-tracking consent. */
export function trackMetaEvent(
  eventName: MetaPixelEvent,
  parameters?: Record<string, string | number>,
): void {
  if (readOptionalTrackingConsent() !== "granted" || !isOptionalTrackingAllowedOnCurrentPage()) return

  try {
    const fbq = getFbq()
    if (!fbq) return

    if (parameters && Object.keys(parameters).length > 0) {
      fbq("track", eventName, parameters)
    } else {
      fbq("track", eventName)
    }
  } catch {
    // Pixel failures or blockers must never interrupt normal site behavior.
  }
}
