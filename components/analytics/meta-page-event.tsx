"use client"

/**
 * Fires one Meta Pixel event when a page renders.
 *
 * Needed because the pages that carry the interesting events (`/products/[id]`,
 * `/profile/[slug]`, the catalog) are **server** components — often statically
 * generated and cached on the CDN, where there is no request to hook into and no
 * place to call `fbq`. They render this client component instead and hand it the
 * already-known facts (product id, name, category), so nothing about the ISR
 * caching or the static HTML changes.
 *
 * Deliberately does NOT use `useSearchParams()`: on a statically generated
 * route that forces Next to bail out to client-side rendering (and errors at
 * build time without a Suspense boundary). Anything that depends on the query
 * string is passed down by the server component as `dedupeKey` + `params`.
 *
 * `trackMetaEventOnce` keeps StrictMode's double effect, and a back-navigation
 * to the same page, from reporting the same view twice.
 */

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import {
  trackMetaEventOnce,
  type MetaEventParams,
  type MetaStandardEvent,
} from "@/lib/analytics/meta/browser"

interface MetaPageEventProps {
  /** Standard event name — "ViewContent" for a detail page, "Search" for a query. */
  event: MetaStandardEvent | (string & {})
  /** Params forwarded verbatim to `fbq('track', ...)`; empty values are dropped. */
  params?: MetaEventParams
  /**
   * What makes two firings of this event genuinely different. Defaults to the
   * pathname; a catalog page passes its query string so `?q=coffee` and
   * `?q=tea` are two searches, not one.
   */
  dedupeKey?: string
}

export function MetaPageEvent({ event, params, dedupeKey }: MetaPageEventProps) {
  const pathname = usePathname()

  // Params come from a server component and are a fresh object every render;
  // keeping them in a ref means the effect can depend on the key alone instead
  // of re-firing whenever React rebuilds the literal.
  const paramsRef = useRef(params)
  paramsRef.current = params

  const key = `${event}|${dedupeKey ?? pathname}`

  useEffect(() => {
    trackMetaEventOnce(key, event, paramsRef.current)
  }, [key, event])

  return null
}
