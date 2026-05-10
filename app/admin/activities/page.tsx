import { redirect } from "next/navigation"
import { getCurrentRole } from "@/lib/auth/guard"
import {
  getOperationalScope,
  resolveScopedClientIds,
} from "@/lib/auth/scope"
import { getDictionary } from "@/lib/i18n/server"
import { Card, CardContent } from "@/components/ui/card"
import { ActivityList, type ActivityListItem } from "@/components/admin/activity-list"

export const dynamic = "force-dynamic"

export default async function ActivitiesPage() {
  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  const { admin, role, userId } = current
  const { t } = await getDictionary()

  // Sprint client-management-for-AE — scope activities by the opportunity's
  // client. Activities not linked to an opportunity (e.g. role_changed audit
  // entries) are admin-only and hidden from scoped roles.
  const scope = getOperationalScope(role, userId)
  const allowedClientIds = await resolveScopedClientIds(admin, scope)

  // Resolve allowed opportunity IDs first so the activity query can stay a
  // single round-trip (the postgrest inner-join filter does not apply when
  // the foreign relation is nullable, so we filter by id explicitly).
  let allowedOppIds: string[] | null = null
  if (allowedClientIds !== null) {
    if (allowedClientIds.length === 0) {
      allowedOppIds = []
    } else {
      const { data: oppRows } = await admin
        .from("opportunities")
        .select("id")
        .in("client_id", allowedClientIds)
      allowedOppIds = (oppRows ?? []).map((r: { id: string }) => r.id)
    }
  }

  let q = admin
    .from("activities")
    .select(
      `
      id,
      action_type,
      description,
      created_at,
      opportunity_id,
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

  if (allowedOppIds !== null) {
    if (allowedOppIds.length === 0) {
      // No managed opportunities → no rows.
      q = q.eq("opportunity_id", "00000000-0000-0000-0000-000000000000")
    } else {
      q = q.in("opportunity_id", allowedOppIds)
    }
  }

  const { data, error } = await q
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
