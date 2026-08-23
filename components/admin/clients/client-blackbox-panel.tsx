/**
 * "Hộp đen" (black-box) tab embedded inside /admin/clients/[id].
 *
 * Server component — renders the full event log + win/lost analysis for
 * ONE client, scoped to a period (?bbPeriod=), plus a CSV export button
 * that hits /api/export/clients/[id]/blackbox.
 *
 * Data comes entirely from lib/analytics/client-blackbox.ts, which reads
 * existing tables (activities, opportunities, stage_transitions,
 * client_requests, buyer_replies) — no new schema.
 */
import { Download, TrendingUp, TrendingDown, Clock, Activity, Inbox } from "lucide-react"
import { parsePeriod, resolvePeriod, type PeriodValue } from "@/lib/analytics/constants"
import { getClientBlackbox } from "@/lib/analytics/client-blackbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { BbPeriodSelector } from "@/components/admin/analytics/bb-period-selector"
import { MonthlyTrendChartCompact } from "@/components/admin/analytics/monthly-trend-chart"

interface Props {
  clientId: string
  bbPeriodRaw: string | undefined
  basePath: string
}

function fmtHours(h: number | null): string {
  if (h === null) return "—"
  if (h < 1) return "<1 giờ"
  if (h < 48) return `${Math.round(h)} giờ`
  return `${Math.round(h / 24)} ngày`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const OUTCOME_BADGE: Record<"won" | "lost" | "in_progress", { label: string; className: string }> = {
  won: { label: "Thắng", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
  lost: { label: "Thua", className: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/20" },
  in_progress: { label: "Đang chạy", className: "" },
}

export async function ClientBlackboxPanel({ clientId, bbPeriodRaw, basePath }: Props) {
  const periodValue = parsePeriod(bbPeriodRaw ?? "quarter")
  const period = resolvePeriod(periodValue, "vi")
  const data = await getClientBlackbox(clientId, period)

  if (!data) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">Không tìm thấy dữ liệu client.</CardContent>
      </Card>
    )
  }

  const { totals, monthly, opportunities, activities } = data

  return (
    <div id="blackbox" className="flex flex-col gap-6">
      {/* Header: period + export */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" />
              Hộp đen dữ liệu ({period.label})
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1 text-pretty">
              Toàn bộ nhật ký sự kiện, tỉ lệ thắng/thua và thời gian phản hồi của client này — dùng để phân
              tích nguyên nhân và cải thiện quy trình chăm sóc.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <BbPeriodSelector value={periodValue} basePath={basePath} />
            <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1.5">
              <a href={`/api/export/clients/${clientId}/blackbox?period=${periodValue}`}>
                <Download className="h-3.5 w-3.5" />
                Xuất CSV
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {/* KPI tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiTile label="Đơn mới" value={totals.opened} />
            <KpiTile label="Thắng" value={totals.won} icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-600" />} />
            <KpiTile label="Thua" value={totals.lost} icon={<TrendingDown className="h-3.5 w-3.5 text-rose-600" />} />
            <KpiTile label="Tỉ lệ thắng" value={totals.winRatePct !== null ? `${totals.winRatePct}%` : "—"} />
            <KpiTile
              label="AE phản hồi client"
              value={fmtHours(totals.avgClientResponseHours)}
              hint={`${totals.clientRequestsInPeriod} yêu cầu`}
              icon={<Clock className="h-3.5 w-3.5 text-muted-foreground" />}
            />
            <KpiTile
              label="Buyer phản hồi"
              value={fmtHours(totals.avgBuyerResponseHours)}
              hint={`${totals.buyerRepliesInPeriod} phản hồi`}
              icon={<Inbox className="h-3.5 w-3.5 text-muted-foreground" />}
            />
          </div>

          {/* Monthly trend */}
          <div>
            <p className="text-sm font-medium mb-2">Xu hướng theo tháng (12 tháng gần nhất)</p>
            <MonthlyTrendChartCompact data={monthly.map((m) => ({ key: m.key, label: m.label, created: m.opened, won: m.won, lost: m.lost }))} />
          </div>
        </CardContent>
      </Card>

      {/* Deal list — outcome + AE note (lost-reason proxy) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Danh sách deal đã chạm trong kỳ{" "}
            <span className="text-muted-foreground font-normal">({opportunities.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {opportunities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Không có deal nào trong kỳ này.</p>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Giai đoạn</TableHead>
                    <TableHead>Kết quả</TableHead>
                    <TableHead>Ngày tạo</TableHead>
                    <TableHead>Ngày đóng</TableHead>
                    <TableHead className="text-right">Giá trị (USD)</TableHead>
                    <TableHead>Ghi chú AE</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opportunities.map((o) => {
                    const badge = OUTCOME_BADGE[o.outcome]
                    return (
                      <TableRow key={o.opportunityId}>
                        <TableCell className="font-medium">{o.buyerName}</TableCell>
                        <TableCell className="text-muted-foreground">{o.stageLabel}</TableCell>
                        <TableCell>
                          {o.outcome === "in_progress" ? (
                            <Badge variant="secondary" className="font-normal">{badge.label}</Badge>
                          ) : (
                            <Badge variant="outline" className={`font-normal ${badge.className}`}>{badge.label}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{fmtDate(o.createdAt)}</TableCell>
                        <TableCell className="text-muted-foreground">{o.closedAt ? fmtDate(o.closedAt) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {o.potentialValue ? new Intl.NumberFormat("en-US").format(o.potentialValue) : "—"}
                        </TableCell>
                        <TableCell className="max-w-[280px] truncate text-muted-foreground" title={o.aeNote ?? undefined}>
                          {o.aeNote ?? "—"}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Raw activity log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Nhật ký sự kiện thô{" "}
            <span className="text-muted-foreground font-normal">
              ({activities.length}{activities.length >= 2000 ? "+, đã cắt ở 2000 dòng gần nhất" : ""})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Không có sự kiện nào được ghi trong kỳ này.</p>
          ) : (
            <div className="overflow-x-auto -mx-6 max-h-[480px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Thời gian</TableHead>
                    <TableHead>Sự kiện</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Người thực hiện</TableHead>
                    <TableHead>Chi tiết</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{fmtDateTime(a.occurredAt)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">{a.actionLabel}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{a.buyerName ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{a.performedByName ?? "—"}</TableCell>
                      <TableCell className="max-w-[320px] truncate text-muted-foreground" title={a.description ?? undefined}>
                        {a.description ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function KpiTile({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: string | number
  hint?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="rounded-md border border-border p-3 flex flex-col gap-1">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

export type { PeriodValue }
