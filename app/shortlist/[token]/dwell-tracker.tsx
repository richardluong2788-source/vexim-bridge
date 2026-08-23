"use client"

import { useEffect, useRef } from "react"

/**
 * Silent, invisible tracker mounted once on the public shortlist page.
 * Watches every element carrying `data-shortlist-item-id="<id>"` with an
 * IntersectionObserver and accumulates how many milliseconds each one was
 * actually visible (>=60% in viewport) to the buyer. Periodically flushes
 * accumulated deltas to `/shortlist/[token]/track`, so the AE can later
 * see which supplier option the buyer actually spent time reading.
 *
 * Renders nothing. Never throws — all failures are swallowed since this
 * is best-effort telemetry that must never affect the buyer's experience.
 */

const VISIBILITY_THRESHOLD = 0.6
const FLUSH_INTERVAL_MS = 8000

export function DwellTracker({ token, itemIds }: { token: string; itemIds: string[] }) {
  const itemIdsRef = useRef(itemIds)
  itemIdsRef.current = itemIds

  useEffect(() => {
    if (itemIdsRef.current.length === 0) return
    if (typeof IntersectionObserver === "undefined") return

    const dwellAccumMs: Record<string, number> = {}
    const visibleSince: Record<string, number | null> = {}

    const flush = (useBeacon: boolean) => {
      const now = performance.now()
      const entries: { itemId: string; ms: number }[] = []

      for (const id of itemIdsRef.current) {
        const since = visibleSince[id]
        let ms = dwellAccumMs[id] ?? 0
        if (since != null) {
          ms += now - since
          // Restart the clock instead of losing visibility state.
          visibleSince[id] = now
        }
        if (ms > 0) {
          entries.push({ itemId: id, ms })
          dwellAccumMs[id] = 0
        }
      }

      if (entries.length === 0) return

      const payload = JSON.stringify({ entries })
      const url = `/shortlist/${token}/track`

      try {
        if (useBeacon && navigator.sendBeacon) {
          const blob = new Blob([payload], { type: "application/json" })
          navigator.sendBeacon(url, blob)
        } else {
          fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
          }).catch(() => {})
        }
      } catch {
        // Best-effort telemetry — never let this affect the page.
      }
    }

    const observer = new IntersectionObserver(
      (observedEntries) => {
        for (const entry of observedEntries) {
          const id = (entry.target as HTMLElement).dataset.shortlistItemId
          if (!id) continue
          if (entry.isIntersecting) {
            if (visibleSince[id] == null) {
              visibleSince[id] = performance.now()
            }
          } else if (visibleSince[id] != null) {
            dwellAccumMs[id] = (dwellAccumMs[id] ?? 0) + (performance.now() - visibleSince[id]!)
            visibleSince[id] = null
          }
        }
      },
      { threshold: VISIBILITY_THRESHOLD },
    )

    const elements = itemIdsRef.current
      .map((id) => document.querySelector(`[data-shortlist-item-id="${id}"]`))
      .filter((el): el is Element => el != null)

    elements.forEach((el) => observer.observe(el))

    const intervalId = window.setInterval(() => flush(false), FLUSH_INTERVAL_MS)

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush(true)
    }
    const handlePageHide = () => flush(true)

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("pagehide", handlePageHide)

    return () => {
      flush(true)
      observer.disconnect()
      window.clearInterval(intervalId)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("pagehide", handlePageHide)
    }
    // Intentionally run once on mount — itemIdsRef keeps the latest ids
    // available to the closures above without re-running the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return null
}
