"use client"

import {
  Target,
  TrendingUp,
  TrendingDown,
  Users,
  Globe,
  Building,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import type { LRKPIs, PeriodWindow } from "@/lib/kpi/queries"

interface Props {
  kpis: LRKPIs
  period: PeriodWindow
  locale: "vi" | "en"
  userName: string
}

export function LRPersonalDashboard({ kpis, period, locale, userName }: Props) {
  const periodLabel = locale === "vi" ? period.labelVi : period.label

  // Progress bar color based on target progress
  const progressColor = kpis.targetMet 
    ? "bg-emerald-500" 
    : kpis.targetProgressPct >= 75 
    ? "bg-amber-500" 
    : kpis.targetProgressPct >= 50 
    ? "bg-blue-500" 
    : "bg-red-500"

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome Banner with Target Progress */}
      <Card className={`relative overflow-hidden border-2 ${
        kpis.targetMet 
          ? "bg-gradient-to-r from-emerald-500/5 via-emerald-500/10 to-emerald-500/5 border-emerald-500/30" 
          : "bg-gradient-to-r from-primary/5 via-primary/10 to-accent/5 border-primary/20"
      }`}>
        <CardContent className="py-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">
                  {locale === "vi" ? `Xin chào, ${userName}!` : `Welcome back, ${userName}!`}
                </h2>
                {kpis.targetMet && (
                  <Badge className="bg-emerald-500 text-white">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {locale === "vi" ? "Đạt Target!" : "Target Met!"}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {locale === "vi" 
                  ? `Tiến độ import buyers trong ${periodLabel}`
                  : `Buyer import progress for ${periodLabel}`}
              </p>
              
              {/* Target Progress Bar */}
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">
                    {kpis.buyersImportedThisMonth} / {kpis.monthlyTarget} buyers
                  </span>
                  <span className={`font-bold ${kpis.targetMet ? "text-emerald-600" : ""}`}>
                    {Math.min(kpis.targetProgressPct, 999)}%
                  </span>
                </div>
                <div className="relative">
                  <Progress 
                    value={Math.min(kpis.targetProgressPct, 100)} 
                    className="h-3"
                  />
                  {/* Target line marker */}
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-foreground/50" 
                    style={{ left: "100%" }}
                  />
                </div>
                {!kpis.targetMet && (
                  <p className="text-xs text-muted-foreground">
                    {locale === "vi" 
                      ? `Còn ${kpis.targetRemaining} buyers để đạt target`
                      : `${kpis.targetRemaining} more buyers to reach target`}
                  </p>
                )}
              </div>
            </div>

            {/* Big Number */}
            <div className="text-center lg:text-right">
              <div className={`text-5xl font-bold ${kpis.targetMet ? "text-emerald-600" : "text-primary"}`}>
                {kpis.buyersImportedThisMonth}
              </div>
              <p className="text-sm text-muted-foreground">
                {locale === "vi" ? "buyers tháng này" : "buyers this month"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Imports This Month */}
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {locale === "vi" ? "Import tháng này" : "This Month"}
            </CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.buyersImportedThisMonth}</div>
            <div className="flex items-center gap-1 mt-1">
              {kpis.buyersGrowth >= 0 ? (
                <>
                  <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                  <span className="text-xs text-emerald-500">+{kpis.buyersGrowth}%</span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="h-3 w-3 text-red-500" />
                  <span className="text-xs text-red-500">{kpis.buyersGrowth}%</span>
                </>
              )}
              <span className="text-xs text-muted-foreground">
                {locale === "vi" ? "vs tháng trước" : "vs last month"}
              </span>
            </div>
          </CardContent>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500/20 to-blue-500/60" />
        </Card>

        {/* Last Month */}
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {locale === "vi" ? "Tháng trước" : "Last Month"}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.buyersImportedLastMonth}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {locale === "vi" ? "buyers đã import" : "buyers imported"}
            </p>
          </CardContent>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-gray-400/20 to-gray-400/40" />
        </Card>

        {/* Target Status */}
        <Card className={`relative overflow-hidden ${kpis.targetMet ? "border-emerald-500/50" : ""}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {locale === "vi" ? "Target" : "Monthly Target"}
            </CardTitle>
            <Target className={`h-4 w-4 ${kpis.targetMet ? "text-emerald-500" : "text-amber-500"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.monthlyTarget}</div>
            <div className="flex items-center gap-1 mt-1">
              {kpis.targetMet ? (
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 text-xs">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {locale === "vi" ? "Đã đạt" : "Achieved"}
                </Badge>
              ) : (
                <span className="text-xs text-amber-600">
                  {kpis.targetRemaining} {locale === "vi" ? "còn thiếu" : "remaining"}
                </span>
              )}
            </div>
          </CardContent>
          <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${
            kpis.targetMet 
              ? "from-emerald-500/20 to-emerald-500/60" 
              : "from-amber-500/20 to-amber-500/60"
          }`} />
        </Card>

        {/* Efficiency */}
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {locale === "vi" ? "Tiến độ" : "Progress Rate"}
            </CardTitle>
            <Zap className="h-4 w-4 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              kpis.targetProgressPct >= 100 ? "text-emerald-600" :
              kpis.targetProgressPct >= 75 ? "text-amber-600" : ""
            }`}>
              {Math.min(kpis.targetProgressPct, 999)}%
            </div>
            <Progress value={Math.min(kpis.targetProgressPct, 100)} className="h-1.5 mt-2" />
          </CardContent>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500/20 to-violet-500/60" />
        </Card>
      </div>

      {/* Bottom Section - Countries + Industries */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Countries */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-500" />
              {locale === "vi" ? "Top Quốc gia" : "Top Countries"}
            </CardTitle>
            <CardDescription>
              {locale === "vi" ? "Phân bố buyers theo quốc gia" : "Buyer distribution by country"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {kpis.topCountries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {locale === "vi" ? "Chưa có dữ liệu" : "No data yet"}
              </p>
            ) : (
              <div className="space-y-3">
                {kpis.topCountries.map((item, i) => {
                  const maxCount = kpis.topCountries[0]?.count ?? 1
                  const pct = (item.count / maxCount) * 100
                  return (
                    <div key={item.country} className="flex items-center gap-3">
                      <span className="w-6 text-xs text-muted-foreground">{i + 1}.</span>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium">{item.country}</span>
                          <span className="text-sm">{item.count}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Industries */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building className="h-4 w-4 text-violet-500" />
              {locale === "vi" ? "Top Ngành hàng" : "Top Industries"}
            </CardTitle>
            <CardDescription>
              {locale === "vi" ? "Phân bố buyers theo ngành" : "Buyer distribution by industry"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {kpis.topIndustries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {locale === "vi" ? "Chưa có dữ liệu" : "No data yet"}
              </p>
            ) : (
              <div className="space-y-3">
                {kpis.topIndustries.map((item, i) => {
                  const maxCount = kpis.topIndustries[0]?.count ?? 1
                  const pct = (item.count / maxCount) * 100
                  return (
                    <div key={item.industry} className="flex items-center gap-3">
                      <span className="w-6 text-xs text-muted-foreground">{i + 1}.</span>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium truncate">{item.industry}</span>
                          <span className="text-sm">{item.count}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-violet-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend Chart */}
      {kpis.monthlyTrend.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              {locale === "vi" ? "Xu hướng Import" : "Import Trend"}
            </CardTitle>
            <CardDescription>
              {locale === "vi" ? "6 tháng gần nhất" : "Last 6 months"} • 
              <span className="text-amber-600 ml-1">
                Target: {kpis.monthlyTarget}/tháng
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {/* Target line */}
              <div 
                className="absolute left-0 right-0 border-t-2 border-dashed border-amber-500/50"
                style={{ 
                  bottom: `${Math.min((kpis.monthlyTarget / Math.max(...kpis.monthlyTrend.map(t => t.imported), kpis.monthlyTarget)) * 100, 100)}%` 
                }}
              />
              <div className="flex items-end gap-2 h-32">
                {kpis.monthlyTrend.slice(-6).map((m) => {
                  const maxImported = Math.max(...kpis.monthlyTrend.map(t => t.imported), kpis.monthlyTarget)
                  const height = (m.imported / maxImported) * 100
                  const metTarget = m.imported >= kpis.monthlyTarget
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex flex-col items-center justify-end flex-1">
                        <div
                          className={`w-full rounded-t transition-all hover:opacity-80 ${
                            metTarget ? "bg-emerald-500" : "bg-primary/80"
                          }`}
                          style={{ height: `${Math.max(height, 5)}%` }}
                          title={`${m.imported} buyers`}
                        />
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground">{m.month}</p>
                        <p className={`text-xs font-medium ${metTarget ? "text-emerald-600" : ""}`}>
                          {m.imported}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
