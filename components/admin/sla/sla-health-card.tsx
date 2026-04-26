/**
 * SLA Health Score widget — one big number, one trend hint.
 *
 * v2 B.7: refreshed every page load. Aggregates the per-client score
 * results coming out of `loadSlaClientsForPeriod`.
 */
import { ShieldCheck, ShieldAlert, ShieldX, Activity } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { SlaClientRow } from "@/lib/sla/queries"

interface Props {
  rows: SlaClientRow[]
  periodLabel: string
}

export function SlaHealthCard({ rows, periodLabel }: Props) {
  const tracked = rows.filter((r) => r.score.score != null)
  const avg =
    tracked.length === 0
      ? null
      : Math.round(
          (tracked.reduce((acc, r) => acc + (r.score.score ?? 0), 0) /
            tracked.length) *
            10,
        ) / 10

  const red = rows.filter((r) => r.score.tier === "red").length
  const yellow = rows.filter((r) => r.score.tier === "yellow").length
  const green = rows.filter((r) => r.score.tier === "green").length

  const tier =
    avg == null ? "untracked" : avg >= 85 ? "green" : avg >= 60 ? "yellow" : "red"

  const accent =
    tier === "green"
      ? "text-emerald-600 dark:text-emerald-400"
      : tier === "yellow"
        ? "text-amber-600 dark:text-amber-400"
        : tier === "red"
          ? "text-rose-600 dark:text-rose-400"
          : "text-muted-foreground"

  const Icon =
    tier === "green" ? ShieldCheck : tier === "yellow" ? ShieldAlert : ShieldX

  // Width of the colored bar: clamp 0..100.
  const barWidth =
    avg == null ? 0 : Math.max(0, Math.min(100, avg))

  return (
    <Card className="border-border">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <Activity className="h-3.5 w-3.5" />
              SLA Health Score
            </div>
            <p className="text-xs text-muted-foreground/80 mt-0.5">
              Trung bình trọng số trên {tracked.length} client trong{" "}
              {periodLabel}
            </p>
          </div>
          <Icon className={`h-6 w-6 shrink-0 ${accent}`} />
        </div>

        <div className="flex items-baseline gap-3 mt-4">
          <span className={`text-5xl font-semibold tabular-nums ${accent}`}>
            {avg == null ? "—" : avg.toFixed(1)}
          </span>
          <span className="text-sm text-muted-foreground">/ 100</span>
        </div>

        {/* Health bar */}
        <div
          className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden"
          role="progressbar"
          aria-valuenow={avg ?? 0}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={
              tier === "green"
                ? "h-full bg-emerald-500"
                : tier === "yellow"
                  ? "h-full bg-amber-500"
                  : tier === "red"
                    ? "h-full bg-rose-500"
                    : "h-full bg-muted-foreground/40"
            }
            style={{ width: `${barWidth}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
          <div className="rounded-md border border-border px-2 py-1.5">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Đạt
            </div>
            <div className="font-semibold tabular-nums mt-0.5">{green}</div>
          </div>
          <div className="rounded-md border border-border px-2 py-1.5">
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Cảnh báo
            </div>
            <div className="font-semibold tabular-nums mt-0.5">{yellow}</div>
          </div>
          <div className="rounded-md border border-border px-2 py-1.5">
            <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              Vi phạm
            </div>
            <div className="font-semibold tabular-nums mt-0.5">{red}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
