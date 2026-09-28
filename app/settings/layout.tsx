import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdminShellRole, normaliseRole } from "@/lib/auth/permissions"
import { SettingsShell } from "@/components/settings/settings-shell"

export const dynamic = "force-dynamic"

/**
 * Settings shell — owns the header + tab navigation shared by
 * `/settings/profile` and `/settings/notifications`, so the individual pages
 * only render their own content.
 *
 * `backHref` is derived from the caller's role: staff land back on /admin,
 * clients on /client. It uses `isAdminShellRole` (the same predicate the two
 * layouts use) rather than a hand-rolled role list — the previous list here
 * only covered admin/staff/super_admin, which sent Account Executives, Lead
 * Researchers, Supplier Researchers and Finance back to the client portal.
 */
export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // Service-role client: `profiles` SELECT policies are written against the
  // legacy 'admin' role string (scripts/003), so reading through the anon
  // client is needlessly fragile. We only ever read the caller's own row.
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string | null }>()

  const backHref = isAdminShellRole(normaliseRole(profile?.role)) ? "/admin" : "/client"

  return <SettingsShell backHref={backHref}>{children}</SettingsShell>
}
