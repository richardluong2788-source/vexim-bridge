import { redirect } from "next/navigation"
import { KanbanBoard, type NeedsReplyItem } from "@/components/admin/kanban-board"
import { PipelineRefSearch } from "@/components/admin/pipeline-ref-search"
import { ScopeBanner } from "@/components/admin/scope-banner"
import type { OpportunityWithClient } from "@/lib/supabase/types"
import { getDictionary } from "@/lib/i18n/server"
import { getCurrentRole } from "@/lib/auth/guard"
import { ownershipScopeFor } from "@/lib/auth/scope"

export const dynamic = "force-dynamic"

export default async function AdminPipelinePage() {
  const { t, locale } = await getDictionary()

  // Use the role-aware client so we can scope by ownership snapshot.
  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  const { admin, role, userId } = current
  const scope = ownershipScopeFor(role, userId)

  // Filter opportunities by the snapshot column (frozen at WON/LOST). For
  // in-progress deals the snapshot is kept in sync by the BEFORE-UPDATE
  // trigger AND by setAccountManager() at reassignment time, so the AE
  // always sees a consistent slice.
  let oppQ = admin
    .from("opportunities")
    .select(`
      *,
      profiles:client_id (*, client_profiles(display_name)),
      leads:lead_id (*)
    `)
    .order("last_updated", { ascending: false })
  if (scope.kind === "owned") {
    oppQ = oppQ.eq("account_manager_id", scope.userId)
  }
  const { data: opportunities } = await oppQ

  // Fetch unread buyer replies (with enough detail to render a "Cần phản
  // hồi" triage list) so the Kanban card can surface a notification badge
  // AND admins get a chat-inbox-style list of who just replied, without
  // reordering the Kanban cards themselves (see needsReplyItems below).
  const oppIds = ((opportunities ?? []) as Array<{ id: string }>).map((o) => o.id)
  let unreadByOpp: Record<string, number> = {}
  const needsReplyItems: NeedsReplyItem[] = []

  // Time-in-current-stage, sourced from the `opportunity_metrics_v` view
  // (migration 029) so the Kanban card can show "đã ở giai đoạn này X
  // ngày" — this is what lets an AE spot a buyer that's gone stale in a
  // stage without having to recall how long ago they dragged the card.
  let daysInStageByOpp: Record<string, number> = {}
  if (oppIds.length > 0) {
    const { data: metrics } = await admin
      .from("opportunity_metrics_v")
      .select("opportunity_id, days_in_current_stage")
      .in("opportunity_id", oppIds)
    if (metrics) {
      for (const row of metrics as Array<{
        opportunity_id: string
        days_in_current_stage: number
      }>) {
        daysInStageByOpp[row.opportunity_id] = row.days_in_current_stage
      }
    }
  }
  if (oppIds.length > 0) {
    const { data: unreadReplies } = await admin
      .from("buyer_replies")
      .select("opportunity_id, raw_content, from_email, received_at")
      .in("opportunity_id", oppIds)
      .is("read_at", null)
      .order("received_at", { ascending: false })
    if (unreadReplies) {
      const oppById = new Map(
        ((opportunities ?? []) as OpportunityWithClient[]).map((o) => [o.id, o]),
      )
      const seenOpp = new Set<string>()
      for (const row of unreadReplies as Array<{
        opportunity_id: string
        raw_content: string
        from_email: string | null
        received_at: string
      }>) {
        unreadByOpp[row.opportunity_id] = (unreadByOpp[row.opportunity_id] ?? 0) + 1
        // Already ordered newest-first, so the first row we see per
        // opportunity is its most recent unread reply — that's the one
        // we surface in the triage list (one row per opportunity, not
        // per message, to keep the list scannable).
        if (!seenOpp.has(row.opportunity_id)) {
          seenOpp.add(row.opportunity_id)
          const opp = oppById.get(row.opportunity_id)
          if (opp) {
            needsReplyItems.push({
              opportunityId: row.opportunity_id,
              companyName: opp.leads?.company_name ?? "—",
              stage: opp.stage,
              fromEmail: row.from_email,
              snippet: row.raw_content.slice(0, 140),
              receivedAt: row.received_at,
            })
          }
        }
      }
    }
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">{t.admin.pipeline.title}</h1>
        <p className="text-sm text-muted-foreground">{t.admin.pipeline.subtitle}</p>
        {scope.kind === "owned" && (
          <ScopeBanner
            locale={locale}
            count={opportunities?.length ?? 0}
            entityVi="cơ hội"
            entityEn="opportunities"
          />
        )}
      </div>
      <PipelineRefSearch />
      <KanbanBoard
        opportunities={(opportunities as OpportunityWithClient[]) ?? []}
        unreadReplyCountByOpp={unreadByOpp}
        needsReplyItems={needsReplyItems}
        daysInStageByOpp={daysInStageByOpp}
      />
    </div>
  )
}
