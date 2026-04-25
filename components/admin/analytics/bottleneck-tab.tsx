/**
 * Bottleneck tab — opportunities that have been sitting in their current
 * stage longer than the per-stage threshold. Grouped by stage so admins can
 * triage quickly.
 */
import Link from "next/link"
import { AlertTriangle, ArrowUpRight, Clock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { getStuckOpportunities, type ClientScope } from "@/lib/analytics/queries"
import { STAGE_LABEL_VI, formatDaysVi } from "@/lib/analytics/constants"
import type { Stage } from "@/lib/supabase/types"

interface Props {
  scope: ClientScope
}

export async function BottleneckTab({ scope }: Props) {
  const stuck = await getStuckOpportunities(scope)

  if (stuck.length === 0) {
    return (
      <Card className="border-border p-10">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Pipeline đang sạch</EmptyTitle>
            <EmptyDescription>
              Không có cơ hội nào đứng yên quá ngưỡng cảnh báo. Tiếp tục
              duy trì tốc độ này.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Card>
    )
  }

  // Group by stage
  const byStage = new Map<Stage, typeof stuck>()
  for (const r of stuck) {
    const slot = byStage.get(r.stage) ?? []
    slot.push(r)
    byStage.set(r.stage, slot)
  }
  const stageOrder: Stage[] = [
    "negotiation",
    "sample_sent",
    "price_agreed",
    "sample_requested",
    "contacted",
    "new",
  ]

  const usd = (n: number | null) =>
    typeof n === "number"
      ? n.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        })
      : "—"

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-border bg-amber-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              {stuck.length} cơ hội đang đứng yên quá ngưỡng cảnh báo
            </p>
            <p className="text-xs text-muted-foreground">
              Ngưỡng theo stage: Mới 7 ngày, Đã liên hệ 14 ngày, Yêu cầu mẫu
              21 ngày, Đã gửi mẫu / Đàm phán 30 ngày, Chốt giá 14 ngày.
            </p>
          </div>
        </CardContent>
      </Card>

      {stageOrder
        .filter((s) => byStage.has(s))
        .map((stage) => {
          const items = byStage.get(stage) ?? []
          return (
            <Card key={stage} className="border-border overflow-hidden">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  {STAGE_LABEL_VI[stage]}
                  <Badge variant="secondary" className="ml-1 tabular-nums">
                    {items.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <div className="divide-y divide-border">
                {items.map((it) => {
                  const overshoot = it.daysInStage - it.threshold
                  return (
                    <Link
                      key={it.opportunityId}
                      href={`/admin/clients/${it.clientId}`}
                      className="flex items-center gap-4 p-4 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium text-foreground truncate">
                            {it.buyerName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            → {it.clientName}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Giá trị tiềm năng: {usd(it.potentialValue)} · Cập nhật{" "}
                          {new Date(it.lastUpdated).toLocaleDateString("vi-VN")}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                          {formatDaysVi(it.daysInStage)}
                        </div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          quá +{overshoot} ngày
                        </div>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </Link>
                  )
                })}
              </div>
            </Card>
          )
        })}
    </div>
  )
}
