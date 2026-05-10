/**
 * Ownership guards for the operational mutation surface.
 *
 * Background — Sprint client-management-for-AE
 * --------------------------------------------
 *   Capability checks (lib/auth/permissions.ts) decide *what* a role is
 *   allowed to do. They do NOT decide *which row* the caller is allowed
 *   to touch. AE / Lead Researcher have e.g. CLIENT_WRITE, but they may
 *   only modify the clients they were assigned as `account_manager_id`.
 *
 *   These helpers run AFTER `requireCap()` (capability gate) and BEFORE
 *   the actual UPDATE/INSERT, returning a discriminated union the caller
 *   narrows on `ok`.
 *
 *   Roles in `SCOPED_ROLES` (lib/auth/scope.ts) are subject to ownership;
 *   admin / super_admin / finance always pass.
 *
 * Usage
 * -----
 *   const guard = await requireCap(CAPS.DEAL_QUANTITY_WRITE)
 *   if (!guard.ok) return { ok: false, error: guard.error }
 *   const own = await assertOpportunityOwnership(
 *     guard.admin, guard.role, guard.userId, opportunityId,
 *   )
 *   if (!own.ok) return { ok: false, error: own.error }
 */
import type { Role } from "@/lib/supabase/types"
import type { createAdminClient } from "@/lib/supabase/admin"
import { isScopedRole } from "@/lib/auth/scope"

type AdminSB = ReturnType<typeof createAdminClient>

export type OwnershipResult =
  | { ok: true; clientId: string; managerId: string | null }
  | { ok: false; error: "notFound" | "forbidden" }

/**
 * Caller is allowed to mutate this opportunity iff:
 *   - role is unscoped (admin / super_admin / finance / client) — always pass.
 *   - role is scoped (AE / lead_researcher / staff) AND the opportunity's
 *     client has account_manager_id = userId.
 *
 * Returns the resolved client_id + managerId for downstream snapshot usage
 * (e.g. seeding `deals.account_manager_at_won` in updateOpportunityStage).
 */
export async function assertOpportunityOwnership(
  admin: AdminSB,
  role: Role,
  userId: string,
  opportunityId: string,
): Promise<OwnershipResult> {
  const { data } = await admin
    .from("opportunities")
    .select("client_id, profiles:client_id ( account_manager_id )")
    .eq("id", opportunityId)
    .single<{
      client_id: string
      profiles: { account_manager_id: string | null } | null
    }>()

  if (!data) return { ok: false, error: "notFound" }
  const managerId = data.profiles?.account_manager_id ?? null

  if (!isScopedRole(role)) {
    return { ok: true, clientId: data.client_id, managerId }
  }
  if (managerId === userId) {
    return { ok: true, clientId: data.client_id, managerId }
  }
  return { ok: false, error: "forbidden" }
}

/**
 * Caller is allowed to mutate this client profile iff:
 *   - role is unscoped — always pass.
 *   - role is scoped AND target's account_manager_id = userId.
 *
 * Also asserts the target row has role = 'client' so admins (and AE) can't
 * accidentally overwrite a staff member's profile via the wrong endpoint.
 */
export async function assertClientOwnership(
  admin: AdminSB,
  role: Role,
  userId: string,
  clientId: string,
): Promise<OwnershipResult> {
  const { data } = await admin
    .from("profiles")
    .select("id, role, account_manager_id")
    .eq("id", clientId)
    .single<{
      id: string
      role: string | null
      account_manager_id: string | null
    }>()

  if (!data) return { ok: false, error: "notFound" }
  if (data.role !== "client") return { ok: false, error: "forbidden" }

  const managerId = data.account_manager_id ?? null
  if (!isScopedRole(role)) {
    return { ok: true, clientId: data.id, managerId }
  }
  if (managerId === userId) {
    return { ok: true, clientId: data.id, managerId }
  }
  return { ok: false, error: "forbidden" }
}

/**
 * Boolean variant of `assertClientOwnership` used by callers that only
 * need a yes/no decision (e.g. compliance doc upload / share / revoke).
 *
 * Returns `false` for missing rows, role-mismatch, and ownership
 * failures. Returns `true` for unscoped roles regardless of who manages
 * the client.
 */
export async function canActOnClient(
  admin: AdminSB,
  role: Role,
  userId: string,
  clientId: string,
): Promise<boolean> {
  const result = await assertClientOwnership(admin, role, userId, clientId)
  return result.ok
}
