"use server"

/**
 * Server actions for /admin/users.
 *
 * Responsibilities:
 *   - updateUserRole: change another user's role (admin + super_admin only)
 *   - createStaffAccount: provision internal staff directly with a
 *     username + password (no invite email)
 *
 * Security:
 *   - Caller must have USERS_ASSIGN_ROLE capability.
 *   - Caller cannot change their own role (prevents lockout).
 *   - Only super_admin may promote someone to super_admin.
 *   - Only super_admin may demote another super_admin.
 *   - Role changes are recorded in the activities log by the DB trigger
 *     `profiles_role_change_audit` (see migration 020).
 */
import { revalidatePath } from "next/cache"
import { requireCap } from "@/lib/auth/guard"
import { CAPS, normaliseRole } from "@/lib/auth/permissions"
  import { normalizeIndustry } from "@/lib/constants/industries"
  import { reserveWorkEmail } from "@/lib/email/work-email"
  import {
    STAFF_PASSWORD_MIN_LENGTH,
    isValidUsername,
    normalizeUsername,
    staffAuthEmail,
  } from "@/lib/auth/staff-login"
  import { rematchOpenSharedInboxLeads } from "@/lib/matching/rematch-shared-inbox"
  import type { Role } from "@/lib/supabase/types"

// Roles that send buyer-facing emails and therefore benefit from their own
// personal sender address (see lib/email/work-email.ts for why).
const ROLES_NEEDING_WORK_EMAIL: Role[] = ["account_executive", "admin", "super_admin"]

// Assignable roles surfaced in the UI. `staff` is legacy — left out on
// purpose so new assignments can only land on the 5 canonical roles.
const ASSIGNABLE: Role[] = [
  "super_admin",
  "admin",
  "account_executive",
  "lead_researcher",
  "supplier_researcher",
  "finance",
  "client",
]

export interface UpdateRoleResult {
  ok: boolean
  error?: string
}

export async function updateUserRole(
  userId: string,
  newRole: Role,
): Promise<UpdateRoleResult> {
  if (!ASSIGNABLE.includes(newRole)) {
    return { ok: false, error: "invalidRole" }
  }

  const guard = await requireCap(CAPS.USERS_ASSIGN_ROLE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin, userId: callerId, role: callerRole } = guard

  if (callerId === userId) {
    return { ok: false, error: "cannotChangeSelf" }
  }

  // Only super_admin can mint new super_admins.
  if (newRole === "super_admin" && callerRole !== "super_admin") {
    return { ok: false, error: "superAdminOnly" }
  }

  // Only super_admin can demote a super_admin.
  const { data: target } = await admin
    .from("profiles")
    .select("role, full_name, work_email")
    .eq("id", userId)
    .single<{ role: string | null; full_name: string | null; work_email: string | null }>()
  const targetRole = normaliseRole(target?.role)
  if (targetRole === "super_admin" && callerRole !== "super_admin") {
    return { ok: false, error: "superAdminOnly" }
  }

  // Backfill a personal sender address if this promotion moves the user
  // into a role that sends buyer-facing email and they don't have one yet
  // (e.g. they were invited as lead_researcher, later promoted to AE).
  const needsWorkEmail =
    ROLES_NEEDING_WORK_EMAIL.includes(newRole) && !target?.work_email
  const workEmail = needsWorkEmail
    ? await reserveWorkEmail(target?.full_name || "user")
    : undefined

  const { error: profileErr } = await admin
    .from("profiles")
    .update({ role: newRole, ...(workEmail ? { work_email: workEmail } : {}) })
    .eq("id", userId)

  if (profileErr) {
    return { ok: false, error: profileErr.message }
  }

  // Keep JWT metadata in sync so the target user sees the new role on next login.
  const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: { role: newRole },
  })

  if (authErr) {
    // profile already updated; return a soft error so the UI can warn
    return { ok: false, error: authErr.message }
  }

  revalidatePath("/admin/users")
  return { ok: true }
}

// ============================================================================
// Backfill Work Email
// ============================================================================

export interface GenerateWorkEmailResult {
  ok: boolean
  workEmail?: string
  error?: string
}

/**
 * Backfill a personal sender address for an existing user who doesn't have
 * one yet (e.g. they were invited before this feature existed). Used from
 * the users table for anyone in ROLES_NEEDING_WORK_EMAIL with a null
 * work_email. See lib/email/work-email.ts for why this matters.
 */
