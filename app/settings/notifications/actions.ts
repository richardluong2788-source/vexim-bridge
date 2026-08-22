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
  telegram_enabled: boolean
  telegram_action_required: boolean
  telegram_status_update: boolean
  telegram_deal_closed: boolean
  telegram_new_assignment: boolean
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
        // Telegram can only be turned ON here if a chat is already linked —
        // the DB doesn't enforce that, so we defensively re-check below.
        telegram_enabled: input.telegram_enabled,
        telegram_action_required: input.telegram_action_required,
        telegram_status_update: input.telegram_status_update,
        telegram_deal_closed: input.telegram_deal_closed,
        telegram_new_assignment: input.telegram_new_assignment,
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

export interface TelegramLinkInfo {
  linked: boolean
  username: string | null
  linkToken: string
  botUsername: string
}

/**
 * Reads (and lazily generates) the current user's Telegram link state. The
 * `linkToken` is embedded in the deep link `t.me/<bot>?start=<token>` shown
 * on the Settings page.
 */
export async function getTelegramLinkInfo(): Promise<TelegramLinkInfo | { ok: false; error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "notAuthenticated" }

  const { data: prefs, error } = await supabase
    .from("notification_preferences")
    .select("telegram_chat_id, telegram_username, telegram_link_token")
    .eq("user_id", user.id)
    .single()

  if (error || !prefs) return { ok: false, error: error?.message ?? "notFound" }

  return {
    linked: Boolean(prefs.telegram_chat_id),
    username: prefs.telegram_username,
    linkToken: prefs.telegram_link_token,
    botUsername: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "Veximtrade_bot",
  }
}

/**
 * Unlinks the current user's Telegram chat (e.g. they want to link a
 * different account). Also rotates the link token so the old deep link
 * can't be reused, and turns the channel off since there's no chat to send to.
 */
export async function unlinkTelegram(): Promise<PreferencesResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "notAuthenticated" }

  const { error } = await supabase
    .from("notification_preferences")
    .update({
      telegram_chat_id: null,
      telegram_username: null,
      telegram_enabled: false,
      telegram_link_token: crypto.randomUUID(),
    })
    .eq("user_id", user.id)

  if (error) return { ok: false, error: error.message }

  revalidatePath("/settings/notifications")
  return { ok: true }
}
