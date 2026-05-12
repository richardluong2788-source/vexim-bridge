"use client"

import {
  DollarSign,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  ArrowUpRight,
  Trophy,
  Users,
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

export function FinanceDashboard({ kpis, period, locale }: Props) {
  const periodLabel = locale === "vi" ? period.labelVi : period.label

  // Calculate totals
  const totalInvoices = kpis.invoicesPending + kpis.invoicesOverdue + kpis.invoicesPaid
  const collectionRate = totalInvoices > 0 
    ? Math.round((kpis.invoicesPaid / totalInvoices) * 100) 
    : 0

  return (
    <div className="flex flex-col gap-6">
      {/* Top Stats - Revenue & Invoices */}
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
            <p className="text-xs text-muted-foreground mt-1">
              {locale === "vi" ? "Trong" : "In"} {periodLabel}
            </p>
          </CardContent>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500/20 to-emerald-500/60" />
        </Card>

        {/* Pending Invoices */}
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {locale === "vi" ? "Chờ thanh toán" : "Pending"}
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{kpis.invoicesPending}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(kpis.totalPendingAmount, locale)}
            </p>
          </CardContent>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500/20 to-amber-500/60" />
        </Card>

        {/* Overdue */}
        <Card className={`relative overflow-hidden ${kpis.invoicesOverdue > 0 ? "border-red-500/50" : ""}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {locale === "vi" ? "Quá hạn" : "Overdue"}
            </CardTitle>
            <AlertTriangle className={`h-4 w-4 ${kpis.invoicesOverdue > 0 ? "text-red-500" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${kpis.invoicesOverdue > 0 ? "text-red-600" : ""}`}>
              {kpis.invoicesOverdue}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {locale === "vi" ? "cần theo dõi" : "need attention"}
            </p>
          </CardContent>
          <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${
            kpis.invoicesOverdue > 0 
              ? "from-red-500/20 to-red-500/60" 
              : "from-gray-300/20 to-gray-300/40"
          }`} />
        </Card>

        {/* Paid */}
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {locale === "vi" ? "Đã thanh toán" : "Paid"}
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{kpis.invoicesPaid}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {locale === "vi" ? "trong kỳ" : "in period"}
            </p>
          </CardContent>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500/20 to-emerald-500/60" />
        </Card>
      </div>

      {/* Invoice Summary Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            {locale === "vi" ? "Tổng quan Hóa đơn" : "Invoice Overview"}
          </CardTitle>
          <CardDescription>{periodLabel}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Invoice Status Distribution */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">
                {locale === "vi" ? "Phân bố trạng thái" : "Status Distribution"}
              </h4>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="flex-1 text-sm">
                    {locale === "vi" ? "Chờ thanh toán" : "Pending"}
                  </span>
                  <span className="text-sm font-medium">{kpis.invoicesPending}</span>
                  <span className="text-xs text-muted-foreground w-12 text-right">
                    {totalInvoices > 0 ? Math.round((kpis.invoicesPending / totalInvoices) * 100) : 0}%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="flex-1 text-sm">
                    {locale === "vi" ? "Quá hạn" : "Overdue"}
                  </span>
                  <span className="text-sm font-medium">{kpis.invoicesOverdue}</span>
                  <span className="text-xs text-muted-foreground w-12 text-right">
                    {totalInvoices > 0 ? Math.round((kpis.invoicesOverdue / totalInvoices) * 100) : 0}%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="flex-1 text-sm">
                    {locale === "vi" ? "Đã thanh toán" : "Paid"}
                  </span>
                  <span className="text-sm font-medium">{kpis.invoicesPaid}</span>
                  <span className="text-xs text-muted-foreground w-12 text-right">
                    {totalInvoices > 0 ? Math.round((kpis.invoicesPaid / totalInvoices) * 100) : 0}%
                  </span>
                </div>
              </div>

              {/* Visual bar */}
              <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                <div 
                  className="bg-amber-500 transition-all"
                  style={{ width: `${totalInvoices > 0 ? (kpis.invoicesPending / totalInvoices) * 100 : 0}%` }}
                />
                <div 
                  className="bg-red-500 transition-all"
                  style={{ width: `${totalInvoices > 0 ? (kpis.invoicesOverdue / totalInvoices) * 100 : 0}%` }}
                />
                <div 
                  className="bg-emerald-500 transition-all"
                  style={{ width: `${totalInvoices > 0 ? (kpis.invoicesPaid / totalInvoices) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Collection Rate */}
            <div className="flex flex-col items-center justify-center p-6 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground mb-2">
                {locale === "vi" ? "Tỷ lệ thu hồi" : "Collection Rate"}
              </p>
              <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="12"
                    className="text-muted"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="12"
                    strokeDasharray={`${collectionRate * 3.52} 352`}
                    className="text-emerald-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold">{collectionRate}%</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {kpis.invoicesPaid} / {totalInvoices} {locale === "vi" ? "hóa đơn" : "invoices"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Section - Team Performance + Deals Overview */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top AEs by Revenue */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              {locale === "vi" ? "Top AE theo doanh thu" : "Top AEs by Revenue"}
            </CardTitle>
            <CardDescription>{periodLabel}</CardDescription>
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

        {/* Team Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-violet-500" />
              {locale === "vi" ? "Tổng quan Team" : "Team Summary"}
            </CardTitle>
            <CardDescription>{periodLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-emerald-500/10 text-center">
                <p className="text-2xl font-bold text-emerald-600">{kpis.totalDealsWon}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {locale === "vi" ? "Deals thắng" : "Deals Won"}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-red-500/10 text-center">
                <p className="text-2xl font-bold text-red-500">{kpis.totalDealsLost}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {locale === "vi" ? "Deals mất" : "Deals Lost"}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-blue-500/10 text-center">
                <p className="text-2xl font-bold text-blue-600">{kpis.overallWinRate}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {locale === "vi" ? "Tỷ lệ chốt" : "Win Rate"}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-violet-500/10 text-center">
                <p className="text-2xl font-bold text-violet-600">{kpis.totalClients}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {locale === "vi" ? "Tổng clients" : "Total Clients"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