export async function generateWorkEmailForUser(
  userId: string,
): Promise<GenerateWorkEmailResult> {
  const guard = await requireCap(CAPS.USERS_ASSIGN_ROLE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin } = guard

  const { data: target } = await admin
    .from("profiles")
    .select("role, full_name, work_email")
    .eq("id", userId)
    .single<{ role: string | null; full_name: string | null; work_email: string | null }>()

  if (!target) return { ok: false, error: "not_found" }
  if (target.work_email) return { ok: true, workEmail: target.work_email }
  if (!ROLES_NEEDING_WORK_EMAIL.includes(normaliseRole(target.role) as Role)) {
    return { ok: false, error: "role_not_eligible" }
  }

  const workEmail = await reserveWorkEmail(target.full_name || "user")
  const { error } = await admin
    .from("profiles")
    .update({ work_email: workEmail })
    .eq("id", userId)

  if (error) return { ok: false, error: error.message }

  revalidatePath("/admin/users")
  return { ok: true, workEmail }
}

// ============================================================================
// Update AE Industries
// ============================================================================

export interface UpdateIndustryResult {
  ok: boolean
  error?: string
}

/**
 * Update the industries a person covers (ordered — [0] is the primary).
 *
 * Works for BOTH account_executive and supplier_researcher:
 *   - AE:  industries feed the AI-matching hard filter — the buyer inbox
 *          only ever receives buyers whose industry the AE covers.
 *   - SR:  industries mark the verticals this researcher sources suppliers
 *          for. The /admin/sourcing demand board defaults to filtering the
 *          buyer-demand list by the SR's assigned industries, so with
 *          multiple SRs each sees their own patch (equipment vs food never
 *          mix in one work queue) — and can toggle to view everything.
 *
 * IMPORTANT — why this writes the `industries` ARRAY and not `industry`:
 * the migration-018 trigger `profiles_sync_primary_industry` runs BEFORE
 * UPDATE and force-sets `NEW.industry := NEW.industries[1]` whenever the
 * array is non-empty. The previous implementation only updated the scalar
 * `industry` column, so the trigger silently reverted the admin's change
 * back to industries[1] (set once at invite time) — once an AE's industry
 * was set it could never be changed. Writing the array fixes that: the
 * trigger then syncs `industry` to the new first element for us. To clear
 * everything we must null BOTH fields in the same statement, otherwise the
 * trigger's ELSIF branch would lift the stale `industry` back into a
 * single-element array.
 *
 * The AI matching hard-filter gates AEs on the full `industries` array
 * (lib/matching/orchestrator.ts), so an AE can cover several verticals.
 */
export async function updateUserIndustries(
  userId: string,
  industries: string[],
): Promise<UpdateIndustryResult> {
  // Normalize every entry, dedupe while preserving the caller's order.
  const normalized: string[] = []
  for (const raw of industries ?? []) {
    const n = normalizeIndustry(raw)
    if (!n) {
      return { ok: false, error: "invalid_industry" }
    }
    if (!normalized.includes(n)) {
      normalized.push(n)
    }
  }

  const guard = await requireCap(CAPS.USERS_ASSIGN_ROLE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin } = guard

  const { data: target } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single<{ role: string | null }>()

  const targetRole = normaliseRole(target?.role)
  if (targetRole !== "account_executive" && targetRole !== "supplier_researcher") {
    return { ok: false, error: "invalid_role" }
  }

  const { error } = await admin
    .from("profiles")
    .update(
      normalized.length > 0
        ? { industries: normalized }
        : { industries: [], industry: null },
    )
    .eq("id", userId)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath("/admin/users")
  revalidatePath("/admin/sourcing")

  // Only AE coverage drives buyer routing — re-run matching for any buyer
  // stuck in the shared inbox for those industries (no AE covered them
  // before). SR industries have NO matching implication.
  // Best effort: never fail the industries update because of this.
  if (targetRole === "account_executive" && normalized.length > 0) {
    try {
      await rematchOpenSharedInboxLeads({
        industries: normalized,
        triggeredBy: guard.userId,
      })
    } catch (err) {
      console.error("[v0] rematchOpenSharedInboxLeads failed after industries update:", err)
    }
  }

  return { ok: true }
}

// ============================================================================
// Create staff account (username + password, provisioned directly)
// ============================================================================

// Internal roles that can be provisioned (not client). super_admin is
// handled separately because only a super_admin may mint one.
const INTERNAL_ROLES: Role[] = [
  "admin",
  "account_executive",
  "lead_researcher",
  "supplier_researcher",
  "finance",
]

export interface CreateStaffAccountInput {
  /** Login username, 3–30 lowercase chars (validated here). */
  username: string
  /** Initial password chosen by the admin. Not force-rotated on first login. */
  password: string
  full_name: string
  role: Role
  /**
   * Optional real mailbox for system notifications. The account still
   * logs in with its username; this is never used as an auth identifier.
   */
  contact_email?: string
  /**
   * All industries the AE/SR covers, in priority order — [0] is primary.
   * Required for account_executive (AI matching hard-filter), optional
   * for supplier_researcher (sourcing-board patch).
   */
  industries?: string[]
}

