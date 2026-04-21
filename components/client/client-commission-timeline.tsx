"use client"

import { useMemo } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslation } from "@/components/i18n/language-provider"

export type TimelinePoint = {
  paid_on: string
  commission_amount: number
  invoice_value: number
}

interface Props {
  points: TimelinePoint[]
  locale?: string
}

/**
 * Cumulative commission paid over time, rendered as a filled area chart.
 *
 * Accepts the raw "paid rows" from the `client_commission_timeline` view,
 * aggregates them per-day, and builds a running total on the client.
 */
export function ClientCommissionTimeline({ points, locale = "en-US" }: Props) {
  const { t } = useTranslation()
  const s = t.client.dashboard.revenueChart

  const data = useMemo(() => {
    // 1) Group by day, sum commission.
    const byDay = new Map<string, number>()
    for (const p of points) {
      const day = p.paid_on
      byDay.set(day, (byDay.get(day) ?? 0) + (p.commission_amount ?? 0))
    }
    // 2) Sort and build cumulative.
    const sorted = Array.from(byDay.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    )
    let running = 0
    return sorted.map(([date, daily]) => {
      running += daily
      return {
        date,
        daily,
        cumulative: running,
        label: new Date(date).toLocaleDateString(locale, {
          month: "short",
          day: "numeric",
          year: "2-digit",
        }),
      }
    })
  }, [points, locale])

  if (data.length === 0) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">{s.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-12">
            {s.empty}
          </p>
        </CardContent>
      </Card>
    )
  }

  const total = data[data.length - 1].cumulative

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-base">{s.title}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {s.subtitle.replace("{amount}", formatUsd(total))}
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
            >
              <defs>
                <linearGradient id="commGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--chart-1)"
                    stopOpacity={0.45}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--chart-1)"
                    stopOpacity={0.02}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="var(--border)"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatUsdCompact(Number(v))}
                width={56}
              />
              <Tooltip
                cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "var(--popover-foreground)",
                }}
                formatter={(value: number, name: string) => {
                  if (name === "cumulative")
                    return [formatUsd(value), s.cumulative]
                  if (name === "daily") return [formatUsd(value), s.daily]
                  return [value, name]
                }}
                labelFormatter={(label) => label}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#commGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

function formatUsd(v: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v)
}

function formatUsdCompact(v: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(v)
}
