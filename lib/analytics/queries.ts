/**
 * Analytics data layer — every SQL the /admin/analytics page (and the
 * per-client / per-buyer Performance cards) talks to.
 *
 * Server-only. Always called from a server component / server action that
 * has already enforced ANALYTICS_VIEW_ALL or ANALYTICS_VIEW_OWN.
 *
 * The `clientScope` param controls horizontal data scope:
 *   - { kind: "all" }                        — admin / super_admin / finance
 *   - { kind: "owned", managerId: <userId> } — AE / Lead Researcher
 *
 * Period filtering happens here, not in the SQL views, so we can pivot the
 * UI dropdown without touching the DB.
 */
import { createAdminClient } from "@/lib/supabase/admin"
import type { Stage } from "@/lib/supabase/types"
import {
  ALL_STAGES,
  IN_PROGRESS_STAGES,
  TERMINAL_STAGES,
  STAGE_LABEL_VI,
  STUCK_THRESHOLD_DAYS,
  monthlyBuckets,
  monthKey,
  type PeriodWindow,
} from "./constants"

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------
export type ClientScope =
  | { kind: "all" }
  | { kind: "owned"; managerId: string }

/**
 * Resolve the list of client_ids the current user is allowed to see, based
 * on profiles.account_manager_id. Returns `null` for "all clients" so callers
 * can skip the .in() filter for unscoped admins (cheaper query).
 */
export async function resolveAllowedClientIds(
  scope: ClientScope,
): Promise<string[] | null> {
  if (scope.kind === "all") return null
  const admin = createAdminClient()
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "client")
    .eq("account_manager_id", scope.managerId)
  return (data ?? []).map((r: { id: string }) => r.id)
}

// ---------------------------------------------------------------------------
// Headline KPIs (Overview tab)
// ---------------------------------------------------------------------------
export interface OverviewKpis {
  /** Opportunities created within the period. */
  newOpportunities: number
  /** Opportunities that transitioned to 'won' within the period. */
  wonInPeriod: number
  /** Opportunities that transitioned to 'lost' within the period. */
  lostInPeriod: number
  /** wonInPeriod / (wonInPeriod + lostInPeriod), rounded %. */
  winRate: number
  /** Total potential value of opportunities currently in-progress (snapshot). */
  inProgressValue: number
  /** Count currently in-progress (snapshot). */
  inProgressCount: number
  /** Total deals (won) commission earned in period. */
  commissionEarned: number
}

export async function getOverviewKpis(
  scope: ClientScope,
  period: PeriodWindow,
): Promise<OverviewKpis> {
  const admin = createAdminClient()
  const allowed = await resolveAllowedClientIds(scope)
  // Empty allowlist means "the user manages no clients" — return zeroes.
  if (allowed?.length === 0) {
    return {
      newOpportunities: 0,
      wonInPeriod: 0,
      lostInPeriod: 0,
      winRate: 0,
      inProgressValue: 0,
      inProgressCount: 0,
      commissionEarned: 0,
    }
  }

  // 1) New opportunities (created_at within period)
  let createdQ = admin
    .from("opportunities")
    .select("id", { count: "exact", head: true })
  if (period.from) createdQ = createdQ.gte("created_at", period.from)
  if (allowed) createdQ = createdQ.in("client_id", allowed)
  const { count: newOpportunities } = await createdQ

  // 2) Won / Lost transitions in period
  let stTransQ = admin
    .from("stage_transitions")
    .select("opportunity_id, to_stage, transitioned_at, opportunities!inner(client_id)")
    .in("to_stage", ["won", "lost"])
  if (period.from) stTransQ = stTransQ.gte("transitioned_at", period.from)
  if (allowed) stTransQ = stTransQ.in("opportunities.client_id", allowed)
  const { data: trans } = await stTransQ

  // De-duplicate per opportunity_id — a deal might bounce won/lost (rare,
  // human error) but we count it once at its latest transition.
  const latestPerOpp = new Map<string, "won" | "lost">()
  for (const t of (trans ?? []) as Array<{ opportunity_id: string; to_stage: string }>) {
    if (t.to_stage === "won" || t.to_stage === "lost") {
      latestPerOpp.set(t.opportunity_id, t.to_stage)
    }
  }
  const wonInPeriod = [...latestPerOpp.values()].filter((v) => v === "won").length
  const lostInPeriod = [...latestPerOpp.values()].filter((v) => v === "lost").length
  const decided = wonInPeriod + lostInPeriod
  const winRate = decided > 0 ? Math.round((wonInPeriod / decided) * 100) : 0

  // 3) In-progress snapshot
  let progressQ = admin
    .from("opportunities")
    .select("id, potential_value")
    .in("stage", IN_PROGRESS_STAGES)
  if (allowed) progressQ = progressQ.in("client_id", allowed)
  const { data: progressRows } = await progressQ
  const inProgressCount = progressRows?.length ?? 0
  const inProgressValue = (progressRows ?? []).reduce(
    (acc: number, r: { potential_value: number | null }) =>
      acc + Number(r.potential_value ?? 0),
    0,
  )

  // 4) Commission earned in period (paid deals only)
  let dealsQ = admin
    .from("deals")
    .select("commission_amount, paid_at, opportunities!inner(client_id)")
    .eq("payment_status", "paid")
  if (period.from) dealsQ = dealsQ.gte("paid_at", period.from)
  if (allowed) dealsQ = dealsQ.in("opportunities.client_id", allowed)
  const { data: dealRows } = await dealsQ
  const commissionEarned = (dealRows ?? []).reduce(
    (acc: number, r: { commission_amount: number | null }) =>
      acc + Number(r.commission_amount ?? 0),
    0,
  )

  return {
    newOpportunities: newOpportunities ?? 0,
    wonInPeriod,
    lostInPeriod,
    winRate,
    inProgressValue,
    inProgressCount,
    commissionEarned,
  }
}

