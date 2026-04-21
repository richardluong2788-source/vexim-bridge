"use client"

import { useDroppable } from "@dnd-kit/core"
import { Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Stage } from "@/lib/supabase/types"
import { useTranslation } from "@/components/i18n/language-provider"

interface StageConfig {
  id: Stage
  label: string
  color: string
  dot: string
}

interface KanbanColumnProps {
  stage: StageConfig
  count: number
  droppableId: string
  /** True when the currently dragged card cannot land here (e.g. FDA missing). */
  isBlocked?: boolean
  children: React.ReactNode
}

export function KanbanColumn({
  stage,
  count,
  droppableId,
  isBlocked = false,
  children,
}: KanbanColumnProps) {
  const { t } = useTranslation()
  const { setNodeRef, isOver } = useDroppable({ id: droppableId })

  return (
    <div className="flex flex-col w-64 shrink-0">
      {/* Column header */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2.5 rounded-t-lg border border-b-0 transition-opacity",
          stage.color,
          isBlocked && "opacity-60",
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn("h-2 w-2 rounded-full shrink-0", stage.dot)} />
          <span className="text-sm font-medium text-foreground truncate">{stage.label}</span>
          {isBlocked && (
            <Lock
              className="h-3 w-3 text-muted-foreground shrink-0"
              aria-label={t.kanban.complianceBlockTitle}
            />
          )}
        </div>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-xs font-medium text-foreground">
          {count}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-col gap-2 min-h-96 p-2 rounded-b-lg border border-t-0 transition-colors",
          stage.color,
          isOver && !isBlocked && "ring-2 ring-accent ring-inset",
          isOver && isBlocked && "ring-2 ring-destructive ring-inset",
          isBlocked && "opacity-60",
        )}
      >
        {children}
        {count === 0 && (
          <div className="flex flex-col items-center justify-center h-24 rounded-md border border-dashed border-border/50 mt-1">
            <p className="text-xs text-muted-foreground">{t.kanban.dropZone}</p>
          </div>
        )}
      </div>
    </div>
  )
}
