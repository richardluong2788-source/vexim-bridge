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
import { ShieldAlert, Mail } from "lucide-react"
import { Card } from "@/components/ui/card"
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

// Compact "X phút trước" style label for the "Cần phản hồi" strip - keeps
// each item scannable without a full timestamp taking up card width.
function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return "Vừa xong"
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  return `${days} ngày trước`
}

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

export interface NeedsReplyItem {
  opportunityId: string
  companyName: string
  stage: Stage
  fromEmail: string | null
  snippet: string
  receivedAt: string
}

interface KanbanBoardProps {
  opportunities: OpportunityWithClient[]
  /** Map of opportunity_id → unread buyer reply count */
  unreadReplyCountByOpp?: Record<string, number>
  /** One row per opportunity with an unread reply, newest reply first.
   *  Rendered as a triage strip above the board — this is the "moves to
   *  the top like a chatbot" behavior, kept OUT of the Kanban cards
   *  themselves so column order stays stable while an AE is scanning or
   *  dragging cards. */
  needsReplyItems?: NeedsReplyItem[]
  /** Map of opportunity_id → number of days spent in its current stage
   *  (from `opportunity_metrics_v`), rendered on the card so an AE can
   *  spot a buyer that's gone stale without recalling when it was moved. */
  daysInStageByOpp?: Record<string, number>
}

export function KanbanBoard({
  opportunities: initialOpportunities,
  unreadReplyCountByOpp = {},
  needsReplyItems = [],
  daysInStageByOpp = {},
}: KanbanBoardProps) {
  const { t } = useTranslation()
  const [opportunities, setOpportunities] = useState(initialOpportunities)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  // "status" when opened via the pencil icon on a card, "replies" when
  // opened by clicking an item in the "Cần phản hồi" triage strip — so
  // the sheet lands directly on the buyer conversation, not the status tab.
  const [editingSection, setEditingSection] = useState<"status" | "replies">("status")

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

      // `over.id` is the column's droppableId when dropped on empty column
      // space, but once a column already has cards filling most of its
      // area, the pointer almost always lands ON one of those existing
      // cards instead — dnd-kit then reports `over.id` as THAT CARD's id
      // (via its own useSortable droppable), not the column id. Without
      // resolving through the card's own stage here, a column with 3+
      // cards silently rejects the 4th drop the moment you land on a card
      // rather than the sliver of empty space below it.
      const overId = over.id as string
      const targetStage = STAGE_IDS.includes(overId as Stage)
        ? (overId as Stage)
        : opportunities.find((o) => o.id === overId)?.stage

      if (!targetStage) return

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
        } else if (res.error === "notFound") {
          toast.error(t.kanban.notFoundTitle ?? "Không tìm thấy cơ hội", {
            description: t.kanban.notFoundDesc ?? "Cơ hội này có thể đã bị xóa hoặc bạn không có quyền truy cập.",
            duration: 5000,
          })
        } else if (res.error === "forbidden") {
          toast.error(t.kanban.forbiddenTitle ?? "Không có quyền", {
            description: t.kanban.forbiddenDesc ?? "Bạn không có quyền di chuyển cơ hội này.",
            duration: 5000,
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
    <>
      {/* CẦN PHẢN HỒI — chat-inbox-style triage strip, newest reply first.
          Kanban columns below stay in fixed positions (drag/drop + scanning
          rely on stable card position); this is the "jumps to top" surface
          instead, so a busy pipeline never buries a fresh buyer reply. */}
      {needsReplyItems.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-chart-2" />
            Cần phản hồi ({needsReplyItems.length})
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {needsReplyItems.map((item) => (
              <button
                key={item.opportunityId}
                type="button"
                onClick={() => {
                  setEditingSection("replies")
                  setEditingId(item.opportunityId)
                }}
                className="text-left shrink-0"
              >
                <Card className="w-64 p-2.5 border-chart-2/30 bg-chart-2/5 hover:bg-chart-2/10 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground truncate">
                      {item.companyName}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatRelativeTime(item.receivedAt)}
                    </span>
                  </div>
                  {item.fromEmail && (
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {item.fromEmail}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-snug">
                    {item.snippet}
                  </p>
                </Card>
              </button>
            ))}
          </div>
        </div>
      )}

    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex items-start gap-4 overflow-x-auto pb-4">
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
                    unreadReplyCount={unreadReplyCountByOpp[opp.id] ?? 0}
                    daysInStage={daysInStageByOpp[opp.id]}
                    onEdit={(o) => {
                      setEditingSection("status")
                      setEditingId(o.id)
                    }}
                  />
                ))}
              </KanbanColumn>
            </SortableContext>
          )
        })}
      </div>

      <DragOverlay>
        {activeOpportunity ? (
          <KanbanCard
            opportunity={activeOpportunity}
            isDragging
            daysInStage={daysInStageByOpp[activeOpportunity.id]}
          />
        ) : null}
      </DragOverlay>

      <OpportunityDetailSheet
        opportunity={opportunities.find((o) => o.id === editingId) ?? null}
        open={editingId !== null}
        initialSection={editingSection}
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
    </>
  )
}
