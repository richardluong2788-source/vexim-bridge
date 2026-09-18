import { createAdminClient } from "@/lib/supabase/admin"

export type UnsubscribeStatus = "success" | "invalid"

/**
 * One-click / magic-link unsubscribe. The token is a per-user (or per-buyer)
 * random secret generated server-side, so presenting it is authorization —
 * no login required.
 *
 * Tries two tables in order:
 *   1. notification_preferences — registered users (clients / staff)
 *   2. leads                    — buyers (no account)
 *
 * Idempotent: already-unsubscribed tokens still return success.
 */
export async function performUnsubscribe(token: string): Promise<UnsubscribeStatus> {
  if (!token || token.length < 8) return "invalid"

  const admin = createAdminClient()

  const { data: prefs } = await admin
    .from("notification_preferences")
    .select("user_id, email_enabled")
    .eq("unsubscribe_token", token)
    .maybeSingle()

  if (prefs) {
    if (prefs.email_enabled) {
      const { error } = await admin
        .from("notification_preferences")
        .update({ email_enabled: false })
        .eq("user_id", prefs.user_id)
      if (error) return "invalid"
    }
    return "success"
  }

  const { data: lead } = await admin
    .from("leads")
    .select("id, email_unsubscribed")
    .eq("unsubscribe_token", token)
    .maybeSingle()

  if (lead) {
    if (!lead.email_unsubscribed) {
      const { error } = await admin
        .from("leads")
        .update({
          email_unsubscribed: true,
          email_unsubscribed_at: new Date().toISOString(),
        })
        .eq("id", lead.id)
      if (error) return "invalid"
    }
    return "success"
  }

  return "invalid"
}