export interface CreateStaffAccountResult {
  ok: boolean
  userId?: string
  username?: string
  /** Auto-generated personal sender address, if this role gets one. */
  workEmail?: string | null
  error?: string
}

/**
 * Provision an internal team member directly — no invite email, no
 * self-set-password step. The super admin hands the username + password
 * to the employee out of band.
 *
 * Flow:
 *   1. Validate username / password / role / industries + caller caps
 *   2. Create the auth user keyed by a synthetic staff email
 *      (`<username>@staff.veximtrade.com`, see lib/auth/staff-login.ts),
 *      email_confirm=true so no confirmation mail is ever sent
 *   3. The handle_new_user trigger opens a profile row; we then fill it
 *      with the real role, username, industries and optional contact email
 *   4. Reserve a personal sender address for buyer-facing roles
 *
 * Security:
 *   - Requires USERS_MANAGE (admin + super_admin).
 *   - Only super_admin may create admin or super_admin accounts.
 */
export async function createStaffAccount(
  input: CreateStaffAccountInput,
): Promise<CreateStaffAccountResult> {
  // ---- 1. Validate input ----------------------------------------------------
  const username = normalizeUsername(input.username)
  const fullName = input.full_name?.trim()
  const password = input.password ?? ""
  const role = input.role
  const contactEmail = input.contact_email?.trim().toLowerCase() || null

  if (!isValidUsername(username)) {
    return { ok: false, error: "invalid_username" }
  }
  if (password.length < STAFF_PASSWORD_MIN_LENGTH) {
    return { ok: false, error: "weak_password" }
  }
  if (!fullName) {
    return { ok: false, error: "full_name_required" }
  }
  if (!INTERNAL_ROLES.includes(role) && role !== "super_admin") {
    return { ok: false, error: "invalid_role" }
  }
  if (
    contactEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)
  ) {
    return { ok: false, error: "invalid_contact_email" }
  }

  // Same industry rules as the old invite flow: required for AE,
  // optional for SR.
  const industries: string[] = []
  if (role === "account_executive" || role === "supplier_researcher") {
    for (const raw of input.industries ?? []) {
      const n = normalizeIndustry(raw)
      if (!n) {
        return { ok: false, error: "invalid_industry" }
      }
      if (!industries.includes(n)) {
        industries.push(n)
      }
    }
    if (role === "account_executive" && industries.length === 0) {
      return { ok: false, error: "invalid_industry" }
    }
  }

  // ---- 2. Check caller permissions ------------------------------------------
  const guard = await requireCap(CAPS.USERS_MANAGE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin, role: callerRole, userId: callerId } = guard

  if ((role === "admin" || role === "super_admin") && callerRole !== "super_admin") {
    return { ok: false, error: "super_admin_only" }
  }

  // ---- 3. Uniqueness checks -------------------------------------------------
  const { data: existingUsername } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle()
  if (existingUsername) {
    return { ok: false, error: "username_taken" }
  }

  if (contactEmail) {
    const { data: existingEmail } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", contactEmail)
      .maybeSingle()
    if (existingEmail) {
      return { ok: false, error: "email_exists" }
    }
  }

  const authEmail = staffAuthEmail(username)

  // ---- 4. Create the auth user directly with the chosen password -----------
  const { data: createData, error: createErr } = await admin.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
    user_metadata: {
      role,
      full_name: fullName,
      username,
      staff: true,
    },
  })

  if (createErr || !createData?.user) {
    const msg = createErr?.message ?? "create_failed"
    console.error("[v0] createStaffAccount: auth createUser failed:", createErr)
    if (/already|exists|registered|taken/i.test(msg)) {
      return { ok: false, error: "username_taken" }
    }
    if (/password/i.test(msg)) {
      return { ok: false, error: "weak_password" }
    }
    if (/rate limit/i.test(msg)) {
      return { ok: false, error: "rate_limited" }
    }
    return { ok: false, error: msg }
  }

  const newUserId = createData.user.id

  // ---- 4a. Belt-and-braces: force the email confirmed state ---------------
  // Some GoTrue configurations ignore `email_confirm` on POST admin/users
  // (custom auth hooks / older releases), which leaves the account able to
  // be created but unable to sign in ("Email not confirmed"). The PUT
  // admin/users/:id endpoint with email_confirm=true always stamps
  // email_confirmed_at; re-read the user and verify it actually took.
  if (!createData.user.email_confirmed_at) {
    const { data: confirmData, error: confirmErr } =
      await admin.auth.admin.updateUserById(newUserId, { email_confirm: true })

    if (confirmErr) {
      console.error("[v0] createStaffAccount: email confirm failed:", confirmErr)
      await admin.auth.admin.deleteUser(newUserId)
      return { ok: false, error: "confirm_failed" }
    }

    if (!confirmData?.user?.email_confirmed_at) {
      console.error(
        "[v0] createStaffAccount: email still unconfirmed after update",
        { userId: newUserId },
      )
      await admin.auth.admin.deleteUser(newUserId)
      return { ok: false, error: "confirm_failed" }
    }
  }

  // ---- 4b. Personal buyer-facing sender address (same roles as before) -----
  const workEmail = ROLES_NEEDING_WORK_EMAIL.includes(role)
    ? await reserveWorkEmail(fullName)
    : null

  // ---- 5. Fill the profile row (trigger already opened a bare one) ---------
  const { error: profileErr } = await admin
    .from("profiles")
    .upsert(
      {
        id: newUserId,
        username,
        // Auth email stays synthetic; store the optional real notification
        // mailbox (or NULL — never the synthetic address).
        email: contactEmail,
        role,
        full_name: fullName,
        industries: industries.length > 0 ? industries : [],
        work_email: workEmail,
      },
      { onConflict: "id" },
    )

  if (profileErr) {
    console.error("[v0] createStaffAccount: profile upsert failed:", profileErr)
    await admin.auth.admin.deleteUser(newUserId)
    return { ok: false, error: profileErr.message }
  }

  // ---- 6. Audit trail (best-effort) ----------------------------------------
  try {
    await admin.from("activities").insert({
      opportunity_id: null,
      action_type: "team_member_created",
      description: JSON.stringify({
        new_user_id: newUserId,
        username,
        contact_email: contactEmail,
        full_name: fullName,
        role,
        industries: industries.length > 0 ? industries : undefined,
        work_email: workEmail ?? undefined,
        created_by_role: callerRole,
      }),
      performed_by: callerId,
    })
  } catch (auditErr) {
    console.error("[v0] createStaffAccount: audit log failed:", auditErr)
  }

  revalidatePath("/admin/users")

  // A new AE covering these industries may unblock buyers stranded in the
  // shared inbox (same behaviour the invite flow had). SR industries have
  // no matching implication. Best effort — never fail creation for this.
  if (role === "account_executive" && industries.length > 0) {
    try {
      await rematchOpenSharedInboxLeads({
        industries,
        triggeredBy: callerId,
      })
    } catch (err) {
      console.error("[v0] rematchOpenSharedInboxLeads failed after staff create:", err)
    }
  }

  return { ok: true, userId: newUserId, username, workEmail }
}

