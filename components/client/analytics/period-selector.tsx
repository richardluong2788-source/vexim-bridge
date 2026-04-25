"use client"

/**
 * Period dropdown for /client/analytics. Mirrors the admin one
 * (components/admin/analytics/period-selector.tsx) but uses the i18n
 * dictionary so the labels switch between Vietnamese and English with
 * the rest of the client portal.
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
import type { PeriodValue } from "@/lib/analytics/constants"
import { useTranslation } from "@/components/i18n/language-provider"

const ORDER: PeriodValue[] = ["30d", "90d", "quarter", "year", "all"]

interface Props {
  value: PeriodValue
}

export function ClientPeriodSelector({ value }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const { t } = useTranslation()
  const labels = t.client.analytics.period

  function onChange(next: string) {
    const sp = new URLSearchParams(params?.toString() ?? "")
    sp.set("period", next)
    startTransition(() => {
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
    })
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={isPending}>
      <SelectTrigger className="w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ORDER.map((p) => (
          <SelectItem key={p} value={p}>
            {labels[p]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
