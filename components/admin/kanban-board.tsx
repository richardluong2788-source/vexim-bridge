"use client"

import { useState, useCallback, useMemo } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { toast } from "sonner"
import { ShieldAlert } from "lucide-react"
import {
  COMPLIANCE_REQUIRED_STAGES,
  type OpportunityWithClient,
  type Stage,
} from "@/lib/supabase/types"
import { updateOpportunityStage } from "@/app/admin/opportunities/actions"
import { KanbanColumn } from "@/components/admin/kanban-column"
import { KanbanCard } from "@/components/admin/kanban-card"
import { OpportunityDetailSheet } from "@/components/admin/opportunity-detail-sheet"
import { useTranslation } from "@/components/i18n/language-provider"

// Full Phase-2 pipeline: 10 columns reflecting the export-sales SOP.
const STAGE_IDS: Stage[] = [
  "new",
  "contacted",
  "sample_requested",
  "sample_sent",
  "negotiation",
  "price_agreed",
  "production",
  "shipped",
  "won",
  "lost",
]

// Each stage gets its own accent so the pipeline is scannable at a glance.
// Colors reference the shadcn chart token palette (see globals.css).
const STAGE_STYLE: Record<Stage, { color: string; dot: string }> = {
  new: { color: "bg-chart-1/10 border-chart-1/30", dot: "bg-chart-1" },
  contacted: { color: "bg-chart-3/10 border-chart-3/30", dot: "bg-chart-3" },
  sample_requested: { color: "bg-chart-2/10 border-chart-2/30", dot: "bg-chart-2" },
  sample_sent: { color: "bg-chart-2/15 border-chart-2/40", dot: "bg-chart-2" },
  negotiation: { color: "bg-chart-5/10 border-chart-5/30", dot: "bg-chart-5" },
  price_agreed: { color: "bg-chart-5/15 border-chart-5/40", dot: "bg-chart-5" },
  production: { color: "bg-chart-1/15 border-chart-1/40", dot: "bg-chart-1" },
  shipped: { color: "bg-chart-4/10 border-chart-4/30", dot: "bg-chart-4" },
  won: { color: "bg-chart-4/20 border-chart-4/50", dot: "bg-chart-4" },
  lost: { color: "bg-destructive/10 border-destructive/30", dot: "bg-destructive" },
}

interface KanbanBoardProps {
  opportunities: OpportunityWithClient[]
}

export function KanbanBoard({ opportunities: initialOpportunities }: KanbanBoardProps) {
  const { t } = useTranslation()
  const [opportunities, setOpportunities] = useState(initialOpportunities)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const activeOpportunity = opportunities.find((o) => o.id === activeId)

  const stages = useMemo(
    () =>
      STAGE_IDS.map((id) => ({
        id,
        label: t.kanban.stages[id],
        ...STAGE_STYLE[id],
      })),
    [t],
  )

  // While a non-compliant card is being dragged, visually mark the columns
  // that would reject the drop so the admin gets instant feedback.
  const activeIsBlockedFromCompliance = useMemo(() => {
    if (!activeOpportunity) return false
    return !activeOpportunity.profiles?.fda_registration_number?.trim()
  }, [activeOpportunity])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveId(null)
      const { active, over } = event
      if (!over || active.id === over.id) return

      const draggedId = active.id as string
      const targetStage = over.id as Stage

      if (!STAGE_IDS.includes(targetStage)) return

      const prevOpportunities = opportunities
      const dragged = prevOpportunities.find((o) => o.id === draggedId)
      const fromStage = dragged?.stage

      if (!dragged || fromStage === targetStage) return

      // ------------------------------------------------------------------
      // Compliance Block: stages past "contacted" require a valid FDA
      // registration on the client profile. Reject the drop and surface a
      // blocking toast so the admin knows exactly what to fix.
      // ------------------------------------------------------------------
      const requiresCompliance = COMPLIANCE_REQUIRED_STAGES.includes(targetStage)
      const clientHasFda = Boolean(dragged.profiles?.fda_registration_number?.trim())
      if (requiresCompliance && !clientHasFda) {
        toast.error(t.kanban.complianceBlockTitle, {
          description: t.kanban.complianceBlockDesc,
          icon: <ShieldAlert className="h-4 w-4" />,
          duration: 6000,
        })
        return
      }

      // Optimistic UI update
      setOpportunities((prev) =>
        prev.map((o) => (o.id === draggedId ? { ...o, stage: targetStage } : o)),
      )

      // Server action: enforces role check, logs activity, and dispatches a
      // notification to the assigned client (status_update or deal_closed).
      const res = await updateOpportunityStage(draggedId, targetStage)

      if (!res.ok) {
        setOpportunities(prevOpportunities)
        if (res.error === "swiftNotVerified") {
          toast.error(t.kanban.swiftRequiredTitle, {
            description: t.kanban.swiftRequiredDesc,
            icon: <ShieldAlert className="h-4 w-4" />,
            duration: 7000,
          })
        } else {
          toast.error(res.error ?? "Failed to update stage")
        }
        return
      }

      const fromLabel = fromStage ? t.kanban.stages[fromStage] : "—"
      const toLabel = t.kanban.stages[targetStage]
      toast.success(`${fromLabel} → ${toLabel}`)
    },
    [opportunities, t],
  )

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const cards = opportunities.filter((o) => o.stage === stage.id)
          const isBlocked =
            activeIsBlockedFromCompliance &&
            COMPLIANCE_REQUIRED_STAGES.includes(stage.id)
          return (
            <SortableContext
              key={stage.id}
              id={stage.id}
              items={cards.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <KanbanColumn
                stage={stage}
                count={cards.length}
                droppableId={stage.id}
                isBlocked={isBlocked}
              >
                {cards.map((opp) => (
                  <KanbanCard
                    key={opp.id}
                    opportunity={opp}
                    onEdit={(o) => setEditingId(o.id)}
                  />
                ))}
              </KanbanColumn>
            </SortableContext>
          )
        })}
      </div>

      <DragOverlay>
        {activeOpportunity ? <KanbanCard opportunity={activeOpportunity} isDragging /> : null}
      </DragOverlay>

      <OpportunityDetailSheet
        opportunity={opportunities.find((o) => o.id === editingId) ?? null}
        open={editingId !== null}
        onOpenChange={(v) => {
          if (!v) setEditingId(null)
        }}
        onSaved={(updated) => {
          // Merge updated fields back into the local state so the card
          // immediately reflects the new next_step / action / deal details
          // without waiting for a router refresh.
          setOpportunities((prev) =>
            prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)),
          )
        }}
      />
    </DndContext>
  )
}
