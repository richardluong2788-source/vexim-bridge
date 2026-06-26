"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"

const data = [
  { name: "Lương NS\n(năm 1)", selfSetup: 480, vexim: 0 },
  { name: "Tư vấn FDA", selfSetup: 120, vexim: 0 },
  { name: "Rủi ro SWIFT", selfSetup: 200, vexim: 0 },
  { name: "Chi phí Vexim", selfSetup: 0, vexim: 80 },
]

const CHART_DATA = [
  { label: "Lương nhân sự/năm", self: 480, vexim: null },
  { label: "Tư vấn FDA", self: 120, vexim: null },
  { label: "Rủi ro SWIFT giả", self: 200, vexim: null },
  { label: "Phí Vexim (ước tính)", self: null, vexim: 80 },
]

type CustomTooltipProps = {
  active?: boolean
  payload?: Array<{ payload: { label: string; self: number | null; vexim: number | null } }>
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload
    return (
      <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
        <p className="text-xs font-semibold text-foreground">{d.label}</p>
        {d.self !== null && (
          <p className="text-xs text-destructive">Tự làm: ~{d.self}M VND</p>
        )}
        {d.vexim !== null && (
          <p className="text-xs text-teal-600">Vexim: ~{d.vexim}M VND</p>
        )}
      </div>
    )
  }
  return null
}

export function CostComparisonChart() {
  return (
    <div className="rounded-xl border border-border/80 bg-card p-5">
      <p className="mb-1 text-sm font-semibold text-foreground">Chi phí ước tính — năm đầu tiên</p>
      <p className="mb-4 text-xs text-muted-foreground">Đơn vị: triệu VND</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={CHART_DATA}
          layout="vertical"
          margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
          barCategoryGap="30%"
        >
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}M`}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={110}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Bar dataKey="self" name="Tự làm" radius={[0, 4, 4, 0]}>
            {CHART_DATA.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.self !== null ? "var(--destructive)" : "transparent"}
                opacity={entry.self !== null ? 0.8 : 0}
              />
            ))}
          </Bar>
          <Bar dataKey="vexim" name="Vexim" radius={[0, 4, 4, 0]}>
            {CHART_DATA.map((entry, index) => (
              <Cell
                key={`cell-v-${index}`}
                fill={entry.vexim !== null ? "#0d9488" : "transparent"}
                opacity={entry.vexim !== null ? 0.9 : 0}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="mt-3 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-destructive/80" aria-hidden="true" />
          <span className="text-xs text-muted-foreground">Tự lập phòng sales</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-teal-600" aria-hidden="true" />
          <span className="text-xs text-muted-foreground">Thuê Vexim Trade</span>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        * Chưa tính cơ hội mất khi chưa có đơn hàng Mỹ trong 6–12 tháng đầu tự mày mò
      </p>
    </div>
  )
}
