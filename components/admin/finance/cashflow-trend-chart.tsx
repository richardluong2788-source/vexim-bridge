"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ComposedChart,
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

interface TrendPoint {
  key: string
  label: string
  revenue: number
  expense: number
  net: number
}

const chartConfig = {
  revenue: {
    label: "Thu",
    color: "hsl(142 76% 36%)",
  },
  expense: {
    label: "Chi",
    color: "hsl(346 77% 49%)",
  },
  net: {
    label: "Ròng",
    color: "hsl(217 91% 60%)",
  },
} satisfies ChartConfig

export function CashflowTrendChart({ data }: { data: TrendPoint[] }) {
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
            tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={44}
            fontSize={11}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => (
                  <div className="flex w-full items-center justify-between gap-4">
                    <span className="text-muted-foreground">
                      {chartConfig[name as keyof typeof chartConfig]?.label ?? name}
                    </span>
                    <span className="font-mono font-medium tabular-nums">
                      ${Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Bar
            dataKey="revenue"
            fill="var(--color-revenue)"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
          <Bar
            dataKey="expense"
            fill="var(--color-expense)"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
          <Line
            dataKey="net"
            type="monotone"
            stroke="var(--color-net)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--color-net)" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
