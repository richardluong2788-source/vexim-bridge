"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { normaliseRole } from "@/lib/auth/permissions"
import { ownershipScopeFor, assertClientOwned } from "@/lib/auth/scope"

export interface UpdateFdaResult {
  ok: boolean
  error?: string
}

export interface UpdateFdaInput {
  clientId: string
  /** Facility Registration Number. Empty string or null clears the value. */
  fdaNumber: string | null
  /** ISO date (YYYY-MM-DD) or null to clear. */
  registeredAt: string | null
  /** ISO date (YYYY-MM-DD) or null to clear. */
  expiresAt: string | null
}

/**
 * Update the FDA registration number + validity window for a client profile.
 *
 * Security:
 *   - Caller must be authenticated AND have role admin/staff.
 *   - The target user must have role `client` (admins cannot overwrite
 *     another admin/staff FDA field by accident).
 *   - Service-role client is used for the UPDATE, but only AFTER the caller's
 *     role has been verified through a normal (RLS-enforced) read.
 *
 * Side effects:
 *   - `fda_renewal_notified_at` is reset to NULL whenever the validity window
 *     changes, so the expiry cron will notify again on the next renewal
 *     instead of staying silent due to a stale "already notified" flag.
 */
export async function updateFdaRegistration(
  input: UpdateFdaInput,
): Promise<UpdateFdaResult> {
  // --- Normalize + validate number ---------------------------------------
  const normalized =
    typeof input.fdaNumber === "string" && input.fdaNumber.trim().length > 0
      ? input.fdaNumber.trim()
      : null

  if (normalized !== null) {
    if (normalized.length < 3 || normalized.length > 32) {
      return { ok: false, error: "invalidLength" }
    }
    if (!/^[A-Za-z0-9\-]+$/.test(normalized)) {
      return { ok: false, error: "invalidFormat" }
    }
  }

  // --- Normalize + validate dates ----------------------------------------
  const registeredAt = normalizeIsoDate(input.registeredAt)
  const expiresAt = normalizeIsoDate(input.expiresAt)

  if (input.registeredAt && !registeredAt) {
    return { ok: false, error: "invalidRegisteredAt" }
  }
  if (input.expiresAt && !expiresAt) {
    return { ok: false, error: "invalidExpiresAt" }
  }
  if (registeredAt && expiresAt && expiresAt < registeredAt) {
    return { ok: false, error: "expiresBeforeRegistered" }
  }
  // If the client provided an FDA number, dates are strongly recommended.
  // We don't hard-enforce here — admins sometimes only know the number.

  // --- AuthZ --------------------------------------------------------------
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "notAuthenticated" }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (
    !callerProfile ||
    !["admin", "staff", "super_admin", "account_executive", "lead_researcher", "finance"].includes(
      callerProfile.role,
    )
  ) {
    return { ok: false, error: "forbidden" }
  }

  const admin = createAdminClient()
  const { data: target, error: targetErr } = await admin
    .from("profiles")
    .select("id, role, fda_registered_at, fda_expires_at, account_manager_id")
    .eq("id", input.clientId)
    .single()

  if (targetErr || !target) return { ok: false, error: "notFound" }
  if (target.role !== "client") return { ok: false, error: "notAClient" }

  // Ownership gate (035): scoped users can only edit FDA for their own
  // clients. Bypass roles (super_admin/admin/finance) skip the check.
  {
    const role = normaliseRole(callerProfile.role)
    if (role) {
      const scope = ownershipScopeFor(role, user.id)
      const own = await assertClientOwned(scope, admin, input.clientId)
      if (!own.ok) return { ok: false, error: own.error }
    }
  }

  // --- Reset notification flag if the validity window changed ------------
  const windowChanged =
    target.fda_registered_at !== registeredAt ||
    target.fda_expires_at !== expiresAt

  const { error: updateErr } = await admin
    .from("profiles")
    .update({
      fda_registration_number: normalized,
      fda_registered_at: registeredAt,
      fda_expires_at: expiresAt,
      // Only wipe the notify marker when dates actually changed — preserves
      // dedup behavior when admin just corrects a typo in the number.
      ...(windowChanged ? { fda_renewal_notified_at: null } : {}),
    })
    .eq("id", input.clientId)

  if (updateErr) {
    return { ok: false, error: updateErr.message }
  }

  revalidatePath("/admin/clients")
  revalidatePath("/admin/leads/new")
  revalidatePath("/client")
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Update client country
// ---------------------------------------------------------------------------

export interface UpdateClientCountryResult {
  ok: boolean
  error?: string
}

/**
 * Update the client's (supplier's) own country.
 *
 * This powers calculateCountryMatch() in lib/matching/scorer.ts — the AE
 * auto-assignment engine checks whether an AE already manages a client
 * based in the buyer's country. Free text, same convention as
 * `leads.country` (see 007_sprint_a_risk_swift.sql).
 */
