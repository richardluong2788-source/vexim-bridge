"use client"

import {
  Users,
  DollarSign,
  Trophy,
  Target,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { TeamKPIs, PeriodWindow } from "@/lib/kpi/queries"

interface Props {
  kpis: TeamKPIs
  period: PeriodWindow
  locale: "vi" | "en"
  stageData: { stage: string; label: string; count: number }[]
  stuckDeals?: { id: string; buyer: string; stage: string; daysStuck: number }[]
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

function formatCompact(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return value.toString()
}

export function AdminOverviewDashboard({ kpis, period, locale, stageData, stuckDeals = [] }: Props) {
  const periodLabel = locale === "vi" ? period.labelVi : period.label
  const totalOpps = stageData.reduce((sum, s) => sum + s.count, 0)

  // Calculate growth (mock for now - can be enhanced with real data)
  const revenueGrowth = kpis.totalRevenue > 0 ? 12.5 : 0

  return (
    <div className="flex flex-col gap-6">
      {/* Header Stats - 4 columns */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue */}
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {locale === "vi" ? "Tổng doanh thu" : "Total Revenue"}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.totalRevenue, locale)}</div>
            <div className="flex items-center gap-1 mt-1">
              {revenueGrowth >= 0 ? (
                <>
                  <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                  <span className="text-xs text-emerald-500">+{revenueGrowth}%</span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="h-3 w-3 text-red-500" />
                  <span className="text-xs text-red-500">{revenueGrowth}%</span>
                </>
              )}
              <span className="text-xs text-muted-foreground ml-1">
                {locale === "vi" ? "so với tháng trước" : "vs last month"}
              </span>
            </div>
          </CardContent>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500/20 to-emerald-500/60" />
        </Card>

        {/* Win Rate */}
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {locale === "vi" ? "Tỷ lệ thắng" : "Win Rate"}
            </CardTitle>
            <Target className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.overallWinRate}%</div>
            <Progress value={kpis.overallWinRate} className="h-1.5 mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              <span className="text-emerald-500 font-medium">{kpis.totalDealsWon}</span> won / 
              <span className="text-red-500 font-medium ml-1">{kpis.totalDealsLost}</span> lost
            </p>
          </CardContent>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500/20 to-blue-500/60" />
        </Card>

        {/* Team Size */}
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {locale === "vi" ? "Nhân sự" : "Team"}
            </CardTitle>
            <Users className="h-4 w-4 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-3">
              <div>
                <span className="text-2xl font-bold">{kpis.totalAEs}</span>
                <span className="text-xs text-muted-foreground ml-1">AE</span>
              </div>
              <div>
                <span className="text-2xl font-bold">{kpis.totalLRs}</span>
                <span className="text-xs text-muted-foreground ml-1">LR</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {kpis.totalClients} clients • {kpis.totalBuyers} buyers
            </p>
          </CardContent>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500/20 to-violet-500/60" />
        </Card>

        {/* Pipeline */}
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {locale === "vi" ? "Pipeline" : "Pipeline"}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOpps}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {locale === "vi" ? "cơ hội đang hoạt động" : "active opportunities"}
            </p>
            <div className="flex gap-1 mt-2">
              {stageData.slice(0, 5).map((s, i) => (
                <div
                  key={s.stage}
                  className="h-1.5 rounded-full bg-accent"
                  style={{
                    width: totalOpps > 0 ? `${Math.max((s.count / totalOpps) * 100, 5)}%` : "20%",
                    opacity: 0.3 + (i * 0.15),
                  }}
                />
              ))}
            </div>
          </CardContent>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500/20 to-amber-500/60" />
        </Card>
      </div>

      {/* Middle Section - Leaderboard + Pipeline Distribution */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Top AEs Leaderboard */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              {locale === "vi" ? "Top AE" : "Top AEs"}
            </CardTitle>
            <CardDescription>
              {locale === "vi" ? "Theo doanh thu" : "By revenue"} • {periodLabel}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {kpis.topAEs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {locale === "vi" ? "Chưa có dữ liệu" : "No data yet"}
              </p>
            ) : (
              <div className="space-y-3">
                {kpis.topAEs.slice(0, 5).map((ae, i) => (
                  <div key={ae.id} className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                      ${i === 0 ? "bg-yellow-500 text-yellow-950" : 
                        i === 1 ? "bg-gray-300 text-gray-700" :
                        i === 2 ? "bg-amber-600 text-amber-50" : "bg-muted text-muted-foreground"}`}>
                      {i + 1}
                    </div>
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {ae.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ae.name}</p>
                      <p className="text-xs text-muted-foreground">{ae.deals} deals</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCompact(ae.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pipeline Distribution */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {locale === "vi" ? "Phân bố Pipeline" : "Pipeline Distribution"}
            </CardTitle>
            <CardDescription>
              {locale === "vi" ? "Cơ hội theo giai đoạn" : "Opportunities by stage"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {stageData.map(({ stage, label, count }) => (
                <div key={stage} className="flex items-center gap-2">
                  <span className="w-20 text-xs text-muted-foreground truncate">{label}</span>
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        stage === "won" ? "bg-emerald-500" :
                        stage === "lost" ? "bg-red-400" : "bg-accent"
                      }`}
                      style={{ width: totalOpps > 0 ? `${(count / totalOpps) * 100}%` : "0%" }}
                    />
                  </div>
                  <span className="w-6 text-right text-xs font-medium">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section - Stuck Deals Alert + Top LRs */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Stuck Deals Alert */}
        <Card className={stuckDeals.length > 0 ? "border-amber-500/50" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${stuckDeals.length > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
              {locale === "vi" ? "Deals cần chú ý" : "Deals Need Attention"}
            </CardTitle>
            <CardDescription>
              {locale === "vi" ? "Không có chuyển động > 7 ngày" : "No movement > 7 days"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stuckDeals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="rounded-full bg-emerald-500/10 p-3 mb-2">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {locale === "vi" ? "Tất cả deals đang hoạt động tốt!" : "All deals moving smoothly!"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {stuckDeals.slice(0, 4).map((deal) => (
                  <div key={deal.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">{deal.buyer}</p>
                      <p className="text-xs text-muted-foreground">{deal.stage}</p>
                    </div>
                    <Badge variant="outline" className="text-amber-600 border-amber-500/50">
                      {deal.daysStuck} {locale === "vi" ? "ngày" : "days"}
                    </Badge>
                  </div>
                ))}
                {stuckDeals.length > 4 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{stuckDeals.length - 4} {locale === "vi" ? "deals khác" : "more deals"}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top LRs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-blue-500" />
              {locale === "vi" ? "Top Lead Researchers" : "Top Lead Researchers"}
            </CardTitle>
            <CardDescription>
              {locale === "vi" ? "Theo buyers imported" : "By buyers imported"} • {periodLabel}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {kpis.topLRs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {locale === "vi" ? "Chưa có dữ liệu" : "No data yet"}
              </p>
            ) : (
              <div className="space-y-3">
                {kpis.topLRs.slice(0, 5).map((lr, i) => (
                  <div key={lr.id} className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                      ${i === 0 ? "bg-blue-500 text-blue-50" : 
                        i === 1 ? "bg-gray-300 text-gray-700" :
                        i === 2 ? "bg-sky-600 text-sky-50" : "bg-muted text-muted-foreground"}`}>
                      {i + 1}
                    </div>
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-xs bg-blue-500/10 text-blue-600">
                        {lr.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{lr.name}</p>
                      <p className="text-xs text-muted-foreground">{lr.matched} matched</p>
                    </div>
                    <Badge variant="secondary">{lr.imported}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
