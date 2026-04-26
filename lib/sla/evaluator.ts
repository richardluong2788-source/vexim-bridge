import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  businessDaysBetween,
  businessHoursBetween,
  startOfMonthUtc,
  startOfNextMonthUtc,
} from "@/lib/sla/business-hours"
import {
  type MetricEvaluation,
  type SlaHoliday,
  type SlaMetricKey,
  type SlaTarget,
} from "@/lib/sla/types"

type AdminSB = ReturnType<typeof createAdminClient>

/**
 * Per-evaluation context. The cron loads holidays + targets ONCE and
 * reuses them across every (client, metric) pair.
 */
export interface SlaEvalContext {
  admin: AdminSB
  holidaySet: Set<string>
  /**
   * Effective target lookup: (clientId, metricKey) -> target row.
   * The evaluator walks plan-specific overrides first, then falls back
   * to the global default (billing_plan_id IS NULL).
   */
  resolveTarget: (clientId: string, metric: SlaMetricKey) => SlaTarget | null
  periodStart: Date
  periodEnd: Date
  periodMonth: string // 'YYYY-MM-DD' (1st)
}

/**
 * Build the per-run context. Reads:
 *   - sla_holidays
 *   - sla_targets (active rows)
 *   - billing_plans (active per client)
 */
export async function buildEvalContext(
  admin: AdminSB,
  asOfMonth: Date,
): Promise<SlaEvalContext> {
  const periodStart = startOfMonthUtc(asOfMonth)
  const periodEnd = startOfNextMonthUtc(asOfMonth)
  const periodMonth = periodStart.toISOString().slice(0, 10)

  // Holidays — single fetch, indexed Set for O(1) lookup.
  const { data: holidayRows } = await admin
    .from("sla_holidays" as never)
    .select("holiday_date")
    .returns<Array<Pick<SlaHoliday, "holiday_date">>>()

  const holidaySet = new Set(holidayRows?.map((h) => h.holiday_date) ?? [])

  // Targets — load all active rows (plan-specific + global defaults).
  const { data: targetRows } = await admin
    .from("sla_targets" as never)
    .select(
      "id, billing_plan_id, metric_key, target_value, weight, penalty_usd_cents, active, notes, created_at, updated_at",
    )
    .eq("active", true)
    .returns<SlaTarget[]>()

  const targets = targetRows ?? []
  const planTargets = new Map<string, SlaTarget>() // key: `${planId}:${metric}`
  const globalTargets = new Map<SlaMetricKey, SlaTarget>()
  for (const t of targets) {
    if (t.billing_plan_id == null) {
      globalTargets.set(t.metric_key, t)
    } else {
      planTargets.set(`${t.billing_plan_id}:${t.metric_key}`, t)
    }
  }

  // Per-client active billing plan lookup.
  const { data: planRows } = await admin
    .from("billing_plans" as never)
    .select("id, client_id, status")
    .eq("status", "active")
    .returns<Array<{ id: string; client_id: string; status: string }>>()

  const clientPlanId = new Map<string, string>()
  for (const p of planRows ?? []) {
    clientPlanId.set(p.client_id, p.id)
  }

  function resolveTarget(
    clientId: string,
    metric: SlaMetricKey,
  ): SlaTarget | null {
    const planId = clientPlanId.get(clientId)
    if (planId) {
      const hit = planTargets.get(`${planId}:${metric}`)
      if (hit) return hit
    }
    return globalTargets.get(metric) ?? null
  }

  return {
    admin,
    holidaySet,
    resolveTarget,
    periodStart,
    periodEnd,
    periodMonth,
  }
}

// ---------------------------------------------------------------------
// Metric evaluators — one async function per SLA. Each returns a
// MetricEvaluation with measuredValue + an array of breaches the cron
// should persist into sla_violations.
// ---------------------------------------------------------------------

interface BreachInput {
  metricKey: SlaMetricKey
  occurrenceInMonth: number
  measuredValue: number
  targetValue: number
  delta: number
  sourceKind: string
  sourceId: string | null
  detail?: Record<string, unknown>
}

/**
 * Stable hash from a UUID string for use as occurrence_in_month — keeps
 * the unique index from rejecting two events on the same day.
 *
 * We just take the first 8 hex chars of the UUID, which gives 32 bits
 * of entropy — collisions are vanishingly unlikely within a single
 * (client, metric, month) combo.
 */