// ---------------------------------------------------------------------------
// Monthly trend — last 12 months of created / won / lost
// ---------------------------------------------------------------------------
export interface MonthlyTrendPoint {
  key: string
  label: string
  created: number
  won: number
  lost: number
}

export async function getMonthlyTrend(
  scope: ClientScope,
  months = 12,
): Promise<MonthlyTrendPoint[]> {
  const admin = createAdminClient()
  const allowed = await resolveAllowedClientIds(scope)
  if (allowed?.length === 0) {
    return monthlyBuckets(months).map((b) => ({ ...b, created: 0, won: 0, lost: 0 }))
  }

  const buckets = monthlyBuckets(months)
  const fromIso = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - (months - 1), 1),
  ).toISOString()

  // Created
  let createdQ = admin
    .from("opportunities")
    .select("created_at")
    .gte("created_at", fromIso)
  if (allowed) createdQ = createdQ.in("client_id", allowed)
  const { data: created } = await createdQ

  // Won / Lost transitions
  let transQ = admin
    .from("stage_transitions")
    .select("to_stage, transitioned_at, opportunity_id, opportunities!inner(client_id)")
    .in("to_stage", ["won", "lost"])
    .gte("transitioned_at", fromIso)
  if (allowed) transQ = transQ.in("opportunities.client_id", allowed)
  const { data: trans } = await transQ

  const idx = new Map(buckets.map((b, i) => [b.key, i]))
  const out: MonthlyTrendPoint[] = buckets.map((b) => ({
    ...b,
    created: 0,
    won: 0,
    lost: 0,
  }))

  for (const r of (created ?? []) as Array<{ created_at: string }>) {
    const i = idx.get(monthKey(r.created_at))
    if (i !== undefined) out[i].created += 1
  }

  // De-duplicate trans per opp+month so a flip-flop doesn't double count.
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
// Stage funnel — current snapshot of stage distribution
// ---------------------------------------------------------------------------
export interface StageFunnelEntry {
  stage: Stage
  label: string
  count: number
}

export async function getStageSnapshot(scope: ClientScope): Promise<StageFunnelEntry[]> {
  const admin = createAdminClient()
  const allowed = await resolveAllowedClientIds(scope)
  if (allowed?.length === 0) {
    return ALL_STAGES.map((s) => ({ stage: s, label: STAGE_LABEL_VI[s], count: 0 }))
  }
  let q = admin.from("opportunities").select("stage")
  if (allowed) q = q.in("client_id", allowed)
  const { data } = await q
  const counts = new Map<Stage, number>()
  for (const r of (data ?? []) as Array<{ stage: Stage }>) {
    counts.set(r.stage, (counts.get(r.stage) ?? 0) + 1)
  }
  return ALL_STAGES.map((s) => ({
    stage: s,
    label: STAGE_LABEL_VI[s],
    count: counts.get(s) ?? 0,
  }))
}

