"use client"

import { useEffect, useState } from "react"

/**
 * Thin horizontal bar pinned to the top that tracks how far the user has
 * scrolled through the article body. Uses `requestAnimationFrame` to avoid
 * hammering the main thread on fast scrolls.
 */
export function ReadingProgress({ targetId = "post-body" }: { targetId?: string }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let raf = 0

    const update = () => {
      const el = document.getElementById(targetId)
      if (!el) {
        setProgress(0)
        return
      }

      const rect = el.getBoundingClientRect()
      const viewportH = window.innerHeight || 1
      // How many pixels of the body have scrolled past the top of the viewport.
      const scrolled = Math.max(0, -rect.top)
      // Total scrollable distance through the body: height minus one viewport
      // (so we hit 100% when the bottom edge reaches the bottom of the viewport).
      const total = Math.max(1, rect.height - viewportH)
      const pct = Math.min(100, Math.max(0, (scrolled / total) * 100))
      setProgress(pct)
    }

    const onScroll = () => {
      if (raf) return
      raf = window.requestAnimationFrame(() => {
        raf = 0
        update()
      })
    }

    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [targetId])

  return (
    <div
      aria-hidden
      className="fixed inset-x-0 top-0 z-50 h-0.5 bg-transparent"
    >
      <div
        className="h-full bg-accent transition-[width] duration-100 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
