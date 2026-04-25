/**
 * Client-side analytics data layer for the /client/analytics page.
 *
 * SECURITY MODEL — read this before changing anything.
 * ----------------------------------------------------
 * Unlike `lib/analytics/queries.ts` (which uses createAdminClient and bypasses
 * RLS because admins legitimately see ALL clients), this module:
 *
 *   1. Uses `createClient()` (the SSR / RLS-bound client) — never the admin
 *      / service-role client. Cross-client leakage is therefore impossible
 *      even if a query forgets to filter by `client_id`.
 *
 *   2. Reads buyer-related data ONLY from `client_leads_masked`, the
 *      DB view that withholds buyer PII (company_name, contact_email,
 *      contact_phone, contact_person, website, linkedin_url) until the
 *      stage is `price_agreed` (level 2) or `shipped`/`won` (level 3).
 *      See migration 013_security_hardening.sql.
 *
 *   3. Drops 10-stage internals into the 5-phase client model
 *      (`stageToClientPhase`) before returning to the UI, so internal
 *      operational details never reach the browser.
 *
 *   4. For win/loss segment breakdowns, only counts opportunities that
 *      ever reached `price_agreed` or beyond. This matches the user's
 *      explicit choice ("ch��� tính trên deal đã đến price_agreed trở lên")
 *      and avoids leaking signals about what buyer pool VXB is currently
 *      prospecting on behalf of competing clients.
 *
 *   5. Stuck-deal data is reframed as "awaiting buyer response" — we do
 *      not surface internal stuck thresholds, days-overshoot, or any
 *      number that would let the client second-guess VXB's playbook.
 *
 * Period filtering uses the same shared `PeriodWindow` helpers as the
 * admin page so the UX dropdown stays consistent.
 */
import { createClient } from "@/lib/supabase/server"
import type { Stage } from "@/lib/supabase/types"
import {
  CLIENT_PHASE_ORDER,
  stageToClientPhase,
  type ClientPhase,
} from "@/lib/pipeline/phases"
import {
  monthlyBuckets,
  monthKey,
  type PeriodWindow,
} from "@/lib/analytics/constants"

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Resolve the current authenticated client_id, throwing on absence. */
async function getClientId(): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("client-queries: no authenticated user")
  return user.id
}

interface MaskedRow {
  opportunity_id: string
  stage: Stage
  industry: string | null
  region: string | null
  potential_value: number | null
  created_at: string
  last_updated: string
  buyer_code: string | null
  // Only set at disclosure level >= 2.
  company_name: string | null
}

async function fetchAllMasked(): Promise<MaskedRow[]> {
  const supabase = await createClient()
  const clientId = await getClientId()

  const { data } = await supabase
    .from("client_leads_masked")
    .select(
      `opportunity_id, stage, industry, region, potential_value,
       created_at, last_updated, buyer_code, company_name`,
    )
    .eq("client_id", clientId)

  return (data ?? []) as unknown as MaskedRow[]
}

// ---------------------------------------------------------------------------
// Tab 1 — Overview KPIs + monthly trend + headline phase snapshot
// ---------------------------------------------------------------------------

export interface ClientOverviewKpis {
  /** Opportunities created within the period. */
  newOpportunities: number
  /** Opportunities currently in stage = won (snapshot, not period-bound). */
  totalWon: number
  /** Currently in-progress count. */
  inProgress: number
  /** Currently in-progress potential value (USD). */
  inProgressValue: number
  /** Won transitions in period (period-bound). */
  wonInPeriod: number
  /** Lost transitions in period (period-bound). */
  lostInPeriod: number
  /** wonInPeriod / (wonInPeriod + lostInPeriod), rounded %. */
  winRate: number
  /** Median days from creation to won, all-time. Null if no won deals. */
  avgWinCycleDays: number | null
  /** Commission USD paid in period. */
  commissionPaidInPeriod: number
  /** Commission USD paid all-time. */
  commissionPaidAllTime: number
  /** How many paid deals contributed to commissionPaidAllTime. */
  paidDealsCount: number
}

