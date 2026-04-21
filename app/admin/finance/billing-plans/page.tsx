import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus, FileText, Users } from "lucide-react"
import { getCurrentRole } from "@/lib/auth/guard"
import { can, CAPS } from "@/lib/auth/permissions"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from "@/components/ui/empty"
import { formatUsd, formatVnd } from "@/lib/finance/format"
import { BILLING_PLAN_STATUS_LABELS } from "@/lib/finance/types"
import type { BillingPlan, BillingPlanStatus, Profile } from "@/lib/supabase/types"

export const dynamic = "force-dynamic"

type PlanWithClient = BillingPlan & {
  profiles: Pick<Profile, "id" | "full_name" | "company_name" | "email"> | null
}

const STATUS_VARIANT: Record<BillingPlanStatus, "default" | "secondary" | "outline"> = {
  active: "default",
  paused: "secondary",
  terminated: "outline",
}

export default async function BillingPlansPage() {
  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  if (!can(current.role, CAPS.FINANCE_READ)) redirect("/admin")
  const admin = current.admin
  const { data: plans } = await admin
    .from("billing_plans" as never)
    .select(
      "*, profiles:client_id (id, full_name, company_name, email)",
    )
    .order("created_at", { ascending: false })

  const rows = (plans ?? []) as PlanWithClient[]

  const stats = {
    total: rows.length,
    active: rows.filter((p) => p.status === "active").length,
    monthlyRetainerUsd: rows
      .filter((p) => p.status === "active")
      .reduce((sum, p) => sum + (Number(p.monthly_retainer_usd) || 0), 0),
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">Gói dịch vụ</h1>
          <p className="text-sm text-muted-foreground text-pretty">
            Hợp đồng tài chính giữa Vexim Bridge và từng khách hàng: phí khởi tạo, phí duy
            trì hàng tháng, phí thành công và chính sách hoàn phí.
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/admin/finance/billing-plans/new">
            <Plus className="h-4 w-4" />
            Tạo gói mới
          </Link>
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="Tổng số gói" value={String(stats.total)} />
        <StatCard label="Gói đang active" value={String(stats.active)} accent />
        <StatCard
          label="Tổng retainer/tháng"
          value={formatUsd(stats.monthlyRetainerUsd)}
        />
      </div>

      {rows.length === 0 ? (
        <Card className="border-border">
          <CardContent className="p-8">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileText className="h-6 w-6" />
                </EmptyMedia>
                <EmptyTitle>Chưa có gói nào</EmptyTitle>
                <EmptyDescription>
                  Tạo gói đầu tiên để bắt đầu xuất hóa đơn retainer và phí thành công.
                </EmptyDescription>
              </EmptyHeader>
              <Button asChild className="gap-2">
                <Link href="/admin/finance/billing-plans/new">
                  <Plus className="h-4 w-4" />
                  Tạo gói mới
                </Link>
              </Button>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border overflow-hidden">
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {rows.map((p) => (
                <PlanRow key={p.id} plan={p} />
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
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <Card className="border-border">
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span
          className={
            accent
              ? "text-2xl font-semibold text-primary"
              : "text-2xl font-semibold text-foreground"
          }
        >
          {value}
        </span>
      </CardContent>
    </Card>
  )
}

function PlanRow({ plan }: { plan: PlanWithClient }) {
  const clientLabel =
    plan.profiles?.company_name ??
    plan.profiles?.full_name ??
    plan.profiles?.email ??
    plan.client_id
  const fxRate = Number(plan.fx_rate_vnd_per_usd ?? 0)
  const retainer = Number(plan.monthly_retainer_usd ?? 0)
  const retainerVnd = fxRate > 0 && retainer > 0 ? retainer * fxRate : null

  return (
    <Link
      href={`/admin/finance/billing-plans/${plan.id}`}
      className="flex items-center justify-between gap-4 p-4 hover:bg-muted/40 transition-colors"
    >
      <div className="flex items-start gap-4 min-w-0">
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
          <Users className="h-4 w-4" />
        </span>
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground truncate">
              {clientLabel}
            </span>
            <Badge variant={STATUS_VARIANT[plan.status]} className="text-xs">
              {BILLING_PLAN_STATUS_LABELS[plan.status].vi}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            {plan.plan_name}
            {plan.contract_start_date && ` · Từ ${plan.contract_start_date}`}
          </span>
        </div>
      </div>

      <div className="hidden md:flex flex-col items-end gap-0.5 shrink-0">
        <span className="text-sm font-medium text-foreground">
          {formatUsd(retainer)} / tháng
        </span>
        {retainerVnd != null && (
          <span className="text-xs text-muted-foreground">
            ≈ {formatVnd(retainerVnd)}
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          Setup {formatUsd(plan.setup_fee_usd ?? 0)} · Success{" "}
          {Number(plan.success_fee_percent ?? 0)}%
        </span>
      </div>
    </Link>
  )
}
