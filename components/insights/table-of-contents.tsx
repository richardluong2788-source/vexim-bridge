"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import type { TocEntry } from "@/lib/insights/toc"

interface TableOfContentsProps {
  entries: TocEntry[]
  title?: string
  /** Scroll offset in pixels to compensate for sticky headers. */
  offset?: number
}

/**
 * Sticky sidebar TOC with scrollspy — highlights the current section as
 * the user scrolls. Falls back to a plain nav when JS is disabled.
 */
export function TableOfContents({
  entries,
  title = "Nội dung",
  offset = 96,
}: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string | null>(
    entries[0]?.id ?? null,
  )

  useEffect(() => {
    if (entries.length === 0) return

    const ids = entries.map((e) => e.id)
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)

    if (elements.length === 0) return

    // A rootMargin that treats "active" as "heading has crossed the top
    // 30% of the viewport" — feels natural for long-form reading.
    const observer = new IntersectionObserver(
      (intersections) => {
        // Walk all tracked elements and pick the last one whose top is
        // above the trigger line. This gives correct behaviour even when
        // several sections are visible at once.
        let current: string | null = null
        for (const el of elements) {
          const rect = el.getBoundingClientRect()
          if (rect.top - offset <= 0) current = el.id
          else break
        }
        if (current) setActiveId(current)
        else setActiveId(ids[0])
        // `intersections` is unused but required to silence the signature.
        void intersections
      },
      {
        // Recompute on every intersection with the viewport.
        rootMargin: `-${offset}px 0px -60% 0px`,
        threshold: [0, 1],
      },
    )

    elements.forEach((el) => observer.observe(el))
    // Also update on scroll so we catch the case where no intersection
    // fires (e.g. user scrolls fast past several sections).
    const onScroll = () => {
      let current: string | null = null
      for (const el of elements) {
        const rect = el.getBoundingClientRect()
        if (rect.top - offset <= 0) current = el.id
        else break
      }
      setActiveId(current ?? ids[0])
    }
    window.addEventListener("scroll", onScroll, { passive: true })

    return () => {
      observer.disconnect()
      window.removeEventListener("scroll", onScroll)
    }
  }, [entries, offset])

  if (entries.length < 2) return null

  return (
    <nav aria-label={title} className="text-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {title}
      </p>
      <ol className="flex flex-col gap-1 border-l border-border">
        {entries.map((entry) => {
          const isActive = entry.id === activeId
          return (
            <li key={entry.id}>
              <Link
                href={`#${entry.id}`}
                className={cn(
                  "-ml-px block border-l-2 py-1.5 pl-3 leading-snug transition-colors",
                  entry.level === 3 && "pl-6",
                  isActive
                    ? "border-accent font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {entry.text}
              </Link>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
