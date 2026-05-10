"use client"

import {
  TrendingUp,
  TrendingDown,
  Trophy,
  Users,
  DollarSign,
  Target,
  Briefcase,
  Award,
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
import type { AEKPIs, PeriodWindow } from "@/lib/kpi/queries"

interface Props {
  kpis: AEKPIs
  period: PeriodWindow
  locale: "vi" | "en"
}

function formatCurrency(value: number, locale: "vi" | "en"): string {
  if (locale === "vi") {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(value)
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

export function AEKPIDashboard({ kpis, period, locale }: Props) {
  const periodLabel = locale === "vi" ? period.labelVi : period.label

  const chartConfig = {
    won: { label: locale === "vi" ? "Won" : "Won", color: "hsl(var(--chart-1))" },
    lost: { label: locale === "vi" ? "Lost" : "Lost", color: "hsl(var(--chart-2))" },
    revenue: { label: locale === "vi" ? "Doanh thu" : "Revenue", color: "hsl(var(--chart-3))" },
  } satisfies ChartConfig

  return (
    <div className="flex flex-col gap-6">
      {/* Top Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Win Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {locale === "vi" ? "Tỷ lệ chốt" : "Win Rate"}
            </CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.winRate}%</div>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={kpis.winRate} className="h-2" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {locale === "vi" ? "Team trung bình:" : "Team average:"} {kpis.teamAvgWinRate}%
              {kpis.winRate > kpis.teamAvgWinRate ? (
                <Badge variant="outline" className="ml-2 text-green-600 border-green-600">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {locale === "vi" ? "Trên TB" : "Above avg"}
                </Badge>
              ) : kpis.winRate < kpis.teamAvgWinRate ? (
                <Badge variant="outline" className="ml-2 text-orange-600 border-orange-600">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  {locale === "vi" ? "Dưới TB" : "Below avg"}
                </Badge>
              ) : null}
            </p>
          </CardContent>
        </Card>

        {/* Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {locale === "vi" ? "Doanh thu" : "Revenue"}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.revenueThisMonth, locale)}</div>
            <div className="flex items-center gap-1 mt-1">
              {kpis.revenueGrowth > 0 ? (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +{kpis.revenueGrowth}%
                </Badge>
              ) : kpis.revenueGrowth < 0 ? (
                <Badge variant="outline" className="text-red-600 border-red-600">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  {kpis.revenueGrowth}%
                </Badge>
              ) : (
                <Badge variant="outline">0%</Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {locale === "vi" ? "so với tháng trước" : "vs last month"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {locale === "vi" ? "Tháng trước:" : "Last month:"}{" "}
              {formatCurrency(kpis.revenueLastMonth, locale)}
            </p>
          </CardContent>
        </Card>

        {/* Deals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {locale === "vi" ? "Deals" : "Deals"}
            </CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-green-600">{kpis.dealsWon}</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-lg text-red-500">{kpis.dealsLost}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {locale === "vi" ? "Won / Lost trong" : "Won / Lost in"} {periodLabel}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {locale === "vi" ? "Đang xử lý:" : "In progress:"}{" "}
              <span className="font-medium">{kpis.dealsInProgress}</span>
            </p>
          </CardContent>
        </Card>

        {/* Ranking */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {locale === "vi" ? "Xếp hạng" : "Ranking"}
            </CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold">#{kpis.rankInTeam}</span>
              <span className="text-muted-foreground text-sm">/ {kpis.totalAEs}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {locale === "vi" ? "trong team AE theo doanh thu" : "in AE team by revenue"}
            </p>
            {kpis.rankInTeam === 1 && (
              <Badge className="mt-2 bg-yellow-500 hover:bg-yellow-600">
                <Award className="h-3 w-3 mr-1" />
                {locale === "vi" ? "Top 1" : "Top Performer"}
              </Badge>
            )}
            {kpis.rankInTeam === 2 && (
              <Badge className="mt-2 bg-gray-400 hover:bg-gray-500">
                <Award className="h-3 w-3 mr-1" />
                {locale === "vi" ? "Top 2" : "Runner Up"}
              </Badge>
            )}
            {kpis.rankInTeam === 3 && (
              <Badge className="mt-2 bg-amber-700 hover:bg-amber-800">
                <Award className="h-3 w-3 mr-1" />
                {locale === "vi" ? "Top 3" : "Third Place"}
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Second Row - Commission & Clients */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Commission */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {locale === "vi" ? "Hoa hồng" : "Commission"}
            </CardTitle>
            <CardDescription>
              {locale === "vi" ? "Đã nhận và đang chờ" : "Earned and pending"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-sm">{locale === "vi" ? "Đã nhận" : "Earned"}</span>
                </div>
                <span className="font-semibold">{formatCurrency(kpis.commissionEarned, locale)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-yellow-500" />
                  <span className="text-sm">{locale === "vi" ? "Đang chờ" : "Pending"}</span>
                </div>
                <span className="font-semibold">{formatCurrency(kpis.commissionPending, locale)}</span>
              </div>
              <div className="border-t pt-4 flex items-center justify-between">
                <span className="text-sm font-medium">{locale === "vi" ? "Tổng" : "Total"}</span>
                <span className="font-bold text-lg">
                  {formatCurrency(kpis.commissionEarned + kpis.commissionPending, locale)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Clients */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {locale === "vi" ? "Khách hàng" : "Clients"}
            </CardTitle>
            <CardDescription>
              {locale === "vi" ? "Đang quản lý" : "Under management"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-8">
              <div className="flex flex-col items-center">
                <Users className="h-8 w-8 text-primary mb-2" />
                <span className="text-3xl font-bold">{kpis.totalClients}</span>
                <span className="text-xs text-muted-foreground">
                  {locale === "vi" ? "Tổng" : "Total"}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">{locale === "vi" ? "Đang hoạt động" : "Active"}</span>
                  <span className="font-semibold">{kpis.activeClients}</span>
                </div>
                <Progress
                  value={kpis.totalClients > 0 ? (kpis.activeClients / kpis.totalClients) * 100 : 0}
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {locale === "vi"
                    ? "Khách hàng có deal đang xử lý"
                    : "Clients with deals in progress"}
                </p>
              </div>
            </div>
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
            {locale === "vi" ? "Deals won/lost theo tháng" : "Monthly won/lost deals"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <BarChart data={kpis.monthlyTrend} accessibilityLayer>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="won" fill="var(--color-won)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="lost" fill="var(--color-lost)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
