/**
 * KPI data layer — personal KPI metrics for each role.
 *
 * Server-only. Called from the /admin/my-kpi page.
 *
 * Each role sees different metrics relevant to their work:
 *   - AE: deals, revenue, win rate, ranking
 *   - LR: buyers imported, matched, conversion
 *   - Finance: revenue, invoices, payments
 *   - Admin: team overview
 */
import { createAdminClient } from "@/lib/supabase/admin"
import type { Role } from "@/lib/supabase/types"

// ---------------------------------------------------------------------------
// Period helpers
// ---------------------------------------------------------------------------
export type KPIPeriod = "this_month" | "last_month" | "this_quarter" | "this_year"

export interface PeriodWindow {
  from: string
  to: string
  label: string
  labelVi: string
}

export function resolvePeriod(period: KPIPeriod): PeriodWindow {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()

  switch (period) {
    case "this_month": {
      const from = new Date(Date.UTC(y, m, 1))
      const to = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59))
      return {
        from: from.toISOString(),
        to: to.toISOString(),
        label: from.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        labelVi: from.toLocaleDateString("vi-VN", { month: "long", year: "numeric" }),
      }
    }
    case "last_month": {
      const from = new Date(Date.UTC(y, m - 1, 1))
      const to = new Date(Date.UTC(y, m, 0, 23, 59, 59))
      return {
        from: from.toISOString(),
        to: to.toISOString(),
        label: from.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        labelVi: from.toLocaleDateString("vi-VN", { month: "long", year: "numeric" }),
      }
    }
    case "this_quarter": {
      const q = Math.floor(m / 3)
      const from = new Date(Date.UTC(y, q * 3, 1))
      const to = new Date(Date.UTC(y, q * 3 + 3, 0, 23, 59, 59))
      return {
        from: from.toISOString(),
        to: to.toISOString(),
        label: `Q${q + 1} ${y}`,
        labelVi: `Quý ${q + 1} ${y}`,
      }
    }
    case "this_year": {
      const from = new Date(Date.UTC(y, 0, 1))
      const to = new Date(Date.UTC(y, 11, 31, 23, 59, 59))
      return {
        from: from.toISOString(),
        to: to.toISOString(),
        label: `${y}`,
        labelVi: `Năm ${y}`,
      }
    }
  }
}

// ---------------------------------------------------------------------------
// AE KPIs
// ---------------------------------------------------------------------------
export interface AEKPIs {
  // Deals
  dealsWon: number
  dealsLost: number
  dealsInProgress: number
  winRate: number
  teamAvgWinRate: number

  // Revenue
  revenueThisMonth: number
  revenueLastMonth: number
  revenueGrowth: number // percentage

  // Commission
  commissionEarned: number
  commissionPending: number

  // Clients
  totalClients: number
  activeClients: number // clients with in-progress deals

  // Ranking
  rankInTeam: number
  totalAEs: number

  // Trend
  monthlyTrend: { month: string; won: number; lost: number; revenue: number }[]
}

