"use client"

/**
 * Period selector for the "Hộp đen" (black-box) tab embedded inside
 * /admin/clients/[id]. Writes to ?bbPeriod= so it does not collide with
 * the Performance card's own ?perfPeriod= selector on the same page.
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

export function BbPeriodSelector({ value, basePath }: Props) {
  const router = useRouter()
  const search = useSearchParams()

  function onChange(next: string) {
    const params = new URLSearchParams(search?.toString() ?? "")
    if (next === "quarter") params.delete("bbPeriod")
    else params.set("bbPeriod", next)
    const qs = params.toString()
    router.push(qs ? `${basePath}?${qs}#blackbox` : `${basePath}#blackbox`, { scroll: false })
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
