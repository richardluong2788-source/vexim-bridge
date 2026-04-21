import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { getCurrentRole } from "@/lib/auth/guard"
import { can, CAPS } from "@/lib/auth/permissions"
import { loadFinanceSettings } from "@/lib/finance/settings"
import { Button } from "@/components/ui/button"
import { NewInvoiceForm } from "@/components/admin/finance/new-invoice-form"

export const dynamic = "force-dynamic"

export default async function NewInvoicePage() {
  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  if (!can(current.role, CAPS.INVOICE_WRITE)) redirect("/admin/finance")
  const admin = current.admin
  const [{ data: clients }, { data: plans }, settings] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, company_name, email")
      .eq("role", "client")
      .order("company_name", { ascending: true }),
    admin
      .from("billing_plans" as never)
      .select("id, client_id, plan_name, setup_fee_usd, monthly_retainer_usd, status"),
    loadFinanceSettings(),
  ])

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/admin/finance/invoices">
            <ArrowLeft className="h-4 w-4" />
            Danh sách hóa đơn
          </Link>
        </Button>
      </div>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Tạo hóa đơn</h1>
        <p className="text-sm text-muted-foreground text-pretty">
          Dành cho hóa đơn phát hành thủ công (phí khởi tạo, phí duy trì phát sinh
          ngoài chu kỳ, hoặc khoản phụ). Hóa đơn phí thành công sẽ được hệ thống tự
          động tạo khi deal chuyển sang trạng thái đã ship.
        </p>
      </header>

      <NewInvoiceForm
        clients={clients ?? []}
        // deno-lint-ignore no-explicit-any
        plans={(plans ?? []) as any}
        defaultFxRate={Number(settings?.default_fx_rate_vnd_per_usd ?? 25000)}
      />
    </div>
  )
}
