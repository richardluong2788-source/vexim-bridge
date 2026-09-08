"use server"

/**
 * Server action for the "forgot password" flow.
 *
 * Supabase Auth's own `resetPasswordForEmail` sends its generic reset email,
 * which fails (500 unexpected_failure) when the project's Auth SMTP provider
 * is unconfigured. So we mint the recovery link ourselves with
 * `admin.auth.admin.generateLink({ type: "recovery" })` (no email sent) and
 * deliver it through our verified veximtrade.com Resend domain.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { siteConfig } from "@/lib/site-config"
import { sendPasswordResetEmail } from "@/lib/email/password-reset-email"

export interface RequestPasswordResetResult {
  ok: boolean
  error?: string
}

export async function requestPasswordResetAction(
  rawEmail: string,
): Promise<RequestPasswordResetResult> {
  const email = rawEmail?.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "invalid_email" }
  }

  const admin = createAdminClient()
  const redirectTo = `${siteConfig.url}/auth/reset-password`

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  })

  if (error) {
    // Anti-enumeration: an unknown email returns a "user not found"-style
    // error — swallow it and report success so callers can't probe which
    // addresses have accounts. Real transport failures are surfaced.
    const msg = error.message ?? ""
    if (/not found|unknown user|does not exist|no user/i.test(msg)) {
      return { ok: true }
    }
    console.error("[v0] requestPasswordResetAction: generateLink failed:", error)
    return { ok: false, error: msg || "generate_link_failed" }
  }

  const actionLink = data?.properties?.action_link
  if (!actionLink) {
    console.error("[v0] requestPasswordResetAction: no action_link returned")
    return { ok: false, error: "generate_link_failed" }
  }

  const { error: sendErr } = await sendPasswordResetEmail({ email, actionLink })
  if (sendErr) {
    console.error(
      "[v0] requestPasswordResetAction: failed to send reset email:",
      sendErr.message,
    )
    return { ok: false, error: sendErr.message }
  }

  return { ok: true }
}