// ============================================================================
// Reset staff password (admin-performed — username accounts can't use the
// email-based "forgot password" flow)
// ============================================================================

export interface ResetStaffPasswordResult {
  ok: boolean
  error?: string
}

export async function resetStaffPassword(
  userId: string,
  newPassword: string,
): Promise<ResetStaffPasswordResult> {
  const password = newPassword ?? ""
  if (password.length < STAFF_PASSWORD_MIN_LENGTH) {
    return { ok: false, error: "weak_password" }
  }

  const guard = await requireCap(CAPS.USERS_MANAGE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin, userId: callerId, role: callerRole } = guard

  if (callerId === userId) {
    // Admins change their own password through the authenticated
    // change-password / reset-link flow, not this override.
    return { ok: false, error: "cannotChangeSelf" }
  }

  const { data: target } = await admin
    .from("profiles")
    .select("role, username")
    .eq("id", userId)
    .single<{ role: string | null; username: string | null }>()

  if (!target) return { ok: false, error: "not_found" }

  const targetRole = normaliseRole(target.role)
  if (targetRole === "client") {
    // Clients keep the email-based reset flow; no admin override.
    return { ok: false, error: "invalid_target" }
  }
  if (
    (targetRole === "admin" || targetRole === "super_admin") &&
    callerRole !== "super_admin"
  ) {
    return { ok: false, error: "super_admin_only" }
  }

  // email_confirm:true heals accounts stuck in "Email not confirmed"
  // (e.g. created before the confirmation hardening shipped).
  const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
  })
  if (updateErr) {
    console.error("[v0] resetStaffPassword failed:", updateErr)
    if (/password/i.test(updateErr.message)) {
      return { ok: false, error: "weak_password" }
    }
    return { ok: false, error: updateErr.message }
  }

  try {
    await admin.from("activities").insert({
      opportunity_id: null,
      action_type: "team_password_reset",
      description: JSON.stringify({
        target_user_id: userId,
        target_username: target.username,
        target_role: targetRole,
        reset_by_role: callerRole,
      }),
      performed_by: callerId,
    })
  } catch (auditErr) {
    console.error("[v0] resetStaffPassword: audit log failed:", auditErr)
  }

  revalidatePath("/admin/users")
  return { ok: true }
}
