/**
 * Performance card embedded inside /admin/buyers/[id].
 *
 * Buyer-centric KPIs: how many deals across all clients have we tried with
 * this buyer, how many won/lost, what is the win rate, average win cycle,
 * and a stage snapshot for in-progress deals.
 *
 * Server component — calls getBuyerMetrics directly.
 */
import { Briefcase } from "lucide-react"
import {
  STAGE_LABEL_VI,
  type Stage,
} from "@/lib/analytics/constants"
import { getBuyerMetrics } from "@/lib/analytics/queries"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface Props {
  leadId: string
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(
    new Date(iso),
  )
}

export async function BuyerPerformanceCard({ leadId }: Props) {
  const m = await getBuyerMetrics(leadId)

  const tiles = [
    { label: "Tổng đơn", value: m.totalOpportunities.toString() },
    { label: "Đã chốt", value: m.won.toString() },
    { label: "Thất bại", value: m.lost.toString() },
    { label: "Đang chạy", value: m.inProgress.toString() },
    { label: "Tỉ lệ thắng", value: `${m.winRate}%` },
    {
      label: "Số client gắn",
      value: m.clientsAttachedCount.toString(),
    },
    {
      label: "Cycle thắng TB",
      value: m.avgWinCycleDays === null ? "—" : `${m.avgWinCycleDays} ngày`,
    },
    { label: "Lần cuối hoạt động", value: formatDate(m.lastActivityAt) },
  ]

  const inProgressStages = m.stageDistribution.filter(
    (s) => s.stage !== "won" && s.stage !== "lost" && s.count > 0,
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Briefcase className="h-4 w-4 text-primary" />
          Hiệu suất buyer
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Tổng hợp lịch sử qua mọi client mà buyer này đã được gắn vào.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {tiles.map((t) => (
            <div
              key={t.label}
              className="rounded-md border border-border p-3 flex flex-col gap-1"
            >
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {t.label}
              </p>
              <p className="text-base font-semibold tabular-nums">{t.value}</p>
            </div>
          ))}
        </div>

        <div>
          <p className="text-sm font-medium mb-2">
            Đang dừng ở stage nào{" "}
            <span className="text-muted-foreground font-normal">
              · {m.inProgress} đơn
            </span>
          </p>
          {inProgressStages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Không còn đơn nào đang chạy với buyer này.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {inProgressStages.map((s) => (
                <Badge
                  key={s.stage}
                  variant="secondary"
                  className="font-normal"
                >
                  {STAGE_LABEL_VI[s.stage as Stage]}: {s.count}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