export async function getAEKPIs(userId: string, period: PeriodWindow): Promise<AEKPIs> {
  const admin = createAdminClient()

  // Get clients managed by this AE
  const { data: clients } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "client")
    .eq("account_manager_id", userId)

  const clientIds = (clients ?? []).map((c) => c.id)
  const totalClients = clientIds.length

  if (clientIds.length === 0) {
    return {
      dealsWon: 0,
      dealsLost: 0,
      dealsInProgress: 0,
      winRate: 0,
      teamAvgWinRate: 0,
      revenueThisMonth: 0,
      revenueLastMonth: 0,
      revenueGrowth: 0,
      commissionEarned: 0,
      commissionPending: 0,
      totalClients: 0,
      activeClients: 0,
      rankInTeam: 0,
      totalAEs: 1,
      monthlyTrend: [],
    }
  }

  // Won/Lost in period
  const { data: transitions } = await admin
    .from("stage_transitions")
    .select("opportunity_id, to_stage, transitioned_at, opportunities!inner(client_id)")
    .in("to_stage", ["won", "lost"])
    .gte("transitioned_at", period.from)
    .lte("transitioned_at", period.to)
    .in("opportunities.client_id", clientIds)

  const wonOppIds = new Set<string>()
  const lostOppIds = new Set<string>()
  for (const t of transitions ?? []) {
    if (t.to_stage === "won") wonOppIds.add(t.opportunity_id)
    else if (t.to_stage === "lost") lostOppIds.add(t.opportunity_id)
  }
  const dealsWon = wonOppIds.size
  const dealsLost = lostOppIds.size
  const decided = dealsWon + dealsLost
  const winRate = decided > 0 ? Math.round((dealsWon / decided) * 100) : 0

  // In-progress
  const { data: inProgressOpps } = await admin
    .from("opportunities")
    .select("id")
    .in("client_id", clientIds)
    .in("stage", ["new", "contacted", "qualified", "proposal_sent", "negotiation"])

  const dealsInProgress = inProgressOpps?.length ?? 0

  // Active clients (clients with in-progress deals)
  const { data: activeClientData } = await admin
    .from("opportunities")
    .select("client_id")
    .in("client_id", clientIds)
    .in("stage", ["new", "contacted", "qualified", "proposal_sent", "negotiation"])

  const activeClientIds = new Set((activeClientData ?? []).map((o) => o.client_id))
  const activeClients = activeClientIds.size

  // Revenue this period (from won deals)
  const { data: wonDeals } = await admin
    .from("deals")
    .select("total_value, commission_amount, payment_status, opportunities!inner(client_id)")
    .gte("created_at", period.from)
    .lte("created_at", period.to)
    .in("opportunities.client_id", clientIds)

  let revenueThisMonth = 0
  let commissionEarned = 0
  let commissionPending = 0
  for (const d of wonDeals ?? []) {
    revenueThisMonth += Number(d.total_value ?? 0)
    if (d.payment_status === "paid") {
      commissionEarned += Number(d.commission_amount ?? 0)
    } else {
      commissionPending += Number(d.commission_amount ?? 0)
    }
  }

  // Revenue last month (for comparison)
  const lastMonthPeriod = resolvePeriod("last_month")
  const { data: lastMonthDeals } = await admin
    .from("deals")
    .select("total_value, opportunities!inner(client_id)")
    .gte("created_at", lastMonthPeriod.from)
    .lte("created_at", lastMonthPeriod.to)
    .in("opportunities.client_id", clientIds)

  let revenueLastMonth = 0
  for (const d of lastMonthDeals ?? []) {
    revenueLastMonth += Number(d.total_value ?? 0)
  }

  const revenueGrowth =
    revenueLastMonth > 0
      ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100)
      : revenueThisMonth > 0
        ? 100
        : 0

  // Team average win rate
  const { data: allTransitions } = await admin
    .from("stage_transitions")
    .select("opportunity_id, to_stage")
    .in("to_stage", ["won", "lost"])
    .gte("transitioned_at", period.from)
    .lte("transitioned_at", period.to)

  const teamWon = new Set<string>()
  const teamLost = new Set<string>()
  for (const t of allTransitions ?? []) {
    if (t.to_stage === "won") teamWon.add(t.opportunity_id)
    else if (t.to_stage === "lost") teamLost.add(t.opportunity_id)
  }
  const teamDecided = teamWon.size + teamLost.size
  const teamAvgWinRate = teamDecided > 0 ? Math.round((teamWon.size / teamDecided) * 100) : 0

  // Ranking by revenue
  const { data: allAEs } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "account_executive")

  const aeIds = (allAEs ?? []).map((a) => a.id)
  const totalAEs = aeIds.length

  // Get revenue for all AEs
  const aeRevenues: { aeId: string; revenue: number }[] = []
  for (const aeId of aeIds) {
    const { data: aeClients } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "client")
      .eq("account_manager_id", aeId)

    const aeClientIds = (aeClients ?? []).map((c) => c.id)
    if (aeClientIds.length === 0) {
      aeRevenues.push({ aeId, revenue: 0 })
      continue
    }

    const { data: aeDeals } = await admin
      .from("deals")
      .select("total_value, opportunities!inner(client_id)")
      .gte("created_at", period.from)
      .lte("created_at", period.to)
      .in("opportunities.client_id", aeClientIds)

    const rev = (aeDeals ?? []).reduce((sum, d) => sum + Number(d.total_value ?? 0), 0)
    aeRevenues.push({ aeId, revenue: rev })
  }

  aeRevenues.sort((a, b) => b.revenue - a.revenue)
  const rankInTeam = aeRevenues.findIndex((a) => a.aeId === userId) + 1

  // Monthly trend (last 6 months)
  const monthlyTrend: { month: string; won: number; lost: number; revenue: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const monthStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
    const monthEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59))

    const { data: monthTrans } = await admin
      .from("stage_transitions")
      .select("opportunity_id, to_stage, opportunities!inner(client_id)")
      .in("to_stage", ["won", "lost"])
      .gte("transitioned_at", monthStart.toISOString())
      .lte("transitioned_at", monthEnd.toISOString())
      .in("opportunities.client_id", clientIds)

    const monthWon = new Set(
      (monthTrans ?? []).filter((t) => t.to_stage === "won").map((t) => t.opportunity_id)
    ).size
    const monthLost = new Set(
      (monthTrans ?? []).filter((t) => t.to_stage === "lost").map((t) => t.opportunity_id)
    ).size

    const { data: monthDeals } = await admin
      .from("deals")
      .select("total_value, opportunities!inner(client_id)")
      .gte("created_at", monthStart.toISOString())
      .lte("created_at", monthEnd.toISOString())
      .in("opportunities.client_id", clientIds)

    const monthRevenue = (monthDeals ?? []).reduce((s, d) => s + Number(d.total_value ?? 0), 0)

    monthlyTrend.push({
      month: monthStart.toLocaleDateString("vi-VN", { month: "short" }),
      won: monthWon,
      lost: monthLost,
      revenue: monthRevenue,
    })
  }

  return {
    dealsWon,
    dealsLost,
    dealsInProgress,
    winRate,
    teamAvgWinRate,
    revenueThisMonth,
    revenueLastMonth,
    revenueGrowth,
    commissionEarned,
    commissionPending,
    totalClients,
    activeClients,
    rankInTeam,
    totalAEs,
    monthlyTrend,
  }
}

