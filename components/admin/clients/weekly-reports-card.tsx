import { CalendarRange, FileDown, FileText } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getDictionary } from "@/lib/i18n/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { WeeklyReportPayload } from "@/lib/supabase/types"

/**
 * AE / admin facing weekly-report list on the client detail page.
 *
 * Shows every stored snapshot (client_weekly_reports) with a per-week PDF
 * download, plus a "download latest" button that always works — the API
 * route rebuilds the report live when nothing is stored yet.
 *
 * Ownership is already enforced by the parent page (AE 404 gate), and RLS
 * grants SELECT to all admin-shell roles.
 */
export async function ClientWeeklyReportsCard({ clientId }: { clientId: string }) {
  const { t, locale } = await getDictionary()
  const r = t.admin.clients.weeklyReports
  const dateLocale = locale === "vi" ? "vi-VN" : "en-US"

  const supabase = await createClient()
  const { data: rows, error } = await supabase
    .from("client_weekly_reports")
    .select("id, week_start, period_start, period_end, payload, email_sent")
    .eq("client_id", clientId)
    .order("week_start", { ascending: false })
    .limit(12)

  // Migration 067 not applied yet → show only the live download button.
  const tableMissing = error?.code === "42P01"
  const reports = (rows ?? []) as Array<{
    id: string
    week_start: string
    period_start: string
    period_end: string
    payload: WeeklyReportPayload
    email_sent: boolean
  }>

  const fmtRange = (startISO: string, endISO: string) => {
    const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }
    const endOpts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }
    return `${new Date(`${startISO}T00:00:00`).toLocaleDateString(dateLocale, opts)} – ${new Date(`${endISO}T00:00:00`).toLocaleDateString(dateLocale, endOpts)}`
  }

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            {r.title}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1 max-w-lg text-pretty">{r.subtitle}</p>
        </div>
        <Button size="sm" asChild>
          <a href={`/api/reports/weekly/${clientId}`}>
            <FileDown className="h-4 w-4" />
            {r.downloadLatest}
          </a>
        </Button>
      </CardHeader>
      <CardContent>
        {reports.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CalendarRange className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{r.empty}</p>
            <p className="text-xs text-muted-foreground max-w-md text-pretty">{r.emptyDesc}</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {reports.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <CalendarRange className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-foreground">
                      {r.week} {fmtRange(row.period_start, row.period_end)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {r.totalLeads}: <strong>{row.payload.totalLeads}</strong> · {r.won}:{" "}
                      <strong>{row.payload.wonCount}</strong> · {r.winRate}:{" "}
                      <strong>{row.payload.winRate}%</strong>
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={row.email_sent ? "secondary" : "outline"} className="font-normal">
                    {row.email_sent ? r.emailed : r.notEmailed}
                  </Badge>
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/api/reports/weekly/${clientId}?week=${row.week_start}`}>
                      <FileDown className="h-4 w-4" />
                      {r.download}
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {tableMissing && (
          <p className="text-xs text-muted-foreground mt-4">
            ⚠️ client_weekly_reports table not found — run scripts/067_client_weekly_reports.sql to
            enable report history. Live downloads still work.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
