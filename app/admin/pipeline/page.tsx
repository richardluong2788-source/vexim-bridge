import { redirect } from "next/navigation"
import { KanbanBoard } from "@/components/admin/kanban-board"
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
      profiles:client_id (*),
      leads:lead_id (*)
    `)
    .order("last_updated", { ascending: false })
  if (scope.kind === "owned") {
    oppQ = oppQ.eq("account_manager_id", scope.userId)
  }
  const { data: opportunities } = await oppQ

  // Fetch unread buyer reply counts per opportunity so the Kanban card can
  // surface a notification badge when the buyer has replied and the AE
  // has not yet read the reply.
  const oppIds = (opportunities ?? []).map((o) => o.id)
  let unreadByOpp: Record<string, number> = {}
  if (oppIds.length > 0) {
    const { data: unreadReplies } = await admin
      .from("buyer_replies")
      .select("opportunity_id")
      .in("opportunity_id", oppIds)
      .is("read_at", null)
    if (unreadReplies) {
      for (const row of unreadReplies) {
        unreadByOpp[row.opportunity_id] = (unreadByOpp[row.opportunity_id] ?? 0) + 1
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
      />
    </div>
  )
}