// ---------------------------------------------------------------------------
// LR KPIs
// ---------------------------------------------------------------------------

/**
 * Lead Researcher monthly target — the minimum number of unique buyers
 * each LR is expected to source in a calendar month.
 *
 * Adjust here to roll out a new target across the org; it flows into the
 * KPI dashboard and any future SLA enforcement.
 */
export const LR_MONTHLY_BUYER_TARGET = 40

export interface LRKPIs {
  // Buyers
  buyersImportedThisMonth: number
  buyersImportedLastMonth: number
  buyersGrowth: number

  // Target tracking — primary metric for LR.
  monthlyTarget: number               // = LR_MONTHLY_BUYER_TARGET
  targetProgressPct: number           // 0..100+ (capped at 999 in UI)
  targetRemaining: number             // max(0, target - imported)
  targetMet: boolean                  // imported >= target

  // Top categories
  topCountries: { country: string; count: number }[]
  topIndustries: { industry: string; count: number }[]

  // Trend (target line shown alongside)
  monthlyTrend: { month: string; imported: number }[]
}

export async function getLRKPIs(userId: string, period: PeriodWindow): Promise<LRKPIs> {
  const admin = createAdminClient()

  // Buyers imported by this LR in period
  const { data: importedBuyers } = await admin
    .from("leads")
    .select("id, country, industry, created_at")
    .eq("created_by", userId)
    .gte("created_at", period.from)
    .lte("created_at", period.to)

  const buyersImportedThisMonth = importedBuyers?.length ?? 0

  // Buyers imported last month
  const lastMonthPeriod = resolvePeriod("last_month")
  const { data: lastMonthBuyers } = await admin
    .from("leads")
    .select("id")
    .eq("created_by", userId)
    .gte("created_at", lastMonthPeriod.from)
    .lte("created_at", lastMonthPeriod.to)

  const buyersImportedLastMonth = lastMonthBuyers?.length ?? 0
  const buyersGrowth =
    buyersImportedLastMonth > 0
      ? Math.round(((buyersImportedThisMonth - buyersImportedLastMonth) / buyersImportedLastMonth) * 100)
      : buyersImportedThisMonth > 0
        ? 100
        : 0

  // Target tracking — buyers per month vs LR_MONTHLY_BUYER_TARGET.
  // Progress is calculated against the *current period* count so it works
  // for "this_month" and any other selected window the user previews.
  const monthlyTarget = LR_MONTHLY_BUYER_TARGET
  const targetProgressPct =
    monthlyTarget > 0 ? Math.round((buyersImportedThisMonth / monthlyTarget) * 100) : 0
  const targetRemaining = Math.max(0, monthlyTarget - buyersImportedThisMonth)
  const targetMet = buyersImportedThisMonth >= monthlyTarget

  // Top countries
  const countryMap = new Map<string, number>()
  for (const b of importedBuyers ?? []) {
    const c = b.country || "Unknown"
    countryMap.set(c, (countryMap.get(c) ?? 0) + 1)
  }
  const topCountries = [...countryMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([country, count]) => ({ country, count }))

  // Top industries
  const industryMap = new Map<string, number>()
  for (const b of importedBuyers ?? []) {
    const i = b.industry || "Unknown"
    industryMap.set(i, (industryMap.get(i) ?? 0) + 1)
  }
  const topIndustries = [...industryMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([industry, count]) => ({ industry, count }))

  // Monthly trend (last 6 months) — only `imported` is needed; the target
  // is a constant rendered as a reference line in the chart.
  const monthlyTrend: { month: string; imported: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const monthStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
    const monthEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59))

    const { data: monthBuyers } = await admin
      .from("leads")
      .select("id")
      .eq("created_by", userId)
      .gte("created_at", monthStart.toISOString())
      .lte("created_at", monthEnd.toISOString())

    monthlyTrend.push({
      month: monthStart.toLocaleDateString("vi-VN", { month: "short" }),
      imported: monthBuyers?.length ?? 0,
    })
  }

  return {
    buyersImportedThisMonth,
    buyersImportedLastMonth,
    buyersGrowth,
    monthlyTarget,
    targetProgressPct,
    targetRemaining,
    targetMet,
    topCountries,
    topIndustries,
    monthlyTrend,
  }
}

