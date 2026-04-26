/**
 * Client portal scorecard — current month KPI breakdown + 6-month trend.
 *
 * Friendly tone: emphasises commitments rather than violations. Each
 * metric is shown alongside its target so the client knows what we
 * promised to deliver.
 */
import {
  Activity,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Mail,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  Users,
  TrendingUp,
  type LucideIcon,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  SLA_METRIC_KEYS,
  SLA_METRIC_META,
  type SlaMetricKey,
  type SlaTarget,
} from "@/lib/sla/types"
import { tierBadgeClass, tierLabelVi, type SlaTier } from "@/lib/sla/scoring"
import type { ClientMonthlyScorePoint } from "@/lib/sla/queries"
import { cn } from "@/lib/utils"

interface Props {
  current: ClientMonthlyScorePoint
  history: ClientMonthlyScorePoint[]
  targets: SlaTarget[]
}

const METRIC_ICONS: Record<SlaMetricKey, LucideIcon> = {
  pipeline_update_response: Activity,
  monthly_qualified_leads: Users,
  monthly_email_outreach: Mail,
  client_request_response: Clock,
  swift_verification_lag: ShieldCheck,
  fda_renewal_alert: Calendar,
  monthly_status_report: FileText,
}

function formatPeriod(p: string): string {
  const [y, m] = p.split("-").map(Number)
  if (!y || !m) return p
  const d = new Date(Date.UTC(y, m - 1, 1))
  return d.toLocaleDateString("vi-VN", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  })
}

function tierIcon(tier: SlaTier): LucideIcon {
  if (tier === "green") return ShieldCheck
  if (tier === "yellow") return ShieldAlert
  if (tier === "red") return ShieldX
  return ShieldCheck
}

function tierTone(tier: SlaTier): string {
  if (tier === "green") return "text-emerald-600 dark:text-emerald-400"
  if (tier === "yellow") return "text-amber-600 dark:text-amber-400"
  if (tier === "red") return "text-rose-600 dark:text-rose-400"
  return "text-muted-foreground"
}

function targetUnitLabel(metric: SlaMetricKey, value: number): string {
  const meta = SLA_METRIC_META[metric]
  switch (meta.unit) {
    case "hours":
      return `≤ ${value} giờ làm việc`
    case "business_days":
      return `≤ ${value} ngày làm việc`
    case "days":
      return `≥ ${value} ngày trước`
    case "count":
      return `≥ ${value} / tháng`
    case "boolean":
      return "phải gửi đúng hạn"
  }
}

export function ClientSlaScorecard({ current, history, targets }: Props) {
  const targetByMetric = new Map<SlaMetricKey, SlaTarget>()
  for (const t of targets) targetByMetric.set(t.metric_key, t)

  const TierIcon = tierIcon(current.tier)

  const monthLabel = formatPeriod(current.period_month)

  return (
    <div className="flex flex-col gap-5">
      {/* Hero score */}
      <Card className="border-border">
        <CardContent className="p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border",
                  tierBadgeClass(current.tier),
                )}
              >
                <TierIcon className={cn("h-6 w-6", tierTone(current.tier))} />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  SLA Health Score · tháng {monthLabel}
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span
                    className={cn(
                      "text-4xl font-semibold tabular-nums",
                      tierTone(current.tier),
                    )}
                  >
                    {current.score == null ? "—" : current.score.toFixed(1)}
                  </span>
                  <span className="text-sm text-muted-foreground">/ 100</span>
                </div>
                <p className="text-sm mt-1">
                  <span className="font-medium">
                    {tierLabelVi(current.tier)}
                  </span>
                  {current.totalViolations > 0 ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · {current.totalViolations} sự cố trong tháng
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {" "}
                      · Đạt cam kết toàn bộ chỉ tiêu
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* 6-month sparkline */}
            <div className="flex items-end gap-1 h-12">
              {history.slice().reverse().map((h) => {
                const height =
                  h.score == null ? 4 : Math.max(4, (h.score / 100) * 48)
                const tone =
                  h.tier === "green"
                    ? "bg-emerald-500"
                    : h.tier === "yellow"
                      ? "bg-amber-500"
                      : h.tier === "red"
                        ? "bg-rose-500"
                        : "bg-muted-foreground/30"
                return (
                  <div
                    key={h.period_month}
                    className="flex flex-col items-center gap-1"
                  >
                    <div
                      className={cn("w-3 rounded-sm", tone)}
                      style={{ height: `${height}px` }}
                      title={`${formatPeriod(h.period_month)} · ${h.score?.toFixed(1) ?? "—"}`}
                    />
                    <span className="text-[9px] text-muted-foreground tabular-nums">
                      {formatPeriod(h.period_month).slice(0, 3)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-metric breakdown */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Chi tiết theo cam kết
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            7 chỉ tiêu Điều 7.3 hợp đồng dịch vụ
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {SLA_METRIC_KEYS.map((key) => {
              const meta = SLA_METRIC_META[key]
              const t = targetByMetric.get(key)
              const violations = current.violationsByMetric[key] ?? 0
              const Icon = METRIC_ICONS[key]
              const ok = violations === 0
              return (
                <li
                  key={key}
                  className="px-5 py-3.5 flex items-start gap-3"
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-md mt-0.5",
                      ok
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
                    )}
                  >
                    {ok ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm font-medium">{meta.labelVi}</p>
                      <p
                        className={cn(
                          "text-xs tabular-nums",
                          ok
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400 font-semibold",
                        )}
                      >
                        {ok ? "Đạt" : `${violations} sự cố`}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {meta.descVi}
                    </p>
                    {t ? (
                      <p className="text-[11px] text-muted-foreground/80 mt-1">
                        Cam kết:{" "}
                        <span className="font-medium text-foreground/80">
                          {targetUnitLabel(key, Number(t.target_value))}
                        </span>
                      </p>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      {/* History grid */}
      {history.length > 1 && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Lịch sử {history.length} tháng gần nhất
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="border-b border-border">
                  <th className="text-left font-medium text-xs uppercase text-muted-foreground px-4 py-2">
                    Tháng
                  </th>
                  <th className="text-left font-medium text-xs uppercase text-muted-foreground px-3 py-2">
                    Score
                  </th>
                  <th className="text-right font-medium text-xs uppercase text-muted-foreground px-4 py-2">
                    Sự cố
                  </th>
                </tr>
              </thead>
              <tbody>
                {history
                  .slice()
                  .reverse()
                  .map((p) => (
                    <tr
                      key={p.period_month}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-4 py-2 capitalize">
                        {formatPeriod(p.period_month)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums",
                            tierBadgeClass(p.tier),
                          )}
                        >
                          {p.score == null ? "—" : p.score.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {p.totalViolations === 0 ? "—" : p.totalViolations}
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
