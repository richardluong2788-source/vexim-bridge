import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { landingPathForRole, normaliseRole } from "@/lib/auth/permissions"

/**
 * Trang chủ công khai (landing page) đã bị gỡ để viết lại toàn bộ.
 *
 * Cho tới khi có landing mới, `/` chỉ đóng vai trò định tuyến:
 *   - Người đã đăng nhập → vào đúng cổng (admin / client) như trước.
 *   - Khách (chưa đăng nhập) → sang trang đăng nhập.
 */
export default async function RootPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
    redirect(landingPathForRole(normaliseRole(profile?.role)))
  }

  redirect("/auth/login")
}
