/**
 * /admin/sla — Sprint 1 dashboard.
 *
 * Sources:
 *   - lib/sla/queries.ts → loadSlaClientsForPeriod, loadRecentSlaRuns, loadOpenClientRequests
 *   - lib/sla/scoring.ts → tier classification & weighted score
 *
 * Layout:
 *   ┌──────────────────────────────┬────────────────┐
 *   │   Health Score      Metric tiles (7)          │
 *   ├──────────────────────────────────────────────┤
 *   │   Clients table (heatmap)                     │
 *   ├──────────────────────────┬───────────────────┤
 *   │   Open client_requests   │  Recent runs      │
 *   └──────────────────────────┴───────────────────┘
 */
import Link from "next/link"
import { redirect } from "next/navigation"
import { Calendar, Settings, ShieldCheck } from "lucide-react"
import { getCurrentRole } from "@/lib/auth/guard"
import { CAPS, can, canAny } from "@/lib/auth/permissions"
import { Button } from "@/components/ui/button"
import {
  loadOpenClientRequests,
  loadRecentSlaRuns,
  loadSlaClientsForPeriod,
} from "@/lib/sla/queries"
import { SlaHealthCard } from "@/components/admin/sla/sla-health-card"
import { SlaMetricTiles } from "@/components/admin/sla/sla-metric-tiles"
import { SlaClientsTable } from "@/components/admin/sla/sla-clients-table"
import { SlaRunsList } from "@/components/admin/sla/sla-runs-list"
import { SlaOpenRequestsList } from "@/components/admin/sla/sla-open-requests-list"
import { SlaMonthPicker } from "@/components/admin/sla/sla-month-picker"
import { SlaRerunButton } from "@/components/admin/sla/sla-rerun-button"
import { SlaManualLogDialog } from "@/components/admin/sla/sla-manual-log-dialog"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

interface PageProps {
  searchParams: Promise<{ period?: string }>
}

/**
 * Default period_month = first of the prior calendar month (which is what
 * the cron evaluates). Returns 'YYYY-MM-DD'.
 */
function defaultPeriodIso(): string {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  return d.toISOString().slice(0, 10)
}

function periodLabelVi(iso: string): string {
  const [y, m] = iso.split("-").map(Number)
  if (!y || !m) return iso
  const d = new Date(Date.UTC(y, m - 1, 1))
  return d.toLocaleDateString("vi-VN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}

export default async function AdminSlaPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const periodMonth =
    sp.period && /^\d{4}-\d{2}-\d{2}$/.test(sp.period)
      ? sp.period
      : defaultPeriodIso()

  // ---- Auth & scope ----
  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  const seeAll = can(current.role, CAPS.SLA_VIEW_ALL)
  const seeOwn = can(current.role, CAPS.SLA_VIEW_OWN)
  if (!seeAll && !seeOwn) redirect("/admin")

  // ---- Scope filter for AE / lead_researcher ----
  let restrictToClientIds: string[] | undefined
  if (!seeAll && seeOwn) {
    const admin = createAdminClient()
    const { data: assigned } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "client")
      .eq("account_manager_id", current.userId)
    restrictToClientIds = (assigned ?? []).map((r) => r.id)
  }

  const [{ rows, totalsByMetric, globalTargets }, runs, openRequests] =
    await Promise.all([
      loadSlaClientsForPeriod(periodMonth, {
        onlyClientIds: restrictToClientIds,
      }),
      loadRecentSlaRuns(6),
      loadOpenClientRequests(20),
    ])

  // Filter open requests for AE / LR scope.
  const visibleRequests =
    restrictToClientIds == null
      ? openRequests
      : openRequests.filter((r) => restrictToClientIds!.includes(r.client_id))

  // Pull the M4 target hours for the timer threshold.
  const responseTarget =
    globalTargets.find((t) => t.metric_key === "client_request_response")
      ?.target_value ?? 24

  // Client option list for the manual-log dialog (admins only).
  const canLogManual = canAny(current.role, [
    CAPS.CLIENT_VIEW,
    CAPS.SLA_VIEW_ALL,
  ])
  const clientOptions = canLogManual
    ? rows.map((r) => ({
        id: r.client_id,
        label:
          r.company_name ??
          r.full_name ??
          r.email ??
          r.client_id.slice(0, 8),
      }))
    : []

  // Precompute prev/next month ISO + hrefs server-side so we can pass plain
  // strings (not functions) into the client SlaMonthPicker component.
  function shiftMonthIso(iso: string, delta: number): string {
    const [y, m] = iso.split("-").map(Number)
    if (!y || !m) return iso
    const d = new Date(Date.UTC(y, m - 1 + delta, 1, 0, 0, 0))
    return d.toISOString().slice(0, 10)
  }
  const prevHref = `/admin/sla?period=${shiftMonthIso(periodMonth, -1)}`
  const nextHref = `/admin/sla?period=${shiftMonthIso(periodMonth, 1)}`

  return (
    <div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2 text-balance">
            <ShieldCheck className="h-6 w-6 text-primary" />
            SLA Tracking
          </h1>
          <p className="text-sm text-muted-foreground mt-1 text-pretty">
            7 chỉ tiêu Điều 7.3 hợp đồng — đo tự động hàng tháng, ghi nhận
            vi phạm và cảnh báo sớm.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SlaMonthPicker
            periodMonth={periodMonth}
            prevHref={prevHref}
            nextHref={nextHref}
          />
          {can(current.role, CAPS.SLA_RUN_TRIGGER) && (
            <SlaRerunButton periodMonth={periodMonth} />
          )}
          {can(current.role, CAPS.SLA_HOLIDAY_WRITE) && (
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href="/admin/sla/holidays">
                <Calendar className="h-3.5 w-3.5" />
                Holiday
              </Link>
            </Button>
          )}
          {can(current.role, CAPS.SLA_TARGET_WRITE) && (
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href="/admin/sla/targets">
                <Settings className="h-3.5 w-3.5" />
                Targets
              </Link>
            </Button>
          )}
          {canLogManual && (
            <SlaManualLogDialog clients={clientOptions} />
          )}
        </div>
      </div>

      {/* Top row — health + metric tiles */}
      <div className="grid lg:grid-cols-[320px_1fr] gap-4">
        <SlaHealthCard
          rows={rows}
          periodLabel={periodLabelVi(periodMonth)}
        />
        <div className="flex flex-col gap-3">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span className="font-medium">
              Vi phạm theo chỉ tiêu trong {periodLabelVi(periodMonth)}
            </span>
            <span>
              Tracked clients: <span className="tabular-nums">{rows.length}</span>
            </span>
          </div>
          <SlaMetricTiles
            totalsByMetric={totalsByMetric}
            totalClients={rows.length}
          />
        </div>
      </div>

      {/* Heatmap table */}
      <SlaClientsTable rows={rows} periodLabel={periodLabelVi(periodMonth)} />

      {/* Bottom row — open requests + recent runs */}
      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <SlaOpenRequestsList
          requests={visibleRequests}
          responseTargetHours={Number(responseTarget)}
        />
        <SlaRunsList runs={runs} />
      </div>
    </div>
  )
}
