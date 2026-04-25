"use client"

/**
 * Period selector specialised for the Performance card embedded inside
 * /admin/clients/[id] and /admin/buyers/[id]. It writes to ?perfPeriod=
 * instead of ?period= so it does not conflict with the dedicated
 * /admin/analytics page.
 */
import { useRouter, useSearchParams } from "next/navigation"
import { PERIOD_OPTIONS, type PeriodValue } from "@/lib/analytics/constants"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Props {
  value: PeriodValue
  basePath: string
}

export function PerfPeriodSelector({ value, basePath }: Props) {
  const router = useRouter()
  const search = useSearchParams()

  function onChange(next: string) {
    const params = new URLSearchParams(search?.toString() ?? "")
    if (next === "30d") params.delete("perfPeriod")
    else params.set("perfPeriod", next)
    const qs = params.toString()
    router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false })
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-[160px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PERIOD_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs">
            {opt.labelVi}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
