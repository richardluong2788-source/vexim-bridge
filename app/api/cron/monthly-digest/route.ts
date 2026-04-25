/**
 * GET /api/cron/monthly-digest — runs on the 1st of every month at 08:00 UTC.
 *
 * For each client we compute their pipeline metrics for the previous full
 * calendar month (and the month before that, for delta arrows) and email
 * the result. Emails are skipped when:
 *   - the client has no email
 *   - the client had zero opportunity activity in either month
 *   - notification_preferences.email_enabled = false
 *
 * Auth
 * ----
 * Bearer token check identical to other cron handlers — Vercel cron sends
 * `Authorization: Bearer $CRON_SECRET` automatically when configured.
 *
 * Idempotency
 * -----------
 * Dedup is handled implicitly by the cron schedule (once / month). We do
 * NOT write to `notification_email_log` because retainer / weekly mailers
 * already use that table for transactional triggers; a calendar-driven
 * digest doesn't benefit from row-level dedup and adding rows here would
 * pollute the alerting view.
 */
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getFromAddress, sendMail } from "@/lib/email/mailer"
import {
  renderMonthlyDigestHtml,
  type MonthlyDigestData,
} from "@/lib/email/monthly-digest"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface MonthMetrics {
  newOpportunities: number
  won: number
  lost: number
  wonValueUsd: number
  commissionPaidUsd: number
}

/**
 * Boundary timestamps for "the month before `ref`". Returns `[from, to)`
 * — `from` inclusive, `to` exclusive — both as UTC ISO strings.
 *
 * Example: ref = 2026-04-25 → returns [2026-03-01, 2026-04-01).
 */
function previousMonthRange(
  ref: Date,
): { fromIso: string; toIso: string; label: string } {
  const y = ref.getUTCFullYear()
  const m = ref.getUTCMonth() // 0-indexed
  const from = new Date(Date.UTC(y, m - 1, 1))
  const to = new Date(Date.UTC(y, m, 1))
  // Vietnamese label "Tháng 3, 2026"
  const monthNum = from.getUTCMonth() + 1
  const label = `Tháng ${monthNum}, ${from.getUTCFullYear()}`
  return { fromIso: from.toISOString(), toIso: to.toISOString(), label }
}

/**
 * Aggregate metrics for ONE client over [fromIso, toIso).
 * All four queries are independent so we run them in parallel.
 */
async function clientMetricsForMonth(
  admin: ReturnType<typeof createAdminClient>,
  clientId: string,
  fromIso: string,
  toIso: string,
): Promise<MonthMetrics> {
  const [createdResp, transResp, wonValResp, commResp] = await Promise.all([
    // 1. New opportunities (created in window)
    admin
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .gte("created_at", fromIso)
      .lt("created_at", toIso),

    // 2. Won / lost transitions in window
    admin
      .from("stage_transitions")
      .select("opportunity_id, to_stage, opportunities!inner(client_id, potential_value)")
      .in("to_stage", ["won", "lost"])
      .gte("transitioned_at", fromIso)
      .lt("transitioned_at", toIso)
      .eq("opportunities.client_id", clientId),

    // 3. (placeholder — wonValueUsd is computed from #2 below)
    Promise.resolve({ data: null }),

    // 4. Commission paid by this client in window (deals → opportunities)
    admin
      .from("deals")
      .select("commission_amount, paid_at, opportunities!inner(client_id)")
      .eq("payment_status", "paid")
      .gte("paid_at", fromIso)
      .lt("paid_at", toIso)
      .eq("opportunities.client_id", clientId),
  ])

  void wonValResp // unused placeholder kept to make Promise.all symmetric

  const transitions = (transResp.data ?? []) as Array<{
    opportunity_id: string
    to_stage: "won" | "lost"
    opportunities: { potential_value: number | null }
  }>

  // De-duplicate per opportunity (rare flip-flops) and sum won value.
  const finalState = new Map<string, "won" | "lost">()
  const wonValueByOpp = new Map<string, number>()
  for (const t of transitions) {
    finalState.set(t.opportunity_id, t.to_stage)
    if (t.to_stage === "won") {
      wonValueByOpp.set(
        t.opportunity_id,
        Number(t.opportunities.potential_value ?? 0),
      )
    }
  }
  let won = 0
  let lost = 0
  for (const v of finalState.values()) {
    if (v === "won") won++
    else lost++
  }
  // Only count won value for opportunities that ended the month in won.
  let wonValueUsd = 0
  for (const [oppId, finalStage] of finalState.entries()) {
    if (finalStage === "won") {
      wonValueUsd += wonValueByOpp.get(oppId) ?? 0
    }
  }

  const commissionPaidUsd = (commResp.data ?? []).reduce(
    (acc: number, r: { commission_amount: number | null }) =>
      acc + Number(r.commission_amount ?? 0),
    0,
  )

  return {
    newOpportunities: createdResp.count ?? 0,
    won,
    lost,
    wonValueUsd,
    commissionPaidUsd,
  }
}

