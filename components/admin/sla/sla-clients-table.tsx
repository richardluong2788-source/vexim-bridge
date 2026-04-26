/**
 * Heatmap-style table: one row per client × one column per metric.
 * The score chip on the left summarises the row; each metric cell is a
 * coloured violation count.
 */
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import { tierBadgeClass, tierLabelVi } from "@/lib/sla/scoring"
import {
  SLA_METRIC_KEYS,
  SLA_METRIC_META,
  type SlaMetricKey,
} from "@/lib/sla/types"
import type { SlaClientRow } from "@/lib/sla/queries"
import { cn } from "@/lib/utils"

interface Props {
  rows: SlaClientRow[]
  periodLabel: string
}

function cellTone(v: number): string {
  if (v === 0) return "text-muted-foreground/70"
  if (v <= 2) return "text-amber-700 dark:text-amber-300 font-semibold"
  return "text-rose-700 dark:text-rose-300 font-semibold"
}

function cellBg(v: number): string {
  if (v === 0) return ""
  if (v <= 2) return "bg-amber-500/10"
  return "bg-rose-500/15"
}

export function SlaClientsTable({ rows, periodLabel }: Props) {
  return (
    <Card className="border-border">
      <CardHeader className="flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="text-base font-semibold">
            Theo dõi theo client · {periodLabel}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sắp xếp theo mức độ vi phạm. Click vào client để xem chi tiết.
          </p>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <Empty className="border-0">
            <EmptyTitle>Chưa có client nào</EmptyTitle>
            <EmptyDescription>
              Hệ thống chưa có khách hàng nào với role =&quot;client&quot;.
            </EmptyDescription>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="border-b border-border">
                  <th className="text-left font-medium text-xs uppercase tracking-wide text-muted-foreground px-4 py-2 sticky left-0 bg-muted/40">
                    Client
                  </th>
                  <th className="text-left font-medium text-xs uppercase tracking-wide text-muted-foreground px-3 py-2">
                    Score
                  </th>
                  {SLA_METRIC_KEYS.map((m) => (
                    <th
                      key={m}
                      className="text-center font-medium text-[11px] uppercase tracking-wide text-muted-foreground px-2 py-2 min-w-[64px]"
                      title={SLA_METRIC_META[m].descVi}
                    >
                      <span className="line-clamp-2 leading-tight">
                        {shortLabel(m)}
                      </span>
                    </th>
                  ))}
                  <th className="px-2 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const name =
                    r.company_name ??
                    r.full_name ??
                    r.email ??
                    r.client_id.slice(0, 8)
                  return (
                    <tr
                      key={r.client_id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-2 sticky left-0 bg-card group-hover:bg-muted/30">
                        <Link
                          href={`/admin/clients/${r.client_id}`}
                          className="flex flex-col hover:underline"
                        >
                          <span className="font-medium truncate max-w-[220px]">
                            {name}
                          </span>
                          {r.billing_plan_name ? (
                            <span className="text-[11px] text-muted-foreground">
                              {r.billing_plan_name}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">
                              chưa có gói
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums",
                            tierBadgeClass(r.score.tier),
                          )}
                        >
                          {r.score.score == null
                            ? "—"
                            : r.score.score.toFixed(1)}
                          <span className="text-[10px] uppercase tracking-wide opacity-80">
                            {tierLabelVi(r.score.tier)}
                          </span>
                        </span>
                      </td>
                      {SLA_METRIC_KEYS.map((m) => {
                        const v = r.violationsByMetric[m] ?? 0
                        return (
                          <td
                            key={m}
                            className={cn(
                              "text-center px-2 py-2 tabular-nums",
                              cellBg(v),
                              cellTone(v),
                            )}
                          >
                            {v === 0 ? "·" : v}
                          </td>
                        )
                      })}
                      <td className="px-2 py-2">
                        <Link
                          href={`/admin/clients/${r.client_id}`}
                          aria-label={`Mở chi tiết ${name}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function shortLabel(key: SlaMetricKey): string {
  switch (key) {
    case "pipeline_update_response":
      return "Pipeline"
    case "monthly_qualified_leads":
      return "Lead đủ ĐK"
    case "monthly_email_outreach":
      return "Email gửi"
    case "client_request_response":
      return "Phản hồi"
    case "swift_verification_lag":
      return "Swift"
    case "fda_renewal_alert":
      return "FDA"
    case "monthly_status_report":
      return "Báo cáo"
  }
}
