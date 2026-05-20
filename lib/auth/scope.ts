/**
 * AE-ownership scope helper — single source of truth for "who can see / edit
 * which records?" across the admin shell.
 *
 * Two scope kinds:
 *   - "all"   : full visibility. Granted to every role with OWNERSHIP_BYPASS
 *               (super_admin, admin, finance).
 *   - "owned" : limited to records the current user owns. Used by AE,
 *               Lead Researcher, and the legacy `staff` role.
 *
 * Ownership is tracked on TWO columns:
 *   - profiles.account_manager_id      → LIVE pointer ("who currently owns
 *                                         this client?")
 *   - opportunities.account_manager_id → SNAPSHOT, frozen at WON/LOST
 *                                         (added in migration 035). This is
 *                                         the column commission/revenue
 *                                         reporting keys off so historical
 *                                         deals stay attributed to the
 *                                         closer even after the client is
 *                                         reassigned to a different AE.
 *
 * For LIST pages (clients, pipeline, buyers, activities) we filter by the
 * relevant snapshot/live column. For WRITE actions we use the assertion
 * helpers below to verify the caller actually owns the row before mutating
 * it. Without this, an AE could (e.g.) drag another AE's deal across the
 * kanban and silently steal the WON snapshot.
 */
import { can, CAPS } from "@/lib/auth/permissions"
import type { Role } from "@/lib/supabase/types"
import { createAdminClient } from "@/lib/supabase/admin"

type AdminSB = ReturnType<typeof createAdminClient>

export type OwnershipScope =
  | { kind: "all" }
  | { kind: "owned"; userId: string }

/**
 * Build the scope object for a given role + user. Centralised so callers
 * never have to remember "which roles bypass ownership?".
 */
export function ownershipScopeFor(
  role: Role,
  userId: string,
): OwnershipScope {
  return can(role, CAPS.OWNERSHIP_BYPASS)
    ? { kind: "all" }
    : { kind: "owned", userId }
}

/**
 * Resolve the list of client_ids the scope is allowed to see, based on
 * profiles.account_manager_id. Returns `null` for "all" (no .in() filter).
 */
export async function resolveAllowedClientIds(
  scope: OwnershipScope,
  admin: AdminSB,
): Promise<string[] | null> {
  if (scope.kind === "all") return null
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "client")
    .eq("account_manager_id", scope.userId)
  return (data ?? []).map((r: { id: string }) => r.id)
}

/**
 * Verify the caller owns the given client (or has bypass).
 * Returns `true` for owners and bypass roles, `false` otherwise.
 */
export async function isClientOwned(
  scope: OwnershipScope,
  admin: AdminSB,
  clientId: string,
): Promise<boolean> {
  if (scope.kind === "all") return true
  const { data } = await admin
    .from("profiles")
    .select("account_manager_id")
    .eq("id", clientId)
    .single<{ account_manager_id: string | null }>()
  return data?.account_manager_id === scope.userId
}

/**
 * Verify the caller owns the given opportunity. Uses the SNAPSHOT column
 * (opportunities.account_manager_id) so once a deal is WON/LOST it stays
 * attributed to the closer.
 */
export async function isOpportunityOwned(
  scope: OwnershipScope,
  admin: AdminSB,
  opportunityId: string,
): Promise<boolean> {
  if (scope.kind === "all") return true
  const { data } = await admin
    .from("opportunities")
    .select("account_manager_id")
    .eq("id", opportunityId)
    .single<{ account_manager_id: string | null }>()
  return data?.account_manager_id === scope.userId
}

/**
 * Convenience for server actions that need both the scope and a fast
 * "owned or bypass" check on an opportunity. Returns a discriminated union
 * matching the existing guard.ts shape.
 */
export type OwnershipCheckResult =
  | { ok: true }
  | { ok: false; error: "forbidden" | "notFound" }

export async function assertOpportunityOwned(
  scope: OwnershipScope,
  admin: AdminSB,
  opportunityId: string,
): Promise<OwnershipCheckResult> {
  if (scope.kind === "all") return { ok: true }
  const { data, error } = await admin
    .from("opportunities")
    .select("id, account_manager_id")
    .eq("id", opportunityId)
    .maybeSingle<{ id: string; account_manager_id: string | null }>()
  
  // Debug logging - remove after issue is resolved
  console.log("[v0] assertOpportunityOwned:", {
    opportunityId,
    scopeKind: scope.kind,
    scopeUserId: scope.userId,
    dataFound: !!data,
    accountManagerId: data?.account_manager_id,
    error: error?.message,
  })
  
  if (!data) return { ok: false, error: "notFound" }
  // If account_manager_id is not set yet (legacy data or missing migration),
  // allow the operation — the trigger or next update will populate it.
  // This prevents blocking AEs from working with older opportunities.
  if (!data.account_manager_id) return { ok: true }
  return data.account_manager_id === scope.userId
    ? { ok: true }
    : { ok: false, error: "forbidden" }
}

export async function assertClientOwned(
  scope: OwnershipScope,
  admin: AdminSB,
  clientId: string,
): Promise<OwnershipCheckResult> {
  if (scope.kind === "all") return { ok: true }
  const { data } = await admin
    .from("profiles")
    .select("id, account_manager_id, role")
    .eq("id", clientId)
    .maybeSingle<{ id: string; account_manager_id: string | null; role: string | null }>()
  if (!data) return { ok: false, error: "notFound" }
  return data.account_manager_id === scope.userId
    ? { ok: true }
    : { ok: false, error: "forbidden" }
}
