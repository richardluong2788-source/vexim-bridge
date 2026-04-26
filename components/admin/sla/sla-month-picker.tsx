"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface SlaMonthPickerProps {
  /** Current period_month (first of month, 'YYYY-MM-DD'). */
  periodMonth: string
  /** URL builder — receives the next periodMonth value, returns href. */
  buildHref: (next: string) => string
}

function shiftMonthIso(periodMonth: string, delta: number): string {
  const [y, m] = periodMonth.split("-").map(Number)
  if (!y || !m) return periodMonth
  const d = new Date(Date.UTC(y, m - 1 + delta, 1, 0, 0, 0))
  return d.toISOString().slice(0, 10)
}

function vnLabel(periodMonth: string): string {
  const [y, m] = periodMonth.split("-").map(Number)
  if (!y || !m) return periodMonth
  const d = new Date(Date.UTC(y, m - 1, 1))
  return d.toLocaleDateString("vi-VN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}

/**
 * Minimal previous/current/next month nav. Server-rendered: the surrounding
 * page reads ?period= from searchParams and rebuilds.
 */
export function SlaMonthPicker({ periodMonth, buildHref }: SlaMonthPickerProps) {
  const prev = shiftMonthIso(periodMonth, -1)
  const next = shiftMonthIso(periodMonth, 1)

  return (
    <div className="flex items-center gap-1 rounded-lg border bg-card px-1 py-1">
      <Button asChild variant="ghost" size="icon" className="h-7 w-7">
        <Link href={buildHref(prev)} aria-label="Tháng trước">
          <ChevronLeft className="h-4 w-4" />
        </Link>
      </Button>
      <span className="px-2 text-sm font-medium tabular-nums capitalize min-w-[120px] text-center">
        {vnLabel(periodMonth)}
      </span>
      <Button asChild variant="ghost" size="icon" className="h-7 w-7">
        <Link href={buildHref(next)} aria-label="Tháng sau">
          <ChevronRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  )
}
