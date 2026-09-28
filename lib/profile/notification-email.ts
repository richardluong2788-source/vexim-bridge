import "server-only"

import { STAFF_EMAIL_DOMAIN } from "@/lib/auth/staff-login"
import type { createAdminClient } from "@/lib/supabase/admin"

/**
 * The single writer for `profiles.email` after an account already exists.
 *
 * That column is what the notification dispatcher sends to
 * (lib/notifications/dispatcher.ts). It is NOT always the login address:
 *
 *   - Username staff (`<username>@staff.veximtrade.com`) sign in with the
 *     synthetic address. `profiles.email` is only their notification mailbox
 *     and may be NULL. Writing it must not touch auth.users.
 *   - Clients and legacy email-invited staff sign in with `profiles.email`.
 *     auth.users.email and profiles.email are updated together and rolled
 *     back if the second write fails — they must never drift apart.
 *
 * Callers enforce their own authorisation (self + current password, or an
 * admin with USERS_MANAGE) before calling this.
 */

type AdminClient = ReturnType<typeof createAdminClient>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_EMAIL_LENGTH = 254

export type NotificationEmailError = "notFound" | "invalidEmail" | "emailTaken" | "updateFailed"

export interface NotificationEmailWriteResult {
  ok: boolean
  error?: NotificationEmailError
  /** True when auth.users.email changed too — the person must sign in with the new address. */
  loginChanged?: boolean
}

export function normaliseNotificationEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

/** The reserved domain has no mailbox. Sending notifications there would silently fail. */
export function isReservedStaffAddress(email: string): boolean {
  return email.toLowerCase().endsWith(`@${STAFF_EMAIL_DOMAIN}`)
}

function isUniquenessError(message: string): boolean {
  return /duplicate|already|exists|registered|23505|unique/i.test(message)
}

/**
 * Add, change, or (staff only) clear the notification mailbox for `userId`.
 * `requestedRaw` of "" clears it.
 */
export async function writeNotificationEmail(
  admin: AdminClient,
  userId: string,
  requestedRaw: string,
): Promise<NotificationEmailWriteResult> {
  const requested = normaliseNotificationEmail(requestedRaw)

  const { data: profile } = await admin
    .from("profiles")
    .select("email, username")
    .eq("id", userId)
    .maybeSingle<{ email: string | null; username: string | null }>()

  if (!profile) return { ok: false, error: "notFound" }

  const { data: authData, error: authLookupErr } = await admin.auth.admin.getUserById(userId)
  const authEmail = authData?.user?.email ?? null
  if (authLookupErr || !authData?.user) return { ok: false, error: "notFound" }

  const isStaffLogin = Boolean(profile.username) || isReservedStaffAddress(authEmail ?? "")

  if (!requested) {
    if (!isStaffLogin) return { ok: false, error: "invalidEmail" }
  } else if (
    !EMAIL_RE.test(requested) ||
    requested.length > MAX_EMAIL_LENGTH ||
    isReservedStaffAddress(requested)
  ) {
    return { ok: false, error: "invalidEmail" }
  }

  const current = profile.email?.trim().toLowerCase() ?? ""
  if (requested === current) return { ok: true, loginChanged: false }

  // `_` is a LIKE wildcard, so an address containing one can false-positive.
  // Failing closed (emailTaken) is the safe direction, and it matches the
  // uniqueness check createStaffAccount already uses.
  if (requested) {
    const { data: taken } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", requested)
      .neq("id", userId)
      .maybeSingle()
    if (taken) return { ok: false, error: "emailTaken" }
  }

  if (isStaffLogin) {
    const { error } = await admin
      .from("profiles")
      .update({ email: requested || null })
      .eq("id", userId)

    if (error) {
      console.error("[v0] writeNotificationEmail (staff) failed:", error)
      return { ok: false, error: isUniquenessError(error.message) ? "emailTaken" : "updateFailed" }
    }
    return { ok: true, loginChanged: false }
  }

  const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
    email: requested,
    // Already proven: either the account holder re-entered their password,
    // or an admin with USERS_MANAGE set it. An unconfirmed row blocks sign-in.
    email_confirm: true,
  })

  if (authErr) {
    console.error("[v0] writeNotificationEmail (auth) failed:", authErr)
    return { ok: false, error: isUniquenessError(authErr.message) ? "emailTaken" : "updateFailed" }
  }

  const { error: profileErr } = await admin
    .from("profiles")
    .update({ email: requested })
    .eq("id", userId)

  if (profileErr) {
    console.error("[v0] writeNotificationEmail (profile) failed, rolling back:", profileErr)
    if (current) {
      await admin.auth.admin.updateUserById(userId, { email: current, email_confirm: true })
    }
    return {
      ok: false,
      error: isUniquenessError(profileErr.message) ? "emailTaken" : "updateFailed",
    }
  }

  return { ok: true, loginChanged: true }
}
