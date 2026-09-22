import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NotificationPreferencesForm } from "@/components/settings/notification-preferences-form"
import type { NotificationPreferences, PreferredLanguage } from "@/lib/supabase/types"

export const dynamic = "force-dynamic"

/**
 * Notification channels + email language. The page header, back link and tab
 * navigation live in `app/settings/layout.tsx` (shared with /settings/profile),
 * so this page renders content only.
 */
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
    admin.from("profiles").select("preferred_language").eq("id", user.id).single(),
  ])

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
      telegram_enabled: false,
      telegram_chat_id: null,
      telegram_username: null,
      telegram_action_required: true,
      telegram_status_update: true,
      telegram_deal_closed: true,
      telegram_new_assignment: true,
      telegram_link_token: "",
      telegram_link_token_expires_at: null,
      updated_at: new Date().toISOString(),
    }
  }

  const initialLanguage: PreferredLanguage =
    (profile?.preferred_language as PreferredLanguage | undefined) ?? "vi"

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "Veximtrade_bot"

  return (
    <NotificationPreferencesForm
      initial={prefs}
      initialLanguage={initialLanguage}
      botUsername={botUsername}
    />
  )
}