export async function getClientOverviewKpis(
  period: PeriodWindow,
): Promise<ClientOverviewKpis> {
  const supabase = await createClient()
  const clientId = await getClientId()

  // 1) Opportunities snapshot via masked view
  const opps = await fetchAllMasked()
  const fromMs = period.from ? new Date(period.from).getTime() : 0

  let newOpportunities = 0
  let totalWon = 0
  let inProgress = 0
  let inProgressValue = 0
  for (const o of opps) {
    if (new Date(o.created_at).getTime() >= fromMs) newOpportunities += 1
    if (o.stage === "won") totalWon += 1
    if (o.stage !== "won" && o.stage !== "lost") {
      inProgress += 1
      inProgressValue += Number(o.potential_value ?? 0)
    }
  }

  // 2) Won/lost transitions in period — uses the new RLS policy from
  //    migration 030. If the policy isn't applied yet, this returns []
  //    and the win-rate stays at 0%, which is a safe default.
  const oppIds = opps.map((o) => o.opportunity_id)
  let wonInPeriod = 0
  let lostInPeriod = 0
  let avgWinCycleDays: number | null = null

  if (oppIds.length > 0) {
    let transQ = supabase
      .from("stage_transitions")
      .select("opportunity_id, to_stage, transitioned_at")
      .in("opportunity_id", oppIds)
      .in("to_stage", ["won", "lost"])
    if (period.from) transQ = transQ.gte("transitioned_at", period.from)
    const { data: trans } = await transQ

    const latestPerOpp = new Map<string, "won" | "lost">()
    for (const t of (trans ?? []) as Array<{
      opportunity_id: string
      to_stage: string
    }>) {
      if (t.to_stage === "won" || t.to_stage === "lost") {
        latestPerOpp.set(t.opportunity_id, t.to_stage)
      }
    }
    wonInPeriod = [...latestPerOpp.values()].filter((v) => v === "won").length
    lostInPeriod = [...latestPerOpp.values()].filter((v) => v === "lost").length

    // Cycle: from opp.created_at to first won transition (all-time, not period-bound)
    const { data: wonTrans } = await supabase
      .from("stage_transitions")
      .select("opportunity_id, transitioned_at")
      .in("opportunity_id", oppIds)
      .eq("to_stage", "won")
    const oppCreated = new Map(opps.map((o) => [o.opportunity_id, o.created_at]))
    const cycles: number[] = []
    for (const r of (wonTrans ?? []) as Array<{
      opportunity_id: string
      transitioned_at: string
    }>) {
      const created = oppCreated.get(r.opportunity_id)
      if (!created) continue
      const days =
        (new Date(r.transitioned_at).getTime() - new Date(created).getTime()) /
        86_400_000
      if (days >= 0) cycles.push(Math.round(days))
    }
    if (cycles.length > 0) {
      avgWinCycleDays = Math.round(
        cycles.reduce((a, b) => a + b, 0) / cycles.length,
      )
    }
  }

  const decided = wonInPeriod + lostInPeriod
  const winRate = decided > 0 ? Math.round((wonInPeriod / decided) * 100) : 0

  // 3) Commission timeline via SECURITY INVOKER view
  let commQ = supabase
    .from("client_commission_timeline")
    .select("paid_on, commission_amount")
    .eq("client_id", clientId)
  const { data: commAllTime } = await commQ
  const commissionPaidAllTime = (commAllTime ?? []).reduce(
    (acc: number, r: { commission_amount: number | null }) =>
      acc + Number(r.commission_amount ?? 0),
    0,
  )

  let commissionPaidInPeriod = 0
  if (period.from) {
    const fromDate = period.from.slice(0, 10) // YYYY-MM-DD
    for (const r of (commAllTime ?? []) as Array<{
      paid_on: string
      commission_amount: number | null
    }>) {
      if (r.paid_on >= fromDate)
        commissionPaidInPeriod += Number(r.commission_amount ?? 0)
    }
  } else {
    commissionPaidInPeriod = commissionPaidAllTime
  }

  return {
    newOpportunities,
    totalWon,
    inProgress,
    inProgressValue,
    wonInPeriod,
    lostInPeriod,
    winRate,
    avgWinCycleDays,
    commissionPaidInPeriod,
    commissionPaidAllTime,
    paidDealsCount: commAllTime?.length ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Monthly trend — last 12 months of created / won / lost
// ---------------------------------------------------------------------------

export interface ClientTrendPoint {
  key: string
  label: string
  created: number
  won: number
  lost: number
}

export async function getClientMonthlyTrend(
  months = 12,
  locale: "vi" | "en" = "vi",
): Promise<ClientTrendPoint[]> {
  const supabase = await createClient()
  const opps = await fetchAllMasked()
  const buckets = monthlyBuckets(months, locale)
  const out: ClientTrendPoint[] = buckets.map((b) => ({
    ...b,
    created: 0,
    won: 0,
    lost: 0,
  }))
  const idx = new Map(buckets.map((b, i) => [b.key, i]))

  // Created (from opps)
  for (const o of opps) {
    const i = idx.get(monthKey(o.created_at))
    if (i !== undefined) out[i].created += 1
  }

  // Won/lost from transitions
  const oppIds = opps.map((o) => o.opportunity_id)
  if (oppIds.length === 0) return out

  const fromIso = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - (months - 1), 1),
  ).toISOString()

  const { data: trans } = await supabase
    .from("stage_transitions")
    .select("opportunity_id, to_stage, transitioned_at")
    .in("opportunity_id", oppIds)
    .in("to_stage", ["won", "lost"])
    .gte("transitioned_at", fromIso)

  const seen = new Set<string>()
  for (const r of (trans ?? []) as Array<{
    opportunity_id: string
    to_stage: string
    transitioned_at: string
  }>) {
    const k = monthKey(r.transitioned_at)
    const dedup = `${r.opportunity_id}|${k}|${r.to_stage}`
    if (seen.has(dedup)) continue
    seen.add(dedup)
    const i = idx.get(k)
    if (i === undefined) continue
    if (r.to_stage === "won") out[i].won += 1
    else if (r.to_stage === "lost") out[i].lost += 1
  }

  return out
}

