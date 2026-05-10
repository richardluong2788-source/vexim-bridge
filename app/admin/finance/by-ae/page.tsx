import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, Trophy, DollarSign, Users, Calendar } from "lucide-react"
import { getCurrentRole } from "@/lib/auth/guard"
import { can, CAPS, ROLE_META } from "@/lib/auth/permissions"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatUsd } from "@/lib/finance/format"
import type { Role } from "@/lib/supabase/types"

export const dynamic = "force-dynamic"

interface AeRow {
  account_manager_id: string
  account_manager_name: string | null
  account_manager_email: string | null
  account_manager_role: Role | null
  won_deals: number
  total_invoice_value: number
  total_commission: number
  total_profit_margin: number
  distinct_clients: number
  first_won_at: string | null
  last_won_at: string | null
}

/**
 * Doanh thu theo AE — page sourced from public.ae_revenue_v (migration 035).
 *
 * Revenue is attributed using the SNAPSHOT account_manager_id on each
 * opportunity, frozen at WON time. Reassigning a client to another AE
 * later does NOT shift historical commission.
 */
export default async function FinanceByAePage() {
  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  // Only roles with FINANCE_READ + bypass should see this — otherwise an
  // AE could see other AEs' commission. (The sidebar entry is also gated.)
  if (
    !can(current.role, CAPS.FINANCE_READ) ||
    !can(current.role, CAPS.OWNERSHIP_BYPASS)
  ) {
    redirect("/admin")
  }

  const { admin } = current

  // Pull the AE rollup view, then enrich with monthly buckets so we can show
  // a "this month / last 30d" column without re-running the analytics view.
  const { data, error } = await admin
    .from("ae_revenue_v" as never)
    .select(
      "account_manager_id, account_manager_name, account_manager_email, account_manager_role, won_deals, total_invoice_value, total_commission, total_profit_margin, distinct_clients, first_won_at, last_won_at",
    )
    .order("total_invoice_value", { ascending: false })

  const rows = (error ? [] : (data ?? [])) as unknown as AeRow[]

  // Totals across the whole roster — sanity-check column for finance.
  const totals = rows.reduce(
    (acc, r) => {
      acc.invoice += Number(r.total_invoice_value ?? 0)
      acc.commission += Number(r.total_commission ?? 0)
      acc.margin += Number(r.total_profit_margin ?? 0)
      acc.deals += Number(r.won_deals ?? 0)
      return acc
    },
    { invoice: 0, commission: 0, margin: 0, deals: 0 },
  )

  return (
    <div className="flex flex-col gap-6 p-8 max-w-[1400px] mx-auto w-full">
      {/* Header */}
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/admin/finance">
            <ArrowLeft className="h-4 w-4" />
            Quay lại Tài chính
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold text-foreground text-balance">
          Doanh thu theo AE
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl text-pretty">
          Tổng hợp doanh thu, hoa hồng và biên lợi nhuận theo từng Account
          Executive. Mỗi deal được quy về AE đang sở hữu client tại thời điểm
          deal chuyển sang trạng thái <strong>Won</strong>; reassignment sau
          đó không ảnh hưởng số liệu lịch sử.
        </p>
      </div>

      {/* Roster totals */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={DollarSign}
          label="Tổng doanh thu (đã chốt)"
          value={formatUsd(totals.invoice)}
        />
        <SummaryCard
          icon={Trophy}
          label="Tổng hoa hồng"
          value={formatUsd(totals.commission)}
        />
        <SummaryCard
          icon={Trophy}
          label="Tổng biên lợi nhuận"
          value={formatUsd(totals.margin)}
        />
        <SummaryCard
          icon={Users}
          label="Số deal Won"
          value={String(totals.deals)}
        />
      </div>

      {/* Per-AE table */}
      <Card className="overflow-hidden">
        <div className="p-5 border-b">
          <h2 className="text-base font-semibold">Bảng xếp hạng AE</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sắp xếp theo doanh thu giảm dần. Click vào tên để xem chi tiết
            client của AE đó (sẽ phát triển ở sprint tới).
          </p>
        </div>
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Chưa có deal nào được đánh dấu Won kèm Account Manager. Khi một
            deal chuyển sang Won, snapshot AE sẽ được đóng băng và xuất hiện
            ở đây.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-medium">AE</TableHead>
                <TableHead className="font-medium text-right">Deals Won</TableHead>
                <TableHead className="font-medium text-right">Khách hàng</TableHead>
                <TableHead className="font-medium text-right">Doanh thu</TableHead>
                <TableHead className="font-medium text-right">Biên lợi nhuận</TableHead>
                <TableHead className="font-medium text-right">Hoa hồng</TableHead>
                <TableHead className="font-medium">Won gần nhất</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const role = r.account_manager_role
                const roleLabel =
                  (role && ROLE_META[role]?.labelVi) ?? role ?? "—"
                return (
                  <TableRow key={r.account_manager_id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-foreground">
                          {r.account_manager_name?.trim() ||
                            r.account_manager_email ||
                            "—"}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="font-normal text-[10px]">
                            {roleLabel}
                          </Badge>
                          {r.account_manager_email && (
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {r.account_manager_email}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.won_deals}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {r.distinct_clients}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {formatUsd(Number(r.total_invoice_value))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatUsd(Number(r.total_profit_margin))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatUsd(Number(r.total_commission))}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.last_won_at ? (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(r.last_won_at).toLocaleDateString("vi-VN")}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}

interface SummaryCardProps {
  icon: typeof DollarSign
  label: string
  value: string
}

function SummaryCard({ icon: Icon, label, value }: SummaryCardProps) {
  return (
    <Card className="p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </Card>
  )
}