// ---------------------------------------------------------------------------
// Admin/Finance KPIs (Team Overview)
// ---------------------------------------------------------------------------
export interface TeamKPIs {
  // Overall
  totalRevenue: number
  totalDealsWon: number
  totalDealsLost: number
  overallWinRate: number

  // Team members
  totalAEs: number
  totalLRs: number
  totalClients: number
  totalBuyers: number

  // Top performers
  topAEs: { id: string; name: string; revenue: number; deals: number }[]
  topLRs: { id: string; name: string; imported: number; matched: number }[]

  // Invoices (Finance)
  invoicesPending: number
  invoicesOverdue: number
  invoicesPaid: number
  totalPendingAmount: number
}

export async function getTeamKPIs(period: PeriodWindow): Promise<TeamKPIs> {
  const admin = createAdminClient()

  // Total deals
  const { data: allTransitions } = await admin
    .from("stage_transitions")
    .select("opportunity_id, to_stage")
    .in("to_stage", ["won", "lost"])
    .gte("transitioned_at", period.from)
    .lte("transitioned_at", period.to)

  const wonIds = new Set<string>()
  const lostIds = new Set<string>()
  for (const t of allTransitions ?? []) {
    if (t.to_stage === "won") wonIds.add(t.opportunity_id)
    else lostIds.add(t.opportunity_id)
  }
  const totalDealsWon = wonIds.size
  const totalDealsLost = lostIds.size
  const decided = totalDealsWon + totalDealsLost
  const overallWinRate = decided > 0 ? Math.round((totalDealsWon / decided) * 100) : 0

  // Total revenue
  const { data: allDeals } = await admin
    .from("deals")
    .select("total_value")
    .gte("created_at", period.from)
    .lte("created_at", period.to)

  const totalRevenue = (allDeals ?? []).reduce((s, d) => s + Number(d.total_value ?? 0), 0)

  // Team counts
  const { count: totalAEs } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "account_executive")

  const { count: totalLRs } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "lead_researcher")

  const { count: totalClients } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "client")

  const { count: totalBuyers } = await admin
    .from("leads")
    .select("id", { count: "exact", head: true })

  // Top AEs by revenue
  const { data: allAEProfiles } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("role", "account_executive")

  const aePerf: { id: string; name: string; revenue: number; deals: number }[] = []
  for (const ae of allAEProfiles ?? []) {
    const { data: aeClients } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "client")
      .eq("account_manager_id", ae.id)

    const clientIds = (aeClients ?? []).map((c) => c.id)
    if (clientIds.length === 0) {
      aePerf.push({ id: ae.id, name: ae.full_name ?? "Unknown", revenue: 0, deals: 0 })
      continue
    }

    const { data: aeDeals } = await admin
      .from("deals")
      .select("total_value, opportunities!inner(client_id)")
      .gte("created_at", period.from)
      .lte("created_at", period.to)
      .in("opportunities.client_id", clientIds)

    const rev = (aeDeals ?? []).reduce((s, d) => s + Number(d.total_value ?? 0), 0)
    aePerf.push({ id: ae.id, name: ae.full_name ?? "Unknown", revenue: rev, deals: aeDeals?.length ?? 0 })
  }
  const topAEs = aePerf.sort((a, b) => b.revenue - a.revenue).slice(0, 5)

  // Top LRs by buyers imported
  const { data: allLRProfiles } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("role", "lead_researcher")

  const lrPerf: { id: string; name: string; imported: number; matched: number }[] = []
  for (const lr of allLRProfiles ?? []) {
    const { data: lrBuyers } = await admin
      .from("leads")
      .select("id")
      .eq("created_by", lr.id)
      .gte("created_at", period.from)
      .lte("created_at", period.to)

    const buyerIds = (lrBuyers ?? []).map((b) => b.id)
    let matched = 0
    if (buyerIds.length > 0) {
      const { data: opps } = await admin
        .from("opportunities")
        .select("lead_id")
        .in("lead_id", buyerIds)

      matched = new Set((opps ?? []).map((o) => o.lead_id)).size
    }

    lrPerf.push({ id: lr.id, name: lr.full_name ?? "Unknown", imported: lrBuyers?.length ?? 0, matched })
  }
  const topLRs = lrPerf.sort((a, b) => b.imported - a.imported).slice(0, 5)

  // Invoice stats
  const { data: pendingInvoices } = await admin
    .from("invoices")
    .select("id, total_amount, due_date, status")
    .eq("status", "pending")

  const now = new Date().toISOString()
  const invoicesPending = pendingInvoices?.length ?? 0
  const invoicesOverdue = (pendingInvoices ?? []).filter((i) => i.due_date && i.due_date < now).length
  const totalPendingAmount = (pendingInvoices ?? []).reduce((s, i) => s + Number(i.total_amount ?? 0), 0)

  const { count: invoicesPaid } = await admin
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("status", "paid")
    .gte("paid_at", period.from)
    .lte("paid_at", period.to)

  return {
    totalRevenue,
    totalDealsWon,
    totalDealsLost,
    overallWinRate,
    totalAEs: totalAEs ?? 0,
    totalLRs: totalLRs ?? 0,
    totalClients: totalClients ?? 0,
    totalBuyers: totalBuyers ?? 0,
    topAEs,
    topLRs,
    invoicesPending,
    invoicesOverdue,
    invoicesPaid: invoicesPaid ?? 0,
    totalPendingAmount,
  }
}
