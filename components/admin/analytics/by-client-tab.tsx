/**
 * By Client tab — sortable comparison table. We sort server-side by total
 * win rate × volume (descending) since shadcn doesn't ship a sortable table
 * primitive. Users can click a row to drill down to /admin/clients/[id].
 */
import Link from "next/link"
import { ArrowUpRight, Download } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getByClient, type ClientScope } from "@/lib/analytics/queries"
import { formatDaysVi, type PeriodWindow, type PeriodValue } from "@/lib/analytics/constants"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"

interface Props {
  scope: ClientScope
  period: PeriodWindow
  /** Original period selector value, forwarded to the CSV download URL. */
  periodValue: PeriodValue
}

export async function ByClientTab({ scope, period, periodValue }: Props) {
  const rows = await getByClient(scope, period)

  // Sort: clients with most decided deals first; tiebreak by win rate.
  rows.sort((a, b) => {
    const da = a.won + a.lost
    const db = b.won + b.lost
    if (db !== da) return db - da
    return b.winRate - a.winRate
  })

  if (rows.length === 0) {
    return (
      <Card className="border-border p-10">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Chưa có khách hàng nào trong phạm vi</EmptyTitle>
            <EmptyDescription>
              Nếu bạn là Account Executive hoặc Researcher, hãy yêu cầu admin
              gán khách hàng cho bạn trong phần quản lý người dùng.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Card>
    )
  }

  const usd = (n: number) =>
    n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    })

  return (
    <Card className="border-border overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <p className="text-xs text-muted-foreground">
          {rows.length} khách hàng — sắp xếp theo số deal đã chốt
        </p>
        <Button asChild variant="outline" size="sm">
          <a
            href={`/api/export/analytics/by-client?period=${encodeURIComponent(periodValue)}`}
            download
          >
            <Download className="h-3.5 w-3.5" />
            Tải CSV
          </a>
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Khách hàng</th>
              <th className="text-right font-medium px-4 py-2.5">Tổng</th>
              <th className="text-right font-medium px-4 py-2.5">Thành công</th>
              <th className="text-right font-medium px-4 py-2.5">Thất bại</th>
              <th className="text-right font-medium px-4 py-2.5">Đang chạy</th>
              <th className="text-right font-medium px-4 py-2.5">Win rate</th>
              <th className="text-right font-medium px-4 py-2.5">
                Doanh thu thắng (kỳ)
              </th>
              <th className="text-right font-medium px-4 py-2.5">
                Cycle TB
              </th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const decided = r.won + r.lost
              const wrColor =
                decided === 0
                  ? "text-muted-foreground"
                  : r.winRate >= 50
                    ? "text-emerald-600 dark:text-emerald-400"
                    : r.winRate >= 25
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-rose-600 dark:text-rose-400"
              return (
                <tr key={r.clientId} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">
                    <Link
                      href={`/admin/clients/${r.clientId}`}
                      className="hover:underline"
                    >
                      {r.clientName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.total}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                    {r.won}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-rose-600 dark:text-rose-400">
                    {r.lost}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.inProgress}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums font-medium ${wrColor}`}>
                    {decided > 0 ? `${r.winRate}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.wonValueInPeriod > 0 ? usd(r.wonValueInPeriod) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.avgCycleDays !== null ? (
                      <Badge variant="secondary" className="font-normal">
                        {formatDaysVi(r.avgCycleDays)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/clients/${r.clientId}`}
                      className="inline-flex items-center text-muted-foreground hover:text-foreground"
                      aria-label={`Xem chi tiết ${r.clientName}`}
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
