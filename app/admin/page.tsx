import { redirect } from "next/navigation"
import { getDictionary } from "@/lib/i18n/server"
import { getCurrentRole } from "@/lib/auth/guard"
import { ownershipScopeFor, resolveAllowedClientIds } from "@/lib/auth/scope"
import { 
  getTeamKPIs, 
  getAEKPIs, 
  getLRKPIs, 
  resolvePeriod,
  type KPIPeriod 
} from "@/lib/kpi/queries"
import { AdminOverviewDashboard } from "@/components/admin/dashboard/admin-overview-dashboard"
import { AEPersonalDashboard } from "@/components/admin/dashboard/ae-personal-dashboard"
import { LRPersonalDashboard } from "@/components/admin/dashboard/lr-personal-dashboard"
import { FinanceDashboard } from "@/components/admin/dashboard/finance-dashboard"
import { ScopeBanner } from "@/components/admin/scope-banner"
import { getDemandSupplyBoard } from "@/lib/sourcing/demand-supply"

export const dynamic = "force-dynamic"

export default async function AdminDashboardPage() {
  const { t, locale } = await getDictionary()

  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  const { admin, role, userId } = current
  
  // Fetch full profile including full_name
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single()
  const scope = ownershipScopeFor(role, userId)

  // Resolve period - default to this month
  const period = resolvePeriod("this_month" as KPIPeriod)

  // Get allowed client IDs for scoped users
  const allowedClientIds = await resolveAllowedClientIds(scope, admin)
  const noScope = allowedClientIds === null
  const empty = !noScope && allowedClientIds.length === 0

  // Helper: count clients for the scope banner
  const clientCount = await (async () => {
    if (empty) return 0
    let q = admin.from("profiles").select("*", { count: "exact", head: true }).eq("role", "client")
    if (!noScope) q = q.eq("account_manager_id", scope.kind === "owned" ? scope.userId : "")
    const { count } = await q
    return count ?? 0
  })()

  // Stage data for pipeline distribution (needed by multiple dashboards)
  let stageQ = admin.from("opportunities").select("stage")
  if (!noScope) {
    if (allowedClientIds!.length === 0) {
      stageQ = stageQ.eq("client_id", "00000000-0000-0000-0000-000000000000")
    } else {
      stageQ = stageQ.in("client_id", allowedClientIds!)
    }
  }
  const { data: stageCounts } = await stageQ

  const stageData = (
    [
      "sample_requested",
      "sample_sent",
      "negotiation",
      "price_agreed",
      "production",
      "shipped",
      "won",
      "lost",
    ] as const
  ).map((key) => ({
    stage: key,
    label: t.kanban.stages[key],
    count: stageCounts?.filter((o: { stage: string }) => o.stage === key).length ?? 0,
  }))

  // Determine which dashboard to show based on role
  const isAdmin = role === "super_admin" || role === "admin"
  const isAE = role === "account_executive"
  const isLR = role === "lead_researcher"
  const isSR = role === "supplier_researcher"
  const isFinance = role === "finance"

  // Get the appropriate KPIs based on role
  let dashboardContent: React.ReactNode

  if (isAdmin) {
    // Admin/Super Admin sees team overview
    const teamKPIs = await getTeamKPIs(period)
    
    // Get stuck deals (opportunities with no stage change in 7+ days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const { data: stuckOpps } = await admin
      .from("opportunities")
      .select("id, buyer_code, stage, updated_at, leads(company_name)")
      .not("stage", "in", "(won,lost)")
      .lt("updated_at", sevenDaysAgo.toISOString())
      .order("updated_at", { ascending: true })
      .limit(10)

    const stuckDeals = (stuckOpps ?? []).map(opp => ({
      id: opp.id,
      buyer: (opp.leads as any)?.company_name ?? opp.buyer_code ?? "Unknown",
      stage: t.kanban.stages[opp.stage as keyof typeof t.kanban.stages] ?? opp.stage,
      daysStuck: Math.floor((Date.now() - new Date(opp.updated_at).getTime()) / (1000 * 60 * 60 * 24)),
    }))

    dashboardContent = (
      <AdminOverviewDashboard
        kpis={teamKPIs}
        period={period}
        locale={locale}
        stageData={stageData}
        stuckDeals={stuckDeals}
      />
    )
  } else if (isAE) {
    // AE sees personal dashboard
    const aeKPIs = await getAEKPIs(userId, period)
    const userName = profile?.full_name ?? "Account Executive"

    dashboardContent = (
      <AEPersonalDashboard
        kpis={aeKPIs}
        period={period}
        locale={locale}
        userName={userName}
        stageData={stageData}
      />
    )
  } else if (isLR) {
    // LR sees import/buyer focused dashboard
    const lrKPIs = await getLRKPIs(userId, period)
    const userName = profile?.full_name ?? "Lead Researcher"

    dashboardContent = (
      <LRPersonalDashboard
        kpis={lrKPIs}
        period={period}
        locale={locale}
        userName={userName}
      />
    )
  } else if (isSR) {
    // Supplier Researcher sees the sourcing board — demand vs supply.
    // (Rendered inline: it is a single aggregate table, not a full
    // dashboard component. The detailed board lives at /admin/sourcing.)
    const board = await getDemandSupplyBoard(admin)
    // The SR's assigned patch — priorities below default to these when set.
    const srIndustries: string[] = (profile?.industries as string[] | null) ?? []
    const priorityRows = board.rows.filter(
      (r) => srIndustries.length === 0 || srIndustries.includes(r.industry),
    )

    dashboardContent = (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            {
              label: locale === "vi" ? "Buyer đã nghiên cứu" : "Buyers researched",
              value: board.totalBuyers,
            },
            {
              label: locale === "vi" ? "Nhu cầu thực" : "Active inquiries",
              value: board.totalActiveInquiries,
            },
            {
              label: locale === "vi" ? "Supplier trong hệ thống" : "Suppliers in pool",
              value: board.totalSuppliers,
            },
            {
              label: locale === "vi" ? "Ngành cần supplier gấp" : "Industries needing supply",
              value: board.urgentIndustries,
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-border bg-card p-4"
            >
              <p className="text-2xl font-semibold text-foreground">{s.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-border">
          <div className="border-b border-border bg-muted/50 px-4 py-2 text-sm font-medium text-foreground">
            {locale === "vi"
              ? "Ưu tiên tìm supplier theo ngành"
              : "Sourcing priorities by industry"}
          </div>
          <ul className="divide-y divide-border">
            {priorityRows
              .filter((r) => r.activeInquiries > 0)
              .slice(0, 8)
              .map((r) => (
                <li
                  key={r.industry}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                >
                  <span className="font-medium text-foreground">{r.industry}</span>
                  <span className="flex items-center gap-3 text-muted-foreground">
                    <span>
                      {r.activeInquiries}{" "}
                      {locale === "vi" ? "nhu cầu" : "inquiries"}
                    </span>
                    <span>
                      {r.suppliers}{" "}
                      {locale === "vi" ? "supplier" : "suppliers"}
                    </span>
                    {r.suppliers === 0 && (
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                        {locale === "vi" ? "Cần tìm gấp" : "Urgent"}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            {priorityRows.filter((r) => r.activeInquiries > 0).length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                {locale === "vi"
                  ? "Chưa có nhu cầu thực nào — Lead Researcher chưa nhập buyer có inquiry."
                  : "No active inquiries yet — no buyer with a real inquiry has been imported."}
              </li>
            )}
          </ul>
        </div>
      </div>
    )
  } else if (isFinance) {
    // Finance sees revenue/invoice dashboard
    const teamKPIs = await getTeamKPIs(period)

    dashboardContent = (
      <FinanceDashboard
        kpis={teamKPIs}
        period={period}
        locale={locale}
      />
    )
  } else {
    // Staff or other roles - show basic admin overview
    const teamKPIs = await getTeamKPIs(period)

    dashboardContent = (
      <AdminOverviewDashboard
        kpis={teamKPIs}
        period={period}
        locale={locale}
        stageData={stageData}
      />
    )
  }

  // Role-specific titles
  const titleMap: Record<string, string> = {
    super_admin: locale === "vi" ? "Tổng quan Hệ thống" : "System Overview",
    admin: locale === "vi" ? "Tổng quan Team" : "Team Overview",
    account_executive: locale === "vi" ? "Dashboard của tôi" : "My Dashboard",
    lead_researcher: locale === "vi" ? "Dashboard của tôi" : "My Dashboard",
    supplier_researcher: locale === "vi" ? "Nguồn cung & Nhu cầu" : "Sourcing Board",
    finance: locale === "vi" ? "Tổng quan Tài chính" : "Finance Overview",
    staff: locale === "vi" ? "Tổng quan" : "Overview",
  }

  const subtitleMap: Record<string, string> = {
    super_admin: locale === "vi" ? "Hiệu suất toàn bộ hệ thống" : "Full system performance",
    admin: locale === "vi" ? "Hiệu suất team bán hàng xuất khẩu" : "Export sales team performance",
    account_executive: locale === "vi" ? "Hiệu suất và KPIs cá nhân" : "Your personal performance & KPIs",
    lead_researcher: locale === "vi" ? "Tiến độ import buyers" : "Buyer import progress",
    supplier_researcher: locale === "vi" ? "Nhu cầu buyer vs nguồn cung supplier" : "Buyer demand vs supplier pool",
    finance: locale === "vi" ? "Doanh thu và hóa đơn" : "Revenue & invoices overview",
    staff: locale === "vi" ? "Tổng quan pipeline" : "Pipeline overview",
  }

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">
          {titleMap[role] ?? t.admin.dashboard.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {subtitleMap[role] ?? t.admin.dashboard.subtitle}
        </p>
        {scope.kind === "owned" && (
          <ScopeBanner
            locale={locale}
            count={clientCount}
            entityVi="khách hàng"
            entityEn="clients"
          />
        )}
      </div>

      {dashboardContent}
    </div>
  )
}