// ---------------------------------------------------------------------------
// By-Client tab — per-client KPI rows
// ---------------------------------------------------------------------------
export interface ByClientRow {
  clientId: string
  clientName: string
  total: number
  won: number
  lost: number
  inProgress: number
  winRate: number
  /** Sum of opportunity.potential_value across won deals in period. */
  wonValueInPeriod: number
  /** Median days from creation to won. Rounded to nearest day. */
  avgCycleDays: number | null
  /** Earliest activity timestamp. */
  lastActivityAt: string | null
}

export async function getByClient(
  scope: ClientScope,
  period: PeriodWindow,
): Promise<ByClientRow[]> {
  const admin = createAdminClient()
  const allowed = await resolveAllowedClientIds(scope)
  if (allowed?.length === 0) return []

  // 1) Pull client list (filtered by scope)
  let clientsQ = admin
    .from("profiles")
    .select("id, full_name, company_name")
    .eq("role", "client")
    .order("company_name", { ascending: true })
  if (allowed) clientsQ = clientsQ.in("id", allowed)
  const { data: clients } = await clientsQ

  // 2) Pull opportunities for these clients
  let oppQ = admin
    .from("opportunities")
    .select("id, client_id, stage, potential_value, created_at, last_updated")
  if (allowed) oppQ = oppQ.in("client_id", allowed)
  const { data: opps } = await oppQ

  // 3) Pull won/lost transitions in period for cycle / period-stats
  let transQ = admin
    .from("stage_transitions")
    .select("opportunity_id, to_stage, transitioned_at, opportunities!inner(client_id, created_at, potential_value)")
    .in("to_stage", ["won", "lost"])
  if (period.from) transQ = transQ.gte("transitioned_at", period.from)
  if (allowed) transQ = transQ.in("opportunities.client_id", allowed)
  const { data: trans } = await transQ

  // Group rows
  const byClient = new Map<
    string,
    { total: number; won: number; lost: number; inProgress: number; lastActivity: string | null }
  >()
  for (const o of (opps ?? []) as Array<{
    client_id: string
    stage: Stage
    last_updated: string
  }>) {
    const row = byClient.get(o.client_id) ?? {
      total: 0,
      won: 0,
      lost: 0,
      inProgress: 0,
      lastActivity: null,
    }
    row.total += 1
    if (o.stage === "won") row.won += 1
    else if (o.stage === "lost") row.lost += 1
    else row.inProgress += 1
    if (!row.lastActivity || o.last_updated > row.lastActivity) {
      row.lastActivity = o.last_updated
    }
    byClient.set(o.client_id, row)
  }

  // Period stats
  const periodStats = new Map<
    string,
    { wonValue: number; cycleDays: number[] }
  >()
  for (const r of (trans ?? []) as Array<{
    to_stage: string
    transitioned_at: string
    opportunity_id: string
    opportunities: { client_id: string; created_at: string; potential_value: number | null }
  }>) {
    if (r.to_stage !== "won") continue
    const cid = r.opportunities.client_id
    const slot = periodStats.get(cid) ?? { wonValue: 0, cycleDays: [] }
    slot.wonValue += Number(r.opportunities.potential_value ?? 0)
    const created = new Date(r.opportunities.created_at).getTime()
    const transitioned = new Date(r.transitioned_at).getTime()
    if (transitioned >= created) {
      slot.cycleDays.push(Math.max(0, Math.round((transitioned - created) / 86_400_000)))
    }
    periodStats.set(cid, slot)
  }

  return (clients ?? []).map(
    (c: { id: string; full_name: string | null; company_name: string | null }) => {
      const row = byClient.get(c.id) ?? {
        total: 0,
        won: 0,
        lost: 0,
        inProgress: 0,
        lastActivity: null,
      }
      const decided = row.won + row.lost
      const winRate = decided > 0 ? Math.round((row.won / decided) * 100) : 0
      const ps = periodStats.get(c.id)
      const avgCycle =
        ps && ps.cycleDays.length > 0
          ? Math.round(ps.cycleDays.reduce((a, b) => a + b, 0) / ps.cycleDays.length)
          : null
      return {
        clientId: c.id,
        clientName: c.company_name ?? c.full_name ?? "—",
        total: row.total,
        won: row.won,
        lost: row.lost,
        inProgress: row.inProgress,
        winRate,
        wonValueInPeriod: ps?.wonValue ?? 0,
        avgCycleDays: avgCycle,
        lastActivityAt: row.lastActivity,
      }
    },
  )
}