export function uuidToOccurrence(id: string): number {
  const hex = id.replace(/-/g, "").slice(0, 8)
  // Mod by 2^31 - 1 to stay inside Postgres INT range.
  return parseInt(hex, 16) % 2_147_483_647
}

// --- M1: Pipeline Update Response ----------------------------------
/**
 * Each active opportunity (stage NOT IN ('won','lost')) is supposed to
 * be touched within `target_value` business hours. We compute, for each
 * opportunity belonging to the client, the gap between `last_updated`
 * and the next stage_changed activity (or now() for currently-stale ones).
 *
 * For Sprint 1 simplification: we count opportunities where
 * (now - last_updated) > target hours AND last_updated falls inside the
 * evaluation month. One breach per opportunity per month.
 */
export async function evaluatePipelineUpdates(
  ctx: SlaEvalContext,
  clientId: string,
  target: SlaTarget,
): Promise<{ result: MetricEvaluation; breaches: BreachInput[] }> {
  const { data: opps } = await ctx.admin
    .from("opportunities")
    .select("id, stage, last_updated")
    .eq("client_id", clientId)
    .not("stage", "in", "(won,lost)")
    .gte("last_updated", ctx.periodStart.toISOString())
    .lt("last_updated", ctx.periodEnd.toISOString())

  const breaches: BreachInput[] = []
  // For "stale" detection we look at the END of the period: did the
  // opportunity sit untouched for more than target hours within the
  // month?  Note: we approximate "no further update" as last_updated
  // staying constant — fine for Sprint 1.
  const nowAtPeriodEnd = ctx.periodEnd

  for (const o of opps ?? []) {
    const lastUpdated = new Date(o.last_updated)
    const hours = businessHoursBetween(
      lastUpdated,
      nowAtPeriodEnd,
      ctx.holidaySet,
    )
    if (hours > target.target_value) {
      breaches.push({
        metricKey: "pipeline_update_response",
        occurrenceInMonth: uuidToOccurrence(o.id),
        measuredValue: hours,
        targetValue: target.target_value,
        delta: hours - target.target_value,
        sourceKind: "opportunity",
        sourceId: o.id,
        detail: { stage: o.stage, last_updated: o.last_updated },
      })
    }
  }

  return {
    result: {
      metricKey: "pipeline_update_response",
      targetValue: target.target_value,
      measuredValue: breaches.length,
      newViolations: breaches.length,
      detail: { scanned_opportunities: opps?.length ?? 0 },
    },
    breaches,
  }
}

// --- M2: Monthly Qualified Leads -----------------------------------
export async function evaluateQualifiedLeads(
  ctx: SlaEvalContext,
  clientId: string,
  target: SlaTarget,
): Promise<{ result: MetricEvaluation; breaches: BreachInput[] }> {
  const { count } = await ctx.admin
    .from("opportunities")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .gte("qualified_at", ctx.periodStart.toISOString())
    .lt("qualified_at", ctx.periodEnd.toISOString())

  const measured = count ?? 0
  const target_ = target.target_value
  const breaches: BreachInput[] =
    measured < target_
      ? [
          {
            metricKey: "monthly_qualified_leads",
            occurrenceInMonth: 1,
            measuredValue: measured,
            targetValue: target_,
            delta: target_ - measured,
            sourceKind: "aggregate",
            sourceId: null,
            detail: { count: measured },
          },
        ]
      : []
  return {
    result: {
      metricKey: "monthly_qualified_leads",
      targetValue: target_,
      measuredValue: measured,
      newViolations: breaches.length,
    },
    breaches,
  }
}

