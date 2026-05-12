"use client"

import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Target,
  DollarSign,
  Users,
  Briefcase,
  ArrowUpRight,
  ArrowDownRight,
  Medal,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import type { AEKPIs, PeriodWindow } from "@/lib/kpi/queries"

interface Props {
  kpis: AEKPIs
  period: PeriodWindow
  locale: "vi" | "en"
  userName: string
  stageData: { stage: string; label: string; count: number }[]
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

export function AEPersonalDashboard({ kpis, period, locale, userName, stageData }: Props) {
  const periodLabel = locale === "vi" ? period.labelVi : period.label
  const totalOpps = stageData.reduce((sum, s) => sum + s.count, 0)

  // Ranking badge color
  const rankBadge = kpis.rankInTeam === 1 
    ? "bg-yellow-500 text-yellow-950" 
    : kpis.rankInTeam === 2 
    ? "bg-gray-300 text-gray-700"
    : kpis.rankInTeam === 3
    ? "bg-amber-600 text-amber-50"
    : "bg-muted text-muted-foreground"

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome Banner with Ranking */}
      <Card className="bg-gradient-to-r from-primary/5 via-primary/10 to-accent/5 border-primary/20">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                {locale === "vi" ? `Xin chào, ${userName}!` : `Welcome back, ${userName}!`}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {locale === "vi" 
                  ? `Đây là tổng quan hiệu suất của bạn trong ${periodLabel}`
                  : `Here's your performance overview for ${periodLabel}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">
                  {locale === "vi" ? "Xếp hạng Team" : "Team Ranking"}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <Medal className={`h-4 w-4 ${kpis.rankInTeam <= 3 ? "text-yellow-500" : "text-muted-foreground"}`} />
                  <span className="text-lg font-bold">
                    #{kpis.rankInTeam}
                    <span className="text-sm font-normal text-muted-foreground">/{kpis.totalAEs}</span>
                  </span>
                </div>
              </div>
              <div className={`flex items-center justify-center w-12 h-12 rounded-full ${rankBadge}`}>
                <Trophy className="h-6 w-6" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Stats - 4 columns */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Win Rate vs Team */}
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {locale === "vi" ? "Tỷ lệ chốt" : "Win Rate"}
            </CardTitle>
            <Target className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.winRate}%</div>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={kpis.winRate} className="h-1.5 flex-1" />
            </div>
            <div className="flex items-center gap-1 mt-2">
              {kpis.winRate >= kpis.teamAvgWinRate ? (
                <>
                  <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                  <span className="text-xs text-emerald-500">
                    +{(kpis.winRate - kpis.teamAvgWinRate).toFixed(0)}%
                  </span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="h-3 w-3 text-red-500" />
                  <span className="text-xs text-red-500">
                    {(kpis.winRate - kpis.teamAvgWinRate).toFixed(0)}%
                  </span>
                </>
              )}
              <span className="text-xs text-muted-foreground">
                {locale === "vi" ? `vs team avg ${kpis.teamAvgWinRate}%` : `vs team avg ${kpis.teamAvgWinRate}%`}
              </span>
            </div>
          </CardContent>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500/20 to-blue-500/60" />
        </Card>

        {/* Revenue This Month */}
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {locale === "vi" ? "Doanh thu tháng" : "Monthly Revenue"}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCompact(kpis.revenueThisMonth)}</div>
            <div className="flex items-center gap-1 mt-1">
              {kpis.revenueGrowth >= 0 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                  <span className="text-xs text-emerald-500">+{kpis.revenueGrowth}%</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-3 w-3 text-red-500" />
                  <span className="text-xs text-red-500">{kpis.revenueGrowth}%</span>
                </>
              )}
              <span className="text-xs text-muted-foreground">
                {locale === "vi" ? "vs tháng trước" : "vs last month"}
              </span>
            </div>
          </CardContent>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500/20 to-emerald-500/60" />
        </Card>

        {/* Commission */}
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {locale === "vi" ? "Hoa hồng" : "Commission"}
            </CardTitle>
            <Trophy className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatCompact(kpis.commissionEarned)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {locale === "vi" ? "Đã nhận" : "Earned"}
            </p>
            {kpis.commissionPending > 0 && (
              <Badge variant="outline" className="mt-2 text-amber-600 border-amber-500/50">
                +{formatCompact(kpis.commissionPending)} {locale === "vi" ? "chờ" : "pending"}
              </Badge>
            )}
          </CardContent>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500/20 to-amber-500/60" />
        </Card>

        {/* Clients */}
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {locale === "vi" ? "Khách hàng" : "Clients"}
            </CardTitle>
            <Users className="h-4 w-4 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.totalClients}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-violet-500 font-medium">{kpis.activeClients}</span>
              {" "}{locale === "vi" ? "đang có deal" : "with active deals"}
            </p>
          </CardContent>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500/20 to-violet-500/60" />
        </Card>
      </div>

      {/* Middle Section - Deals + Pipeline */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Deals Breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-primary" />
              {locale === "vi" ? "Deals của bạn" : "Your Deals"}
            </CardTitle>
            <CardDescription>{periodLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-emerald-500/10">
                <p className="text-3xl font-bold text-emerald-600">{kpis.dealsWon}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {locale === "vi" ? "Thắng" : "Won"}
                </p>
              </div>
              <div className="text-center p-4 rounded-lg bg-amber-500/10">
                <p className="text-3xl font-bold text-amber-600">{kpis.dealsInProgress}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {locale === "vi" ? "Đang xử lý" : "In Progress"}
                </p>
              </div>
              <div className="text-center p-4 rounded-lg bg-red-500/10">
                <p className="text-3xl font-bold text-red-500">{kpis.dealsLost}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {locale === "vi" ? "Mất" : "Lost"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Your Pipeline */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {locale === "vi" ? "Pipeline của bạn" : "Your Pipeline"}
            </CardTitle>
            <CardDescription>
              {totalOpps} {locale === "vi" ? "cơ hội đang hoạt động" : "active opportunities"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stageData
                .filter(s => s.count > 0 || ["new", "contacted", "negotiation", "won", "lost"].includes(s.stage))
                .slice(0, 6)
                .map(({ stage, label, count }) => (
                <div key={stage} className="flex items-center gap-2">
                  <span className="w-20 text-xs text-muted-foreground truncate">{label}</span>
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        stage === "won" ? "bg-emerald-500" :
                        stage === "lost" ? "bg-red-400" : "bg-primary"
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

      {/* Monthly Trend Chart (simplified visual) */}
      {kpis.monthlyTrend.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              {locale === "vi" ? "Xu hướng 6 tháng" : "6-Month Trend"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-32">
              {kpis.monthlyTrend.slice(-6).map((m, i) => {
                const maxRevenue = Math.max(...kpis.monthlyTrend.map(t => t.revenue), 1)
                const height = (m.revenue / maxRevenue) * 100
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col items-center justify-end flex-1">
                      <div
                        className="w-full bg-primary/80 rounded-t transition-all hover:bg-primary"
                        style={{ height: `${Math.max(height, 5)}%` }}
                        title={formatCurrency(m.revenue, locale)}
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground">{m.month}</p>
                      <p className="text-xs font-medium">{m.won}W/{m.lost}L</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
