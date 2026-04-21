import { createClient } from "@/lib/supabase/server"
import { getDictionary } from "@/lib/i18n/server"
import { Card, CardContent } from "@/components/ui/card"
import { ActivityList, type ActivityListItem } from "@/components/admin/activity-list"

export default async function ActivitiesPage() {
  const supabase = await createClient()
  const { t } = await getDictionary()

  // Pull the most recent 100 activities with joined opportunity/lead/client + performer.
  // Admin RLS policy allows full access.
  const { data, error } = await supabase
    .from("activities")
    .select(
      `
      id,
      action_type,
      description,
      created_at,
      performer:profiles!activities_performed_by_fkey(full_name, email),
      opportunity:opportunities(
        id,
        stage,
        lead:leads(company_name),
        client:profiles!opportunities_client_id_fkey(company_name, full_name)
      )
      `,
    )
    .order("created_at", { ascending: false })
    .limit(100)

  const items = (error ? [] : (data ?? [])) as unknown as ActivityListItem[]

  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t.admin.activities.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t.admin.activities.subtitle}</p>
      </div>

      <Card className="border-border">
        <CardContent className="p-6">
          <ActivityList items={items} showOpportunity showPerformer />
        </CardContent>
      </Card>
    </div>
  )
}
