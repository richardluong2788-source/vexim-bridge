import { redirect } from "next/navigation"
import { getCurrentRole } from "@/lib/auth/guard"
import {
  getOperationalScope,
  resolveScopedClientIds,
} from "@/lib/auth/scope"
import { KanbanBoard } from "@/components/admin/kanban-board"
import { PipelineRefSearch } from "@/components/admin/pipeline-ref-search"
import type { OpportunityWithClient } from "@/lib/supabase/types"
import { getDictionary } from "@/lib/i18n/server"

export const dynamic = "force-dynamic"

export default async function AdminPipelinePage() {
  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  const { admin, role, userId } = current
  const { t } = await getDictionary()

  // Sprint client-management-for-AE — scope opportunities to the caller's
  // managed clients for AE / lead_researcher / staff. Admins see all.
  const scope = getOperationalScope(role, userId)
  const allowed = await resolveScopedClientIds(admin, scope)

  let oppQ = admin
    .from("opportunities")
    .select(`
      *,
      profiles:client_id (*),
      leads:lead_id (*)
    `)
    .order("last_updated", { ascending: false })

  if (allowed) {
    if (allowed.length === 0) {
      // Caller manages zero clients — render an empty board instead of
      // omitting the filter (which would leak everyone else's data).
      return (
        <div className="flex flex-col gap-6 p-8">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {t.admin.pipeline.title}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t.admin.pipeline.subtitle}
            </p>
          </div>
          <PipelineRefSearch />
          <KanbanBoard opportunities={[]} />
        </div>
      )
    }
    oppQ = oppQ.in("client_id", allowed)
  }

  const { data: opportunities } = await oppQ

  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t.admin.pipeline.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t.admin.pipeline.subtitle}</p>
      </div>
      <PipelineRefSearch />
      <KanbanBoard opportunities={(opportunities as OpportunityWithClient[]) ?? []} />
    </div>
  )
}
