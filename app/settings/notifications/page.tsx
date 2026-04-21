import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NotificationPreferencesForm } from "@/components/settings/notification-preferences-form"
import { SettingsPageHeader } from "@/components/settings/settings-page-header"
import type { NotificationPreferences, PreferredLanguage } from "@/lib/supabase/types"

export const dynamic = "force-dynamic"

export default async function NotificationSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // Use admin client to bypass RLS — we only read/write rows keyed on user.id
  // that we already own. This also guarantees the row exists (upsert on read).
  const admin = createAdminClient()

  const [{ data: prefsRow }, { data: profile }] = await Promise.all([
    admin.from("notification_preferences").select("*").eq("user_id", user.id).maybeSingle(),
    admin.from("profiles").select("preferred_language, role").eq("id", user.id).single(),
  ])

  // Role determines where "Back to dashboard" sends the user. Clients should
  // never accidentally land on /admin even if they navigate here directly.
  const backHref =
    profile?.role && ["admin", "staff", "super_admin"].includes(profile.role)
      ? "/admin"
      : "/client"

  let prefs: NotificationPreferences
  if (prefsRow) {
    prefs = prefsRow
  } else {
    // First time loading the page — insert sensible defaults.
    const { data: created } = await admin
      .from("notification_preferences")
      .insert({ user_id: user.id })
      .select()
      .single()
    prefs = created ?? {
      user_id: user.id,
      email_enabled: true,
      email_action_required: true,
      email_status_update: true,
      email_deal_closed: true,
      email_new_assignment: true,
      unsubscribe_token: "",
      updated_at: new Date().toISOString(),
    }
  }

  const initialLanguage: PreferredLanguage =
    (profile?.preferred_language as PreferredLanguage | undefined) ?? "vi"

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <SettingsPageHeader backHref={backHref} />
      <NotificationPreferencesForm initial={prefs} initialLanguage={initialLanguage} />
    </div>
  )
}
