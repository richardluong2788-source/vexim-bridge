import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { CountryRiskManager, type CountryRiskRow } from "@/components/admin/country-risk-manager"

export const dynamic = "force-dynamic"

export default async function CountryRiskPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    redirect("/admin")
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from("country_risk")
    .select("country_code, country_name, risk_level, requires_verified_swift, notes, updated_at")
    .order("risk_level", { ascending: false })
    .order("country_code", { ascending: true })

  const rows = (data ?? []) as CountryRiskRow[]

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Danh mục rủi ro theo quốc gia</h1>
        <p className="text-sm text-muted-foreground text-pretty">
          Đây là nguồn sự thật để phân loại rủi ro buyer theo quốc gia (SOP Phase 3).
          Khi FATF hoặc Bộ Công Thương cập nhật danh sách cảnh báo, hãy chỉnh sửa
          tại đây — các cổng Swift và cảnh báo form Add Lead sẽ lập tức dùng giá trị mới.
        </p>
      </header>

      <CountryRiskManager initialRows={rows} />
    </div>
  )
}
