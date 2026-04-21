import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { getCurrentRole } from "@/lib/auth/guard"
import { can, CAPS } from "@/lib/auth/permissions"
import { loadFinanceSettings } from "@/lib/finance/settings"
import { Button } from "@/components/ui/button"
import { BillingPlanForm } from "@/components/admin/finance/billing-plan-form"

export const dynamic = "force-dynamic"

interface Props {
  searchParams: Promise<{ clientId?: string }>
}

export default async function NewBillingPlanPage({ searchParams }: Props) {
  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  if (!can(current.role, CAPS.BILLING_PLAN_WRITE)) redirect("/admin/finance")
  const admin = current.admin
  const params = await searchParams
  const [{ data: clients }, settings] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, company_name, email")
      .eq("role", "client")
      .order("company_name", { ascending: true }),
    loadFinanceSettings(),
  ])

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/admin/finance/billing-plans">
            <ArrowLeft className="h-4 w-4" />
            Danh sách gói
          </Link>
        </Button>
      </div>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Tạo gói mới</h1>
        <p className="text-sm text-muted-foreground text-pretty">
          Ghi lại các điều khoản thương mại để hệ thống tự động xuất hóa đơn định kỳ
          và tính phí thành công khi deal chốt.
        </p>
      </header>

      <BillingPlanForm
        mode="create"
        clients={clients ?? []}
        defaultFxRate={Number(settings?.default_fx_rate_vnd_per_usd ?? 25000)}
        lockClientId={params.clientId}
      />
    </div>
  )
}
