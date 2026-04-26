import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  computeClientScore,
  type ClientScoreResult,
} from "@/lib/sla/scoring"
import {
  SLA_METRIC_KEYS,
  type SlaMetricKey,
  type SlaMonthlyRow,
  type SlaTarget,
} from "@/lib/sla/types"

type AdminSB = ReturnType<typeof createAdminClient>

export interface SlaClientRow {
  client_id: string
  company_name: string | null
  full_name: string | null
  email: string | null
  billing_plan_id: string | null
  billing_plan_name: string | null
  score: ClientScoreResult
  totalViolations: number
  /** Per-metric violation count for the period. */
  violationsByMetric: Record<SlaMetricKey, number>
}

/**
 * Get the active billing plan ID for a set of clients.
 */
async function loadActivePlans(
  admin: AdminSB,
  clientIds: string[],
): Promise<Map<string, { id: string; plan_name: string }>> {
  if (clientIds.length === 0) return new Map()
  const { data } = await admin
    .from("billing_plans" as never)
    .select("id, client_id, plan_name, status")
    .eq("status", "active")
    .in("client_id", clientIds)
    .returns<
      Array<{
        id: string
        client_id: string
        plan_name: string
        status: string
      }>
    >()
  const map = new Map<string, { id: string; plan_name: string }>()
  for (const r of data ?? []) {
    map.set(r.client_id, { id: r.id, plan_name: r.plan_name })
  }
  return map
}

/**
 * Aggregator for the admin dashboard. Returns one row per client with the
 * health score for the given period.
 */
export async function loadSlaClientsForPeriod(
  periodMonth: string,
  options: { onlyClientIds?: string[] } = {},
): Promise<{
  rows: SlaClientRow[]
  totalsByMetric: Record<SlaMetricKey, number>
  globalTargets: SlaTarget[]
}> {
  const admin = createAdminClient()

  // 1. Active client list (or filtered).
  let clientsQuery = admin
    .from("profiles")
    .select("id, full_name, company_name, email")
    .eq("role", "client")
  if (options.onlyClientIds && options.onlyClientIds.length > 0) {
    clientsQuery = clientsQuery.in("id", options.onlyClientIds)
  }
  const { data: clientRows } = await clientsQuery
  const clients = (clientRows ?? []) as Array<{
    id: string
    full_name: string | null
    company_name: string | null
    email: string | null
  }>

  if (clients.length === 0) {
    return {
      rows: [],
      totalsByMetric: emptyMetricCounts(),
      globalTargets: [],
    }
  }

  // 2. All targets (global + plan-specific).
  const { data: targetRows } = await admin
    .from("sla_targets" as never)
    .select(
      "id, billing_plan_id, metric_key, target_value, weight, penalty_usd_cents, active, notes, created_at, updated_at",
    )
    .eq("active", true)
    .returns<SlaTarget[]>()
  const allTargets = targetRows ?? []
  const globalTargets = allTargets.filter((t) => t.billing_plan_id == null)

  // 3. Active plan per client.
  const planMap = await loadActivePlans(
    admin,
    clients.map((c) => c.id),
  )

  function targetsForClient(clientId: string): SlaTarget[] {
    const planId = planMap.get(clientId)?.id ?? null
    const out: SlaTarget[] = []
    for (const metric of SLA_METRIC_KEYS) {
      const planSpecific = planId
        ? allTargets.find(
            (t) =>
              t.billing_plan_id === planId && t.metric_key === metric,
          )
        : null
      const globalT = allTargets.find(
        (t) => t.billing_plan_id == null && t.metric_key === metric,
      )
      const t = planSpecific ?? globalT
      if (t) out.push(t)
    }
    return out
  }

  // 4. Violations for the period.
  const { data: vRows } = await admin
    .from("sla_monthly_summary" as never)
    .select("client_id, period_month, metric_key, violations")
    .eq("period_month", periodMonth)
    .returns<Array<Pick<SlaMonthlyRow, "client_id" | "metric_key" | "violations">>>()

  const violations = vRows ?? []
  const byClient = new Map<string, Record<SlaMetricKey, number>>()
  for (const v of violations) {
    const bucket = byClient.get(v.client_id) ?? emptyMetricCounts()
    bucket[v.metric_key] = (bucket[v.metric_key] ?? 0) + Number(v.violations)
    byClient.set(v.client_id, bucket)
  }

  // 5. Build per-client rows.
  const rows: SlaClientRow[] = clients.map((c) => {
    const violationsByMetric =
      byClient.get(c.id) ?? emptyMetricCounts()
    const targets = targetsForClient(c.id)
    const score = computeClientScore({ violationsByMetric, targets })
    const total = SLA_METRIC_KEYS.reduce(
      (acc, m) => acc + (violationsByMetric[m] ?? 0),
      0,
    )
    const plan = planMap.get(c.id) ?? null
    return {
      client_id: c.id,
      company_name: c.company_name,
      full_name: c.full_name,
      email: c.email,
      billing_plan_id: plan?.id ?? null,
      billing_plan_name: plan?.plan_name ?? null,
      score,
      totalViolations: total,
      violationsByMetric,
    }
  })

  // Sort: violators first (red, yellow, green), within each by total breaches desc.
  rows.sort((a, b) => {
    const tierOrder: Record<string, number> = {
      red: 0,
      yellow: 1,
      untracked: 2,
      green: 3,
    }
    const t = tierOrder[a.score.tier] - tierOrder[b.score.tier]
    if (t !== 0) return t
    if (a.totalViolations !== b.totalViolations) {
      return b.totalViolations - a.totalViolations
    }
    return (a.company_name ?? a.email ?? "").localeCompare(
      b.company_name ?? b.email ?? "",
    )
  })

  // 6. Totals by metric across all clients (for the summary header).
  const totalsByMetric = emptyMetricCounts()
  for (const r of rows) {
    for (const m of SLA_METRIC_KEYS) {
      totalsByMetric[m] += r.violationsByMetric[m] ?? 0
    }
  }

  return { rows, totalsByMetric, globalTargets }
}

