"use client"

import {
  isOptionalTrackingAllowedOnCurrentPage,
  readOptionalTrackingConsent,
} from "@/lib/analytics/meta-pixel"

const DEFAULT_GA_MEASUREMENT_ID = "G-ZEJM6Q37SY"
const configuredMeasurementId =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? DEFAULT_GA_MEASUREMENT_ID
const GA_MEASUREMENT_ID = /^G-[A-Z0-9]+$/i.test(configuredMeasurementId)
  ? configuredMeasurementId
  : null

type GtagArgument = string | number | boolean | Date | Record<string, unknown>
type GtagFunction = (...args: GtagArgument[]) => void
type GoogleAnalyticsEvent = "page_view" | "contact" | "generate_lead"

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: GtagFunction
  }
}

let configuredId: string | null = null

function getGtag(): GtagFunction | null {
  if (typeof window === "undefined" || !GA_MEASUREMENT_ID) return null

  let gtag = window.gtag
  if (!gtag) {
    const dataLayer = window.dataLayer ?? []
    window.dataLayer = dataLayer
    gtag = function () {
      dataLayer.push(arguments)
    }
    window.gtag = gtag

    const script = document.createElement("script")
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`
    const firstScript = document.getElementsByTagName("script")[0]
    if (firstScript?.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript)
    } else {
      document.head.appendChild(script)
    }

    gtag("js", new Date())
  }

  // We disable gtag's automatic page view and send one explicitly for each
  // App Router navigation. Ads signals are off; this integration is analytics
  // only and runs only after the visitor accepts optional tracking.
  gtag("consent", "update", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  })
  if (configuredId !== GA_MEASUREMENT_ID) {
    gtag("config", GA_MEASUREMENT_ID, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    })
    configuredId = GA_MEASUREMENT_ID
  }

  return gtag
}

/** Send a GA4 event only after optional tracking consent on a safe public URL. */
export function trackGoogleAnalyticsEvent(
  eventName: GoogleAnalyticsEvent,
  parameters?: Record<string, string | number | boolean>,
): void {
  if (readOptionalTrackingConsent() !== "granted" || !isOptionalTrackingAllowedOnCurrentPage()) return

  try {
    const gtag = getGtag()
    if (!gtag) return

    if (parameters && Object.keys(parameters).length > 0) {
      gtag("event", eventName, parameters)
    } else {
      gtag("event", eventName)
    }
  } catch {
    // Measurement is best-effort and must never interrupt normal site behavior.
  }
}

/** Stop GA4 collection and clear first-party GA cookies when consent is withdrawn. */
export function revokeGoogleAnalyticsConsent(): void {
  if (typeof window === "undefined") return

  try {
    window.gtag?.("consent", "update", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    })
  } catch {
    // A blocked analytics script must not prevent the rest of the consent choice.
  }

  try {
    const host = window.location.hostname
    const domains = ["", `; domain=${host}`, `; domain=.${host}`]
    const names = new Set(["_ga", "_gid"])
    for (const cookie of document.cookie.split(";")) {
      const name = cookie.split("=")[0]?.trim()
      if (name?.startsWith("_ga_")) names.add(name)
    }
    const expired = "=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax"

    for (const name of names) {
      for (const domain of domains) {
        document.cookie = `${name}${expired}${domain}`
      }
    }
  } catch {
    // Analytics is best-effort and must never interrupt normal site behavior.
  }
}
