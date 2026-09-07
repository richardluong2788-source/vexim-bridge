import { redirect } from "next/navigation"
import { getCurrentRole } from "@/lib/auth/guard"
import { getDictionary } from "@/lib/i18n/server"
import { can, CAPS } from "@/lib/auth/permissions"
import { SourcingBillingList, type SourcingBillingClient } from "@/components/admin/sourcing/sourcing-billing"

export const dynamic = "force-dynamic"

type PlanRow = {
  id: string
  client_id: string
  status: string
  plan_name: string | null
  monthly_retainer_usd: number | null
  setup_fee_usd: number | null
  success_fee_percent: number | null
  billing_anchor_day: number | null
  contract_start_date: string | null
}

type InvoiceRow = {
  id: string
  client_id: string
  kind: string
  status: string
  net_amount_usd: number | null
  due_date: string | null
}

/**
 * /admin/sourcing/billing — "Hợp đồng & Đốc thu" for Supplier Researcher.
 *
 * SR is the person who works directly with the supplier and closes the
 * commercial terms (setup fee / monthly retainer / success fee %). Here SR:
 *   - proposes the client's service contract (draft) for Finance to approve
 *   - sees the billing status (draft / active / invoices / outstanding) of
 *     every supplier they sourced, so they can chase payment.
 *
 * SR NEVER creates/edits invoices or marks payment — that stays Finance's job
 * (INVOICE_WRITE), keeping money handling segregated from supplier sourcing.
 */
export default async function SourcingBillingPage() {
  const { locale } = await getDictionary()
  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  // SR-only surface — admin/super_admin/finance manage contracts + invoices
  // through the Finance module instead.
  if (current.role !== "supplier_researcher" || !can(current.role, CAPS.INVOICE_VIEW_OWN)) {
    redirect("/admin/finance/billing-plans")
  }

  const admin = current.admin

  const { data: clientsRaw } = await admin
    .from("profiles")
    .select("id, company_name, full_name, email, created_at")
    .eq("role", "client")
    .eq("sourced_by", current.userId)
    .order("created_at", { ascending: false })

  const clients = (clientsRaw ?? []) as Array<{
    id: string
    company_name: string | null
    full_name: string | null
    email: string | null
    created_at: string
  }>

  const ids = clients.map((c) => c.id)
  let plans: PlanRow[] = []
  let invoices: InvoiceRow[] = []

  if (ids.length > 0) {
    const [plansRes, invoicesRes] = await Promise.all([
      admin
        .from("billing_plans" as never)
        .select(
          "id, client_id, status, plan_name, monthly_retainer_usd, setup_fee_usd, success_fee_percent, billing_anchor_day, contract_start_date",
        )
        .in("client_id", ids)
        .order("created_at", { ascending: false }),
      admin
        .from("invoices" as never)
        .select("id, client_id, kind, status, net_amount_usd, due_date")
        .in("client_id", ids)
        .order("created_at", { ascending: false }),
    ])
    plans = (plansRes.data ?? []) as unknown as PlanRow[]
    invoices = (invoicesRes.data ?? []) as unknown as InvoiceRow[]
  }

  const byClient = new Map<string, { plans: PlanRow[]; invoices: InvoiceRow[] }>()
  for (const c of clients) byClient.set(c.id, { plans: [], invoices: [] })
  for (const p of plans) byClient.get(p.client_id)?.plans.push(p)
  for (const i of invoices) byClient.get(i.client_id)?.invoices.push(i)

  const rows: SourcingBillingClient[] = clients.map((c) => {
    const bucket = byClient.get(c.id) ?? { plans: [], invoices: [] }
    const active = bucket.plans.find((p) => p.status === "active")
    const draft = bucket.plans.find((p) => p.status === "draft")
    const outstanding = bucket.invoices
      .filter((i) => i.status === "sent" || i.status === "overdue" || i.status === "partial")
      .reduce((s, i) => s + (Number(i.net_amount_usd) || 0), 0)
    const paid = bucket.invoices
      .filter((i) => i.status === "paid")
      .reduce((s, i) => s + (Number(i.net_amount_usd) || 0), 0)

    return {
      id: c.id,
      label: c.company_name?.trim() || c.full_name?.trim() || c.email || "—",
      planStatus: active ? "active" : draft ? "draft" : "none",
      retainerUsd: active?.monthly_retainer_usd ?? draft?.monthly_retainer_usd ?? null,
      setupFeeUsd: active?.setup_fee_usd ?? draft?.setup_fee_usd ?? null,
      successFeePct: active?.success_fee_percent ?? draft?.success_fee_percent ?? null,
      outstandingUsd: outstanding,
      paidUsd: paid,
    }
  })

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">
          {locale === "vi" ? "Hợp đồng & Đốc thu" : "Contracts & Collections"}
        </h1>
        <p className="text-sm text-muted-foreground text-pretty max-w-3xl">
          {locale === "vi"
            ? "Đề xuất điều khoản hợp đồng (phí khởi tạo, phí duy trì tháng, phí thành công) cho các supplier bạn đã đưa vào. Finance sẽ duyệt, phát hành hóa đơn và ghi nhận thanh toán — bạn theo dõi trạng thái tại đây để đốc thu."
            : "Propose the service contract (setup fee, monthly retainer, success fee) for suppliers you sourced. Finance approves, issues invoices and records payment — track status here to chase collection."}
        </p>
      </div>

      <SourcingBillingList clients={rows} locale={locale} />
    </div>
  )
}