export function emptyMetricCounts(): Record<SlaMetricKey, number> {
  return {
    pipeline_update_response: 0,
    monthly_qualified_leads: 0,
    monthly_email_outreach: 0,
    client_request_response: 0,
    swift_verification_lag: 0,
    fda_renewal_alert: 0,
    monthly_status_report: 0,
  }
}

/**
 * Recent run history for the admin dashboard sidebar.
 */
export async function loadRecentSlaRuns(limit = 6): Promise<
  Array<{
    period_month: string
    status: string
    triggered_by: string
    started_at: string
    completed_at: string | null
    scanned_clients: number
    violations_inserted: number
  }>
> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("sla_evaluation_runs" as never)
    .select(
      "period_month, status, triggered_by, started_at, completed_at, scanned_clients, violations_inserted",
    )
    .order("period_month", { ascending: false })
    .limit(limit)
  return (data ?? []) as Array<{
    period_month: string
    status: string
    triggered_by: string
    started_at: string
    completed_at: string | null
    scanned_clients: number
    violations_inserted: number
  }>
}

/**
 * Pending client_requests across all clients — surfaced on the admin
 * dashboard so AE / staff see the SLA-clock running on inbound questions.
 */
export async function loadOpenClientRequests(limit = 25): Promise<
  Array<{
    id: string
    client_id: string
    subject: string
    received_at: string
    first_response_at: string | null
    priority: string
    channel: string
    status: string
    company_name: string | null
    full_name: string | null
  }>
> {
  const admin = createAdminClient()
  const { data: reqs } = await admin
    .from("client_requests" as never)
    .select(
      "id, client_id, subject, received_at, first_response_at, priority, channel, status",
    )
    .in("status", ["open", "in_progress"])
    .order("received_at", { ascending: true })
    .limit(limit)

  const rows = (reqs ?? []) as Array<{
    id: string
    client_id: string
    subject: string
    received_at: string
    first_response_at: string | null
    priority: string
    channel: string
    status: string
  }>

  if (rows.length === 0) return []

  const clientIds = Array.from(new Set(rows.map((r) => r.client_id)))
  const { data: profs } = await admin
    .from("profiles")
    .select("id, full_name, company_name")
    .in("id", clientIds)
  const profMap = new Map(
    (profs ?? []).map((p) => [
      p.id,
      {
        full_name: (p as { full_name: string | null }).full_name,
        company_name: (p as { company_name: string | null }).company_name,
      },
    ]),
  )

  return rows.map((r) => ({
    ...r,
    company_name: profMap.get(r.client_id)?.company_name ?? null,
    full_name: profMap.get(r.client_id)?.full_name ?? null,
  }))
}

// =====================================================================
// Client-portal helpers (scoped to a single client, no admin info).
// =====================================================================

