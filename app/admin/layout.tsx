import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { AppTopbar } from "@/components/app-topbar"
import { normaliseRole } from "@/lib/auth/permissions"
import type { Role } from "@/lib/supabase/types"

// Roles allowed to enter the admin shell. `client` is portal-only, so it
// goes elsewhere. `staff` is legacy but still permitted for now.
const ADMIN_SHELL_ROLES: Role[] = [
  "super_admin",
  "admin",
  "account_executive",
  "lead_researcher",
  "finance",
  "staff",
]

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  // SECURITY: DB is the single source of truth. No fallback to
  // user_metadata (client-controlled) and no default-to-admin.
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  const role = normaliseRole(profile?.role)
  if (!profile || !role || !ADMIN_SHELL_ROLES.includes(role)) {
    redirect("/client")
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar profile={profile} role={role} />
      <div className="flex flex-1 flex-col min-w-0">
        <AppTopbar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
