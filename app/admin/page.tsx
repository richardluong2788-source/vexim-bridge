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

export const dynamic = "force-dynamic"

export default async function AdminDashboardPage() {
  const { t, locale } = await getDictionary()

  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  const { admin, role, userId, profile } = current
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
    finance: locale === "vi" ? "Tổng quan Tài chính" : "Finance Overview",
    staff: locale === "vi" ? "Tổng quan" : "Overview",
  }

  const subtitleMap: Record<string, string> = {
    super_admin: locale === "vi" ? "Hiệu suất toàn bộ hệ thống" : "Full system performance",
    admin: locale === "vi" ? "Hiệu suất team bán hàng xuất khẩu" : "Export sales team performance",
    account_executive: locale === "vi" ? "Hiệu suất và KPIs cá nhân" : "Your personal performance & KPIs",
    lead_researcher: locale === "vi" ? "Tiến độ import buyers" : "Buyer import progress",
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
