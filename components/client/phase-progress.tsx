import { cn } from "@/lib/utils"
import { CLIENT_PHASE_ORDER, stageToClientPhase, type ClientPhase } from "@/lib/pipeline/phases"
import type { Stage } from "@/lib/supabase/types"
import { CheckCircle2 } from "lucide-react"

interface PhaseProgressProps {
  stage: Stage
  phaseLabels: Record<ClientPhase, string>
  phaseDesc: Record<ClientPhase, string>
}

export function PhaseProgress({ stage, phaseLabels, phaseDesc }: PhaseProgressProps) {
  const currentPhase = stageToClientPhase(stage)
  const isLost = currentPhase === "closed_lost"
  const currentIdx = isLost ? -1 : CLIENT_PHASE_ORDER.indexOf(currentPhase)

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        {/* track */}
        <div className="absolute top-3 left-0 right-0 h-0.5 bg-border" aria-hidden="true" />
        {/* fill */}
        {!isLost && currentIdx >= 0 && (
          <div
            className="absolute top-3 left-0 h-0.5 bg-primary transition-all"
            style={{
              width: `${(currentIdx / (CLIENT_PHASE_ORDER.length - 1)) * 100}%`,
            }}
            aria-hidden="true"
          />
        )}
        <ol className="relative grid grid-cols-5 gap-2">
          {CLIENT_PHASE_ORDER.map((phase, idx) => {
            const done = !isLost && idx < currentIdx
            const active = !isLost && idx === currentIdx
            return (
              <li key={phase} className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    "relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-background transition-colors",
                    done && "border-primary bg-primary text-primary-foreground",
                    active && "border-primary bg-background",
                    !done && !active && "border-border",
                  )}
                  aria-current={active ? "step" : undefined}
                >
                  {done ? (
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        active ? "bg-primary" : "bg-muted-foreground/40",
                      )}
                    />
                  )}
                </div>
                <div className="flex flex-col items-center text-center">
                  <span
                    className={cn(
                      "text-xs font-medium",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {phaseLabels[phase]}
                  </span>
                  {active && (
                    <span className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1 max-w-[12ch]">
                      {phaseDesc[phase]}
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
