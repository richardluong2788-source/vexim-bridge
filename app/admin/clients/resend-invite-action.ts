"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { siteConfig } from "@/lib/site-config"
import { sendClientInviteEmail } from "@/lib/email/client-invite-email"

export interface ResendInviteResult {
  ok: boolean
  error?: string
}

/**
 * Admin action: regenerate and re-send the "accept invite" email for a client
 * whose original OTP has expired or been consumed.
 *
 * Why we don't just call `admin.inviteUserByEmail` again:
 *   - It errors with "User already registered" when the auth row exists,
 *     even if the user never accepted the first invite.
 *
 * Why we don't use `admin.generateLink({ type: 'invite' })` alone:
 *   - `generateLink` DOES mint a fresh OTP, but it does NOT send the email.
 *     Supabase only auto-sends for `inviteUserByEmail` / `resetPasswordForEmail`.
 *
 * Strategy:
 *   1. Validate caller is admin/staff.
 *   2. Look up target profile, must be role=client.
 *   3. Generate a fresh magiclink via the admin API. This invalidates the
 *      previous OTP and produces an `action_link` pointing at our
 *      `/auth/accept-invite` page (with tokens in the hash fragment).
 *   4. Send the email ourselves via Zoho SMTP so we control wording/branding.
 */
export async function resendClientInvite(
  clientId: string,
): Promise<ResendInviteResult> {
  if (!clientId || typeof clientId !== "string") {
    return { ok: false, error: "invalid_client_id" }
  }

  // --- 1. AuthZ ---------------------------------------------------------
  const supabase = await createClient()
  const {
    data: { user: caller },
  } = await supabase.auth.getUser()
  if (!caller) return { ok: false, error: "unauthenticated" }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", caller.id)
    .single()

  if (
    !callerProfile ||
    !["admin", "staff", "super_admin"].includes(callerProfile.role)
  ) {
    return { ok: false, error: "forbidden" }
  }

  // --- 2. Lookup target -------------------------------------------------
  const admin = createAdminClient()
  const { data: target, error: targetErr } = await admin
    .from("profiles")
    .select("id, email, full_name, company_name, role")
    .eq("id", clientId)
    .single()

  if (targetErr || !target) return { ok: false, error: "not_found" }
  if (target.role !== "client") return { ok: false, error: "not_a_client" }
  if (!target.email) return { ok: false, error: "missing_email" }

  const redirectTo = `${siteConfig.url}/auth/accept-invite`

  // --- 3. Generate a fresh magic link ----------------------------------
  // Using type='magiclink' works whether the user has confirmed their email
  // or not; type='invite' would fail if they've already confirmed.
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: target.email,
    options: { redirectTo },
  })

  if (linkErr || !linkData?.properties?.action_link) {
    return {
      ok: false,
      error: linkErr?.message ?? "generate_link_failed",
    }
  }

  const actionLink = linkData.properties.action_link

  // --- 4. Send the branded activation email via Resend ------------------
  const displayName =
    target.full_name?.trim() ||
    target.company_name?.trim() ||
    target.email.split("@")[0]

  const { error: sendErr } = await sendClientInviteEmail({
    email: target.email,
    displayName,
    actionLink,
    variant: "resend",
  })

  if (sendErr) {
    return { ok: false, error: `smtp: ${sendErr.message}` }
  }

  // --- 5. Audit trail --------------------------------------------------
  await admin.from("activities").insert({
    user_id: caller.id,
    action: "client_invite_resent",
    details: {
      client_id: target.id,
      email: target.email,
    },
  })

  return { ok: true }
}
