import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { getCurrentRole } from "@/lib/auth/guard"
import { can, CAPS } from "@/lib/auth/permissions"
import { loadFinanceSettings } from "@/lib/finance/settings"
import { Button } from "@/components/ui/button"
import { BillingPlanForm } from "@/components/admin/finance/billing-plan-form"
import type { BillingPlan } from "@/lib/supabase/types"

export const dynamic = "force-dynamic"

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditBillingPlanPage({ params }: Props) {
  const { id } = await params
  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  if (!can(current.role, CAPS.BILLING_PLAN_WRITE)) redirect("/admin/finance")
  const admin = current.admin
  const [{ data: plan }, { data: clients }, settings] = await Promise.all([
    admin.from("billing_plans" as never).select("*").eq("id", id).maybeSingle(),
    admin
      .from("profiles")
      .select("id, full_name, company_name, email")
      .eq("role", "client")
      .order("company_name", { ascending: true }),
    loadFinanceSettings(),
  ])

  if (!plan) return notFound()

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
        <h1 className="text-2xl font-semibold text-foreground">Chỉnh sửa gói</h1>
        <p className="text-sm text-muted-foreground text-pretty">
          Mọi thay đổi chỉ ảnh hưởng tới các hóa đơn phát sinh sau thời điểm lưu.
          Các hóa đơn cũ giữ nguyên các điều khoản tại thời điểm xuất.
        </p>
      </header>

      <BillingPlanForm
        mode="edit"
        plan={plan as unknown as BillingPlan}
        clients={clients ?? []}
        defaultFxRate={Number(settings?.default_fx_rate_vnd_per_usd ?? 25000)}
      />
    </div>
  )
}
