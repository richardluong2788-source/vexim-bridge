import { redirect } from "next/navigation"
import { getCurrentRole } from "@/lib/auth/guard"
import { can, CAPS } from "@/lib/auth/permissions"
import { loadFinanceSettings } from "@/lib/finance/settings"
import { ExpensesManager } from "@/components/admin/finance/expenses-manager"
import type { OperatingExpense } from "@/lib/supabase/types"

export const dynamic = "force-dynamic"

export default async function OperatingExpensesPage() {
  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  if (!can(current.role, CAPS.FINANCE_READ)) redirect("/admin")
  const admin = current.admin
  const [{ data: expenses }, settings] = await Promise.all([
    admin
      .from("operating_expenses" as never)
      .select("*")
      .order("expense_date", { ascending: false })
      .limit(500),
    loadFinanceSettings(),
  ])

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">
          Chi phí vận hành
        </h1>
        <p className="text-sm text-muted-foreground text-pretty">
          Ghi nhận lương, công cụ, marketing và các khoản chi khác. Con số này
          được đối chiếu với doanh thu retainer để tính điểm hòa vốn.
        </p>
      </header>

      <ExpensesManager
        initial={(expenses ?? []) as unknown as OperatingExpense[]}
        defaultFxRate={Number(settings?.default_fx_rate_vnd_per_usd ?? 25000)}
      />
    </div>
  )
}
