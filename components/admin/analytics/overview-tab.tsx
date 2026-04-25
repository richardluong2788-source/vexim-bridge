/**
 * Overview tab — top-level KPIs + monthly trend + current stage snapshot.
 */
import { TrendingUp, Trophy, XCircle, Briefcase, DollarSign, BarChart3 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  getOverviewKpis,
  getMonthlyTrend,
  getStageSnapshot,
  type ClientScope,
} from "@/lib/analytics/queries"
import type { PeriodWindow } from "@/lib/analytics/constants"
import { MonthlyTrendChart } from "./monthly-trend-chart"
import { StageFunnel } from "./stage-funnel"

interface Props {
  scope: ClientScope
  period: PeriodWindow
}

export async function OverviewTab({ scope, period }: Props) {
  const [kpis, monthly, snapshot] = await Promise.all([
    getOverviewKpis(scope, period),
    getMonthlyTrend(scope, 12),
    getStageSnapshot(scope),
  ])

  const usd = (n: number) =>
    n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    })

  const kpiCards = [
    {
      label: "Cơ hội mới",
      value: kpis.newOpportunities.toString(),
      hint: `Trong ${period.label.toLowerCase()}`,
      icon: Briefcase,
      tone: "neutral",
    },
    {
      label: "Chốt thành công",
      value: kpis.wonInPeriod.toString(),
      hint: `${kpis.winRate}% tỷ lệ thắng`,
      icon: Trophy,
      tone: "positive",
    },
    {
      label: "Thất bại",
      value: kpis.lostInPeriod.toString(),
      hint:
        kpis.wonInPeriod + kpis.lostInPeriod > 0
          ? `${100 - kpis.winRate}% trong số đã quyết định`
          : "Chưa có deal kết thúc",
      icon: XCircle,
      tone: "warning",
    },
    {
      label: "Đang chạy",
      value: kpis.inProgressCount.toString(),
      hint: `Giá trị tiềm năng ${usd(kpis.inProgressValue)}`,
      icon: TrendingUp,
      tone: "neutral",
    },
    {
      label: "Hoa hồng đã thu",
      value: usd(kpis.commissionEarned),
      hint: `Trong ${period.label.toLowerCase()}`,
      icon: DollarSign,
      tone: "positive",
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpiCards.map((k) => {
          const Icon = k.icon
          const toneCls =
            k.tone === "positive"
              ? "text-emerald-600 dark:text-emerald-400"
              : k.tone === "warning"
                ? "text-rose-600 dark:text-rose-400"
                : "text-foreground"
          return (
            <Card key={k.label} className="border-border">
              <CardContent className="p-4 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {k.label}
                  </span>
                  <Icon className={`h-4 w-4 ${toneCls}`} />
                </div>
                <div className={`text-2xl font-semibold tabular-nums ${toneCls}`}>
                  {k.value}
                </div>
                <div className="text-xs text-muted-foreground line-clamp-2">
                  {k.hint}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Monthly trend */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            Xu hướng 12 tháng
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Số cơ hội tạo mới (đường) so với chốt thành công / thất bại (cột)
          </p>
        </CardHeader>
        <CardContent>
          <MonthlyTrendChart data={monthly} />
        </CardContent>
      </Card>

      {/* Current stage snapshot */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Phân bố theo giai đoạn hiện tại
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Ảnh chụp pipeline hiện tại — giúp phát hiện stage đang nghẽn
          </p>
        </CardHeader>
        <CardContent>
          <StageFunnel data={snapshot} />
        </CardContent>
      </Card>
    </div>
  )
}