// ---------------------------------------------------------------------------
// Tab 2 — Phase distribution + avg time per phase + awaiting-response list
// ---------------------------------------------------------------------------

export interface PhaseDistribution {
  phase: ClientPhase
  count: number
}

export async function getClientPhaseDistribution(): Promise<PhaseDistribution[]> {
  const opps = await fetchAllMasked()
  const counts = new Map<ClientPhase, number>()
  for (const o of opps) {
    const p = stageToClientPhase(o.stage)
    counts.set(p, (counts.get(p) ?? 0) + 1)
  }
  // Closed_lost is its own bucket but we still display it in this tab.
  const phases: ClientPhase[] = [...CLIENT_PHASE_ORDER, "closed_lost"]
  return phases.map((p) => ({ phase: p, count: counts.get(p) ?? 0 }))
}

export interface AvgTimeInPhase {
  phase: ClientPhase
  /** Median number of days a deal spent in this phase, across all-time history. */
  medianDays: number | null
  /** How many deals contributed to the median. */
  sampleSize: number
}

/**
 * For each of the 5 client phases, compute the median number of days a deal
 * historically spent in that phase. We aggregate over `time_in_previous_stage_seconds`
 * grouped by `from_stage` mapped to its client phase.
 */
export async function getClientAvgTimePerPhase(): Promise<AvgTimeInPhase[]> {
  const supabase = await createClient()
  const opps = await fetchAllMasked()
  const oppIds = opps.map((o) => o.opportunity_id)

  if (oppIds.length === 0) {
    return CLIENT_PHASE_ORDER.map((p) => ({
      phase: p,
      medianDays: null,
      sampleSize: 0,
    }))
  }

  const { data: trans } = await supabase
    .from("stage_transitions")
    .select("from_stage, time_in_previous_stage_seconds")
    .in("opportunity_id", oppIds)
    .not("from_stage", "is", null)
    .not("time_in_previous_stage_seconds", "is", null)

  const byPhase = new Map<ClientPhase, number[]>()
  for (const r of (trans ?? []) as Array<{
    from_stage: Stage | null
    time_in_previous_stage_seconds: number | null
  }>) {
    if (!r.from_stage || r.time_in_previous_stage_seconds == null) continue
    const phase = stageToClientPhase(r.from_stage)
    if (phase === "closed_lost") continue
    const days = r.time_in_previous_stage_seconds / 86400
    const slot = byPhase.get(phase) ?? []
    slot.push(days)
    byPhase.set(phase, slot)
  }

  return CLIENT_PHASE_ORDER.map((p) => {
    const arr = byPhase.get(p) ?? []
    if (arr.length === 0) return { phase: p, medianDays: null, sampleSize: 0 }
    const sorted = [...arr].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    const median =
      sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid]
    return {
      phase: p,
      medianDays: Math.max(0, Math.round(median)),
      sampleSize: arr.length,
    }
  })
}

