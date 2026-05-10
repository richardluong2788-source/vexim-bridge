/**
 * Operational data scope — single source of truth for the 5 day-to-day
 * pages (/admin, /admin/clients, /admin/pipeline, /admin/buyers,
 * /admin/activities).
 *
 * Rule (Sprint client-management-for-AE):
 *   - super_admin / admin / finance  → see ALL clients & deals
 *   - account_executive / lead_researcher / staff (legacy)
 *                                    → see ONLY rows tied to clients where
 *                                      profiles.account_manager_id = themselves
 *
 * This mirrors the analytics ClientScope helper in lib/analytics/queries.ts;
 * we keep them separate because analytics pages enforce it via the
 * ANALYTICS_VIEW_ALL / VIEW_OWN capabilities, while the operational pages
 * derive scope purely from role.
 *
 * Server-only — every caller has already passed through getCurrentRole()
 * or requireCap(), so we trust the `role` argument here.
 */
import type { Role } from "@/lib/supabase/types"
import type { createAdminClient } from "@/lib/supabase/admin"

type AdminSB = ReturnType<typeof createAdminClient>

export type OperationalScope =
  | { kind: "all" }
  | { kind: "owned"; managerId: string }

/**
 * Roles that are restricted to the clients they personally manage on the
 * operational pages. Keep this list small and explicit — every other role
 * defaults to full visibility.
 */
const SCOPED_ROLES: readonly Role[] = [
  "account_executive",
  "lead_researcher",
  "staff", // legacy — treated as AE
]

/** Decide the scope based on the caller's role. */
export function getOperationalScope(
  role: Role,
  userId: string,
): OperationalScope {
  return SCOPED_ROLES.includes(role)
    ? { kind: "owned", managerId: userId }
    : { kind: "all" }
}

/** True iff the role only sees rows tied to its own managed clients. */
export function isScopedRole(role: Role): boolean {
  return SCOPED_ROLES.includes(role)
}

/**
 * Resolve the list of client_ids the current user is allowed to see.
 * Returns `null` for "all clients" so callers can skip the .in() filter
 * for unscoped roles (cheaper query).
 *
 * Returns `[]` when the user is scoped but manages zero clients — callers
 * MUST treat this as "no rows" (do not omit the filter).
 */
export async function resolveScopedClientIds(
  admin: AdminSB,
  scope: OperationalScope,
): Promise<string[] | null> {
  if (scope.kind === "all") return null
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "client")
    .eq("account_manager_id", scope.managerId)
  return (data ?? []).map((r: { id: string }) => r.id)
}
