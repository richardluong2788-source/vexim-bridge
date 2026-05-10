import { redirect } from "next/navigation"
import { getDictionary } from "@/lib/i18n/server"
import { Card, CardContent } from "@/components/ui/card"
import { ActivityList, type ActivityListItem } from "@/components/admin/activity-list"
import { ScopeBanner } from "@/components/admin/scope-banner"
import { getCurrentRole } from "@/lib/auth/guard"
import { ownershipScopeFor } from "@/lib/auth/scope"

export const dynamic = "force-dynamic"

export default async function ActivitiesPage() {
  const { t, locale } = await getDictionary()

  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  const { admin, role, userId } = current
  const scope = ownershipScopeFor(role, userId)

  // Scoped users only see activities tied to opportunities they own.
  // We resolve the allowed opportunity_ids first so the activities query
  // can use a single .in() filter (no nested join filter on activities).
  let allowedOppIds: string[] | null = null
  if (scope.kind === "owned") {
    const { data: ownedOpps } = await admin
      .from("opportunities")
      .select("id")
      .eq("account_manager_id", scope.userId)
    allowedOppIds = (ownedOpps ?? []).map((r: any) => r.id)
  }

  let actQ = admin
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

  if (allowedOppIds !== null) {
    if (allowedOppIds.length === 0) {
      // No owned opps → only show activities the user performed themselves
      // (e.g. login, buyer edits) so the page never appears completely
      // empty for a brand-new AE.
      actQ = actQ.eq("performed_by", scope.kind === "owned" ? scope.userId : "")
    } else {
      actQ = actQ.in("opportunity_id", allowedOppIds)
    }
  }

  const { data, error } = await actQ
  const items = (error ? [] : (data ?? [])) as unknown as ActivityListItem[]

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">{t.admin.activities.title}</h1>
        <p className="text-sm text-muted-foreground">{t.admin.activities.subtitle}</p>
        {scope.kind === "owned" && (
          <ScopeBanner
            locale={locale}
            count={items.length}
            entityVi="hoạt động"
            entityEn="activities"
          />
        )}
      </div>

      <Card className="border-border">
        <CardContent className="p-6">
          <ActivityList items={items} showOpportunity showPerformer />
        </CardContent>
      </Card>
    </div>
  )
}
