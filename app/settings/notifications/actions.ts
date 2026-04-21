"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { PreferredLanguage } from "@/lib/supabase/types"

export interface PreferencesInput {
  email_enabled: boolean
  email_action_required: boolean
  email_status_update: boolean
  email_deal_closed: boolean
  email_new_assignment: boolean
  preferred_language: PreferredLanguage
}

export interface PreferencesResult {
  ok: boolean
  error?: string
}

/**
 * Persist the current user's notification preferences + preferred email
 * language. Writes happen against RLS-protected tables so no admin client is
 * needed — the user can only ever mutate their own rows.
 */
export async function updateNotificationPreferences(
  input: PreferencesInput,
): Promise<PreferencesResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "notAuthenticated" }

  if (input.preferred_language !== "vi" && input.preferred_language !== "en") {
    return { ok: false, error: "invalidLanguage" }
  }

  // Run the two updates in parallel. They target different tables so they can
  // never interfere with each other.
  const [prefRes, profRes] = await Promise.all([
    supabase
      .from("notification_preferences")
      .update({
        email_enabled: input.email_enabled,
        email_action_required: input.email_action_required,
        email_status_update: input.email_status_update,
        email_deal_closed: input.email_deal_closed,
        email_new_assignment: input.email_new_assignment,
      })
      .eq("user_id", user.id),
    supabase
      .from("profiles")
      .update({ preferred_language: input.preferred_language })
      .eq("id", user.id),
  ])

  if (prefRes.error) return { ok: false, error: prefRes.error.message }
  if (profRes.error) return { ok: false, error: profRes.error.message }

  revalidatePath("/settings/notifications")
  return { ok: true }
}
