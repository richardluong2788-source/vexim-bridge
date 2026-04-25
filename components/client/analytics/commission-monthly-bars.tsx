"use client"

/**
 * Plain bar chart for monthly commission USD. Separate from the cumulative
 * area chart so the two visualisations stay self-contained.
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import type { CommissionMonthPoint } from "@/lib/analytics/client-queries"

interface Props {
  data: CommissionMonthPoint[]
}

const chartConfig = {
  amount: { label: "Amount", color: "hsl(142 76% 36%)" },
} satisfies ChartConfig

export function CommissionMonthlyBars({ data }: Props) {
  const { t } = useTranslation()
  const tooltipLabel = t.client.analytics.financial.monthlyTooltip

  const cfg = {
    amount: { label: tooltipLabel, color: "hsl(142 76% 36%)" },
  } satisfies ChartConfig

  return (
    <ChartContainer config={cfg} className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
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
            width={56}
            fontSize={11}
            tickFormatter={(v) =>
              new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                notation: "compact",
                maximumFractionDigits: 1,
              }).format(Number(v))
            }
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => (
                  <div className="flex items-center justify-between gap-4 w-full">
                    <span className="text-muted-foreground">
                      {chartConfig.amount.label}
                    </span>
                    <span className="font-mono font-medium tabular-nums">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      }).format(Number(value))}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Bar
            dataKey="amount"
            fill="var(--color-amount)"
            radius={[4, 4, 0, 0]}
            maxBarSize={32}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
