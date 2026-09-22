"use server"

/**
 * Self-service account actions for `/settings/profile`.
 *
 * Why this file exists: before it, `profiles.email` was written exactly once —
 * at account-creation time. Staff accounts are provisioned with a username +
 * password and an OPTIONAL "notification email" (app/admin/users/actions.ts →
 * createStaffAccount), so leaving that field blank produced an account that
 * could never receive notification email: the dispatcher silently returns when
 * `profiles.email` is NULL (lib/notifications/dispatcher.ts → sendEmailChannel)
 * and nothing in the UI could fill it in afterwards. `updateClientEmail` was
 * the only post-creation writer and it hard-rejects every non-client role.
 *
 * Security model:
 *   - Every action re-resolves the caller from the session cookie and only ever
 *     touches the caller's OWN rows (`id = user.id`). No user-supplied id.
 *   - Changing the email or the password requires re-entering the current
 *     password, verified with a throwaway Supabase client (persistSession off)
 *     so the caller's real session is never replaced.
 *   - Staff accounts authenticate with a synthetic, non-routable address
 *     (`<username>@staff.veximtrade.com`, see lib/auth/staff-login.ts). For
 *     them `profiles.email` is a pure notification mailbox and auth.users is
 *     left untouched. For clients (and legacy email-invited staff) the address
 *     IS the login, so auth.users.email and profiles.email are updated together
 *     and rolled back if the second write fails — they must never drift apart.
 */
import { revalidatePath } from "next/cache"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { STAFF_PASSWORD_MIN_LENGTH } from "@/lib/auth/staff-login"
import {
  normaliseNotificationEmail,
  writeNotificationEmail,
} from "@/lib/profile/notification-email"

const MAX_NAME_LENGTH = 120
const MAX_URL_LENGTH = 2048

export type ProfileErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "fullNameRequired"
  | "invalidEmail"
  | "invalidAvatar"
  | "emailTaken"
  | "wrongPassword"
  | "weakPassword"
  | "updateFailed"

export interface ProfileActionResult {
  ok: boolean
  error?: ProfileErrorCode | string
}

export interface UpdateMyProfileInput {
  fullName: string
  /** Empty string / null clears the avatar. */
  avatarUrl?: string | null
}

export interface UpdateMyEmailInput {
  /** Empty string clears the mailbox (staff accounts only). */
  email: string
  currentPassword: string
}

export interface ChangeMyPasswordInput {
  currentPassword: string
  newPassword: string
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type AdminSB = ReturnType<typeof createAdminClient>

interface Caller {
  userId: string
  admin: AdminSB
}

async function resolveCaller(): Promise<Caller | { error: ProfileErrorCode }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "unauthenticated" }
  return { userId: user.id, admin: createAdminClient() }
}

/**
 * Confirm the caller really knows their current password.
 *
 * A dedicated client with `persistSession: false` is used on purpose: calling
 * signInWithPassword on the request's own cookie-bound client would overwrite
 * the session (and, on failure, could sign the user out). The authoritative
 * auth email is read from the admin API rather than derived from the username
 * so legacy email-invited staff work too.
 */
async function verifyCurrentPassword(
  admin: AdminSB,
  userId: string,
  password: string,
): Promise<boolean> {
  if (!password) return false

  const { data, error } = await admin.auth.admin.getUserById(userId)
  const authEmail = data?.user?.email
  if (error || !authEmail) return false

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  if (!url || !anonKey) return false

  const probe = createSupabaseClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  const { error: signInError } = await probe.auth.signInWithPassword({
    email: authEmail,
    password,
  })
  if (signInError) return false

  // Do NOT signOut here. supabase-js defaults to scope "global", which would
  // revoke every session for this user — including the browser session that
  // just asked to change their email. The probe client has persistSession
  // off, so the extra refresh token is never written to a cookie.
  return true
}

// ---------------------------------------------------------------------------
// 1) Name + avatar
// ---------------------------------------------------------------------------

/**
 * Update the caller's display name and avatar. No password needed — nothing
 * here affects authentication or where notifications are delivered.
 */