// --- M3: Monthly Email Outreach -----------------------------------
export async function evaluateEmailOutreach(
  ctx: SlaEvalContext,
  clientId: string,
  target: SlaTarget,
): Promise<{ result: MetricEvaluation; breaches: BreachInput[] }> {
  // Count emails sent during the month for opportunities owned by this
  // client. Two-step query because email_drafts joins to opportunities,
  // not directly to a client_id.
  const { data: oppRows } = await ctx.admin
    .from("opportunities")
    .select("id")
    .eq("client_id", clientId)

  const oppIds = (oppRows ?? []).map((r) => r.id)
  if (oppIds.length === 0) {
    const breaches =
      0 < target.target_value
        ? [
            {
              metricKey: "monthly_email_outreach" as const,
              occurrenceInMonth: 1,
              measuredValue: 0,
              targetValue: target.target_value,
              delta: target.target_value,
              sourceKind: "aggregate",
              sourceId: null,
              detail: { count: 0 },
            },
          ]
        : []
    return {
      result: {
        metricKey: "monthly_email_outreach",
        targetValue: target.target_value,
        measuredValue: 0,
        newViolations: breaches.length,
      },
      breaches,
    }
  }

  const { count } = await ctx.admin
    .from("email_drafts")
    .select("id", { count: "exact", head: true })
    .eq("status", "sent")
    .in("opportunity_id", oppIds)
    .gte("sent_at", ctx.periodStart.toISOString())
    .lt("sent_at", ctx.periodEnd.toISOString())

  const measured = count ?? 0
  const target_ = target.target_value
  const breaches: BreachInput[] =
    measured < target_
      ? [
          {
            metricKey: "monthly_email_outreach",
            occurrenceInMonth: 1,
            measuredValue: measured,
            targetValue: target_,
            delta: target_ - measured,
            sourceKind: "aggregate",
            sourceId: null,
            detail: { count: measured, opp_count: oppIds.length },
          },
        ]
      : []
  return {
    result: {
      metricKey: "monthly_email_outreach",
      targetValue: target_,
      measuredValue: measured,
      newViolations: breaches.length,
    },
    breaches,
  }
}

// --- M4: Client Request Response Time -----------------------------
export async function evaluateClientRequestResponse(
  ctx: SlaEvalContext,
  clientId: string,
  target: SlaTarget,
): Promise<{ result: MetricEvaluation; breaches: BreachInput[] }> {
  const { data: rows } = await ctx.admin
    .from("client_requests" as never)
    .select(
      "id, received_at, first_response_at, status",
    )
    .eq("client_id", clientId)
    .gte("received_at", ctx.periodStart.toISOString())
    .lt("received_at", ctx.periodEnd.toISOString())
    .returns<
      Array<{
        id: string
        received_at: string
        first_response_at: string | null
        status: string
      }>
    >()

  const breaches: BreachInput[] = []
  let totalGapHours = 0
  let respondedCount = 0

  for (const r of rows ?? []) {
    const received = new Date(r.received_at)
    // For un-responded requests we measure up to the period end so that
    // an open ticket counts as a breach if it has been sitting longer
    // than the target.
    const responded = r.first_response_at
      ? new Date(r.first_response_at)
      : ctx.periodEnd

    const hours = businessHoursBetween(received, responded, ctx.holidaySet)
    if (r.first_response_at) {
      totalGapHours += hours
      respondedCount += 1
    }
    if (hours > target.target_value) {
      breaches.push({
        metricKey: "client_request_response",
        occurrenceInMonth: uuidToOccurrence(r.id),
        measuredValue: hours,
        targetValue: target.target_value,
        delta: hours - target.target_value,
        sourceKind: "client_request",
        sourceId: r.id,
        detail: {
          received_at: r.received_at,
          first_response_at: r.first_response_at,
          status: r.status,
        },
      })
    }
  }

  return {
    result: {
      metricKey: "client_request_response",
      targetValue: target.target_value,
      measuredValue: breaches.length,
      newViolations: breaches.length,
      detail: {
        total_requests: rows?.length ?? 0,
        responded_count: respondedCount,
        avg_response_hours:
          respondedCount > 0
            ? Number((totalGapHours / respondedCount).toFixed(2))
            : null,
      },
    },
    breaches,
  }
}

// --- M5: Swift Verification Lag -----------------------------------
export async function evaluateSwiftVerification(
  ctx: SlaEvalContext,
  clientId: string,
  target: SlaTarget,
): Promise<{ result: MetricEvaluation; breaches: BreachInput[] }> {
  // Find the client's deals (via opportunities) where Swift was uploaded
  // during the month. For each, compute upload->verify lag.
  const { data: oppRows } = await ctx.admin
    .from("opportunities")
    .select("id")
    .eq("client_id", clientId)

  const oppIds = (oppRows ?? []).map((r) => r.id)
  if (oppIds.length === 0) {
    return {
      result: {
        metricKey: "swift_verification_lag",
        targetValue: target.target_value,
        measuredValue: 0,
        newViolations: 0,
      },
      breaches: [],
    }
  }

  const { data: dealRows } = await ctx.admin
    .from("deals")
    .select(
      "id, opportunity_id, swift_uploaded_at, swift_verified_at",
    )
    .in("opportunity_id", oppIds)
    .not("swift_uploaded_at", "is", null)
    .gte("swift_uploaded_at", ctx.periodStart.toISOString())
    .lt("swift_uploaded_at", ctx.periodEnd.toISOString())

  const breaches: BreachInput[] = []
  for (const d of dealRows ?? []) {
    if (!d.swift_uploaded_at) continue
    const uploaded = new Date(d.swift_uploaded_at)
    const verifiedOrPeriodEnd = d.swift_verified_at
      ? new Date(d.swift_verified_at)
      : ctx.periodEnd
    const days = businessDaysBetween(
      uploaded,
      verifiedOrPeriodEnd,
      ctx.holidaySet,
    )
    if (days > target.target_value) {
      breaches.push({
        metricKey: "swift_verification_lag",
        occurrenceInMonth: uuidToOccurrence(d.id),
        measuredValue: days,
        targetValue: target.target_value,
        delta: days - target.target_value,
        sourceKind: "deal",
        sourceId: d.id,
        detail: {
          swift_uploaded_at: d.swift_uploaded_at,
          swift_verified_at: d.swift_verified_at,
        },
      })
    }
  }

  return {
    result: {
      metricKey: "swift_verification_lag",
      targetValue: target.target_value,
      measuredValue: breaches.length,
      newViolations: breaches.length,
      detail: { scanned_deals: dealRows?.length ?? 0 },
    },
    breaches,
  }
}