/** In-progress count snapshot AT a specific timestamp (using last_updated). */
async function inProgressCountAt(
  admin: ReturnType<typeof createAdminClient>,
  clientId: string,
): Promise<number> {
  const { count } = await admin
    .from("opportunities")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .not("stage", "in", "(won,lost)")
  return count ?? 0
}

export async function GET(request: Request) {
  // ---- 1. Authenticate ---------------------------------------------------
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    )
  }
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()

  // ---- 2. Compute month windows -----------------------------------------
  const now = new Date()
  const lastMonth = previousMonthRange(now)
  // Month before that = the month immediately preceding lastMonth.
  const prevRefDate = new Date(lastMonth.fromIso) // 1st of last month
  const monthBefore = previousMonthRange(prevRefDate)

  // ---- 3. Build app URL --------------------------------------------------
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://example.com")

  // ---- 4. Pull every client + their notification preference -------------
  const [{ data: clients }, { data: prefs }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, email, full_name, company_name")
      .eq("role", "client"),
    admin
      .from("notification_preferences")
      .select("user_id, email_enabled, email_status_update"),
  ])

  // user_id -> "should we send?" — defaults true when no row exists.
  const optedIn = new Map<string, boolean>()
  for (const p of (prefs ?? []) as Array<{
    user_id: string
    email_enabled: boolean
    email_status_update: boolean
  }>) {
    optedIn.set(p.user_id, p.email_enabled && p.email_status_update)
  }

  const from = getFromAddress()
  type Result = {
    clientId: string
    status: "sent" | "skipped" | "failed"
    reason?: string
  }
  const results: Result[] = []

  // ---- 5. Process each client sequentially to avoid SMTP rate limits ---
  for (const c of clients ?? []) {
    if (!c.email) {
      results.push({ clientId: c.id, status: "skipped", reason: "no email" })
      continue
    }
    if (optedIn.get(c.id) === false) {
      results.push({ clientId: c.id, status: "skipped", reason: "opted out" })
      continue
    }

    const [m, prev, inProgress] = await Promise.all([
      clientMetricsForMonth(admin, c.id, lastMonth.fromIso, lastMonth.toIso),
      clientMetricsForMonth(admin, c.id, monthBefore.fromIso, monthBefore.toIso),
      inProgressCountAt(admin, c.id),
    ])

    // Skip the noisy "no activity" emails. We only send if at least one of
    // the recent months had ANY activity, or there are deals in progress.
    const hadActivity =
      m.newOpportunities > 0 ||
      m.won > 0 ||
      m.lost > 0 ||
      m.commissionPaidUsd > 0 ||
      prev.won > 0 ||
      inProgress > 0
    if (!hadActivity) {
      results.push({
        clientId: c.id,
        status: "skipped",
        reason: "no activity",
      })
      continue
    }

    const decidedNow = m.won + m.lost
    const winRateNow = decidedNow > 0 ? Math.round((m.won / decidedNow) * 100) : 0
    const decidedPrev = prev.won + prev.lost
    const winRatePrev =
      decidedPrev > 0 ? Math.round((prev.won / decidedPrev) * 100) : 0

    const payload: MonthlyDigestData = {
      clientName: c.company_name ?? c.full_name ?? "bạn",
      monthLabel: lastMonth.label,
      metrics: {
        newOpportunities: m.newOpportunities,
        won: m.won,
        lost: m.lost,
        wonValueUsd: m.wonValueUsd,
        inProgressCount: inProgress,
        winRate: winRateNow,
        commissionPaidUsd: m.commissionPaidUsd,
      },
      previous: {
        won: prev.won,
        winRate: winRatePrev,
        commissionPaidUsd: prev.commissionPaidUsd,
      },
      appUrl,
    }

    try {
      const { error: sendErr } = await sendMail({
        from,
        to: c.email,
        subject: `Báo cáo tháng — ${lastMonth.label} · Vexim Bridge`,
        html: renderMonthlyDigestHtml(payload),
      })
      if (sendErr) {
        results.push({
          clientId: c.id,
          status: "failed",
          reason: sendErr.message,
        })
      } else {
        results.push({ clientId: c.id, status: "sent" })
      }
    } catch (err) {
      results.push({
        clientId: c.id,
        status: "failed",
        reason: err instanceof Error ? err.message : "unknown",
      })
    }
  }

  const summary = {
    total: results.length,
    sent: results.filter((r) => r.status === "sent").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "failed").length,
    monthLabel: lastMonth.label,
  }
  return NextResponse.json({ summary, results })
}
