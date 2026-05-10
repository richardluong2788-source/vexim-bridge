"use client"

import { useRouter, useSearchParams } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { KPIPeriod } from "@/lib/kpi/queries"

interface Props {
  value: KPIPeriod
  locale: "vi" | "en"
}

const PERIODS: { value: KPIPeriod; labelVi: string; labelEn: string }[] = [
  { value: "this_month", labelVi: "Tháng này", labelEn: "This Month" },
  { value: "last_month", labelVi: "Tháng trước", labelEn: "Last Month" },
  { value: "this_quarter", labelVi: "Quý này", labelEn: "This Quarter" },
  { value: "this_year", labelVi: "Năm nay", labelEn: "This Year" },
]

export function KPIPeriodSelector({ value, locale }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleChange(newValue: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("period", newValue)
    router.push(`/admin/my-kpi?${params.toString()}`)
  }

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className="w-[160px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PERIODS.map((p) => (
          <SelectItem key={p.value} value={p.value}>
            {locale === "vi" ? p.labelVi : p.labelEn}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
