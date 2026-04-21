"use server"

/**
 * Server actions for /admin/users.
 *
 * Responsibilities:
 *   - updateUserRole: change another user's role (admin + super_admin only)
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
import type { Role } from "@/lib/supabase/types"

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
    .select("role")
    .eq("id", userId)
    .single<{ role: string | null }>()
  const targetRole = normaliseRole(target?.role)
  if (targetRole === "super_admin" && callerRole !== "super_admin") {
    return { ok: false, error: "superAdminOnly" }
  }

  const { error: profileErr } = await admin
    .from("profiles")
    .update({ role: newRole })
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
