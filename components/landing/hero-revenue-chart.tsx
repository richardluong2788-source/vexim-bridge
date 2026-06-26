"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

const data = [
  { month: "T1", revenue: 0 },
  { month: "T2", revenue: 0 },
  { month: "T3", revenue: 48 },
  { month: "T4", revenue: 95 },
  { month: "T5", revenue: 140 },
  { month: "T6", revenue: 210 },
  { month: "T7", revenue: 290 },
  { month: "T8", revenue: 380 },
  { month: "T9", revenue: 490 },
  { month: "T10", revenue: 610 },
  { month: "T11", revenue: 750 },
  { month: "T12", revenue: 920 },
]

export function HeroRevenueChart() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-white/60">Kim ngạch tích lũy (USD)</p>
          <p className="text-xl font-semibold text-white">$920,000</p>
        </div>
        <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-400">
          +920% / năm
        </span>
      </div>
      <ResponsiveContainer width="100%" height={100}>
        <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#5eead4" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#5eead4" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="month"
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide />
          <Tooltip
            contentStyle={{
              background: "rgba(15,31,61,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#fff",
            }}
            formatter={(value: number) => [`$${value}K`, "Doanh thu"]}
            labelFormatter={(label) => `Tháng ${label.replace("T", "")}`}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#5eead4"
            strokeWidth={2}
            fill="url(#revenueGradient)"
            dot={false}
            activeDot={{ r: 4, fill: "#5eead4" }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <p className="mt-2 text-center text-[10px] text-white/40">
        Dữ liệu mô phỏng nhà máy điển hình trong hệ thống Vexim
      </p>
    </div>
  )
}
