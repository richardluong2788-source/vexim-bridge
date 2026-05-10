"use client"

import {
  TrendingUp,
  TrendingDown,
  Globe2,
  Factory,
  Upload,
  Target,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts"
import type { LRKPIs, PeriodWindow } from "@/lib/kpi/queries"

interface Props {
  kpis: LRKPIs
  period: PeriodWindow
  locale: "vi" | "en"
}

/**
 * Lead Researcher KPI dashboard.
 *
 * The hero metric is "buyers sourced this month vs target" (default 40).
 * We intentionally do NOT show deal-side metrics (matched / conversion to
 * opportunity) here — those depend on AE workflow and would punish LR for
 * downstream behaviour outside their control. LR can monitor the matching
 * outcome read-only via the AE Inbox link in the sidebar.
 */
export function LRKPIDashboard({ kpis, period, locale }: Props) {
  const periodLabel = locale === "vi" ? period.labelVi : period.label

  // Cap progress for the bar component (it accepts 0..100); we still show
  // the raw percent text so over-target performance is visible.
  const progressBarValue = Math.min(100, kpis.targetProgressPct)

  const chartConfig = {
    imported: {
      label: locale === "vi" ? "Buyers đã nhập" : "Buyers imported",
      color: "hsl(var(--chart-1))",
    },
  } satisfies ChartConfig

  return (
    <div className="flex flex-col gap-6">
      {/* Hero: Monthly Buyer Target */}
      <Card className={kpis.targetMet ? "border-green-600/40" : undefined}>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-5 w-5 text-primary" />
              {locale === "vi" ? "Mục tiêu buyer tháng này" : "Monthly buyer target"}
            </CardTitle>
            <CardDescription>
              {locale === "vi"
                ? `Tối thiểu ${kpis.monthlyTarget} buyer / tháng. Kỳ: ${periodLabel}.`
                : `Minimum ${kpis.monthlyTarget} buyers / month. Period: ${periodLabel}.`}
            </CardDescription>
          </div>
          {kpis.targetMet ? (
            <Badge variant="outline" className="self-start text-green-600 border-green-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {locale === "vi" ? "Đạt mục tiêu" : "Target met"}
            </Badge>
          ) : (
            <Badge variant="outline" className="self-start text-amber-600 border-amber-600">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {locale === "vi"
                ? `Còn thiếu ${kpis.targetRemaining}`
                : `${kpis.targetRemaining} to go`}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
            <span className="text-4xl font-bold tabular-nums">
              {kpis.buyersImportedThisMonth}
            </span>
            <span className="text-lg text-muted-foreground">/ {kpis.monthlyTarget}</span>
            <span
              className={
                "ml-auto text-sm font-medium tabular-nums " +
                (kpis.targetMet ? "text-green-600" : "text-muted-foreground")
              }
            >
              {kpis.targetProgressPct}%
            </span>
          </div>
          <Progress value={progressBarValue} className="h-3" />
          <p className="text-xs text-muted-foreground">
            {locale === "vi"
              ? "Chỉ tính buyer do bạn sourced trong kỳ. Trùng (dedupe) không được cộng."
              : "Only counts buyers you sourced in this period. Duplicates are excluded."}
          </p>
        </CardContent>
      </Card>

      {/* Secondary stats: imported vs last month + period */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {locale === "vi" ? "So với tháng trước" : "vs last month"}
            </CardTitle>
            <Upload className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums">
                {kpis.buyersImportedLastMonth}
              </span>
              <span className="text-xs text-muted-foreground">
                {locale === "vi" ? "tháng trước" : "last month"}
              </span>
            </div>
            <div className="flex items-center gap-1 mt-2">
              {kpis.buyersGrowth > 0 ? (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +{kpis.buyersGrowth}%
                </Badge>
              ) : kpis.buyersGrowth < 0 ? (
                <Badge variant="outline" className="text-red-600 border-red-600">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  {kpis.buyersGrowth}%
                </Badge>
              ) : (
                <Badge variant="outline">0%</Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {locale === "vi" ? "thay đổi" : "change"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {locale === "vi" ? "Kỳ thống kê" : "Period"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">{periodLabel}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {locale === "vi"
                ? "Dữ liệu cập nhật realtime từ buyer pool."
                : "Live data from the buyer pool."}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Countries & Industries */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Top Countries */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe2 className="h-4 w-4" />
              {locale === "vi" ? "Top quốc gia" : "Top Countries"}
            </CardTitle>
            <CardDescription>
              {locale === "vi" ? "Buyers đã nhập theo quốc gia" : "Buyers imported by country"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {kpis.topCountries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {locale === "vi" ? "Chưa có dữ liệu" : "No data yet"}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {kpis.topCountries.map((c, i) => (
                  <div key={c.country} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground w-4">
                        {i + 1}.
                      </span>
                      <span className="text-sm">{c.country}</span>
                    </div>
                    <Badge variant="secondary">{c.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Industries */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Factory className="h-4 w-4" />
              {locale === "vi" ? "Top ngành hàng" : "Top Industries"}
            </CardTitle>
            <CardDescription>
              {locale === "vi" ? "Buyers đã nhập theo ngành" : "Buyers imported by industry"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {kpis.topIndustries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {locale === "vi" ? "Chưa có dữ liệu" : "No data yet"}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {kpis.topIndustries.map((ind, i) => (
                  <div key={ind.industry} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground w-4">
                        {i + 1}.
                      </span>
                      <span className="text-sm truncate max-w-[200px]">{ind.industry}</span>
                    </div>
                    <Badge variant="secondary">{ind.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 6-month Trend with target reference line */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {locale === "vi" ? "Xu hướng 6 tháng" : "6-Month Trend"}
          </CardTitle>
          <CardDescription>
            {locale === "vi"
              ? `Buyers đã nhập theo tháng. Đường mức = mục tiêu ${kpis.monthlyTarget}.`
              : `Monthly buyers imported. Reference line = target of ${kpis.monthlyTarget}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[260px] w-full">
            <BarChart data={kpis.monthlyTrend} accessibilityLayer>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ReferenceLine
                y={kpis.monthlyTarget}
                stroke="hsl(var(--primary))"
                strokeDasharray="4 4"
                label={{
                  value: locale === "vi" ? `Mục tiêu ${kpis.monthlyTarget}` : `Target ${kpis.monthlyTarget}`,
                  position: "insideTopRight",
                  fontSize: 11,
                  fill: "hsl(var(--primary))",
                }}
              />
              <Bar dataKey="imported" fill="var(--color-imported)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
