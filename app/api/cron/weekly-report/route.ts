import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getFromAddress, sendMail } from "@/lib/email/mailer"
import { renderWeeklyReportHtml } from "@/lib/email/weekly-report"
import { siteConfig } from "@/lib/site-config"
import {
  buildWeeklyReportPayload,
  markReportEmailStatus,
  previousWeekStart,
  upsertWeeklyReport,
} from "@/lib/reports/weekly-report"
import type { StageSummary } from "@/lib/email/weekly-report"
import type { PreferredLanguage } from "@/lib/supabase/types"

// Run on the Node.js runtime because nodemailer uses Node APIs.
export const runtime = "nodejs"
// Never cache — always send fresh data.
export const dynamic = "force-dynamic"

/**
 * Weekly pipeline report cron.
 *
 * Triggered by vercel.json at 09:00 UTC every Monday and reports on the
 * PREVIOUS week (Monday → Sunday). Must be called with
 * `Authorization: Bearer <CRON_SECRET>`.
 *
 * Per client (that has at least one opportunity) this job:
 *   1. Builds the report payload (buyer names pre-masked per R-07).
 *   2. Upserts a snapshot row into client_weekly_reports (migration 067)
 *      so the client dashboard + AE download views have history.
 *   3. Sends the report email (as before).
 *   4. Creates an in-app notification linking to /client/reports.
 */
export async function GET(request: Request) {
  // ---- 1. Authenticate the call ----------------------------------------
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

  // ---- 2. Use the admin client to bypass RLS ---------------------------
  const supabase = createAdminClient()
  const weekStart = previousWeekStart()

  // ---- 3. Fetch all clients ---------------------------------------------
  const { data: clients, error: clientsErr } = await supabase
    .from("profiles")
    .select("id, email, full_name, company_name, preferred_language")
    .eq("role", "client")

  if (clientsErr) {
    return NextResponse.json(
      { error: "Failed to load clients", detail: clientsErr.message },
      { status: 500 },
    )
  }

  // Use the stable production domain, never the per-deployment VERCEL_URL —
  // that one sits behind Vercel's Deployment Protection SSO wall and would
  // 403 recipients clicking the link in this email.
  const appUrl = siteConfig.url

  const from = getFromAddress()
  const results: Array<{
    clientId: string
    status: "sent" | "skipped" | "failed"
    persisted?: boolean
    notified?: boolean
    reason?: string
  }> = []

  // ---- 4. For each client: build → persist → email → notify -------------
  for (const client of clients ?? []) {
    if (!client.email) {
      results.push({ clientId: client.id, status: "skipped", reason: "no email" })
      continue
    }

    // Build the snapshot. Buyer names inside are already masked (R-07).
    const payload = await buildWeeklyReportPayload(supabase, client, weekStart)

    if (payload.totalLeads === 0) {
      results.push({
        clientId: client.id,
        status: "skipped",
        reason: "no opportunities",
      })
      continue
    }

    // Persist so dashboards + AE downloads have the exact same snapshot.
    const persisted = await upsertWeeklyReport(supabase, payload)

    // ---- Email (unchanged shape, now with masked names) ---------------
    const stageCounts: StageSummary[] = payload.stageCounts
    let emailStatus: "sent" | "failed" = "sent"
    let emailError: string | undefined

    try {
      const { error: sendErr } = await sendMail({
        from,
        to: client.email,
        subject: "Your weekly pipeline report — Vexim Trade",
        html: renderWeeklyReportHtml({
          clientName: payload.clientName,
          totalLeads: payload.totalLeads,
          stageCounts,
          recentLeads: payload.recentLeads,
          appUrl,
        }),
      })
      if (sendErr) {
        emailStatus = "failed"
        emailError = sendErr.message
      }
    } catch (err) {
      emailStatus = "failed"
      emailError = err instanceof Error ? err.message : "unknown"
    }

    if (persisted.ok) {
      await markReportEmailStatus(
        supabase,
        client.id,
        weekStart,
        emailStatus === "sent",
        emailStatus === "failed" ? (emailError ?? null) : null,
      )
    }

    // ---- In-app notification (bell feed) -------------------------------
    // Inserted directly — the email was already sent above, so we must NOT
    // go through dispatchNotification (it would double-email).
    const locale: PreferredLanguage = client.preferred_language ?? "vi"
    const title =
      locale === "vi"
        ? `Báo cáo tuần ${formatWeekRangeVi(payload.periodStart, payload.periodEnd)} đã sẵn sàng`
        : `Your weekly report for ${formatWeekRangeEn(payload.periodStart, payload.periodEnd)} is ready`
    const body =
      locale === "vi"
        ? `Tuần này có ${payload.newThisWeek} lead mới và ${payload.updatedThisWeek} lead có tiến triển. Xem chi tiết và tải PDF tại đây.`
        : `${payload.newThisWeek} new leads and ${payload.updatedThisWeek} progressed this week. View details and download the PDF.`

    const { error: notifErr } = await supabase.from("notifications").insert({
      user_id: client.id,
      category: "status_update",
      title,
      body,
      link_path: "/client/reports",
    })
    if (notifErr && notifErr.code !== "42P01") {
      console.error("[weekly-report] notification insert failed:", notifErr.message)
    }

    results.push({
      clientId: client.id,
      status: emailStatus === "sent" ? "sent" : "failed",
      persisted: persisted.ok,
      notified: !notifErr,
      ...(emailError ? { reason: emailError } : {}),
    })
  }

  const summary = {
    week: weekStart,
    total: results.length,
    sent: results.filter((r) => r.status === "sent").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "failed").length,
    persisted: results.filter((r) => r.persisted).length,
  }

  return NextResponse.json({ summary, results })
}

function formatWeekRangeVi(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00`)
  const e = new Date(`${end}T00:00:00`)
  const fmt = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`
  return `${fmt(s)}–${fmt(e)}`
}

function formatWeekRangeEn(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00`)
  const e = new Date(`${end}T00:00:00`)
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  return `${fmt(s)} – ${fmt(e)}`
}
