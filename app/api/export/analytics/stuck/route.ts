/**
 * GET /api/export/analytics/stuck — CSV of stuck opportunities (Bottleneck tab).
 *
 * Stuck = days_in_current_stage exceeds the stage threshold defined in
 * `lib/analytics/constants.ts` (STUCK_THRESHOLD_DAYS).
 */
import { NextResponse } from "next/server"
import { getCurrentRole } from "@/lib/auth/guard"
import { CAPS, can } from "@/lib/auth/permissions"
import {
  getStuckOpportunities,
  type ClientScope,
  type StuckOpportunity,
} from "@/lib/analytics/queries"
import { STAGE_LABEL_VI } from "@/lib/analytics/constants"
import { toCsv, csvResponseHeaders, type CsvColumn } from "@/lib/export/csv"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const current = await getCurrentRole()
  if (!current) return NextResponse.json({ error: "unauthenticated" }, { status: 401 })

  const seeAll = can(current.role, CAPS.ANALYTICS_VIEW_ALL)
  const seeOwn = can(current.role, CAPS.ANALYTICS_VIEW_OWN)
  if (!seeAll && !seeOwn) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const scope: ClientScope = seeAll
    ? { kind: "all" }
    : { kind: "owned", managerId: current.userId }

  const rows = await getStuckOpportunities(scope)

  const columns: CsvColumn<StuckOpportunity>[] = [
    { header: "Client",            value: (r) => r.clientName },
    { header: "Buyer",             value: (r) => r.buyerName },
    { header: "Stage",             value: (r) => STAGE_LABEL_VI[r.stage] ?? r.stage },
    { header: "Days in stage",     value: (r) => r.daysInStage },
    { header: "Threshold",         value: (r) => r.threshold },
    { header: "Overdue (days)",    value: (r) => r.daysInStage - r.threshold },
    { header: "Potential value (USD)", value: (r) => r.potentialValue ?? "" },
    { header: "Last updated",      value: (r) => r.lastUpdated },
    { header: "Opportunity ID",    value: (r) => r.opportunityId },
  ]

  const csv = toCsv(rows, columns)
  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    status: 200,
    headers: csvResponseHeaders(`vexim-analytics-stuck-${stamp}.csv`),
  })
}