// ---------------------------------------------------------------------------
// Bottleneck tab — opportunities stuck longer than threshold
// ---------------------------------------------------------------------------
export interface StuckOpportunity {
  opportunityId: string
  clientId: string
  clientName: string
  buyerName: string
  stage: Stage
  daysInStage: number
  threshold: number
  potentialValue: number | null
  lastUpdated: string
}

export async function getStuckOpportunities(
  scope: ClientScope,
): Promise<StuckOpportunity[]> {
  const admin = createAdminClient()
  const allowed = await resolveAllowedClientIds(scope)
  if (allowed?.length === 0) return []

  // Pull metrics view + joined client / buyer names.
  let q = admin
    .from("opportunity_metrics_v")
    .select(
      `
      opportunity_id,
      client_id,
      stage,
      potential_value,
      days_in_current_stage,
      last_updated,
      profiles:client_id (full_name, company_name),
      opportunities:opportunity_id (
        leads:lead_id ( company_name )
      )
    `,
    )
    .in("stage", Object.keys(STUCK_THRESHOLD_DAYS) as Stage[])
  if (allowed) q = q.in("client_id", allowed)
  const { data } = await q

  const rows = (data ?? []) as unknown as Array<{
    opportunity_id: string
    client_id: string
    stage: Stage
    potential_value: number | null
    days_in_current_stage: number
    last_updated: string
    profiles: { full_name: string | null; company_name: string | null } | null
    opportunities: { leads: { company_name: string | null } | null } | null
  }>

  return rows
    .map((r) => {
      const threshold = STUCK_THRESHOLD_DAYS[r.stage] ?? 0
      return {
        opportunityId: r.opportunity_id,
        clientId: r.client_id,
        clientName: r.profiles?.company_name ?? r.profiles?.full_name ?? "—",
        buyerName: r.opportunities?.leads?.company_name ?? "—",
        stage: r.stage,
        daysInStage: r.days_in_current_stage,
        threshold,
        potentialValue: r.potential_value,
        lastUpdated: r.last_updated,
      }
    })
    .filter((r) => r.daysInStage >= r.threshold)
    .sort((a, b) => b.daysInStage - a.daysInStage)
}

// ---------------------------------------------------------------------------
// Lost analysis tab
// ---------------------------------------------------------------------------
export interface LostAnalysis {
  /** How many deals went to 'lost' in the period. */
  totalLost: number
  /** Distribution: previous stage → count (i.e., where deals fell off). */
  byPreviousStage: { stage: Stage; label: string; count: number }[]
  /** Win rate breakdown by buyer country. */
  winRateByCountry: { country: string; total: number; won: number; lost: number; winRate: number }[]
  /** Win rate breakdown by buyer industry. */
  winRateByIndustry: { industry: string; total: number; won: number; lost: number; winRate: number }[]
}

