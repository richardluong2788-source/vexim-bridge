import { redirect } from "next/navigation"
import { getCurrentRole } from "@/lib/auth/guard"
import { can, CAPS } from "@/lib/auth/permissions"
import { FinanceSettingsForm } from "@/components/admin/finance/finance-settings-form"
import type { FinanceSettings } from "@/lib/supabase/types"

export const dynamic = "force-dynamic"

export default async function FinanceSettingsPage() {
  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  if (!can(current.role, CAPS.FINANCE_SETTINGS_WRITE)) redirect("/admin/finance")
  const admin = current.admin
  const { data } = await admin
    .from("finance_settings" as never)
    .select("*")
    .eq("id", 1)
    .maybeSingle()

  const initial = (data as unknown as FinanceSettings | null)
  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-semibold">Cài đặt tài chính</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Thông tin công ty, tài khoản ngân hàng, và tỷ giá VND/USD mặc định.
          Những giá trị này sẽ xuất hiện trên mọi hóa đơn mới.
        </p>
      </div>

      <FinanceSettingsForm initial={initial} />
    </div>
  )
}