// --- M6: FDA Renewal Alert Lead Time ------------------------------
/**
 * Did we send the renewal alert at least `target_value` days BEFORE
 * the FDA expires? For each client we look at their FDA expiry date,
 * the most-recent renewal email log entry inside the month, and the
 * gap between (email sent) and (expiry).
 *
 * If the client's FDA already expired AND no email was sent in the
 * last 90 days, that counts as a breach.
 */
export async function evaluateFdaRenewalAlert(
  ctx: SlaEvalContext,
  clientId: string,
  target: SlaTarget,
): Promise<{ result: MetricEvaluation; breaches: BreachInput[] }> {
  const { data: profile } = await ctx.admin
    .from("profiles")
    .select("id, fda_expires_at, fda_renewal_notified_at")
    .eq("id", clientId)
    .single()

  if (!profile?.fda_expires_at) {
    // Client hasn't set FDA — not in scope for this metric.
    return {
      result: {
        metricKey: "fda_renewal_alert",
        targetValue: target.target_value,
        measuredValue: 0,
        newViolations: 0,
      },
      breaches: [],
    }
  }

  const expiry = new Date(profile.fda_expires_at)
  const notifiedAt = profile.fda_renewal_notified_at
    ? new Date(profile.fda_renewal_notified_at)
    : null

  // Was the most recent notification at least target_value days before
  // expiry? If yes -> compliant. If no notification or too late -> breach.
  if (notifiedAt) {
    const daysAhead =
      (expiry.getTime() - notifiedAt.getTime()) / (24 * 3_600_000)
    if (daysAhead >= target.target_value) {
      return {
        result: {
          metricKey: "fda_renewal_alert",
          targetValue: target.target_value,
          measuredValue: daysAhead,
          newViolations: 0,
        },
        breaches: [],
      }
    }
  }

  // Only mark as breach if expiry falls in the period or earlier (i.e.
  // the SLA window for this client has elapsed). Future expiries that
  // are still > target days out are fine.
  const daysUntilExpiry =
    (expiry.getTime() - ctx.periodEnd.getTime()) / (24 * 3_600_000)
  if (daysUntilExpiry > target.target_value) {
    return {
      result: {
        metricKey: "fda_renewal_alert",
        targetValue: target.target_value,
        measuredValue: daysUntilExpiry,
        newViolations: 0,
      },
      breaches: [],
    }
  }

  const measuredAhead = notifiedAt
    ? Math.max(
        0,
        (expiry.getTime() - notifiedAt.getTime()) / (24 * 3_600_000),
      )
    : 0
  return {
    result: {
      metricKey: "fda_renewal_alert",
      targetValue: target.target_value,
      measuredValue: measuredAhead,
      newViolations: 1,
    },
    breaches: [
      {
        metricKey: "fda_renewal_alert",
        occurrenceInMonth: 1,
        measuredValue: measuredAhead,
        targetValue: target.target_value,
        delta: target.target_value - measuredAhead,
        sourceKind: "profile",
        sourceId: profile.id,
        detail: {
          fda_expires_at: profile.fda_expires_at,
          fda_renewal_notified_at: profile.fda_renewal_notified_at,
        },
      },
    ],
  }
}

