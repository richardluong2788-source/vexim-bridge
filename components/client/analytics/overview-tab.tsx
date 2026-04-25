/**
 * Overview tab — top-level KPIs + 12-month trend + 5-phase snapshot.
 *
 * Server component so the heavy aggregation runs on the edge and only
 * digestible numbers reach the browser. The chart and phase funnel are
 * client components delegated to via props.
 */
import {
  Briefcase,
  Trophy,
  XCircle,
  TrendingUp,
  Clock,
  HandCoins,
  BarChart3,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  getClientOverviewKpis,
  getClientMonthlyTrend,
  getClientPhaseDistribution,
} from "@/lib/analytics/client-queries"
import type { PeriodWindow } from "@/lib/analytics/constants"
import { getDictionary } from "@/lib/i18n/server"
import { ClientMonthlyTrendChart } from "./monthly-trend-chart"
import { ClientPhaseFunnel } from "./phase-funnel"

interface Props {
  period: PeriodWindow
}

export async function ClientOverviewTab({ period }: Props) {
  const { t, locale } = await getDictionary()
  const a = t.client.analytics

  const [kpis, monthly, phases] = await Promise.all([
    getClientOverviewKpis(period),
    getClientMonthlyTrend(12, locale),
    getClientPhaseDistribution(),
  ])

  const usd = (n: number) =>
    n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    })
  const fmtDays = (n: number | null) => {
    if (n === null) return a.kpis.avgCycleNoData
    if (n === 0) return a.kpis.daysZero
    return a.kpis.daysSuffix.replace("{n}", String(n))
  }

  // Tone classes — keep "good" green, "bad" rose, neutral foreground. We
  // reuse the same palette as the admin overview tab for visual consistency.
  const cards = [
    {
      label: a.kpis.newOpps,
      value: kpis.newOpportunities.toString(),
      hint: a.kpis.newOppsHint.replace("{period}", period.label.toLowerCase()),
      icon: Briefcase,
      tone: "neutral",
    },
    {
      label: a.kpis.won,
      value: kpis.wonInPeriod.toString(),
      hint:
        kpis.wonInPeriod + kpis.lostInPeriod > 0
          ? a.kpis.wonHint.replace("{rate}", String(kpis.winRate))
          : a.kpis.lostHintNoData,
      icon: Trophy,
      tone: "positive",
    },
    {
      label: a.kpis.lost,
      value: kpis.lostInPeriod.toString(),
      hint:
        kpis.wonInPeriod + kpis.lostInPeriod > 0
          ? a.kpis.lostHint.replace("{rate}", String(100 - kpis.winRate))
          : a.kpis.lostHintNoData,
      icon: XCircle,
      tone: "warning",
    },
    {
      label: a.kpis.inProgress,
      value: kpis.inProgress.toString(),
      hint: a.kpis.inProgressHint.replace("{value}", usd(kpis.inProgressValue)),
      icon: TrendingUp,
      tone: "neutral",
    },
    {
      label: a.kpis.avgCycle,
      value: fmtDays(kpis.avgWinCycleDays),
      hint:
        kpis.avgWinCycleDays === null
          ? a.kpis.avgCycleEmpty
          : a.kpis.avgCycleHint,
      icon: Clock,
      tone: "neutral",
    },
    {
      label: a.kpis.commissionPaid,
      value: usd(kpis.commissionPaidInPeriod),
      hint: a.kpis.commissionPaidHint.replace(
        "{n}",
        String(kpis.paidDealsCount),
      ),
      icon: HandCoins,
      tone: "positive",
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* KPI grid: 2 cols mobile, 3 tablet, 6 desktop */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {cards.map((c) => {
          const Icon = c.icon
          const toneCls =
            c.tone === "positive"
              ? "text-emerald-600 dark:text-emerald-400"
              : c.tone === "warning"
                ? "text-rose-600 dark:text-rose-400"
                : "text-foreground"
          return (
            <Card key={c.label} className="border-border">
              <CardContent className="p-4 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {c.label}
                  </span>
                  <Icon className={`h-4 w-4 ${toneCls}`} />
                </div>
                <div
                  className={`text-2xl font-semibold tabular-nums ${toneCls}`}
                >
                  {c.value}
                </div>
                <div className="text-xs text-muted-foreground line-clamp-2">
                  {c.hint}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 12-month trend */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            {a.trend.title}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{a.trend.subtitle}</p>
        </CardHeader>
        <CardContent>
          <ClientMonthlyTrendChart data={monthly} />
        </CardContent>
      </Card>

      {/* Phase distribution */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            {a.pipeline.distributionTitle}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {a.pipeline.distributionDesc}
          </p>
        </CardHeader>
        <CardContent>
          <ClientPhaseFunnel data={phases} />
        </CardContent>
      </Card>
    </div>
  )
}
