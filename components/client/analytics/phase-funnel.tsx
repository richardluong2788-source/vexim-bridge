"use client"

/**
 * 5-phase distribution bars for the client analytics page. Pure CSS so it
 * stays fast and matches the admin StageFunnel visual language while
 * displaying client-facing phase labels (not internal stages).
 */
import type { ClientPhase } from "@/lib/pipeline/phases"
import { useTranslation } from "@/components/i18n/language-provider"
import { cn } from "@/lib/utils"

interface Entry {
  phase: ClientPhase
  count: number
}

interface Props {
  data: Entry[]
}

export function ClientPhaseFunnel({ data }: Props) {
  const { t } = useTranslation()
  const labels = t.client.leads.phase

  const total = data.reduce((acc, d) => acc + d.count, 0)

  return (
    <ul className="flex flex-col gap-2.5">
      {data.map(({ phase, count }) => {
        const pct = total > 0 ? (count / total) * 100 : 0
        const tone =
          phase === "closed_won"
            ? "bg-emerald-500"
            : phase === "closed_lost"
              ? "bg-rose-500"
              : "bg-accent"
        return (
          <li key={phase} className="flex items-center gap-3">
            <span className="w-32 text-sm text-muted-foreground shrink-0 truncate">
              {labels[phase]}
            </span>
            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", tone)}
                style={{
                  width: `${Math.max(2, pct)}%`,
                  opacity: count === 0 ? 0.25 : 1,
                }}
              />
            </div>
            <span className="w-12 text-right text-sm font-medium tabular-nums text-foreground">
              {count}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
