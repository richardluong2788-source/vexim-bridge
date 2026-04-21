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

  // The token is a per-user random secret generated server-side, so
  // presenting it is itself authorization — no login required.
  const { data: prefs, error: findErr } = await admin
    .from("notification_preferences")
    .select("user_id, email_enabled")
    .eq("unsubscribe_token", token)
    .maybeSingle()

  if (findErr || !prefs) {
    return <UnsubscribeResult status="invalid" />
  }

  // Idempotent: if already off, skip the write but still show success.
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
