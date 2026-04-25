/**
 * Lost-analysis tab — where deals fall off the cliff and which segments
 * (country/industry) under-perform.
 */
import { XCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { getLostAnalysis, type ClientScope } from "@/lib/analytics/queries"
import type { PeriodWindow } from "@/lib/analytics/constants"

interface Props {
  scope: ClientScope
  period: PeriodWindow
}

export async function LostTab({ scope, period }: Props) {
  const data = await getLostAnalysis(scope, period)

  if (data.totalLost === 0) {
    return (
      <Card className="border-border p-10">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Chưa có deal nào thất bại trong kỳ</EmptyTitle>
            <EmptyDescription>
              Không có dữ liệu để phân tích. Hãy mở rộng phạm vi thời gian
              hoặc chờ đủ dữ liệu lịch sử.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            {data.totalLost} deal thất bại trong {period.label.toLowerCase()}
          </CardTitle>
        </CardHeader>
      </Card>

      {/* By previous stage */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Rơi từ giai đoạn nào
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Stage mà deal đang ở ngay trước khi chuyển sang &ldquo;Thất bại&rdquo;.
            Stage có số lượng cao là điểm cần can thiệp sớm.
          </p>
        </CardHeader>
        <CardContent>
          {data.byPreviousStage.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Không có dữ liệu về stage chuyển tiếp.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {data.byPreviousStage.map((row) => {
                const max = data.byPreviousStage[0]?.count ?? 1
                const pct = (row.count / max) * 100
                return (
                  <li key={row.stage} className="flex items-center gap-3">
                    <span className="w-32 text-sm text-muted-foreground shrink-0">
                      {row.label}
                    </span>
                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-rose-500 transition-all"
                        style={{ width: `${Math.max(2, pct)}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-sm font-medium tabular-nums text-foreground">
                      {row.count}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* By country & industry side-by-side on lg, stacked on mobile */}
      <div className="grid lg:grid-cols-2 gap-4">
        <SegmentCard
          title="Win rate theo quốc gia buyer"
          subtitle="Top 10 quốc gia có nhiều deal nhất trong kỳ"
          rows={data.winRateByCountry.map((c) => ({
            key: c.country,
            label: c.country,
            total: c.total,
            won: c.won,
            lost: c.lost,
            winRate: c.winRate,
          }))}
        />
        <SegmentCard
          title="Win rate theo ngành buyer"
          subtitle="Top 10 ngành có nhiều deal nhất trong kỳ"
          rows={data.winRateByIndustry.map((i) => ({
            key: i.industry,
            label: i.industry,
            total: i.total,
            won: i.won,
            lost: i.lost,
            winRate: i.winRate,
          }))}
        />
      </div>
    </div>
  )
}

interface SegmentRow {
  key: string
  label: string
  total: number
  won: number
  lost: number
  winRate: number
}

function SegmentCard({
  title,
  subtitle,
  rows,
}: {
  title: string
  subtitle: string
  rows: SegmentRow[]
}) {
  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Không đủ dữ liệu.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium pb-2">Phân khúc</th>
                <th className="text-right font-medium pb-2">Thắng</th>
                <th className="text-right font-medium pb-2">Thua</th>
                <th className="text-right font-medium pb-2">Win rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const wrColor =
                  r.winRate >= 50
                    ? "text-emerald-600 dark:text-emerald-400"
                    : r.winRate >= 25
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-rose-600 dark:text-rose-400"
                return (
                  <tr key={r.key}>
                    <td className="py-2 truncate max-w-[180px]">{r.label}</td>
                    <td className="py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {r.won}
                    </td>
                    <td className="py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">
                      {r.lost}
                    </td>
                    <td className={`py-2 text-right tabular-nums font-medium ${wrColor}`}>
                      {r.winRate}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}