export async function getLostAnalysis(
  scope: ClientScope,
  period: PeriodWindow,
): Promise<LostAnalysis> {
  const admin = createAdminClient()
  const allowed = await resolveAllowedClientIds(scope)
  if (allowed?.length === 0) {
    return { totalLost: 0, byPreviousStage: [], winRateByCountry: [], winRateByIndustry: [] }
  }

  // 1) Lost transitions in period
  let lostQ = admin
    .from("stage_transitions")
    .select(
      "opportunity_id, from_stage, opportunities!inner(client_id, lead_id, leads!inner(country, industry))",
    )
    .eq("to_stage", "lost")
  if (period.from) lostQ = lostQ.gte("transitioned_at", period.from)
  if (allowed) lostQ = lostQ.in("opportunities.client_id", allowed)
  const { data: lostRows } = await lostQ

  // 2) Won transitions in period (for win-rate by country/industry)
  let wonQ = admin
    .from("stage_transitions")
    .select(
      "opportunity_id, opportunities!inner(client_id, leads!inner(country, industry))",
    )
    .eq("to_stage", "won")
  if (period.from) wonQ = wonQ.gte("transitioned_at", period.from)
  if (allowed) wonQ = wonQ.in("opportunities.client_id", allowed)
  const { data: wonRows } = await wonQ

  // ----- by previous stage -----
  const stageCounts = new Map<Stage, number>()
  const lostByOpp = new Set<string>()
  for (const r of (lostRows ?? []) as Array<{
    opportunity_id: string
    from_stage: Stage | null
  }>) {
    if (lostByOpp.has(r.opportunity_id)) continue
    lostByOpp.add(r.opportunity_id)
    if (r.from_stage && r.from_stage !== "lost") {
      stageCounts.set(r.from_stage, (stageCounts.get(r.from_stage) ?? 0) + 1)
    }
  }
  const byPreviousStage = ALL_STAGES.filter((s) => s !== "won" && s !== "lost")
    .map((s) => ({ stage: s, label: STAGE_LABEL_VI[s], count: stageCounts.get(s) ?? 0 }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count)

  // ----- by country / industry -----
  type Bucket = { total: number; won: number; lost: number }
  const countryStats = new Map<string, Bucket>()
  const industryStats = new Map<string, Bucket>()

  function addBucket(
    bucket: Map<string, Bucket>,
    key: string | null,
    kind: "won" | "lost",
  ) {
    const k = key && key.trim() ? key.trim() : "—"
    const slot = bucket.get(k) ?? { total: 0, won: 0, lost: 0 }
    slot.total += 1
    slot[kind] += 1
    bucket.set(k, slot)
  }

  for (const r of (wonRows ?? []) as Array<{
    opportunities: { leads: { country: string | null; industry: string | null } }
  }>) {
    addBucket(countryStats, r.opportunities.leads.country, "won")
    addBucket(industryStats, r.opportunities.leads.industry, "won")
  }
  for (const r of (lostRows ?? []) as Array<{
    opportunities: { leads: { country: string | null; industry: string | null } }
  }>) {
    addBucket(countryStats, r.opportunities.leads.country, "lost")
    addBucket(industryStats, r.opportunities.leads.industry, "lost")
  }

  function projectBucket<T extends Map<string, Bucket>>(m: T, keyName: string) {
    return [...m.entries()]
      .map(([k, v]) => ({
        [keyName]: k,
        total: v.total,
        won: v.won,
        lost: v.lost,
        winRate: v.total > 0 ? Math.round((v.won / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
  }

  return {
    totalLost: lostByOpp.size,
    byPreviousStage,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    winRateByCountry: projectBucket(countryStats, "country") as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    winRateByIndustry: projectBucket(industryStats, "industry") as any,
  }
}

// ---------------------------------------------------------------------------
// Single-client metrics — used by the Performance card on /admin/clients/[id]
// and by the same card embedded in /admin/buyers/[id] (passing every client
// the buyer has touched).
// ---------------------------------------------------------------------------
export interface SingleClientMetrics extends OverviewKpis {
  stageDistribution: StageFunnelEntry[]
  monthly: MonthlyTrendPoint[]
}

export function getSingleClientMetrics(
  clientId: string,
  period: PeriodWindow,
): Promise<SingleClientMetrics> {
  return getMetricsForClientIds([clientId], period)
}

export async function getMetricsForClientIds(
  clientIds: string[],
  period: PeriodWindow,
): Promise<SingleClientMetrics> {
  const admin = createAdminClient()
  if (clientIds.length === 0) {
    return {
      newOpportunities: 0,
      wonInPeriod: 0,
      lostInPeriod: 0,
      winRate: 0,
      inProgressValue: 0,
      inProgressCount: 0,
      commissionEarned: 0,
      stageDistribution: ALL_STAGES.map((s) => ({
        stage: s,
        label: STAGE_LABEL_VI[s],
        count: 0,
      })),
      monthly: monthlyBuckets(12).map((b) => ({ ...b, created: 0, won: 0, lost: 0 })),
    }
  }

  // KPIs
  let createdQ = admin
    .from("opportunities")
    .select("id", { count: "exact", head: true })
    .in("client_id", clientIds)
  if (period.from) createdQ = createdQ.gte("created_at", period.from)
  const { count: newOpportunities } = await createdQ

  let transQ = admin
    .from("stage_transitions")
    .select("opportunity_id, to_stage, transitioned_at, opportunities!inner(client_id)")
    .in("to_stage", ["won", "lost"])
    .in("opportunities.client_id", clientIds)
  if (period.from) transQ = transQ.gte("transitioned_at", period.from)
  const { data: trans } = await transQ
  const latest = new Map<string, "won" | "lost">()
  for (const t of (trans ?? []) as Array<{ opportunity_id: string; to_stage: string }>) {
    if (t.to_stage === "won" || t.to_stage === "lost")
      latest.set(t.opportunity_id, t.to_stage)
  }
  const wonInPeriod = [...latest.values()].filter((v) => v === "won").length
  const lostInPeriod = [...latest.values()].filter((v) => v === "lost").length
  const decided = wonInPeriod + lostInPeriod
  const winRate = decided > 0 ? Math.round((wonInPeriod / decided) * 100) : 0

  const { data: progRows } = await admin
    .from("opportunities")
    .select("potential_value")
    .in("client_id", clientIds)
    .in("stage", IN_PROGRESS_STAGES)
  const inProgressCount = progRows?.length ?? 0
  const inProgressValue = (progRows ?? []).reduce(
    (acc: number, r: { potential_value: number | null }) =>
      acc + Number(r.potential_value ?? 0),
    0,
  )

  let dealsQ = admin
    .from("deals")
    .select("commission_amount, paid_at, opportunities!inner(client_id)")
    .eq("payment_status", "paid")
    .in("opportunities.client_id", clientIds)
  if (period.from) dealsQ = dealsQ.gte("paid_at", period.from)
  const { data: dealRows } = await dealsQ
  const commissionEarned = (dealRows ?? []).reduce(
    (acc: number, r: { commission_amount: number | null }) =>
      acc + Number(r.commission_amount ?? 0),
    0,
  )

  // Stage snapshot
  const { data: stageRows } = await admin
    .from("opportunities")
    .select("stage")
    .in("client_id", clientIds)
  const stageCounts = new Map<Stage, number>()
  for (const r of (stageRows ?? []) as Array<{ stage: Stage }>) {
    stageCounts.set(r.stage, (stageCounts.get(r.stage) ?? 0) + 1)
  }
  const stageDistribution = ALL_STAGES.map((s) => ({
    stage: s,
    label: STAGE_LABEL_VI[s],
    count: stageCounts.get(s) ?? 0,
  }))

  // Monthly trend (12 months)
  const buckets = monthlyBuckets(12)
  const fromIso = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 11, 1),
  ).toISOString()

  const { data: createdRows } = await admin
    .from("opportunities")
    .select("created_at")
    .in("client_id", clientIds)
    .gte("created_at", fromIso)

  const { data: trendTrans } = await admin
    .from("stage_transitions")
    .select("to_stage, transitioned_at, opportunity_id, opportunities!inner(client_id)")
    .in("to_stage", ["won", "lost"])
    .in("opportunities.client_id", clientIds)
    .gte("transitioned_at", fromIso)

  const idx = new Map(buckets.map((b, i) => [b.key, i]))
  const monthly: MonthlyTrendPoint[] = buckets.map((b) => ({
    ...b,
    created: 0,
    won: 0,
    lost: 0,
  }))
  for (const r of (createdRows ?? []) as Array<{ created_at: string }>) {
    const i = idx.get(monthKey(r.created_at))
    if (i !== undefined) monthly[i].created += 1
  }
  const seen = new Set<string>()
  for (const r of (trendTrans ?? []) as Array<{
    to_stage: string
    transitioned_at: string
    opportunity_id: string
  }>) {
    const k = monthKey(r.transitioned_at)
    const dedup = `${r.opportunity_id}|${k}|${r.to_stage}`
    if (seen.has(dedup)) continue
    seen.add(dedup)
    const i = idx.get(k)
    if (i === undefined) continue
    if (r.to_stage === "won") monthly[i].won += 1
    else if (r.to_stage === "lost") monthly[i].lost += 1
  }

  return {
    newOpportunities: newOpportunities ?? 0,
    wonInPeriod,
    lostInPeriod,
    winRate,
    inProgressValue,
    inProgressCount,
    commissionEarned,
    stageDistribution,
    monthly,
  }
}

void TERMINAL_STAGES // referenced for clarity / future use

// ---------------------------------------------------------------------------
// Buyer metrics — for the Performance card on /admin/buyers/[id]
// ---------------------------------------------------------------------------
export interface BuyerMetrics {
  totalOpportunities: number
  won: number
  lost: number
  inProgress: number
  winRate: number
  /** Across how many distinct clients this buyer was assigned. */
  clientsAttachedCount: number
  /** First and last activity. */
  firstSeenAt: string | null
  lastActivityAt: string | null
  /** Median lifetime (days) from creation to terminal stage, won deals only. */
  avgWinCycleDays: number | null
  /** Stage distribution snapshot for in-progress deals on this buyer. */
  stageDistribution: StageFunnelEntry[]
}

export async function getBuyerMetrics(leadId: string): Promise<BuyerMetrics> {
  const admin = createAdminClient()

  const { data: opps } = await admin
    .from("opportunities")
    .select("id, client_id, stage, created_at, last_updated")
    .eq("lead_id", leadId)
  const oppRows =
    (opps ?? []) as Array<{
      id: string
      client_id: string
      stage: Stage
      created_at: string
      last_updated: string
    }>

  if (oppRows.length === 0) {
    return {
      totalOpportunities: 0,
      won: 0,
      lost: 0,
      inProgress: 0,
      winRate: 0,
      clientsAttachedCount: 0,
      firstSeenAt: null,
      lastActivityAt: null,
      avgWinCycleDays: null,
      stageDistribution: ALL_STAGES.map((s) => ({
        stage: s,
        label: STAGE_LABEL_VI[s],
        count: 0,
      })),
    }
  }

  const won = oppRows.filter((o) => o.stage === "won").length
  const lost = oppRows.filter((o) => o.stage === "lost").length
  const inProgress = oppRows.length - won - lost
  const decided = won + lost
  const winRate = decided > 0 ? Math.round((won / decided) * 100) : 0
  const clientsAttachedCount = new Set(oppRows.map((o) => o.client_id)).size
  const firstSeenAt = oppRows.reduce(
    (acc: string | null, o) => (acc === null || o.created_at < acc ? o.created_at : acc),
    null as string | null,
  )
  const lastActivityAt = oppRows.reduce(
    (acc: string | null, o) =>
      acc === null || o.last_updated > acc ? o.last_updated : acc,
    null as string | null,
  )

  // Avg win cycle: from created_at to the won transition timestamp.
  const oppIds = oppRows.map((o) => o.id)
  const { data: wonTrans } = await admin
    .from("stage_transitions")
    .select("opportunity_id, transitioned_at")
    .eq("to_stage", "won")
    .in("opportunity_id", oppIds)
  const oppCreatedById = new Map(oppRows.map((o) => [o.id, o.created_at]))
  const cycleDays: number[] = []
  for (const r of (wonTrans ?? []) as Array<{
    opportunity_id: string
    transitioned_at: string
  }>) {
    const createdAt = oppCreatedById.get(r.opportunity_id)
    if (!createdAt) continue
    const diff =
      (new Date(r.transitioned_at).getTime() - new Date(createdAt).getTime()) /
      86_400_000
    if (diff >= 0) cycleDays.push(Math.round(diff))
  }
  const avgWinCycleDays =
    cycleDays.length > 0
      ? Math.round(cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length)
      : null

  const stageCounts = new Map<Stage, number>()
  for (const o of oppRows) {
    stageCounts.set(o.stage, (stageCounts.get(o.stage) ?? 0) + 1)
  }
  const stageDistribution = ALL_STAGES.map((s) => ({
    stage: s,
    label: STAGE_LABEL_VI[s],
    count: stageCounts.get(s) ?? 0,
  }))

  return {
    totalOpportunities: oppRows.length,
    won,
    lost,
    inProgress,
    winRate,
    clientsAttachedCount,
    firstSeenAt,
    lastActivityAt,
    avgWinCycleDays,
    stageDistribution,
  }
}

