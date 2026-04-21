import { createClient } from "@/lib/supabase/server"
import { KanbanBoard } from "@/components/admin/kanban-board"
import type { OpportunityWithClient } from "@/lib/supabase/types"
import { getDictionary } from "@/lib/i18n/server"

export default async function AdminPipelinePage() {
  const supabase = await createClient()
  const { t } = await getDictionary()

  const { data: opportunities } = await supabase
    .from("opportunities")
    .select(`
      *,
      profiles:client_id (*),
      leads:lead_id (*)
    `)
    .order("last_updated", { ascending: false })

  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t.admin.pipeline.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t.admin.pipeline.subtitle}</p>
      </div>
      <KanbanBoard opportunities={(opportunities as OpportunityWithClient[]) ?? []} />
    </div>
  )
}
