"use server"

/**
 * Country risk catalogue — admin CRUD (Audit finding R-04).
 *
 * The country_risk table is the runtime-editable source of truth for
 * buyer-country risk classification. The SOP callouts (Pakistan, Nigeria,
 * etc.) are seeded by migration 013, but admins need to add/edit/remove
 * countries without a redeploy when FATF or sanctions lists change.
 *
 * Only the `admin` / `super_admin` roles may mutate. We enforce this both
 * at the DB layer (RLS on country_risk) and at the action layer (role
 * check before calling the admin client).
 */

import { revalidatePath } from "next/cache"
import { requireCap } from "@/lib/auth/guard"
import { CAPS } from "@/lib/auth/permissions"

const RISK_LEVELS = ["low", "medium", "high"] as const
type RiskLevel = (typeof RISK_LEVELS)[number]

export interface UpsertInput {
  country_code: string
  country_name: string
  risk_level: RiskLevel
  requires_verified_swift: boolean
  notes: string | null
}

export type UpsertResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "forbidden" | "unauthenticated" | "invalid" | "db" }

function sanitize(input: UpsertInput): UpsertInput | null {
  const code = input.country_code?.trim().toUpperCase() ?? ""
  if (!/^[A-Z]{2}$/.test(code)) return null
  const name = input.country_name?.trim()
  if (!name || name.length > 100) return null
  if (!RISK_LEVELS.includes(input.risk_level)) return null
  const notes = input.notes?.trim().slice(0, 500) || null
  return {
    country_code: code,
    country_name: name,
    risk_level: input.risk_level,
    requires_verified_swift: Boolean(input.requires_verified_swift),
    notes,
  }
}

export async function upsertCountryRisk(input: UpsertInput): Promise<UpsertResult> {
  const guard = await requireCap(CAPS.COUNTRY_RISK_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin, userId } = guard

  const clean = sanitize(input)
  if (!clean) return { ok: false, error: "invalid" }

  const { error } = await admin.from("country_risk").upsert(
    {
      ...clean,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "country_code" },
  )

  if (error) {
    console.error("[v0] country_risk upsert failed", error)
    return { ok: false, error: "db" }
  }

  // Also record an activity row so the WORM audit trail captures every
  // change to the sanctions catalogue. Triggers on activities ensure the
  // row can never be altered later.
  await admin.from("activities").insert({
    action_type: "country_risk_updated",
    description: `${clean.country_code} · ${clean.country_name} → ${clean.risk_level}${clean.requires_verified_swift ? " (Swift required)" : ""}`,
    performed_by: userId,
  })

  revalidatePath("/admin/country-risk")
  return { ok: true }
}

export async function deleteCountryRisk(
  country_code: string,
): Promise<UpsertResult> {
  const guard = await requireCap(CAPS.COUNTRY_RISK_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin, userId } = guard

  const code = country_code?.trim().toUpperCase() ?? ""
  if (!/^[A-Z]{2}$/.test(code)) return { ok: false, error: "invalid" }

  const { error } = await admin.from("country_risk").delete().eq("country_code", code)
  if (error) {
    console.error("[v0] country_risk delete failed", error)
    return { ok: false, error: "db" }
  }

  await admin.from("activities").insert({
    action_type: "country_risk_removed",
    description: `${code} removed from country_risk catalogue`,
    performed_by: userId,
  })

  revalidatePath("/admin/country-risk")
  return { ok: true }
}
