"use client"

/**
 * Small dropdown that updates `?period=` on the current URL while keeping
 * every other query param intact. Used both on /admin/analytics and on the
 * Performance cards inside /admin/clients/[id] and /admin/buyers/[id].
 */
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useTransition } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ANALYTICS_PERIODS, type AnalyticsPeriod } from "@/lib/analytics/constants"

interface Props {
  value: AnalyticsPeriod
  /** Optional — when provided, scopes the query param to a different name
   *  (e.g. "perfPeriod" so the page period and the Performance-card period
   *  on the same URL don't collide). Defaults to "period". */
  paramName?: string
  className?: string
}

export function PeriodSelector({ value, paramName = "period", className }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function onChange(next: string) {
    const sp = new URLSearchParams(params?.toString() ?? "")
    sp.set(paramName, next)
    startTransition(() => {
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
    })
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={isPending}>
      <SelectTrigger className={className ?? "w-[180px]"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ANALYTICS_PERIODS.map((p) => (
          <SelectItem key={p.value} value={p.value}>
            {p.labelVi}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