export interface ClientMonthlyScorePoint {
  /** First-of-month ISO ('YYYY-MM-DD'). */
  period_month: string
  /** Computed weighted score 0-100, or null if no targets matched. */
  score: number | null
  tier: ReturnType<typeof computeClientScore>["tier"]
  totalViolations: number
  violationsByMetric: Record<SlaMetricKey, number>
}

/**
 * Per-month SLA snapshot for a single client. Used by the client portal
 * to render the current scorecard plus a 6-month trail.
 */
export async function loadClientSlaHistory(
  clientId: string,
  options: { monthsBack?: number } = {},
): Promise<{
  points: ClientMonthlyScorePoint[]
  targets: SlaTarget[]
}> {
  const monthsBack = Math.max(1, Math.min(24, options.monthsBack ?? 6))
  const admin = createAdminClient()

  // 1. Compute the list of months we care about (UTC, first of each).
  const points: ClientMonthlyScorePoint[] = []
  const now = new Date()
  const months: string[] = []
  for (let i = monthsBack - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    months.push(d.toISOString().slice(0, 10))
  }

  // 2. Resolve targets (plan-specific + global).
  const { data: planRow } = await admin
    .from("billing_plans" as never)
    .select("id, plan_name")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle<{ id: string; plan_name: string }>()
  const planId = planRow?.id ?? null

  const { data: targetRows } = await admin
    .from("sla_targets" as never)
    .select(
      "id, billing_plan_id, metric_key, target_value, weight, penalty_usd_cents, active, notes, created_at, updated_at",
    )
    .eq("active", true)
    .returns<SlaTarget[]>()
  const allTargets = targetRows ?? []

  const resolvedTargets: SlaTarget[] = []
  for (const metric of SLA_METRIC_KEYS) {
    const planSpecific = planId
      ? allTargets.find(
          (t) => t.billing_plan_id === planId && t.metric_key === metric,
        )
      : null
    const globalT = allTargets.find(
      (t) => t.billing_plan_id == null && t.metric_key === metric,
    )
    const t = planSpecific ?? globalT
    if (t) resolvedTargets.push(t)
  }

  // 3. Pull all summary rows for this client across the date range.
  if (months.length === 0) {
    return { points, targets: resolvedTargets }
  }
  const earliest = months[0]
  const { data: vRows } = await admin
    .from("sla_monthly_summary" as never)
    .select("period_month, metric_key, violations")
    .eq("client_id", clientId)
    .gte("period_month", earliest)
    .returns<Array<Pick<SlaMonthlyRow, "period_month" | "metric_key" | "violations">>>()
  const summaries = vRows ?? []

  // 4. Build a per-month bucket and compute scores.
  const byMonth = new Map<string, Record<SlaMetricKey, number>>()
  for (const v of summaries) {
    const key = v.period_month.slice(0, 10)
    const bucket = byMonth.get(key) ?? emptyMetricCounts()
    bucket[v.metric_key] = (bucket[v.metric_key] ?? 0) + Number(v.violations)
    byMonth.set(key, bucket)
  }

  for (const m of months) {
    const violationsByMetric = byMonth.get(m) ?? emptyMetricCounts()
    const score = computeClientScore({
      violationsByMetric,
      targets: resolvedTargets,
    })
    const total = SLA_METRIC_KEYS.reduce(
      (acc, k) => acc + (violationsByMetric[k] ?? 0),
      0,
    )
    points.push({
      period_month: m,
      score: score.score,
      tier: score.tier,
      totalViolations: total,
      violationsByMetric,
    })
  }

  return { points, targets: resolvedTargets }
}

/**
 * Recent client_requests submitted by (or logged for) a single client.
 */
export async function loadClientOwnRequests(
  clientId: string,
  limit = 30,
): Promise<
  Array<{
    id: string
    subject: string
    body: string | null
    channel: string
    priority: string
    status: string
    received_at: string
    first_response_at: string | null
    first_response_note: string | null
    resolved_at: string | null
    logged_via_channel: boolean
  }>
> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("client_requests" as never)
    .select(
      "id, subject, body, channel, priority, status, received_at, first_response_at, first_response_note, resolved_at, logged_via_channel",
    )
    .eq("client_id", clientId)
    .order("received_at", { ascending: false })
    .limit(limit)

  return (data ?? []) as Array<{
    id: string
    subject: string
    body: string | null
    channel: string
    priority: string
    status: string
    received_at: string
    first_response_at: string | null
    first_response_note: string | null
    resolved_at: string | null
    logged_via_channel: boolean
  }>
}
