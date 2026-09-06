import { redirect } from "next/navigation"
import { CalendarRange, FileDown, FileText } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getDictionary } from "@/lib/i18n/server"
import { isAdminShellRole, normaliseRole } from "@/lib/auth/permissions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { WeeklyReportPayload } from "@/lib/supabase/types"

export const dynamic = "force-dynamic"

/**
 * /client/reports — weekly report history + PDF downloads.
 *
 * Rows come from client_weekly_reports (RLS: own rows only). When nothing is
 * stored yet (e.g. before the first Monday cron run or before migration 067)
 * the page still offers a live-generated "latest report" download — the API
 * route rebuilds the payload on the fly.
 */
export default async function ClientReportsPage() {
  const { t, locale } = await getDictionary()
  const r = t.client.reports
  const dateLocale = locale === "vi" ? "vi-VN" : "en-US"

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  const role = normaliseRole(profile?.role)
  if (isAdminShellRole(role)) redirect("/admin")

  // Own rows only — enforced by RLS (client_weekly_reports_select_own).
  const { data: reports, error } = await supabase
    .from("client_weekly_reports")
    .select("id, week_start, period_start, period_end, payload, email_sent, created_at")
    .eq("client_id", user.id)
    .order("week_start", { ascending: false })
    .limit(26)

  // 42P01 = table missing (migration 067 not applied yet) → show the
  // live-download empty state instead of an error.
  const tableMissing = error?.code === "42P01"
  const list = (reports ?? []) as Array<{
    id: string
    week_start: string
    period_start: string
    period_end: string
    payload: WeeklyReportPayload
    email_sent: boolean
    created_at: string
  }>

  const fmtRange = (startISO: string, endISO: string) => {
    const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }
    const endOpts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }
    return `${new Date(`${startISO}T00:00:00`).toLocaleDateString(dateLocale, opts)} – ${new Date(`${endISO}T00:00:00`).toLocaleDateString(dateLocale, endOpts)}`
  }

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8 max-w-[1400px] mx-auto w-full">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{r.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{r.subtitle}</p>
      </div>

      {list.length === 0 ? (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">{r.emptyTitle}</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md text-pretty">
                {r.emptyDesc}
              </p>
            </div>
            <Button asChild>
              <a href={`/api/reports/weekly/${user.id}`}>
                <FileDown className="h-4 w-4" />
                {r.downloadLatest}
              </a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-base font-semibold">{r.title}</CardTitle>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/reports/weekly/${user.id}`}>
                <FileDown className="h-4 w-4" />
                {r.downloadLatest}
              </a>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col divide-y divide-border">
              {list.map((row) => {
                const p = row.payload
                return (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                        <CalendarRange className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-foreground">
                          {r.week} {fmtRange(row.period_start, row.period_end)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {r.totalLeads}: <strong>{p.totalLeads}</strong> · {r.activeLeads}:{" "}
                          <strong>{p.activeLeads}</strong> · {r.won}: <strong>{p.wonCount}</strong> ·{" "}
                          {r.winRate}: <strong>{p.winRate}%</strong>
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={row.email_sent ? "secondary" : "outline"} className="font-normal">
                        {row.email_sent ? r.emailSent : r.emailNotSent}
                      </Badge>
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/api/reports/weekly/${user.id}?week=${row.week_start}`}>
                          <FileDown className="h-4 w-4" />
                          {r.downloadPdf}
                        </a>
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {tableMissing && (
        <p className="text-xs text-muted-foreground text-center">
          ⚠️ client_weekly_reports table not found — run scripts/067_client_weekly_reports.sql to
          enable report history. Live downloads still work.
        </p>
      )}
    </div>
  )
}