export interface AwaitingDeal {
  opportunityId: string
  buyerLabel: string
  industry: string | null
  region: string | null
  phase: ClientPhase
  daysAtPhase: number
  potentialValue: number | null
}

/**
 * Deals currently in an in-progress phase that have been there longer than a
 * conservative public-facing threshold (14 days). We do NOT expose internal
 * stage-specific stuck thresholds — that information would let clients
 * second-guess VXB's playbook. The framing is "awaiting buyer response".
 */
export async function getClientAwaitingDeals(): Promise<AwaitingDeal[]> {
  const PUBLIC_THRESHOLD_DAYS = 14
  const supabase = await createClient()
  const opps = await fetchAllMasked()

  // For each in-progress opp, find when it entered its current stage so we
  // can compute days-at-phase. We use `opportunity_metrics_v` which already
  // does this for us — but the view's underlying join on stage_transitions
  // requires the migration-030 RLS policy. If it's missing, days_in_current_stage
  // collapses to days_total_lifetime (still a usable proxy).
  const inProgress = opps.filter(
    (o) => o.stage !== "won" && o.stage !== "lost",
  )
  if (inProgress.length === 0) return []

  const oppIds = inProgress.map((o) => o.opportunity_id)
  const { data: metrics } = await supabase
    .from("opportunity_metrics_v")
    .select("opportunity_id, days_in_current_stage")
    .in("opportunity_id", oppIds)

  const daysById = new Map<string, number>()
  for (const r of (metrics ?? []) as Array<{
    opportunity_id: string
    days_in_current_stage: number | null
  }>) {
    daysById.set(r.opportunity_id, Number(r.days_in_current_stage ?? 0))
  }

  return inProgress
    .map((o) => ({
      opportunityId: o.opportunity_id,
      // Fallback to buyer code for masked stages.
      buyerLabel: o.company_name ?? o.buyer_code ?? "—",
      industry: o.industry,
      region: o.region,
      phase: stageToClientPhase(o.stage),
      daysAtPhase: daysById.get(o.opportunity_id) ?? 0,
      potentialValue: o.potential_value,
    }))
    .filter((d) => d.daysAtPhase >= PUBLIC_THRESHOLD_DAYS)
    .sort((a, b) => b.daysAtPhase - a.daysAtPhase)
    .slice(0, 12)
}

// ---------------------------------------------------------------------------
// Tab 3 — Win/loss analysis (filtered to deals that reached price_agreed+)
// ---------------------------------------------------------------------------

