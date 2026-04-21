"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

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

  if (!callerProfile || !["admin", "staff"].includes(callerProfile.role)) {
    return { ok: false, error: "forbidden" }
  }

  const admin = createAdminClient()
  const { data: target, error: targetErr } = await admin
    .from("profiles")
    .select("id, role, fda_registered_at, fda_expires_at")
    .eq("id", input.clientId)
    .single()

  if (targetErr || !target) return { ok: false, error: "notFound" }
  if (target.role !== "client") return { ok: false, error: "notAClient" }

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
