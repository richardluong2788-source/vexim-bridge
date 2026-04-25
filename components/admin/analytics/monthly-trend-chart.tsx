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
  created: number
  won: number
  lost: number
}

const chartConfig = {
  created: { label: "Tạo mới",      color: "hsl(217 91% 60%)" },  // blue
  won:     { label: "Thành công",   color: "hsl(142 76% 36%)" },  // green
  lost:    { label: "Thất bại",     color: "hsl(346 77% 49%)" },  // rose
} satisfies ChartConfig

export function MonthlyTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ChartContainer config={chartConfig} className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} width={32} fontSize={11} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => (
                  <div className="flex w-full items-center justify-between gap-4">
                    <span className="text-muted-foreground">
                      {chartConfig[name as keyof typeof chartConfig]?.label ?? name}
                    </span>
                    <span className="font-mono font-medium tabular-nums">{Number(value)}</span>
                  </div>
                )}
              />
            }
          />
          <Bar dataKey="won"  fill="var(--color-won)"  radius={[4, 4, 0, 0]} maxBarSize={32} />
          <Bar dataKey="lost" fill="var(--color-lost)" radius={[4, 4, 0, 0]} maxBarSize={32} />
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

/**
 * Compact variant used inside Client / Buyer Performance cards. Same data
 * shape, smaller height, no Y axis labels, no legend.
 */
export function MonthlyTrendChartCompact({ data }: { data: TrendPoint[] }) {
  return (
    <ChartContainer config={chartConfig} className="h-[160px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} fontSize={10} />
          <YAxis hide />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="won"  fill="var(--color-won)"  radius={[3, 3, 0, 0]} maxBarSize={24} />
          <Bar dataKey="lost" fill="var(--color-lost)" radius={[3, 3, 0, 0]} maxBarSize={24} />
          <Line
            dataKey="created"
            type="monotone"
            stroke="var(--color-created)"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
