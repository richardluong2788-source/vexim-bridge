/**
 * Shared server-action guard — wraps the "get user + load profile + check
 * capability" dance that was duplicated across 8 server-action files.
 *
 * Usage inside a server action:
 *
 *   import { requireCap } from "@/lib/auth/guard"
 *   import { CAPS } from "@/lib/auth/permissions"
 *
 *   const guard = await requireCap(CAPS.INVOICE_WRITE)
 *   if (!guard.ok) return { ok: false, error: guard.error }
 *   const { admin, userId, role } = guard
 *
 * `admin` is a service-role Supabase client (bypasses RLS) — all writes go
 * through it after the capability check has already been enforced here.
 */
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { can, canAll, canAny, normaliseRole, type Capability } from "@/lib/auth/permissions"
import type { Role } from "@/lib/supabase/types"

type AdminSB = ReturnType<typeof createAdminClient>

export interface GuardSuccess {
  ok: true
  userId: string
  role: Role
  admin: AdminSB
}

export interface GuardFailure {
  ok: false
  error: "unauthenticated" | "forbidden"
}

export type GuardResult = GuardSuccess | GuardFailure

/**
 * Core resolver — returns the current authenticated user + their normalised
 * role. Uses the service-role client for the profile lookup to avoid an
 * RLS recursion on `profiles`.
 */
async function resolveCurrent(): Promise<
  | { ok: true; userId: string; role: Role; admin: AdminSB }
  | { ok: false; error: "unauthenticated" | "forbidden" }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "unauthenticated" }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single<{ id: string; role: string | null }>()

  const role = normaliseRole(profile?.role)
  if (!role) return { ok: false, error: "forbidden" }

  return { ok: true, userId: user.id, role, admin }
}

/**
 * Require that the current user has the given capability.
 * Returns a discriminated union — callers must narrow on `ok`.
 */
export async function requireCap(cap: Capability): Promise<GuardResult> {
  const base = await resolveCurrent()
  if (!base.ok) return base
  if (!can(base.role, cap)) return { ok: false, error: "forbidden" }
  return base
}

/** Require ALL given capabilities (AND). */
export async function requireAllCaps(caps: Capability[]): Promise<GuardResult> {
  const base = await resolveCurrent()
  if (!base.ok) return base
  if (!canAll(base.role, caps)) return { ok: false, error: "forbidden" }
  return base
}

/** Require ANY of the given capabilities (OR). */
export async function requireAnyCap(caps: Capability[]): Promise<GuardResult> {
  const base = await resolveCurrent()
  if (!base.ok) return base
  if (!canAny(base.role, caps)) return { ok: false, error: "forbidden" }
  return base
}

/**
 * Just get the current user + role, with no capability check. Use this for
 * pages / layouts that need to branch UI without blocking access entirely.
 */
export async function getCurrentRole(): Promise<
  | { userId: string; role: Role; admin: AdminSB }
  | null
> {
  const base = await resolveCurrent()
  if (!base.ok) return null
  return { userId: base.userId, role: base.role, admin: base.admin }
}
