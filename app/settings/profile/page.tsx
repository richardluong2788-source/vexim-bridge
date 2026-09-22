import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getDictionary } from "@/lib/i18n/server"
import { normaliseRole, ROLE_META } from "@/lib/auth/permissions"
import { MyProfileForm } from "@/components/settings/my-profile-form"
import type { Role } from "@/lib/supabase/types"

export const dynamic = "force-dynamic"

/**
 * Personal profile page — the account's own name, photo, notification email
 * and password.
 *
 * Every other "profile" surface in this app is about somebody else:
 * `/profile/[slug]` is the public supplier profile shown to US buyers, and
 * `/admin/clients/[id]/profile` is the admin's editor for it. Until now there
 * was no page where a signed-in person could see or change their own record,
 * which is why an AE provisioned without a notification email had no way to
 * add one later (see app/settings/profile/actions.ts for the details).
 */
export default async function MyProfilePage() {
  const { locale } = await getDictionary()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // Service-role read of the caller's own row — `profiles` SELECT policies key
  // off the legacy 'admin' role string (scripts/003), and the settings shell
  // already uses the admin client for the same reason.
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("profiles")
    .select(
      "id, email, full_name, username, role, company_name, avatar_url, work_email, preferred_language",
    )
    .eq("id", user.id)
    .maybeSingle<{
      id: string
      email: string | null
      full_name: string | null
      username: string | null
      role: string | null
      company_name: string | null
      avatar_url: string | null
      work_email: string | null
      preferred_language: string | null
    }>()

  const role = (normaliseRole(profile?.role) ?? "client") as Role
  const meta = ROLE_META[role]
  const roleLabel = meta ? (locale === "vi" ? meta.labelVi : meta.label) : role

  return (
    <MyProfileForm
      initial={{
        userId: user.id,
        fullName: profile?.full_name ?? "",
        email: profile?.email ?? "",
        avatarUrl: profile?.avatar_url ?? null,
        username: profile?.username ?? null,
        workEmail: profile?.work_email ?? null,
        companyName: profile?.company_name ?? null,
        roleLabel,
        // A username means the account signs in with it and its auth address is
        // the synthetic staff.veximtrade.com one, so `email` here is purely the
        // notification mailbox. Clients' email doubles as their login.
        isStaffLogin: Boolean(profile?.username),
      }}
    />
  )
}
