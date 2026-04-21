/**
 * DB-driven country risk resolver (Audit finding R-04).
 *
 * Replaces the hardcoded HIGH/MEDIUM/LOW sets in `country-risk.ts` with
 * a lookup against `public.country_risk`, editable by admins at runtime
 * via /admin/country-risk. The reason strings + recommended-payment copy
 * still live in `country-risk.ts` because they are policy text, not data.
 *
 * Usage pattern (server actions):
 *   const assessment = await assessCountryRiskDb(leadCountry)
 *   if (assessment.requiresVerifiedSwift) { ... }
 *
 * Pure client components should keep using the sync `assessCountryRisk`
 * helper for preview (no DB round-trip), then the server-side gate
 * re-validates with this function before committing the stage change.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import {
  assessCountryRisk,
  normalizeCountry,
  type RiskAssessment,
} from "@/lib/risk/country-risk"

interface CountryRiskRow {
  country_code: string
  country_name: string
  risk_level: "low" | "medium" | "high"
  requires_verified_swift: boolean
  notes: string | null
}

/**
 * Resolve a country risk assessment using the admin-editable catalogue.
 *
 * Fall-back behaviour:
 *   1. Country blank                 -> medium + Swift required
 *   2. Code not in catalogue         -> medium + Swift required (safe default)
 *   3. DB read fails for any reason  -> fall back to the static TS table
 *      so a transient DB hiccup never ACCIDENTALLY lets a high-risk
 *      country slip through.
 */
export async function assessCountryRiskDb(
  country: string | null | undefined,
): Promise<RiskAssessment> {
  const code = normalizeCountry(country)
  const label = country?.trim() || null

  if (!code) {
    // Keep the exact same "unknown country" assessment the static helper
    // uses — that copy is already audited & translated.
    return assessCountryRisk(country)
  }

  let row: CountryRiskRow | null = null
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("country_risk")
      .select("country_code, country_name, risk_level, requires_verified_swift, notes")
      .eq("country_code", code)
      .maybeSingle()

    if (!error && data) {
      row = data as CountryRiskRow
    }
  } catch (err) {
    console.error("[v0] country_risk lookup failed, falling back to static list", err)
  }

  // No DB row? Use the static classifier — it covers the SOP-defined lists
  // and returns a safe default for unknown codes.
  if (!row) return assessCountryRisk(country)

  // We have a DB row. Build the assessment using the static helper for
  // the reason/payment copy, then override level + swift flag from the DB.
  const base = assessCountryRisk(country)
  const merged: RiskAssessment = {
    ...base,
    level: row.risk_level,
    requiresVerifiedSwift: row.requires_verified_swift,
    countryLabel: label ?? row.country_name,
  }

  // If the DB level differs from the static one (e.g. admin just promoted
  // a country), surface that in the reason so the admin audit log is
  // self-explanatory.
  if (row.risk_level !== base.level) {
    const dbNote = row.notes?.trim()
    const viLine = dbNote
      ? `Ghi chú quản trị: ${dbNote}`
      : `Quốc gia "${row.country_name}" được Admin phân loại ở mức ${row.risk_level}.`
    const enLine = dbNote
      ? `Admin note: ${dbNote}`
      : `"${row.country_name}" is classified as ${row.risk_level} by admin override.`
    merged.reasons = {
      vi: [viLine, ...base.reasons.vi],
      en: [enLine, ...base.reasons.en],
    }
  }

  return merged
}
