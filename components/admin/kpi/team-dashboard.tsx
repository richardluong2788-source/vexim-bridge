"use client"

import {
  Users,
  DollarSign,
  Trophy,
  Briefcase,
  FileText,
  AlertTriangle,
  CheckCircle,
  Target,
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
  showFinance?: boolean
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

export function TeamKPIDashboard({ kpis, period, locale, showFinance }: Props) {
  const periodLabel = locale === "vi" ? period.labelVi : period.label

  return (
    <div className="flex flex-col gap-6">
      {/* Top Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {locale === "vi" ? "Tổng doanh thu" : "Total Revenue"}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.totalRevenue, locale)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {locale === "vi" ? "Trong" : "In"} {periodLabel}
            </p>
          </CardContent>
        </Card>

        {/* Win Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {locale === "vi" ? "Tỷ lệ chốt" : "Win Rate"}
            </CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.overallWinRate}%</div>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={kpis.overallWinRate} className="h-2" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {kpis.totalDealsWon} won / {kpis.totalDealsLost} lost
            </p>
          </CardContent>
        </Card>

        {/* Team Size */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {locale === "vi" ? "Quy mô team" : "Team Size"}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-4">
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
              {kpis.totalClients} clients, {kpis.totalBuyers} buyers
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
              <span className="text-2xl font-bold text-green-600">{kpis.totalDealsWon}</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-lg text-red-500">{kpis.totalDealsLost}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {locale === "vi" ? "Won / Lost trong" : "Won / Lost in"} {periodLabel}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Finance Section (only for Finance role) */}
      {showFinance && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {locale === "vi" ? "Hóa đơn chờ" : "Pending Invoices"}
              </CardTitle>
              <FileText className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.invoicesPending}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(kpis.totalPendingAmount, locale)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {locale === "vi" ? "Quá hạn" : "Overdue"}
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{kpis.invoicesOverdue}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {locale === "vi" ? "Cần theo dõi" : "Need attention"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {locale === "vi" ? "Đã thanh toán" : "Paid"}
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{kpis.invoicesPaid}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {locale === "vi" ? "Trong kỳ" : "In period"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top Performers */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Top AEs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              {locale === "vi" ? "Top Account Executives" : "Top Account Executives"}
            </CardTitle>
            <CardDescription>
              {locale === "vi" ? "Theo doanh thu trong kỳ" : "By revenue in period"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {kpis.topAEs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {locale === "vi" ? "Chưa có dữ liệu" : "No data yet"}
              </p>
            ) : (
              <div className="space-y-4">
                {kpis.topAEs.map((ae, i) => (
                  <div key={ae.id} className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-semibold">
                      {i + 1}
                    </div>
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {ae.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ae.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ae.deals} deals
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(ae.revenue, locale)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top LRs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-blue-500" />
              {locale === "vi" ? "Top Lead Researchers" : "Top Lead Researchers"}
            </CardTitle>
            <CardDescription>
              {locale === "vi" ? "Theo số buyers imported" : "By buyers imported"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {kpis.topLRs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {locale === "vi" ? "Chưa có dữ liệu" : "No data yet"}
              </p>
            ) : (
              <div className="space-y-4">
                {kpis.topLRs.map((lr, i) => (
                  <div key={lr.id} className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-semibold">
                      {i + 1}
                    </div>
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {lr.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{lr.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {lr.matched} matched
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary">{lr.imported} imported</Badge>
                    </div>
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
