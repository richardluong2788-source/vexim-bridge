/**
 * Financial tab — commission KPIs + cumulative timeline + per-month bar
 * chart + top-won-deals leaderboard. Reuses the existing client commission
 * timeline component for the cumulative view; adds a monthly bar chart for
 * paid-month granularity.
 */
import { HandCoins, Trophy, BarChart3 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { getClientFinancials } from "@/lib/analytics/client-queries"
import { getDictionary } from "@/lib/i18n/server"
import { ClientCommissionTimeline } from "@/components/client/client-commission-timeline"
import { CommissionMonthlyBars } from "./commission-monthly-bars"

export async function ClientFinancialTab() {
  const { t, locale } = await getDictionary()
  const a = t.client.analytics
  const dateLocale = locale === "vi" ? "vi-VN" : "en-US"

  const fin = await getClientFinancials(locale)

  const usd = (n: number) =>
    n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    })

  if (fin.paidDealsCount === 0) {
    return (
      <Card className="border-border p-10">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{a.financial.emptyTitle}</EmptyTitle>
            <EmptyDescription>{a.financial.empty}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* KPI strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-border">
          <CardContent className="p-4 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {a.financial.totalPaid}
              </span>
              <HandCoins className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-2xl font-semibold tabular-nums text-foreground">
              {usd(fin.totalCommissionPaid)}
            </div>
            <div className="text-xs text-muted-foreground">
              {a.financial.totalPaidHint.replace(
                "{n}",
                String(fin.paidDealsCount),
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {a.financial.avgCommission}
              </span>
              <Trophy className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-2xl font-semibold tabular-nums text-foreground">
              {fin.averageCommissionPerDeal !== null
                ? usd(fin.averageCommissionPerDeal)
                : "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              {a.financial.avgCommissionHint}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {a.financial.paidDeals}
              </span>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-semibold tabular-nums text-foreground">
              {fin.paidDealsCount}
            </div>
            <div className="text-xs text-muted-foreground">
              {a.financial.paidDealsHint}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-month bar chart */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            {a.financial.monthlyTitle}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {a.financial.monthlyDesc}
          </p>
        </CardHeader>
        <CardContent>
          <CommissionMonthlyBars data={fin.byMonth} />
        </CardContent>
      </Card>

      {/* Cumulative timeline (reuses dashboard chart) */}
      <ClientCommissionTimeline points={fin.cumulative} locale={dateLocale} />

      {/* Top won deals */}
      {fin.topWonDeals.length > 0 && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              {a.financial.topDealsTitle}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {a.financial.topDealsDesc}
            </p>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="text-left font-medium pb-2">
                    {a.financial.cols.buyer}
                  </th>
                  <th className="text-left font-medium pb-2">
                    {a.financial.cols.industry}
                  </th>
                  <th className="text-right font-medium pb-2">
                    {a.financial.cols.value}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {fin.topWonDeals.map((d) => (
                  <tr key={d.opportunityId}>
                    <td className="py-2 truncate max-w-[240px] font-medium text-foreground">
                      {d.buyerLabel}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {d.industry ?? "—"}
                    </td>
                    <td className="py-2 text-right tabular-nums text-foreground">
                      {d.potentialValue !== null
                        ? usd(Number(d.potentialValue))
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