export interface ClientWinLoss {
  /** Sample size after the price_agreed+ filter. */
  totalAnalysed: number
  totalWon: number
  totalLost: number
  /** Win rate by buyer industry, top 10 by total. */
  byIndustry: SegmentRow[]
  /** Win rate by buyer region, top 10 by total. */
  byRegion: SegmentRow[]
  /** When deals were lost, which client-facing phase did they fall off from. */
  byLostPhase: { phase: ClientPhase; count: number }[]
}

export interface SegmentRow {
  key: string
  total: number
  won: number
  lost: number
  winRate: number
}

export async function getClientWinLoss(period: PeriodWindow): Promise<ClientWinLoss> {
  const supabase = await createClient()
  const opps = await fetchAllMasked()

  if (opps.length === 0) {
    return {
      totalAnalysed: 0,
      totalWon: 0,
      totalLost: 0,
      byIndustry: [],
      byRegion: [],
      byLostPhase: [],
    }
  }

  const oppIds = opps.map((o) => o.opportunity_id)

  // 1) Find opportunities that EVER reached price_agreed or beyond.
  //    These are the only ones the user agreed to include in the breakdown.
  const { data: gateTrans } = await supabase
    .from("stage_transitions")
    .select("opportunity_id, to_stage")
    .in("opportunity_id", oppIds)
    .in("to_stage", ["price_agreed", "production", "shipped", "won"])
  const reachedPriceAgreed = new Set(
    (gateTrans ?? []).map(
      (r: { opportunity_id: string }) => r.opportunity_id,
    ),
  )

  // 2) Pull the lost-from transitions inside the period to know which phase
  //    the deal fell off from.
  let lostQ = supabase
    .from("stage_transitions")
    .select("opportunity_id, from_stage, transitioned_at")
    .in("opportunity_id", oppIds)
    .eq("to_stage", "lost")
  if (period.from) lostQ = lostQ.gte("transitioned_at", period.from)
  const { data: lostTrans } = await lostQ

  const lostFromStage = new Map<string, Stage>()
  for (const r of (lostTrans ?? []) as Array<{
    opportunity_id: string
    from_stage: Stage | null
  }>) {
    if (r.from_stage) lostFromStage.set(r.opportunity_id, r.from_stage)
  }

  // 3) Bucket: for every analysed opportunity, classify as won / lost.
  type Bucket = { total: number; won: number; lost: number }
  const industryStats = new Map<string, Bucket>()
  const regionStats = new Map<string, Bucket>()
  const lostPhaseCounts = new Map<ClientPhase, number>()

  let totalAnalysed = 0
  let totalWon = 0
  let totalLost = 0

  function add(map: Map<string, Bucket>, key: string | null, kind: "won" | "lost") {
    const k = key && key.trim() ? key.trim() : "—"
    const slot = map.get(k) ?? { total: 0, won: 0, lost: 0 }
    slot.total += 1
    slot[kind] += 1
    map.set(k, slot)
  }

  for (const o of opps) {
    // Filter: must have reached price_agreed at some point.
    if (!reachedPriceAgreed.has(o.opportunity_id)) continue

    if (o.stage === "won") {
      totalAnalysed += 1
      totalWon += 1
      add(industryStats, o.industry, "won")
      add(regionStats, o.region, "won")
      continue
    }
    if (o.stage === "lost") {
      totalAnalysed += 1
      totalLost += 1
      add(industryStats, o.industry, "lost")
      add(regionStats, o.region, "lost")

      const fromStage = lostFromStage.get(o.opportunity_id)
      if (fromStage) {
        const phase = stageToClientPhase(fromStage)
        if (phase !== "closed_lost" && phase !== "closed_won") {
          lostPhaseCounts.set(phase, (lostPhaseCounts.get(phase) ?? 0) + 1)
        }
      }
    }
    // Still in-progress deals that already reached price_agreed are NOT
    // counted in the won/lost breakdown (they haven't been decided yet).
  }

  function project(m: Map<string, Bucket>): SegmentRow[] {
    return [...m.entries()]
      .map(([k, v]) => ({
        key: k,
        total: v.total,
        won: v.won,
        lost: v.lost,
        winRate: v.total > 0 ? Math.round((v.won / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
  }

  const byLostPhase = CLIENT_PHASE_ORDER.filter((p) => p !== "closed_won")
    .map((p) => ({ phase: p, count: lostPhaseCounts.get(p) ?? 0 }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count)

  return {
    totalAnalysed,
    totalWon,
    totalLost,
    byIndustry: project(industryStats),
    byRegion: project(regionStats),
    byLostPhase,
  }
}

// ---------------------------------------------------------------------------
// Tab 4 — Financial / commission analysis
// ---------------------------------------------------------------------------

export interface CommissionMonthPoint {
  key: string
  label: string
  amount: number
}

export interface ClientFinancials {
  cumulative: { paid_on: string; commission_amount: number; invoice_value: number }[]
  byMonth: CommissionMonthPoint[]
  paidDealsCount: number
  totalCommissionPaid: number
  averageCommissionPerDeal: number | null
  topWonDeals: {
    opportunityId: string
    buyerLabel: string
    industry: string | null
    potentialValue: number | null
  }[]
}

export async function getClientFinancials(
  locale: "vi" | "en" = "vi",
): Promise<ClientFinancials> {
  const supabase = await createClient()
  const clientId = await getClientId()

  const { data: timeline } = await supabase
    .from("client_commission_timeline")
    .select("paid_on, commission_amount, invoice_value")
    .eq("client_id", clientId)
    .order("paid_on", { ascending: true })

  const rows = (timeline ?? []) as Array<{
    paid_on: string
    commission_amount: number | null
    invoice_value: number | null
  }>

  // Monthly buckets — only include months that actually have data plus the
  // last 12 months so the chart isn't sparse.
  const buckets = monthlyBuckets(12, locale)
  const idx = new Map(buckets.map((b, i) => [b.key, i]))
  const byMonth: CommissionMonthPoint[] = buckets.map((b) => ({
    ...b,
    amount: 0,
  }))
  for (const r of rows) {
    // r.paid_on is YYYY-MM-DD; first 7 chars = YYYY-MM
    const k = r.paid_on.slice(0, 7)
    const i = idx.get(k)
    if (i !== undefined) byMonth[i].amount += Number(r.commission_amount ?? 0)
  }

  const totalCommissionPaid = rows.reduce(
    (acc, r) => acc + Number(r.commission_amount ?? 0),
    0,
  )
  const paidDealsCount = rows.length
  const averageCommissionPerDeal =
    paidDealsCount > 0 ? totalCommissionPaid / paidDealsCount : null

  // Top won deals by potential value (from masked view — buyer_code falls
  // back to mask the company until disclosure level >= 2, but won deals are
  // always level 3 so company_name will be present).
  const opps = await fetchAllMasked()
  const topWonDeals = opps
    .filter((o) => o.stage === "won")
    .sort(
      (a, b) =>
        Number(b.potential_value ?? 0) - Number(a.potential_value ?? 0),
    )
    .slice(0, 10)
    .map((o) => ({
      opportunityId: o.opportunity_id,
      buyerLabel: o.company_name ?? o.buyer_code ?? "—",
      industry: o.industry,
      potentialValue: o.potential_value,
    }))

  return {
    cumulative: rows.map((r) => ({
      paid_on: r.paid_on,
      commission_amount: Number(r.commission_amount ?? 0),
      invoice_value: Number(r.invoice_value ?? 0),
    })),
    byMonth,
    paidDealsCount,
    totalCommissionPaid,
    averageCommissionPerDeal,
    topWonDeals,
  }
}
