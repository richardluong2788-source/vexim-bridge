import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import type { Stage, WeeklyReportPayload } from "@/lib/supabase/types"

/**
 * Weekly client report — shared data layer.
 *
 * Three consumers:
 *   1. /api/cron/weekly-report  — builds + persists + emails the report.
 *   2. /api/reports/weekly/[id] — renders the stored (or live) payload as PDF.
 *   3. Client & AE dashboards   — lists stored reports for display/download.
 *
 * SECURITY (R-07 disclosure rules, mirrors client_leads_masked):
 *   Buyer identity (company_name) is only revealed once a deal reaches
 *   price_agreed/production/shipped/won. Before that we show the opaque
 *   buyer_code instead. This module is therefore safe to feed BOTH the
 *   client-facing email/PDF and the AE-downloaded PDF.
 */

type AdminSB = ReturnType<typeof createAdminClient>

export const PIPELINE_STAGES: Stage[] = [
  "sample_requested",
  "sample_sent",
  "negotiation",
  "price_agreed",
  "production",
  "shipped",
  "won",
  "lost",
]

/** Stages at which the buyer's real company name may be revealed. */
export const IDENTITY_REVEALED_STAGES: Stage[] = [
  "price_agreed",
  "production",
  "shipped",
  "won",
]

interface OpportunityRow {
  stage: Stage
  last_updated: string
  created_at: string
  buyer_code: string | null
  leads: { company_name: string | null } | null
}

interface ClientLike {
  id: string
  company_name: string | null
  full_name: string | null
}

/** Monday 00:00 of the week containing `date` (local time). */
export function mondayOf(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

/**
 * The week the Monday-morning cron reports on: the PREVIOUS week
 * (Monday → Sunday). Called at 09:00 UTC Monday, this is "7 days ago".
 */
export function previousWeekStart(now: Date = new Date()): string {
  const prevMonday = new Date(mondayOf(now))
  prevMonday.setDate(prevMonday.getDate() - 7)
  return toISODate(prevMonday)
}

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function addDaysISO(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00`)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

/** Validate a `?week=` param: must be a real Monday in YYYY-MM-DD form. */
export function parseWeekParam(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const d = new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  if (d.getDay() !== 1) return null // must be a Monday
  return value
}

/** R-07: real name only from price_agreed onwards, otherwise buyer_code. */
export function maskBuyerName(o: OpportunityRow): string {
  if (IDENTITY_REVEALED_STAGES.includes(o.stage)) {
    return o.leads?.company_name ?? o.buyer_code ?? "Anonymous buyer"
  }
  return o.buyer_code ?? "Anonymous buyer"
}

/**
 * Build a report payload for one client + one week.
 *
 * The caller decides how to use it: the cron persists it (upsert) while the
 * PDF route may build it on the fly for weeks that were never persisted.
 */
export async function buildWeeklyReportPayload(
  admin: AdminSB,
  client: ClientLike,
  weekStart: string,
): Promise<WeeklyReportPayload> {
  const periodStart = weekStart
  const periodEnd = addDaysISO(weekStart, 6) // Sunday
  const periodStartTs = new Date(`${periodStart}T00:00:00`).getTime()
  const periodEndTs = new Date(`${periodEnd}T23:59:59.999`).getTime()

  const { data, error } = await admin
    .from("opportunities")
    .select("stage, last_updated, created_at, buyer_code, leads(company_name)")
    .eq("client_id", client.id)
    .is("archived_at", null)

  if (error) {
    throw new Error(`Failed to load opportunities: ${error.message}`)
  }
  const rows = (data ?? []) as unknown as OpportunityRow[]

  const stageCounts = PIPELINE_STAGES.map((stage) => ({
    stage,
    count: rows.filter((o) => o.stage === stage).length,
  }))

  const totalLeads = rows.length
  const wonCount = rows.filter((o) => o.stage === "won").length
  const lostCount = rows.filter((o) => o.stage === "lost").length
  const activeLeads = totalLeads - wonCount - lostCount
  const winRate = totalLeads > 0 ? Math.round((wonCount / totalLeads) * 100) : 0

  const createdInWeek = rows.filter(
    (o) =>
      new Date(o.created_at).getTime() >= periodStartTs &&
      new Date(o.created_at).getTime() <= periodEndTs,
  )
  const updatedInWeek = rows.filter(
    (o) =>
      new Date(o.last_updated).getTime() >= periodStartTs &&
      new Date(o.last_updated).getTime() <= periodEndTs,
  )

  // Recent leads = most recently updated opportunities of the week,
  // masked per R-07 disclosure rules.
  const recentLeads = [...updatedInWeek]
    .sort(
      (a, b) =>
        new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime(),
    )
    .slice(0, 8)
    .map((o) => ({
      displayName: maskBuyerName(o),
      stage: o.stage,
      updatedAt: o.last_updated,
    }))

  return {
    clientId: client.id,
    clientName: client.company_name ?? client.full_name ?? "Valued client",
    weekStart,
    periodStart,
    periodEnd,
    totalLeads,
    activeLeads,
    wonCount,
    lostCount,
    winRate,
    newThisWeek: createdInWeek.length,
    updatedThisWeek: updatedInWeek.length,
    stageCounts,
    recentLeads,
  }
}

/**
 * Upsert the report snapshot (idempotent on client_id + week_start).
 * Degrades gracefully when migration 067 hasn't been applied yet.
 */
export async function upsertWeeklyReport(
  admin: AdminSB,
  payload: WeeklyReportPayload,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await admin
    .from("client_weekly_reports")
    .upsert(
      {
        client_id: payload.clientId,
        week_start: payload.weekStart,
        period_start: payload.periodStart,
        period_end: payload.periodEnd,
        payload,
      },
      { onConflict: "client_id,week_start" },
    )

  if (error) {
    // 42P01 = undefined_table → migration 067 not applied yet.
    if (error.code === "42P01") {
      console.warn(
        "[weekly-report] client_weekly_reports table missing (run scripts/067_client_weekly_reports.sql) — report not persisted.",
      )
      return { ok: false, error: error.message }
    }
    console.error("[weekly-report] upsert failed:", error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

/**
 * Mark delivery status on the stored row (best-effort, no throw).
 */
export async function markReportEmailStatus(
  admin: AdminSB,
  clientId: string,
  weekStart: string,
  emailSent: boolean,
  emailError?: string | null,
): Promise<void> {
  const { error } = await admin
    .from("client_weekly_reports")
    .update({ email_sent: emailSent, email_error: emailError ?? null })
    .eq("client_id", clientId)
    .eq("week_start", weekStart)
  if (error && error.code !== "42P01") {
    console.error("[weekly-report] status update failed:", error.message)
  }
}
