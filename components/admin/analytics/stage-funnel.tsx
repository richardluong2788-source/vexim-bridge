/**
 * Server-rendered horizontal stacked funnel. Pure CSS (no recharts) so it
 * stays in the server bundle and avoids a tiny client JS payload.
 */
import type { StageFunnelEntry } from "@/lib/analytics/queries"
import { cn } from "@/lib/utils"

interface Props {
  data: StageFunnelEntry[]
  /** When true, won/lost rows get coloured accents. */
  highlightTerminal?: boolean
}

export function StageFunnel({ data, highlightTerminal = true }: Props) {
  const total = data.reduce((acc, d) => acc + d.count, 0)
  return (
    <ul className="flex flex-col gap-2.5">
      {data.map(({ stage, label, count }) => {
        const pct = total > 0 ? (count / total) * 100 : 0
        const tone =
          highlightTerminal && stage === "won"
            ? "bg-emerald-500"
            : highlightTerminal && stage === "lost"
              ? "bg-rose-500"
              : "bg-accent"
        return (
          <li key={stage} className="flex items-center gap-3">
            <span className="w-28 text-sm text-muted-foreground shrink-0 truncate">
              {label}
            </span>
            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", tone)}
                style={{ width: `${Math.max(2, pct)}%`, opacity: count === 0 ? 0.25 : 1 }}
              />
            </div>
            <span className="w-12 text-right text-sm font-medium text-foreground tabular-nums">
              {count}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