export async function updateClientCountry(
  clientId: string,
  country: string | null,
): Promise<UpdateClientCountryResult> {
  const normalized = typeof country === "string" ? country.trim() || null : null

  // --- AuthZ --------------------------------------------------------------
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "notAuthenticated" }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (
    !callerProfile ||
    !["admin", "staff", "super_admin", "account_executive", "lead_researcher", "finance"].includes(
      callerProfile.role,
    )
  ) {
    return { ok: false, error: "forbidden" }
  }

  const admin = createAdminClient()
  const { data: target, error: targetErr } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", clientId)
    .single()

  if (targetErr || !target) return { ok: false, error: "notFound" }
  if (target.role !== "client") return { ok: false, error: "notAClient" }

  // Ownership gate — scoped users can only edit clients they manage.
  {
    const role = normaliseRole(callerProfile.role)
    if (role) {
      const scope = ownershipScopeFor(role, user.id)
      const own = await assertClientOwned(scope, admin, clientId)
      if (!own.ok) return { ok: false, error: own.error }
    }
  }

  const { error: updateErr } = await admin
    .from("profiles")
    .update({ country: normalized })
    .eq("id", clientId)

  if (updateErr) {
    return { ok: false, error: updateErr.message }
  }

  revalidatePath("/admin/clients")
  revalidatePath(`/admin/clients/${clientId}`)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Update client login email
// ---------------------------------------------------------------------------

export interface UpdateClientEmailResult {
  ok: boolean
  error?: string
}

/**
 * Update a client's login email.
 *
 * Updates BOTH `auth.users` (via the admin API, so the client can actually
 * sign in with the new address) and `profiles.email` (so the clients table /
 * client-card / AI email generator stay in sync) — these two must never
 * drift apart.
 *
 * Security:
 *   - Caller must be authenticated AND have role admin/staff/super_admin/
 *     account_executive/lead_researcher/finance (same list as the other
 *     client-editing actions on this page).
 *   - Target must have role `client`.
 *   - Ownership gate: scoped users (AE/Lead Researcher) can only edit
 *     clients assigned to them.
 */
export async function updateClientEmail(
  clientId: string,
  email: string,
): Promise<UpdateClientEmailResult> {
  const normalized = email.trim().toLowerCase()
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { ok: false, error: "invalidEmail" }
  }

  // --- AuthZ --------------------------------------------------------------
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "notAuthenticated" }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (
    !callerProfile ||
    !["admin", "staff", "super_admin", "account_executive", "lead_researcher", "finance"].includes(
      callerProfile.role,
    )
  ) {
    return { ok: false, error: "forbidden" }
  }

  const admin = createAdminClient()
  const { data: target, error: targetErr } = await admin
    .from("profiles")
    .select("id, role, email")
    .eq("id", clientId)
    .single()

  if (targetErr || !target) return { ok: false, error: "notFound" }
  if (target.role !== "client") return { ok: false, error: "notAClient" }

  // Ownership gate — scoped users can only edit clients they manage.
  {
    const role = normaliseRole(callerProfile.role)
    if (role) {
      const scope = ownershipScopeFor(role, user.id)
      const own = await assertClientOwned(scope, admin, clientId)
      if (!own.ok) return { ok: false, error: own.error }
    }
  }

  if (normalized === target.email) {
    return { ok: true }
  }

  // --- Update the auth user first — this is what the client actually
  // signs in with, and it's the one that can fail with "email_exists".
  const { error: authErr } = await admin.auth.admin.updateUserById(clientId, {
    email: normalized,
    email_confirm: true,
  })

  if (authErr) {
    if (/already|exists|registered/i.test(authErr.message)) {
      return { ok: false, error: "emailExists" }
    }
    return { ok: false, error: authErr.message }
  }

  const { error: profileErr } = await admin
    .from("profiles")
    .update({ email: normalized })
    .eq("id", clientId)

  if (profileErr) {
    // Best-effort rollback so auth + profile don't drift apart.
    await admin.auth.admin.updateUserById(clientId, { email: target.email ?? undefined })
    return { ok: false, error: profileErr.message }
  }

  revalidatePath("/admin/clients")
  revalidatePath(`/admin/clients/${clientId}`)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Delete client
// ---------------------------------------------------------------------------

export interface DeleteClientResult {
  ok: boolean
  error?: string
}

/**
 * Permanently deletes a client profile from the system.
 * Only super_admin is allowed to perform this action.
 */
export async function deleteClient(clientId: string): Promise<DeleteClientResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { ok: false, error: "unauthenticated" }

  const { data: callerRaw } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  const caller = callerRaw as { role: string } | null

  if (caller?.role !== "super_admin") {
    return { ok: false, error: "forbidden" }
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from("profiles")
    .delete()
    .eq("id", clientId)
    .eq("role", "client")

  if (error) return { ok: false, error: error.message }

  revalidatePath("/admin/clients")
  return { ok: true }
}

/**
 * Accepts `YYYY-MM-DD` (what <input type="date"> emits). Returns `null` for
 * empty/invalid input, or the cleaned-up ISO date string.
 */
function normalizeIsoDate(v: string | null | undefined): string | null {
  if (!v || typeof v !== "string") return null
  const trimmed = v.trim()
  if (trimmed.length === 0) return null
  // Strict YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  const d = new Date(`${trimmed}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  return trimmed
}
