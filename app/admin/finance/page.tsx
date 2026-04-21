import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ArrowUpRight,
  DollarSign,
  Receipt,
  TrendingDown,
  Wallet,
  AlertTriangle,
  Activity,
} from "lucide-react"
import { getCurrentRole } from "@/lib/auth/guard"
import { can, CAPS } from "@/lib/auth/permissions"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { InvoiceStatusBadge } from "@/components/admin/finance/invoice-action-bar"
import { CashflowTrendChart } from "@/components/admin/finance/cashflow-trend-chart"
import { formatUsd, formatVnd } from "@/lib/finance/format"
import { loadFinanceSettings } from "@/lib/finance/settings"
import type { Invoice, OperatingExpense, Profile } from "@/lib/supabase/types"

export const dynamic = "force-dynamic"

/**
 * Admin finance dashboard — cash-flow command center.
 *
 * Sections:
 *   1. KPI row — revenue (setup/retainer/success), AR outstanding, expenses, net
 *   2. Cash-flow trend chart (last 6 months, stacked bars)
 *   3. Outstanding invoices table (sent + overdue)
 *   4. Recent draft invoices that admin still needs to review/send
 */
export default async function FinanceDashboardPage() {
  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  if (!can(current.role, CAPS.FINANCE_READ)) redirect("/admin")
  const admin = current.admin
  const settings = await loadFinanceSettings()
  const fx = settings?.default_fx_rate_vnd_per_usd ?? 25000
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10)
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10)
  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1))
    .toISOString()
    .slice(0, 10)

  // Pull data needed for all sections in parallel.
  const [
    invoicesRes,
    draftsRes,
    expensesRes,
    trendInvoicesRes,
    trendExpensesRes,
  ] = await Promise.all([
    admin
      .from("invoices" as never)
      .select(
        "id, invoice_number, kind, status, net_amount_usd, issue_date, due_date, paid_at, client_id",
      )
      .gte("issue_date", sixMonthsAgo)
      .order("issue_date", { ascending: false }),
    admin
      .from("invoices" as never)
      .select(
        "id, invoice_number, kind, status, net_amount_usd, due_date, client_id",
      )
      .in("status", ["draft", "sent", "overdue"])
      .order("due_date", { ascending: true })
      .limit(25),
    admin
      .from("operating_expenses" as never)
      .select("id, amount_usd, expense_date")
      .gte("expense_date", sixMonthsAgo),
    admin
      .from("invoices" as never)
      .select("net_amount_usd, paid_at, status")
      .gte("paid_at", sixMonthsAgo)
      .eq("status", "paid"),
    admin
      .from("operating_expenses" as never)
      .select("amount_usd, expense_date")
      .gte("expense_date", sixMonthsAgo),
  ])

  const allInvoices = (invoicesRes.data ?? []) as unknown as Invoice[]
  const outstanding = (draftsRes.data ?? []) as unknown as Invoice[]
  const expenses = (expensesRes.data ?? []) as unknown as Pick<
    OperatingExpense,
    "id" | "amount_usd" | "expense_date"
  >[]

  // Load client names for invoices shown on the page.
  const clientIds = Array.from(
    new Set(
      [...allInvoices, ...outstanding]
        .map((i) => i.client_id)
        .filter((x): x is string => !!x),
    ),
  )
  let profilesById = new Map<string, Profile>()
  if (clientIds.length > 0) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, company_name, full_name")
      .in("id", clientIds)
    const rows = (profs ?? []) as Array<{
      id: string
      company_name: string | null
      full_name: string | null
    }>
    profilesById = new Map(rows.map((p) => [p.id, p as unknown as Profile]))
  }

  // ---- KPIs (this month) ----
  function sumPaidThisMonth(kind?: string): number {
    return allInvoices
      .filter((inv) => {
        if (inv.status !== "paid") return false
        if (!inv.paid_at) return false
        const day = inv.paid_at.slice(0, 10)
        if (day < monthStart || day > monthEnd) return false
        if (kind && inv.kind !== kind) return false
        return true
      })
      .reduce((acc, inv) => acc + Number(inv.net_amount_usd ?? 0), 0)
  }

  const revSetup = sumPaidThisMonth("setup_fee")
  const revRetainer = sumPaidThisMonth("retainer")
  const revSuccess = sumPaidThisMonth("success_fee")
  const revManual = sumPaidThisMonth("manual")
  const revTotal = revSetup + revRetainer + revSuccess + revManual

  const expensesThisMonth = expenses
    .filter((e) => {
      const d = e.expense_date
      return d >= monthStart && d <= monthEnd
    })
    .reduce((acc, e) => acc + Number(e.amount_usd ?? 0), 0)

  const netThisMonth = revTotal - expensesThisMonth
  const breakEvenPct =
    expensesThisMonth > 0
      ? Math.min(100, (revTotal / expensesThisMonth) * 100)
      : revTotal > 0
        ? 100
        : 0

  const outstandingTotal = outstanding
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((acc, i) => acc + Number(i.net_amount_usd ?? 0), 0)
  const overdueTotal = outstanding
    .filter((i) => i.status === "overdue")
    .reduce((acc, i) => acc + Number(i.net_amount_usd ?? 0), 0)

  // ---- Cash-flow trend (last 6 months) ----
  const paidInvoicesForTrend = (trendInvoicesRes.data ?? []) as unknown as Array<{
    net_amount_usd: number
    paid_at: string | null
  }>
  const allExpensesForTrend = (trendExpensesRes.data ?? []) as unknown as Array<{
    amount_usd: number
    expense_date: string
  }>

  const trend = buildMonthlyTrend({
    now,
    months: 6,
    paidInvoices: paidInvoicesForTrend,
    expenses: allExpensesForTrend,
  })

  return (
    <div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-balance">
            Tài chính &amp; Dòng tiền
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tổng quan thu — chi — công nợ của Vexim Bridge theo tháng.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/finance/billing-plans">Gói hợp đồng</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/finance/expenses">Chi phí vận hành</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/finance/invoices">Tất cả hóa đơn</Link>
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={DollarSign}
          label="Thu tháng này"
          valueUsd={revTotal}
          fx={fx}
          tone="positive"
          hint={`Setup ${formatUsd(revSetup, { compact: true })} · Retainer ${formatUsd(revRetainer, { compact: true })} · Success ${formatUsd(revSuccess, { compact: true })}`}
        />
        <KpiCard
          icon={Wallet}
          label="Công nợ phải thu"
          valueUsd={outstandingTotal}
          fx={fx}
          tone={overdueTotal > 0 ? "warning" : "neutral"}
          hint={
            overdueTotal > 0
              ? `Quá hạn: ${formatUsd(overdueTotal, { compact: true })}`
              : "Không có hóa đơn quá hạn"
          }
        />
        <KpiCard
          icon={TrendingDown}
          label="Chi phí tháng này"
          valueUsd={expensesThisMonth}
          fx={fx}
          tone="neutral"
          hint="Lương, tool, marketing..."
        />
        <KpiCard
          icon={Activity}
          label={netThisMonth >= 0 ? "Lợi nhuận ròng" : "Lỗ tháng này"}
          valueUsd={netThisMonth}
          fx={fx}
          tone={netThisMonth >= 0 ? "positive" : "warning"}
          hint={`${breakEvenPct.toFixed(0)}% hòa vốn`}
        />
      </div>

      {/* Break-even progress */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Tiến độ hòa vốn tháng này</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Thu {formatUsd(revTotal, { compact: true })} / Chi{" "}
              {formatUsd(expensesThisMonth, { compact: true })}
            </div>
          </div>
          <div className="text-lg font-semibold tabular-nums">
            {breakEvenPct.toFixed(0)}%
          </div>
        </div>
        <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={
              breakEvenPct >= 100
                ? "h-full bg-emerald-500 transition-all"
                : breakEvenPct >= 60
                  ? "h-full bg-amber-500 transition-all"
                  : "h-full bg-rose-500 transition-all"
            }
            style={{ width: `${Math.min(100, Math.max(2, breakEvenPct))}%` }}
          />
        </div>
      </Card>

      {/* Cash-flow trend */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold">Xu hướng 6 tháng</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Doanh thu đã thu vs chi phí vận hành
            </p>
          </div>
        </div>
        <CashflowTrendChart data={trend} />
      </Card>

      {/* Outstanding invoices */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-5 border-b">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">Hóa đơn cần xử lý</h2>
            <Badge variant="secondary" className="ml-1 tabular-nums">
              {outstanding.length}
            </Badge>
          </div>
          {overdueTotal > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {formatUsd(overdueTotal, { compact: true })} quá hạn
            </div>
          )}
        </div>
        {outstanding.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Không có hóa đơn nào đang chờ xử lý.
          </div>
        ) : (
          <div className="divide-y">
            {outstanding.map((inv) => {
              const p = profilesById.get(inv.client_id)
              const clientLabel =
                p?.company_name ?? p?.full_name ?? "—"
              return (
                <Link
                  key={inv.id}
                  href={`/admin/finance/invoices/${inv.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-medium truncate">
                        {inv.invoice_number}
                      </span>
                      <InvoiceStatusBadge status={inv.status} />
                      <KindBadge kind={inv.kind} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {clientLabel} · hạn {inv.due_date}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold tabular-nums">
                      {formatUsd(Number(inv.net_amount_usd))}
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {formatVnd(Number(inv.net_amount_usd) * fx, { compact: true })}
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

interface KpiCardProps {
  icon: typeof DollarSign
  label: string
  valueUsd: number
  fx: number
  tone: "positive" | "warning" | "neutral"
  hint?: string
}

function KpiCard({ icon: Icon, label, valueUsd, fx, tone, hint }: KpiCardProps) {
  const toneClasses =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warning"
        ? "text-rose-600 dark:text-rose-400"
        : "text-foreground"
  return (
    <Card className="p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${toneClasses}`} />
      </div>
      <div className={`text-2xl font-semibold tabular-nums ${toneClasses}`}>
        {formatUsd(valueUsd, { signed: tone === "warning" && valueUsd < 0 })}
      </div>
      <div className="text-xs text-muted-foreground tabular-nums">
        ≈ {formatVnd(valueUsd * fx, { compact: true })}
      </div>
      {hint && (
        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {hint}
        </div>
      )}
    </Card>
  )
}

function KindBadge({ kind }: { kind: Invoice["kind"] }) {
  const map: Record<Invoice["kind"], { label: string; cls: string }> = {
    setup_fee: {
      label: "Setup",
      cls: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
    },
    retainer: {
      label: "Retainer",
      cls: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
    },
    success_fee: {
      label: "Success fee",
      cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    },
    manual: {
      label: "Thủ công",
      cls: "bg-muted text-muted-foreground border-border",
    },
  }
  const v = map[kind]
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${v.cls}`}
    >
      {v.label}
    </span>
  )
}

/**
 * Aggregate paid invoices and expenses into per-month buckets for the chart.
 */
function buildMonthlyTrend({
  now,
  months,
  paidInvoices,
  expenses,
}: {
  now: Date
  months: number
  paidInvoices: Array<{ net_amount_usd: number; paid_at: string | null }>
  expenses: Array<{ amount_usd: number; expense_date: string }>
}) {
  const buckets: Array<{
    key: string
    label: string
    revenue: number
    expense: number
    net: number
  }> = []

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
    const label = d.toLocaleDateString("vi-VN", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    })
    buckets.push({ key, label, revenue: 0, expense: 0, net: 0 })
  }

  const idx = new Map(buckets.map((b, i) => [b.key, i]))

  for (const inv of paidInvoices) {
    if (!inv.paid_at) continue
    const k = inv.paid_at.slice(0, 7)
    const i = idx.get(k)
    if (i !== undefined) {
      buckets[i].revenue += Number(inv.net_amount_usd ?? 0)
    }
  }
  for (const e of expenses) {
    const k = e.expense_date.slice(0, 7)
    const i = idx.get(k)
    if (i !== undefined) {
      buckets[i].expense += Number(e.amount_usd ?? 0)
    }
  }
  for (const b of buckets) b.net = b.revenue - b.expense

  return buckets
}
