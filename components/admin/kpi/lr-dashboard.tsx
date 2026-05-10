"use client"

import {
  TrendingUp,
  TrendingDown,
  Users,
  Globe2,
  Factory,
  ArrowRight,
  Upload,
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
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Line, LineChart } from "recharts"
import type { LRKPIs, PeriodWindow } from "@/lib/kpi/queries"

interface Props {
  kpis: LRKPIs
  period: PeriodWindow
  locale: "vi" | "en"
}

export function LRKPIDashboard({ kpis, period, locale }: Props) {
  const periodLabel = locale === "vi" ? period.labelVi : period.label

  const chartConfig = {
    imported: { label: locale === "vi" ? "Imported" : "Imported", color: "hsl(var(--chart-1))" },
    matched: { label: locale === "vi" ? "Matched" : "Matched", color: "hsl(var(--chart-2))" },
  } satisfies ChartConfig

  return (
    <div className="flex flex-col gap-6">
      {/* Top Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Buyers Imported */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {locale === "vi" ? "Buyers đã nhập" : "Buyers Imported"}
            </CardTitle>
            <Upload className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.buyersImportedThisMonth}</div>
            <div className="flex items-center gap-1 mt-1">
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
                {locale === "vi" ? "so với tháng trước" : "vs last month"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {locale === "vi" ? "Tháng trước:" : "Last month:"} {kpis.buyersImportedLastMonth}
            </p>
          </CardContent>
        </Card>

        {/* Buyers Matched */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {locale === "vi" ? "Đã ghép nối" : "Matched"}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{kpis.buyersMatched}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {locale === "vi"
                ? "Buyers đã có opportunity"
                : "Buyers with opportunities"}
            </p>
          </CardContent>
        </Card>

        {/* Conversion Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {locale === "vi" ? "Tỷ lệ chuyển đổi" : "Conversion Rate"}
            </CardTitle>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.conversionRate}%</div>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={kpis.conversionRate} className="h-2" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {locale === "vi"
                ? "Pool -> Opportunity"
                : "Pool -> Opportunity"}
            </p>
          </CardContent>
        </Card>

        {/* Period */}
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
                ? "Dữ liệu được cập nhật realtime"
                : "Data updated in real-time"}
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
              {locale === "vi" ? "Buyers imported theo quốc gia" : "Buyers imported by country"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {kpis.topCountries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {locale === "vi" ? "Chưa có dữ liệu" : "No data yet"}
              </p>
            ) : (
              <div className="space-y-3">
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
              {locale === "vi" ? "Buyers imported theo ngành" : "Buyers imported by industry"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {kpis.topIndustries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {locale === "vi" ? "Chưa có dữ liệu" : "No data yet"}
              </p>
            ) : (
              <div className="space-y-3">
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

      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {locale === "vi" ? "Xu hướng 6 tháng" : "6-Month Trend"}
          </CardTitle>
          <CardDescription>
            {locale === "vi" ? "Buyers imported và matched theo tháng" : "Monthly imported and matched buyers"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <BarChart data={kpis.monthlyTrend} accessibilityLayer>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="imported" fill="var(--color-imported)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="matched" fill="var(--color-matched)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
