import { createAdminClient } from "@/lib/supabase/admin"
import { UnsubscribeResult } from "@/components/settings/unsubscribe-result"

export const dynamic = "force-dynamic"

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  if (!token || token.length < 8) {
    return <UnsubscribeResult status="invalid" />
  }

  const admin = createAdminClient()

  // The token is a per-user / per-buyer random secret generated server-side,
  // so presenting it is itself authorization — no login required.
  //
  // We try two tables in order:
  //   1. notification_preferences — registered users (clients / admins)
  //   2. leads                    — buyers (no account)
  // This lets a single /unsubscribe/[token] URL serve both audiences.

  const { data: prefs } = await admin
    .from("notification_preferences")
    .select("user_id, email_enabled")
    .eq("unsubscribe_token", token)
    .maybeSingle()

  if (prefs) {
    if (prefs.email_enabled) {
      const { error: updErr } = await admin
        .from("notification_preferences")
        .update({ email_enabled: false })
        .eq("user_id", prefs.user_id)

      if (updErr) {
        return <UnsubscribeResult status="invalid" />
      }
    }
    return <UnsubscribeResult status="success" />
  }

  // Fall back to buyer tokens on the leads table.
  const { data: lead } = await admin
    .from("leads")
    .select("id, email_unsubscribed")
    .eq("unsubscribe_token", token)
    .maybeSingle()

  if (lead) {
    if (!lead.email_unsubscribed) {
      const { error: updErr } = await admin
        .from("leads")
        .update({
          email_unsubscribed: true,
          email_unsubscribed_at: new Date().toISOString(),
        })
        .eq("id", lead.id)

      if (updErr) {
        return <UnsubscribeResult status="invalid" />
      }
    }
    return <UnsubscribeResult status="success" />
  }

  return <UnsubscribeResult status="invalid" />
}
