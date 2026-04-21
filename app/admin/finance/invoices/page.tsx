import Link from "next/link"
import { redirect } from "next/navigation"
import { FileText, Plus } from "lucide-react"
import { getCurrentRole } from "@/lib/auth/guard"
import { can, CAPS } from "@/lib/auth/permissions"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from "@/components/ui/empty"
import { formatDate, formatUsd, formatVnd } from "@/lib/finance/format"
import {
  INVOICE_KIND_LABELS,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_VARIANT,
} from "@/lib/finance/types"
import { usdToVnd } from "@/lib/finance/vietqr"
import type { Invoice, InvoiceStatus, Profile } from "@/lib/supabase/types"

export const dynamic = "force-dynamic"

type InvoiceRow = Invoice & {
  profiles: Pick<Profile, "id" | "full_name" | "company_name" | "email"> | null
}

const STATUS_FILTERS: { value: InvoiceStatus | "all"; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "draft", label: INVOICE_STATUS_LABELS.draft.vi },
  { value: "sent", label: INVOICE_STATUS_LABELS.sent.vi },
  { value: "overdue", label: INVOICE_STATUS_LABELS.overdue.vi },
  { value: "paid", label: INVOICE_STATUS_LABELS.paid.vi },
]

interface Props {
  searchParams: Promise<{ status?: string; kind?: string }>
}

export default async function InvoicesPage({ searchParams }: Props) {
  const params = await searchParams
  const statusFilter = (params.status ?? "all") as InvoiceStatus | "all"

  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  if (!can(current.role, CAPS.FINANCE_READ)) redirect("/admin")
  const admin = current.admin
  let query = admin
    .from("invoices" as never)
    .select(
      "*, profiles:client_id (id, full_name, company_name, email)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .limit(200)

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter)
  }

  const { data: invoices } = await query
  const rows = (invoices ?? []) as InvoiceRow[]

  // Stats across ALL invoices (ignore filter) so the KPIs stay meaningful.
  const { data: allForStats } = await admin
    .from("invoices" as never)
    .select("status, net_amount_usd")

  // deno-lint-ignore no-explicit-any
  const allStats = (allForStats ?? []) as { status: InvoiceStatus; net_amount_usd: any }[]
  const stats = {
    outstandingUsd: allStats
      .filter((i) => i.status === "sent" || i.status === "overdue" || i.status === "partial")
      .reduce((s, i) => s + (Number(i.net_amount_usd) || 0), 0),
    overdueUsd: allStats
      .filter((i) => i.status === "overdue")
      .reduce((s, i) => s + (Number(i.net_amount_usd) || 0), 0),
    paidUsd: allStats
      .filter((i) => i.status === "paid")
      .reduce((s, i) => s + (Number(i.net_amount_usd) || 0), 0),
    draftCount: allStats.filter((i) => i.status === "draft").length,
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">Hóa đơn</h1>
          <p className="text-sm text-muted-foreground text-pretty">
            Quản lý hóa đơn phí khởi tạo, phí duy trì hàng tháng và phí thành công.
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/admin/finance/invoices/new">
            <Plus className="h-4 w-4" />
            Tạo hóa đơn
          </Link>
        </Button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Chưa thu" value={formatUsd(stats.outstandingUsd)} />
        <StatCard
          label="Quá hạn"
          value={formatUsd(stats.overdueUsd)}
          tone={stats.overdueUsd > 0 ? "destructive" : undefined}
        />
        <StatCard label="Đã thu" value={formatUsd(stats.paidUsd)} tone="accent" />
        <StatCard label="Hóa đơn nháp" value={String(stats.draftCount)} />
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => {
          const href =
            f.value === "all"
              ? "/admin/finance/invoices"
              : `/admin/finance/invoices?status=${f.value}`
          const active = statusFilter === f.value
          return (
            <Button
              key={f.value}
              asChild
              variant={active ? "default" : "outline"}
              size="sm"
            >
              <Link href={href}>{f.label}</Link>
            </Button>
          )
        })}
      </div>

      {rows.length === 0 ? (
        <Card className="border-border">
          <CardContent className="p-8">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileText className="h-6 w-6" />
                </EmptyMedia>
                <EmptyTitle>Chưa có hóa đơn</EmptyTitle>
                <EmptyDescription>
                  Tạo hóa đơn đầu tiên hoặc chờ cron tự động xuất phí duy trì hàng tháng.
                </EmptyDescription>
              </EmptyHeader>
              <Button asChild className="gap-2">
                <Link href="/admin/finance/invoices/new">
                  <Plus className="h-4 w-4" />
                  Tạo hóa đơn
                </Link>
              </Button>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border overflow-hidden">
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {rows.map((inv) => (
                <InvoiceRowLink key={inv.id} inv={inv} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "destructive" | "accent"
}) {
  const color =
    tone === "destructive"
      ? "text-destructive"
      : tone === "accent"
        ? "text-primary"
        : "text-foreground"
  return (
    <Card className="border-border">
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-2xl font-semibold ${color}`}>{value}</span>
      </CardContent>
    </Card>
  )
}

function InvoiceRowLink({ inv }: { inv: InvoiceRow }) {
  const clientLabel =
    inv.profiles?.company_name ?? inv.profiles?.full_name ?? inv.profiles?.email ?? "—"
  const vnd = usdToVnd(Number(inv.net_amount_usd), Number(inv.fx_rate_vnd_per_usd))
  return (
    <Link
      href={`/admin/finance/invoices/${inv.id}`}
      className="flex items-center justify-between gap-4 p-4 hover:bg-muted/40 transition-colors"
    >
      <div className="flex items-center gap-4 min-w-0">
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-muted shrink-0">
          <FileText className="h-4 w-4 text-muted-foreground" />
        </span>
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm text-foreground">
              {inv.invoice_number}
            </span>
            <Badge variant={INVOICE_STATUS_VARIANT[inv.status]} className="text-xs">
              {INVOICE_STATUS_LABELS[inv.status].vi}
            </Badge>
            <Badge variant="outline" className="text-xs font-normal">
              {INVOICE_KIND_LABELS[inv.kind].vi}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground truncate">
            {clientLabel} · Phát hành {formatDate(inv.issue_date, "vi")} · Hạn{" "}
            {formatDate(inv.due_date, "vi")}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end shrink-0">
        <span className="text-sm font-semibold text-foreground">
          {formatUsd(Number(inv.net_amount_usd))}
        </span>
        {vnd != null && (
          <span className="text-xs text-muted-foreground">≈ {formatVnd(vnd)}</span>
        )}
      </div>
    </Link>
  )
}
