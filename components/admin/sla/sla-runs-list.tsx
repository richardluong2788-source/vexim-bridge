/**
 * Recent run history sidebar — sources sla_evaluation_runs.
 */
import { CheckCircle2, Loader2, XCircle, History } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Empty, EmptyTitle, EmptyDescription } from "@/components/ui/empty"

interface RunRow {
  period_month: string
  status: string
  triggered_by: string
  started_at: string
  completed_at: string | null
  scanned_clients: number
  violations_inserted: number
}

interface Props {
  runs: RunRow[]
}

function formatPeriod(p: string): string {
  const [y, m] = p.split("-").map(Number)
  if (!y || !m) return p
  const d = new Date(Date.UTC(y, m - 1, 1))
  return d.toLocaleDateString("vi-VN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—"
  const then = new Date(iso).getTime()
  const now = Date.now()
  const mins = Math.round((now - then) / 60_000)
  if (mins < 1) return "vừa xong"
  if (mins < 60) return `${mins} phút trước`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} giờ trước`
  const days = Math.round(hrs / 24)
  return `${days} ngày trước`
}

export function SlaRunsList({ runs }: Props) {
  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          Lịch sử chạy đánh giá
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {runs.length === 0 ? (
          <Empty className="border-0 py-6">
            <EmptyTitle className="text-sm">Chưa có run nào</EmptyTitle>
            <EmptyDescription className="text-xs">
              Cron tự chạy mùng 1 hàng tháng. Bạn có thể chạy thử bằng nút
              &quot;Chạy lại đánh giá&quot;.
            </EmptyDescription>
          </Empty>
        ) : (
          <ul className="divide-y divide-border">
            {runs.map((r) => {
              const Icon =
                r.status === "completed"
                  ? CheckCircle2
                  : r.status === "running"
                    ? Loader2
                    : XCircle
              const tone =
                r.status === "completed"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : r.status === "running"
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-rose-600 dark:text-rose-400"
              return (
                <li key={r.period_month} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium capitalize">
                      {formatPeriod(r.period_month)}
                    </span>
                    <Icon
                      className={`h-3.5 w-3.5 ${tone} ${r.status === "running" ? "animate-spin" : ""}`}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                    <span className="tabular-nums">
                      {r.scanned_clients} client
                    </span>
                    <span className="tabular-nums">
                      +{r.violations_inserted} vi phạm
                    </span>
                    <span>{relativeTime(r.completed_at ?? r.started_at)}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground/80 mt-0.5 truncate">
                    {r.triggered_by.startsWith("manual:")
                      ? "Chạy thủ công"
                      : r.triggered_by === "cron"
                        ? "Cron tự động"
                        : r.triggered_by}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
