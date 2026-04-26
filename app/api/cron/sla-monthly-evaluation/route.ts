/**
 * Monthly SLA Evaluation cron.
 *
 * Schedule (vercel.json): "0 2 1 * *" — first day of each month at 02:00 UTC.
 * Evaluates the PRIOR calendar month's SLA compliance for every client.
 *
 * Idempotency (v2 B.6):
 *   1. INSERT ... ON CONFLICT DO NOTHING into sla_evaluation_runs claims
 *      ownership of the period. Concurrent invocations get NULL back and
 *      bail out gracefully.
 *   2. Within each (client, metric) pair, sla_violations has a unique
 *      index on (client_id, metric_key, period_month, occurrence_in_month)
 *      so re-runs after a crash never duplicate breach rows.
 *
 * Manual re-run: POST to this endpoint with `{ "period_month": "2026-04-01",
 * "force": true }` to delete the existing run row and re-evaluate. Useful
 * after fixing a bad target row or correcting a backdated request.
 */
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  buildEvalContext,
  evaluateClientForMonth,
} from "@/lib/sla/evaluator"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get("authorization") === `Bearer ${secret}`
}

/**
 * Compute the "prior month" anchor as a UTC Date positioned on the 15th
 * of the prior month. Using day=15 sidesteps DST / month-length edge
 * cases that day=1 has when subtracting months.
 */
function priorMonthAnchor(now: Date): Date {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth() // current
  // m - 1; JS Date wraps to previous year if needed.
  return new Date(Date.UTC(y, m - 1, 15, 0, 0, 0, 0))
}

interface RunSummary {
  period_month: string
  scanned_clients: number
  violations_inserted: number
  errors: Array<{ client_id: string; metric: string; message: string }>
}

async function runEvaluation(
  asOfMonth: Date,
  triggeredBy: string,
): Promise<RunSummary | { error: string; status: number }> {
  const admin = createAdminClient()
  const ctx = await buildEvalContext(admin, asOfMonth)

  // --- v2 B.6: claim the run slot ----------------------------------
  const { error: claimErr, data: claimRow } = await admin
    .from("sla_evaluation_runs" as never)
    .insert({
      period_month: ctx.periodMonth,
      status: "running",
      triggered_by: triggeredBy,
    } as never)
    .select("period_month")
    .maybeSingle<{ period_month: string }>()

  if (claimErr) {
    // Unique violation = another invocation already claimed this period.
    if ((claimErr as { code?: string }).code === "23505") {
      return { error: "Evaluation already in progress for this period", status: 409 }
    }
    return { error: claimErr.message, status: 500 }
  }
  if (!claimRow) {
    return { error: "Failed to claim evaluation slot", status: 500 }
  }

  // --- Iterate every client (role='client') ------------------------
  const { data: clients, error: clientsErr } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "client")

  if (clientsErr) {
    await admin
      .from("sla_evaluation_runs" as never)
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: clientsErr.message,
      } as never)
      .eq("period_month", ctx.periodMonth)
    return { error: clientsErr.message, status: 500 }
  }

  let totalNew = 0
  const errors: RunSummary["errors"] = []
  for (const c of clients ?? []) {
    const { newViolations, errors: clientErrors } = await evaluateClientForMonth(
      ctx,
      c.id,
    )
    totalNew += newViolations
    for (const e of clientErrors) {
      errors.push({ client_id: c.id, metric: e.metric, message: e.message })
    }
  }

  // --- Mark run completed -----------------------------------------
  await admin
    .from("sla_evaluation_runs" as never)
    .update({
      status: errors.length > 0 ? "completed" : "completed",
      completed_at: new Date().toISOString(),
      scanned_clients: clients?.length ?? 0,
      violations_inserted: totalNew,
      error_message:
        errors.length > 0
          ? `${errors.length} per-metric errors logged`
          : null,
    } as never)
    .eq("period_month", ctx.periodMonth)

  return {
    period_month: ctx.periodMonth,
    scanned_clients: clients?.length ?? 0,
    violations_inserted: totalNew,
    errors,
  }
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const now = new Date()
  const result = await runEvaluation(priorMonthAnchor(now), "cron")
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ ok: true, ...result })
}

/**
 * Manual re-run. Body shape:
 *   { period_month: 'YYYY-MM-DD', force?: boolean, triggered_by?: string }
 *
 * Requires the cron secret OR (later) admin auth. Sprint 1 keeps it as
 * cron-secret only — admin UI calls a server action which reaches the
 * evaluator directly without going through this route.
 */
export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  let payload: {
    period_month?: string
    force?: boolean
    triggered_by?: string
  } = {}
  try {
    payload = (await req.json()) as typeof payload
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!payload.period_month) {
    return NextResponse.json(
      { error: "period_month required (YYYY-MM-DD)" },
      { status: 400 },
    )
  }

  // Validate string before passing to Date.
  const isoMatch = /^\d{4}-\d{2}-\d{2}$/.test(payload.period_month)
  if (!isoMatch) {
    return NextResponse.json(
      { error: "period_month must be YYYY-MM-DD" },
      { status: 400 },
    )
  }

  const anchor = new Date(`${payload.period_month}T00:00:00Z`)

  if (payload.force) {
    const admin = createAdminClient()
    await admin
      .from("sla_evaluation_runs" as never)
      .delete()
      .eq("period_month", payload.period_month)
    // Note: existing sla_violations rows are kept — the unique index
    // means re-evaluation will simply not duplicate them.
  }

  const result = await runEvaluation(anchor, payload.triggered_by ?? "manual_post")
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ ok: true, ...result })
}
