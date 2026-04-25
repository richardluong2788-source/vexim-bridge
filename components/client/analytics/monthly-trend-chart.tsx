"use client"

/**
 * 12-month trend chart for the client analytics overview tab. Mirrors the
 * admin chart but uses the i18n dictionary for legend / tooltip labels so
 * Vietnamese / English switching works inside the chart too.
 */
import {
  Bar,
  ComposedChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { useTranslation } from "@/components/i18n/language-provider"
import type { ClientTrendPoint } from "@/lib/analytics/client-queries"

interface Props {
  data: ClientTrendPoint[]
}

export function ClientMonthlyTrendChart({ data }: Props) {
  const { t } = useTranslation()
  const labels = t.client.analytics.trend.legend

  const chartConfig = {
    created: { label: labels.created, color: "hsl(217 91% 60%)" },
    won: { label: labels.won, color: "hsl(142 76% 36%)" },
    lost: { label: labels.lost, color: "hsl(346 77% 49%)" },
  } satisfies ChartConfig

  return (
    <ChartContainer config={chartConfig} className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={11}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={32}
            fontSize={11}
            allowDecimals={false}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => (
                  <div className="flex w-full items-center justify-between gap-4">
                    <span className="text-muted-foreground">
                      {chartConfig[name as keyof typeof chartConfig]?.label ??
                        name}
                    </span>
                    <span className="font-mono font-medium tabular-nums">
                      {Number(value)}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Bar
            dataKey="won"
            fill="var(--color-won)"
            radius={[4, 4, 0, 0]}
            maxBarSize={32}
          />
          <Bar
            dataKey="lost"
            fill="var(--color-lost)"
            radius={[4, 4, 0, 0]}
            maxBarSize={32}
          />
          <Line
            dataKey="created"
            type="monotone"
            stroke="var(--color-created)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--color-created)" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
