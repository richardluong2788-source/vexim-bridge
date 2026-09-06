/**
 * GET /api/reports/weekly/[clientId] — download a weekly report PDF.
 *
 * Auth scope
 * ----------
 *   - role "client"     → only their own clientId
 *   - admin-shell roles → CLIENT_VIEW cap required; AE / researcher / staff
 *                         additionally restricted to clients they own
 *                         (profiles.account_manager_id)
 *
 * Query params
 * ------------
 *   ?week=YYYY-MM-DD  Monday of the requested week. Defaults to the latest
 *                     STORED report; when nothing is stored yet the previous
 *                     week is generated live.
 *   ?inline=1         Render in the browser instead of forcing a download.
 *
 * The payload is taken from client_weekly_reports when available (exact
 * snapshot semantics) and rebuilt live otherwise, so this endpoint keeps
 * working even before migration 067 is applied.
 */
import { NextResponse } from "next/server"
import { getCurrentRole } from "@/lib/auth/guard"
import { CAPS, can } from "@/lib/auth/permissions"
import { isClientOwned } from "@/lib/auth/scope"
import {
  buildWeeklyReportPayload,
  parseWeekParam,
  previousWeekStart,
} from "@/lib/reports/weekly-report"
import {
  renderWeeklyReportPdf,
  weeklyReportFilename,
} from "@/lib/reports/weekly-report-pdf"
import type {
  PreferredLanguage,
  WeeklyReportPayload,
} from "@/lib/supabase/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params

  // ---- 1. Authenticate + authorise ---------------------------------------
  const current = await getCurrentRole()
  if (!current) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }
  const { userId, role, admin } = current

  if (role === "client") {
    if (clientId !== userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 })
    }
  } else {
    if (!can(role, CAPS.CLIENT_VIEW)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 })
    }
    // AE / researcher / staff may only download reports of clients they own.
    const owned = await isClientOwned(
      { kind: can(role, CAPS.OWNERSHIP_BYPASS) ? "all" : "owned", userId },
      admin,
      clientId,
    )
    if (!owned) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 })
    }
  }

  // ---- 2. Load the client profile (needed for the header + language) -----
  const { data: client } = await admin
    .from("profiles")
    .select("id, company_name, full_name, preferred_language")
    .eq("id", clientId)
    .single<{ id: string; company_name: string | null; full_name: string | null; preferred_language: PreferredLanguage | null }>()

  if (!client) {
    return NextResponse.json({ error: "client not found" }, { status: 404 })
  }

  const locale: PreferredLanguage = client.preferred_language ?? "vi"

  // ---- 3. Resolve the requested week -------------------------------------
  const url = new URL(request.url)
  const weekParam = parseWeekParam(url.searchParams.get("week"))

  // Prefer the exact stored snapshot for the requested week.
  let payload: WeeklyReportPayload | null = null
  if (weekParam) {
    const { data: stored, error } = await admin
      .from("client_weekly_reports")
      .select("payload")
      .eq("client_id", clientId)
      .eq("week_start", weekParam)
      .maybeSingle<{ payload: WeeklyReportPayload }>()
    if (!error && stored?.payload) payload = stored.payload
  } else {
    // No week given → latest stored report, newest first.
    const { data: rows, error } = await admin
      .from("client_weekly_reports")
      .select("payload")
      .eq("client_id", clientId)
      .order("week_start", { ascending: false })
      .limit(1)
    if (!error && rows && rows.length > 0) payload = rows[0].payload
  }

  // Fall back to a live build (table missing, week never persisted, or a
  // specific week requested that has no snapshot).
  if (!payload) {
    const week = weekParam ?? previousWeekStart()
    payload = await buildWeeklyReportPayload(admin, client, week)
  }

  // ---- 4. Render + stream the PDF -----------------------------------------
  try {
    const pdfBytes = await renderWeeklyReportPdf(payload, locale)
    const filename = weeklyReportFilename(payload)
    const inline = url.searchParams.get("inline") === "1"

    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    console.error("[weekly-report-pdf] render failed:", err)
    return NextResponse.json(
      { error: "Failed to render PDF" },
      { status: 500 },
    )
  }
}
