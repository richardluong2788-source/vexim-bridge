"use server"

/**
 * Sprint 3 — Account Manager assignment.
 *
 * Allows Admin / Super-Admin to set or unset `profiles.account_manager_id`
 * on a client. The chosen manager must be an internal staff role (admin,
 * super_admin, account_executive, lead_researcher, finance, staff).
 *
 * Why this matters
 * ----------------
 *   - AE / Lead Researcher have ANALYTICS_VIEW_OWN scope: the Analytics
 *     dashboard, monthly digest, and per-client performance card all key
 *     off this column to decide what they're allowed to see.
 *   - Without this UI, Super Admin had to run SQL by hand. Sprint 3 ships
 *     the inline dropdown on /admin/clients so non-technical operators
 *     can self-serve.
 *
 * Security
 * --------
 *   - Caller must have CLIENT_WRITE.
 *   - Target row must currently have role = 'client' (no overwriting
 *     another staff member's row by accident).
 *   - When `managerId` is non-null, the manager row must exist AND have
 *     a staff role. We block setting another client as manager.
 */
import { revalidatePath } from "next/cache"
import { requireCap } from "@/lib/auth/guard"
import { CAPS } from "@/lib/auth/permissions"
import type { Role } from "@/lib/supabase/types"

export interface SetAccountManagerResult {
  ok: boolean
  error?: string
}

const STAFF_ROLES: Role[] = [
  "super_admin",
  "admin",
  "account_executive",
  "lead_researcher",
  "finance",
  "staff",
]

export async function setAccountManager(
  clientId: string,
  managerId: string | null,
): Promise<SetAccountManagerResult> {
  if (!clientId || typeof clientId !== "string") {
    return { ok: false, error: "invalidClient" }
  }
  if (managerId !== null && typeof managerId !== "string") {
    return { ok: false, error: "invalidManager" }
  }

  const guard = await requireCap(CAPS.CLIENT_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin } = guard

  // Target must be a client row.
  const { data: target, error: targetErr } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", clientId)
    .single<{ id: string; role: string | null }>()

  if (targetErr || !target) return { ok: false, error: "notFound" }
  if (target.role !== "client") return { ok: false, error: "notAClient" }

  // Manager must be a real staff row (when set).
  if (managerId !== null) {
    const { data: manager, error: mgrErr } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", managerId)
      .single<{ id: string; role: string | null }>()

    if (mgrErr || !manager) return { ok: false, error: "managerNotFound" }
    if (!STAFF_ROLES.includes(manager.role as Role)) {
      return { ok: false, error: "managerNotStaff" }
    }
  }

  const { error: updErr } = await admin
    .from("profiles")
    .update({ account_manager_id: managerId })
    .eq("id", clientId)

  if (updErr) return { ok: false, error: updErr.message }

  revalidatePath("/admin/clients")
  revalidatePath(`/admin/clients/${clientId}`)
  revalidatePath("/admin/analytics")
  return { ok: true }
}
