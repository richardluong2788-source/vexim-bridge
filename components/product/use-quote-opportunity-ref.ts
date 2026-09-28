"use client"

import { useSearchParams } from "next/navigation"

/**
 * The opportunity id behind a tracking link, read from `?ref=` on the client.
 *
 * `/api/share/link` emits `?ref=<base64(opportunityId)>` so a quote request can
 * be attributed to the outreach that produced it. Decoding it here (instead of
 * awaiting `searchParams` in the page) keeps the whole product page a static
 * document that the CDN can serve without touching our origin.
 */
export function useQuoteOpportunityRef(): string | null {
  const searchParams = useSearchParams()
  const ref = searchParams?.get("ref")
  if (!ref) return null
  try {
    return atob(ref) || null
  } catch {
    // Not valid base64 - someone hand-edited the link. Ignore it rather than
    // losing the quote over attribution.
    return null
  }
}
