import { redirect } from "next/navigation"
import { getDictionary } from "@/lib/i18n/server"
import { Card, CardContent } from "@/components/ui/card"
import { ActivityList, type ActivityListItem } from "@/components/admin/activity-list"
import { ScopeBanner } from "@/components/admin/scope-banner"
import { getCurrentRole } from "@/lib/auth/guard"
import { ownershipScopeFor } from "@/lib/auth/scope"
import { CAPS, can } from "@/lib/auth/permissions"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 50

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { t, locale } = await getDictionary()
  const urlPage = Number((await searchParams).page ?? "1")
  const page = Number.isFinite(urlPage) && urlPage >= 1 ? Math.floor(urlPage) : 1
  const from = (page - 1) * PAGE_SIZE

  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  // Capability gate (defense-in-depth) — same rationale as the pipeline
  // page: OWNERSHIP_BYPASS roles without ACTIVITY_LOG_VIEW (e.g.
  // supplier_researcher) must not reach the audit log via direct URL.
  if (!can(current.role, CAPS.ACTIVITY_LOG_VIEW)) redirect("/admin")
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

  // Tổng số (cùng scope) để dựng phân trang — đếm trước khi áp .range().
  let countQ = admin
    .from("activities")
    .select("id", { count: "exact", head: true })
  if (allowedOppIds !== null) {
    if (allowedOppIds.length === 0) {
      countQ = countQ.eq("performed_by", scope.kind === "owned" ? scope.userId : "")
    } else {
      countQ = countQ.in("opportunity_id", allowedOppIds)
    }
  }
  const { count } = await countQ
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Trang ngoài khoảng (URL tay) → kẹp về trang cuối, không 404.
  const safePage = Math.min(page, totalPages)
  const { data, error } = await actQ.range(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE - 1,
  )
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>
            {t.admin.activities.title} {((safePage - 1) * PAGE_SIZE) + 1}
            &ndash;
            {Math.min(safePage * PAGE_SIZE, total)} / {total}
          </p>
          <div className="flex items-center gap-2">
            {safePage > 1 && (
              <a
                href={`/admin/activities?page=${safePage - 1}`}
                className="rounded-md border border-border px-3 py-1.5 hover:bg-muted"
              >
                &larr; {locale === "vi" ? "Trước" : "Prev"}
              </a>
            )}
            <span className="px-1">
              {safePage} / {totalPages}
            </span>
            {safePage < totalPages && (
              <a
                href={`/admin/activities?page=${safePage + 1}`}
                className="rounded-md border border-border px-3 py-1.5 hover:bg-muted"
              >
                {locale === "vi" ? "Sau" : "Next"} &rarr;
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
