"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import type { ClientFactoryAssessment } from "@/lib/supabase/types"
import { computeScore } from "@/lib/assessment/scoring"

const ALLOWED_ROLES = ["admin", "super_admin", "staff", "account_executive"]

async function requireInternalUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" as const }

  const { data: userProfileRaw } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  const userProfile = userProfileRaw as { role: string } | null

  if (!userProfile || !ALLOWED_ROLES.includes(userProfile.role)) {
    return { error: "Unauthorized" as const }
  }
  return { user }
}

export interface AssessmentInput {
  quality_systems: string[]
  quality_systems_other: string | null
  oem_odm: string[]
  company_scale: string | null
  export_since_year: number | null
  export_markets: string[]
  export_markets_other: string | null
  traceability: string[]
  audit_readiness: string[]
  audit_owner: string | null
  incoterms: string[]
  payment_policy: string | null
  oem_policy: string | null
  odm_policy: string | null
  has_export_dept: boolean | null
  has_english_staff: boolean | null
  pricing_decision_maker: string | null
  commitments: string[]
  project_priority: string | null
  // Dong bo 2 chieu sang client_profiles
  moq: string | null
  lead_time_days: string | null
  production_capacity: string | null
  // Muc 11: Nhan su, gio lam, ATTP/thiet bi, nguon nuoc, vi tri nha may
  staff_engineers_count: number | null
  staff_workers_count: number | null
  work_hours_start: string | null
  work_hours_end: string | null
  work_days_per_week: number | null
  food_safety_training_regular: boolean | null
  equipment_calibration_regular: boolean | null
  water_source: string[]
  water_source_other: string | null
  water_testing: boolean | null
  near_pollution_source: boolean | null
  pollution_source_note: string | null
}

/**
 * Get assessment by client ID (internal only).
 */
export async function getAssessmentByClientId(
  clientId: string
): Promise<{ success: boolean; data?: ClientFactoryAssessment | null; error?: string }> {
  const auth = await requireInternalUser()
  if ("error" in auth) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("client_factory_assessments")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

/**
 * Upsert assessment + recompute score + sync MOQ/LeadTime/capacity to client_profiles.
 */
export async function upsertAssessment(
  clientId: string,
  input: AssessmentInput
): Promise<{ success: boolean; data?: ClientFactoryAssessment; error?: string }> {
  const auth = await requireInternalUser()
  if ("error" in auth) return { success: false, error: auth.error }
  const { user } = auth

  const admin = createAdminClient()

  // Lay FDA tu profiles de cham diem
  const { data: clientProfileRaw } = await admin
    .from("profiles")
    .select("fda_registration_number, fda_expires_at")
    .eq("id", clientId)
    .single()
  const clientProfile = clientProfileRaw as {
    fda_registration_number: string | null
    fda_expires_at: string | null
  } | null

  const score = computeScore(input, {
    fda_registration_number: clientProfile?.fda_registration_number ?? null,
    fda_expires_at: clientProfile?.fda_expires_at ?? null,
  })

  const payload = {
    client_id: clientId,
    quality_systems: input.quality_systems,
    quality_systems_other: input.quality_systems_other,
    oem_odm: input.oem_odm,
    company_scale: input.company_scale,
    export_since_year: input.export_since_year,
    export_markets: input.export_markets,
    export_markets_other: input.export_markets_other,
    traceability: input.traceability,
    audit_readiness: input.audit_readiness,
    audit_owner: input.audit_owner,
    incoterms: input.incoterms,
    payment_policy: input.payment_policy,
    oem_policy: input.oem_policy,
    odm_policy: input.odm_policy,
    has_export_dept: input.has_export_dept,
    has_english_staff: input.has_english_staff,
    pricing_decision_maker: input.pricing_decision_maker,
    commitments: input.commitments,
    project_priority: input.project_priority,
    staff_engineers_count: input.staff_engineers_count,
    staff_workers_count: input.staff_workers_count,
    work_hours_start: input.work_hours_start,
    work_hours_end: input.work_hours_end,
    work_days_per_week: input.work_days_per_week,
    food_safety_training_regular: input.food_safety_training_regular,
    equipment_calibration_regular: input.equipment_calibration_regular,
    water_source: input.water_source,
    water_source_other: input.water_source_other,
    water_testing: input.water_testing,
    near_pollution_source: input.near_pollution_source,
    pollution_source_note: input.pollution_source_note,
    score_total: score.total,
    score_grade: score.grade,
    score_breakdown: score.breakdown as unknown as Record<string, unknown>,
    scored_at: new Date().toISOString(),
    updated_by: user.id,
  }

  const { data: existingRaw } = await admin
    .from("client_factory_assessments")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle()
  const existing = existingRaw as { id: string } | null

  const table = admin.from("client_factory_assessments") as any
  let result
  if (existing) {
    result = await table
      .update(payload)
      .eq("client_id", clientId)
      .select()
      .single()
  } else {
    result = await table
      .insert({ ...payload, created_by: user.id })
      .select()
      .single()
  }

  if (result.error) {
    console.error("[v0] upsertAssessment error:", result.error)
    return { success: false, error: result.error.message }
  }

  // Dong bo 2 chieu: MOQ / Lead Time / Cong suat -> client_profiles
  const { data: cpRaw } = await admin
    .from("client_profiles")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle()
  const cp = cpRaw as { id: string } | null

  if (cp) {
    await (admin.from("client_profiles") as any)
      .update({
        moq: input.moq,
        lead_time_days: input.lead_time_days,
        production_capacity: input.production_capacity,
        updated_by: user.id,
      })
      .eq("client_id", clientId)
  }

  return { success: true, data: result.data as ClientFactoryAssessment }
}

// ============================================================
// Public (buyer-facing) — chi tra ve cac truong AN TOAN
// ============================================================

export interface PublicCapability {
  quality_systems: string[]
  oem_odm: string[]
  export_markets: string[]
  audit_readiness: string[]
  incoterms: string[]
  traceability: string[]
  // Muc 11 — chi cac tin hieu AN TOAN/tich cuc, KHONG lo so nhan su hay
  // vi tri/ghi chu o nhiem (nhung du lieu nay chi dung cho diem noi bo).
  food_safety_training_regular: boolean | null
  equipment_calibration_regular: boolean | null
  water_testing: boolean | null
}

/**
 * Lay phan nang luc AN TOAN de hien thi cong khai cho buyer.
 * KHONG tra ve diem so, cam ket, nhan su, nguoi quyet dinh gia,
 * so lieu nhan cong hoac vi tri/nguon o nhiem cua nha may.
 * Dung admin client de bypass RLS (bang nay khong public-read).
 */
export async function getPublicCapabilityByClientId(
  clientId: string
): Promise<{ success: boolean; data?: PublicCapability | null; error?: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("client_factory_assessments")
    .select(
      "quality_systems, oem_odm, export_markets, audit_readiness, incoterms, traceability, food_safety_training_regular, equipment_calibration_regular, water_testing"
    )
    .eq("client_id", clientId)
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  return { success: true, data: (data as PublicCapability | null) ?? null }
}