export async function updateMyProfile(
  input: UpdateMyProfileInput,
): Promise<ProfileActionResult> {
  const caller = await resolveCaller()
  if ("error" in caller) return caller
  const { userId, admin } = caller

  const fullName = input.fullName?.trim()
  if (!fullName) return { ok: false, error: "fullNameRequired" }
  if (fullName.length > MAX_NAME_LENGTH) {
    return { ok: false, error: "fullNameRequired" }
  }

  const rawAvatar = input.avatarUrl?.trim() || null
  if (rawAvatar && (!rawAvatar.startsWith("http") || rawAvatar.length > MAX_URL_LENGTH)) {
    return { ok: false, error: "invalidAvatar" }
  }

  const { data: updated, error } = await admin
    .from("profiles")
    .update({ full_name: fullName, avatar_url: rawAvatar })
    .eq("id", userId)
    .select("id")
    .maybeSingle()

  if (error || !updated) {
    console.error("[v0] updateMyProfile failed:", error)
    return { ok: false, error: "updateFailed" }
  }

  // Best-effort: keep the auth metadata copy of the name from drifting (it is
  // only ever used as a display fallback, never for authorisation). Spread the
  // existing metadata so a replace-style GoTrue update can't wipe role/username.
  try {
    const { data: authUser } = await admin.auth.admin.getUserById(userId)
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...(authUser?.user?.user_metadata ?? {}),
        full_name: fullName,
      },
    })
  } catch (err) {
    console.error("[v0] updateMyProfile: user_metadata sync failed:", err)
  }

  revalidatePath("/settings/profile")
  return { ok: true }
}

// ---------------------------------------------------------------------------
// 2) Notification email
// ---------------------------------------------------------------------------

/**
 * Add or change the caller's email address.
 *
 * - Staff (username login): writes `profiles.email` only — the notification
 *   mailbox the dispatcher reads. Auth stays on the synthetic address.
 * - Client / legacy staff: the address is also their login, so `auth.users`
 *   is updated first (that's the write that can fail on uniqueness) and
 *   `profiles.email` second, rolling the auth change back if it fails.
 */
export async function updateMyEmail(
  input: UpdateMyEmailInput,
): Promise<ProfileActionResult> {
  const caller = await resolveCaller()
  if ("error" in caller) return caller
  const { userId, admin } = caller

  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle<{ email: string | null }>()

  const requested = normaliseNotificationEmail(input.email ?? "")
  const current = profile?.email?.trim().toLowerCase() ?? ""
  // No-op must not demand the password — otherwise "Save" with an untouched
  // field fails for anyone who leaves the password blank.
  if (profile && requested === current) return { ok: true }

  const passwordOk = await verifyCurrentPassword(admin, userId, input.currentPassword ?? "")
  if (!passwordOk) return { ok: false, error: "wrongPassword" }

  // Staff vs login-address rules live in one writer so the admin override
  // (app/admin/users/actions.ts) cannot drift from this self-service path.
  const written = await writeNotificationEmail(admin, userId, requested)
  if (!written.ok) return { ok: false, error: written.error }

  revalidatePath("/settings/profile")
  if (written.loginChanged) revalidatePath("/client")
  return { ok: true }
}

// ---------------------------------------------------------------------------
// 3) Password
// ---------------------------------------------------------------------------

/**
 * Change the caller's own password.
 *
 * Staff accounts previously had no self-service path at all — `resetStaffPassword`
 * deliberately refuses to target the caller (`cannotChangeSelf`) because it is
 * the admin override, so a staff member who knew their password could never
 * rotate it without asking a super admin.
 */
export async function changeMyPassword(
  input: ChangeMyPasswordInput,
): Promise<ProfileActionResult> {
  const caller = await resolveCaller()
  if ("error" in caller) return caller
  const { userId, admin } = caller

  const newPassword = input.newPassword ?? ""
  if (newPassword.length < STAFF_PASSWORD_MIN_LENGTH) {
    return { ok: false, error: "weakPassword" }
  }

  const passwordOk = await verifyCurrentPassword(admin, userId, input.currentPassword ?? "")
  if (!passwordOk) return { ok: false, error: "wrongPassword" }

  const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword })
  if (error) {
    console.error("[v0] changeMyPassword failed:", error)
    return {
      ok: false,
      error: /password/i.test(error.message) ? "weakPassword" : "updateFailed",
    }
  }

  return { ok: true }
}
