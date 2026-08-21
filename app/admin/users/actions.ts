"use server"

/**
 * Server actions for /admin/users.
 *
 * Responsibilities:
 *   - updateUserRole: change another user's role (admin + super_admin only)
 *   - inviteTeamMember: invite internal staff (AE, LR, Finance, Admin)
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
import { createAdminClient } from "@/lib/supabase/admin"
import { CAPS, normaliseRole } from "@/lib/auth/permissions"
import { siteConfig } from "@/lib/site-config"
import { INDUSTRIES, normalizeIndustry } from "@/lib/constants/industries"
import { reserveWorkEmail } from "@/lib/email/work-email"
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
// Update AE Industry
// ============================================================================

export interface UpdateIndustryResult {
  ok: boolean
  error?: string
}

/**
 * Update an Account Executive's primary industry.
 *
 * The AI matching hard-filter only scores AEs whose industry matches the
 * buyer's industry, so this is the lever admins use to decide which AE
 * covers which vertical. Restricted to account_executive targets only.
 */
export async function updateUserIndustry(
  userId: string,
  industry: string,
): Promise<UpdateIndustryResult> {
  const normalized = normalizeIndustry(industry)
  if (!normalized) {
    return { ok: false, error: "invalid_industry" }
  }

  const guard = await requireCap(CAPS.USERS_ASSIGN_ROLE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin } = guard

  const { data: target } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single<{ role: string | null }>()

  if (normaliseRole(target?.role) !== "account_executive") {
    return { ok: false, error: "invalid_role" }
  }

  const { error } = await admin
    .from("profiles")
    .update({ industry: normalized })
    .eq("id", userId)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath("/admin/users")
  return { ok: true }
}

// ============================================================================
// Invite Team Member
// ============================================================================

// Internal roles that can be invited (not client)
const INTERNAL_ROLES: Role[] = [
  "admin",
  "account_executive",
  "lead_researcher",
  "finance",
]

export interface InviteTeamMemberInput {
  email: string
  full_name: string
  role: Role
  /**
   * Primary industry the AE will cover. Required for account_executive —
   * the AI matching hard-filter only ever scores AEs whose industry
   * matches the buyer's, so an AE invited without one would never receive
   * any buyer via matching.
   */
  industry?: string
}

export interface InviteTeamMemberResult {
  ok: boolean
  userId?: string
  error?: string
  /** Auto-generated personal sender address, if this role gets one — surface
   * it to the admin so they know which mailbox to create in Zoho Mail. */
  workEmail?: string | null
}

/**
 * Invite a new internal team member (AE, LR, Finance, Admin).
 *
 * Flow:
 *   1. Validate input and check caller permissions
 *   2. Use service-role to invite via Supabase Auth
 *   3. Create profile with the specified role
 *   4. User receives email, clicks link, sets password
 *   5. User enters system with correct role immediately
 *
 * Security:
 *   - Only users with USERS_ASSIGN_ROLE can invite
 *   - Only super_admin can invite admin or super_admin roles
 */
export async function inviteTeamMember(
  input: InviteTeamMemberInput,
): Promise<InviteTeamMemberResult> {
  // ---- 1. Validate input ----------------------------------------------------
  const email = input.email?.trim().toLowerCase()
  const fullName = input.full_name?.trim()
  const role = input.role

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "invalid_email" }
  }
  if (!fullName) {
    return { ok: false, error: "full_name_required" }
  }
  if (!INTERNAL_ROLES.includes(role) && role !== "super_admin") {
    return { ok: false, error: "invalid_role" }
  }

  // Account Executives are hard-gated by industry in AI matching — an AE
  // with no industry would never be scored for any buyer, so require one.
  const industry = role === "account_executive" ? normalizeIndustry(input.industry) : null
  if (role === "account_executive" && !industry) {
    return { ok: false, error: "invalid_industry" }
  }

  // ---- 2. Check caller permissions ------------------------------------------
  const guard = await requireCap(CAPS.USERS_ASSIGN_ROLE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin, role: callerRole } = guard

  // Only super_admin can create admin or super_admin
  if ((role === "admin" || role === "super_admin") && callerRole !== "super_admin") {
    return { ok: false, error: "super_admin_only" }
  }

  // ---- 3. Invite via Supabase Auth ------------------------------------------
  const { data: inviteData, error: inviteErr } =
    await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        role,
        full_name: fullName,
      },
      redirectTo: `${siteConfig.url}/auth/accept-invite`,
    })

  if (inviteErr || !inviteData?.user) {
    const msg = inviteErr?.message ?? "invite_failed"
    if (/already/i.test(msg)) return { ok: false, error: "email_exists" }
    return { ok: false, error: msg }
  }

  const newUserId = inviteData.user.id

  // ---- 3b. Auto-generate a personal work email for roles that send
  // buyer-facing email, so each person has a stable address the buyer's
  // mail provider learns to trust with their real name (see
  // lib/email/work-email.ts). A matching mailbox must still be created
  // manually in Zoho Mail for replies to actually be received.
  const workEmail = ROLES_NEEDING_WORK_EMAIL.includes(role)
    ? await reserveWorkEmail(fullName)
    : null

  // ---- 4. Create profile with role ------------------------------------------
  const { error: profileErr } = await admin
    .from("profiles")
    .upsert(
      {
        id: newUserId,
        role,
        email,
        full_name: fullName,
        industry,
        work_email: workEmail,
      },
      { onConflict: "id" },
    )

  if (profileErr) {
    // Rollback auth user
    await admin.auth.admin.deleteUser(newUserId)
    return { ok: false, error: profileErr.message }
  }

  // ---- 5. Audit trail -------------------------------------------------------
  const adminClient = createAdminClient()
  await adminClient.from("activities").insert({
    user_id: guard.userId,
    action: "team_member_invited",
    details: {
      new_user_id: newUserId,
      email,
      full_name: fullName,
      role,
      industry,
      work_email: workEmail,
      invited_by_role: callerRole,
    },
  })

  revalidatePath("/admin/users")

  return {
    ok: true,
    userId: newUserId,
    workEmail,
  }
}
