import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getFromAddress, getResend } from "@/lib/email/resend"
import {
  renderWeeklyReportHtml,
  type RecentLead,
  type StageSummary,
  type WeeklyReportData,
} from "@/lib/email/weekly-report"
import type { Stage } from "@/lib/supabase/types"

// Run on the Node.js runtime because the Resend SDK uses Node APIs.
export const runtime = "nodejs"
// Never cache — always send fresh data.
export const dynamic = "force-dynamic"

const STAGES: Stage[] = [
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
]

/**
 * Weekly pipeline report cron.
 *
 * Triggered by vercel.json at 09:00 UTC every Monday.
 * Must be called with `Authorization: Bearer <CRON_SECRET>`.
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

  // ---- 3. Fetch all clients that have at least one opportunity ---------
  const { data: clients, error: clientsErr } = await supabase
    .from("profiles")
    .select("id, email, full_name, company_name")
    .eq("role", "client")

  if (clientsErr) {
    return NextResponse.json(
      { error: "Failed to load clients", detail: clientsErr.message },
      { status: 500 },
    )
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://example.com"

  const resend = getResend()
  const from = getFromAddress()
  const results: Array<{ clientId: string; status: "sent" | "skipped" | "failed"; reason?: string }> = []

  // ---- 4. For each client, aggregate pipeline + send email -------------
  for (const client of clients ?? []) {
    if (!client.email) {
      results.push({ clientId: client.id, status: "skipped", reason: "no email" })
      continue
    }

    // Fetch this client's opportunities with joined lead info
    const { data: opps } = await supabase
      .from("opportunities")
      .select("stage, last_updated, leads(company_name)")
      .eq("client_id", client.id)
      .order("last_updated", { ascending: false })

    const opportunities = (opps ?? []) as Array<{
      stage: Stage
      last_updated: string
      leads: { company_name: string } | null
    }>

    if (opportunities.length === 0) {
      results.push({ clientId: client.id, status: "skipped", reason: "no opportunities" })
      continue
    }

    const stageCounts: StageSummary[] = STAGES.map((stage) => ({
      stage,
      count: opportunities.filter((o) => o.stage === stage).length,
    }))

    // Recent leads updated in the last 7 days
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const recentLeads: RecentLead[] = opportunities
      .filter((o) => new Date(o.last_updated).getTime() >= sevenDaysAgo)
      .slice(0, 5)
      .map((o) => ({
        companyName: o.leads?.company_name ?? "Unknown",
        stage: o.stage,
        updatedAt: o.last_updated,
      }))

    const payload: WeeklyReportData = {
      clientName: client.company_name ?? client.full_name ?? "there",
      totalLeads: opportunities.length,
      stageCounts,
      recentLeads,
      appUrl,
    }

    try {
      const { error: sendErr } = await resend.emails.send({
        from,
        to: client.email,
        subject: "Your weekly pipeline report — Vexim Bridge",
        html: renderWeeklyReportHtml(payload),
      })
      if (sendErr) {
        results.push({ clientId: client.id, status: "failed", reason: sendErr.message })
      } else {
        results.push({ clientId: client.id, status: "sent" })
      }
    } catch (err) {
      results.push({
        clientId: client.id,
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
  }

  return NextResponse.json({ summary, results })
}
