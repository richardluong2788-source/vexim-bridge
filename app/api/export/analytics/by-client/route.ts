/**
 * GET /api/export/analytics/by-client?period=90d
 * CSV dump of the same data shown on the Analytics → "By Client" tab.
 */
import { NextResponse } from "next/server"
import { getCurrentRole } from "@/lib/auth/guard"
import { CAPS, can } from "@/lib/auth/permissions"
import { parsePeriod, resolvePeriod } from "@/lib/analytics/constants"
import { getByClient, type ClientScope, type ByClientRow } from "@/lib/analytics/queries"
import { toCsv, csvResponseHeaders, type CsvColumn } from "@/lib/export/csv"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const current = await getCurrentRole()
  if (!current) return NextResponse.json({ error: "unauthenticated" }, { status: 401 })

  const seeAll = can(current.role, CAPS.ANALYTICS_VIEW_ALL)
  const seeOwn = can(current.role, CAPS.ANALYTICS_VIEW_OWN)
  if (!seeAll && !seeOwn) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const url = new URL(request.url)
  const periodValue = parsePeriod(url.searchParams.get("period") ?? undefined)
  const period = resolvePeriod(periodValue, "vi")
  const scope: ClientScope = seeAll
    ? { kind: "all" }
    : { kind: "owned", managerId: current.userId }

  const rows = await getByClient(scope, period)

  // Sort same as the UI for parity with the on-screen table.
  rows.sort((a, b) => {
    const da = a.won + a.lost
    const db = b.won + b.lost
    if (db !== da) return db - da
    return b.winRate - a.winRate
  })

  const columns: CsvColumn<ByClientRow>[] = [
    { header: "Client",                value: (r) => r.clientName },
    { header: "Total opportunities",   value: (r) => r.total },
    { header: "Won",                   value: (r) => r.won },
    { header: "Lost",                  value: (r) => r.lost },
    { header: "In progress",           value: (r) => r.inProgress },
    { header: "Win rate (%)",          value: (r) => (r.won + r.lost > 0 ? r.winRate : "") },
    { header: "Won value (period, USD)", value: (r) => r.wonValueInPeriod },
    { header: "Avg cycle (days)",      value: (r) => r.avgCycleDays ?? "" },
    { header: "Last activity",         value: (r) => r.lastActivityAt },
  ]

  const csv = toCsv(rows, columns)
  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    status: 200,
    headers: csvResponseHeaders(
      `vexim-analytics-by-client-${periodValue}-${stamp}.csv`,
    ),
  })
}