// --- M7: Monthly Status Report ------------------------------------
/**
 * Was a digest email recorded in notification_email_log for this client
 * during the period? Distinguished by dedup_key prefix
 * `monthly_digest:` (matches the cron in /api/cron/monthly-digest).
 */
export async function evaluateMonthlyReport(
  ctx: SlaEvalContext,
  clientId: string,
  target: SlaTarget,
): Promise<{ result: MetricEvaluation; breaches: BreachInput[] }> {
  // The monthly digest cron fires on the 1st of the month and ships the
  // PRIOR month. Allow a 5-day grace: we look for any digest log entry
  // up to the 5th of the next month for the period being evaluated.
  const graceEnd = new Date(ctx.periodEnd.getTime())
  graceEnd.setUTCDate(graceEnd.getUTCDate() + 5)

  const { count } = await ctx.admin
    .from("notification_email_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", clientId)
    .eq("status", "sent")
    .like("dedup_key", "monthly_digest:%")
    .gte("created_at", ctx.periodEnd.toISOString())
    .lt("created_at", graceEnd.toISOString())

  const sent = (count ?? 0) > 0
  const measured = sent ? 1 : 0
  const breaches: BreachInput[] =
    !sent && target.target_value >= 1
      ? [
          {
            metricKey: "monthly_status_report",
            occurrenceInMonth: 1,
            measuredValue: 0,
            targetValue: 1,
            delta: 1,
            sourceKind: "aggregate",
            sourceId: null,
            detail: {
              expected_window_end: graceEnd.toISOString(),
            },
          },
        ]
      : []
  return {
    result: {
      metricKey: "monthly_status_report",
      targetValue: target.target_value,
      measuredValue: measured,
      newViolations: breaches.length,
    },
    breaches,
  }
}

// ---------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------

const EVAL_REGISTRY: Record<
  SlaMetricKey,
  (
    ctx: SlaEvalContext,
    clientId: string,
    target: SlaTarget,
  ) => Promise<{ result: MetricEvaluation; breaches: BreachInput[] }>
> = {
  pipeline_update_response: evaluatePipelineUpdates,
  monthly_qualified_leads: evaluateQualifiedLeads,
  monthly_email_outreach: evaluateEmailOutreach,
  client_request_response: evaluateClientRequestResponse,
  swift_verification_lag: evaluateSwiftVerification,
  fda_renewal_alert: evaluateFdaRenewalAlert,
  monthly_status_report: evaluateMonthlyReport,
}

/**
 * Run all 7 metric evaluators for one client + write the resulting
 * breaches to sla_violations. Returns a summary for the cron response.
 */
export async function evaluateClientForMonth(
  ctx: SlaEvalContext,
  clientId: string,
): Promise<{
  metrics: MetricEvaluation[]
  newViolations: number
  errors: Array<{ metric: SlaMetricKey; message: string }>
}> {
  const metrics: MetricEvaluation[] = []
  const errors: Array<{ metric: SlaMetricKey; message: string }> = []
  let newViolations = 0

  for (const metric of Object.keys(EVAL_REGISTRY) as SlaMetricKey[]) {
    const target = ctx.resolveTarget(clientId, metric)
    if (!target) {
      // No target configured -> skip silently.
      continue
    }
    try {
      const fn = EVAL_REGISTRY[metric]
      const { result, breaches } = await fn(ctx, clientId, target)
      metrics.push(result)

      // Persist breaches with ON CONFLICT DO NOTHING so re-runs are safe.
      if (breaches.length > 0) {
        const rows = breaches.map((b) => ({
          client_id: clientId,
          billing_plan_id: target.billing_plan_id,
          sla_target_id: target.id,
          metric_key: b.metricKey,
          period_month: ctx.periodMonth,
          occurrence_in_month: b.occurrenceInMonth,
          measured_value: b.measuredValue,
          target_value: b.targetValue,
          delta: b.delta,
          source_kind: b.sourceKind,
          source_id: b.sourceId,
          status: "logged" as const,
          detail: b.detail ?? null,
        }))

        // upsert with onConflict to keep idempotency.
        const { error: insertErr, count: insertedCount } = await ctx.admin
          .from("sla_violations" as never)
          .upsert(rows as never[], {
            onConflict: "client_id,metric_key,period_month,occurrence_in_month",
            ignoreDuplicates: true,
            count: "exact",
          })
        if (insertErr) {
          errors.push({ metric, message: insertErr.message })
        } else {
          newViolations += insertedCount ?? 0
        }
      }
    } catch (err) {
      errors.push({
        metric,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { metrics, newViolations, errors }
}
