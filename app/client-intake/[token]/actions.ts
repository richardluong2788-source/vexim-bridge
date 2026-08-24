"use server"

import { createClient } from "@/lib/supabase/server"
import { INDUSTRIES, type Industry } from "@/lib/constants/industries"

export interface ClientIntakePayload {
  contact_name: string
  email: string
  phone: string
  company_name: string
  industries: Industry[]
  country?: string
  address?: string
  website?: string
  tax_code?: string
  tagline?: string
  company_description?: string
  main_products?: string
  production_capacity?: string
  moq?: string
  lead_time_days?: string
  usp_points?: { icon: string; title: string }[]
  logo_url?: string
  cover_image_url?: string
  factory_image_urls?: string[]
  video_url?: string
  certifications?: string[]
  certifications_other?: string
  quality_systems?: string[]
  quality_systems_other?: string
  oem_odm?: string[]
  company_scale?: string
  export_since_year?: string
  export_markets?: string[]
  export_markets_other?: string
  traceability?: string[]
  fda_status?: string
  fda_number?: string
  fda_expires_at?: string
  staff_engineers_count?: string
  staff_workers_count?: string
  work_hours_start?: string
  work_hours_end?: string
  work_days_per_week?: string
  food_safety_training_regular?: boolean
  equipment_calibration_regular?: boolean
  water_source?: string[]
  water_source_other?: string
  water_testing?: boolean
  near_pollution_source?: boolean
  pollution_source_note?: string
  audit_readiness?: string[]
  audit_owner?: string
  incoterms?: string[]
  payment_policy?: string
  oem_policy?: string
  odm_policy?: string
  has_export_dept?: boolean
  has_english_staff?: boolean
  pricing_decision_maker?: string
  commitments?: string[]
  project_priority?: string
}

export interface SubmitClientIntakeResult {
  ok: boolean
  error?: string
}

/**
 * Public server action — called from the unauthenticated /client-intake/[token]
 * wizard on final submit. Delegates to the `submit_client_intake` RPC
 * (SECURITY DEFINER) so we never grant a raw anon UPDATE policy on
 * `client_intake_submissions`. Validates the required fields client-facing
 * here as a second line of defense before hitting the DB.
 */
export async function submitClientIntake(
  token: string,
  data: ClientIntakePayload,
): Promise<SubmitClientIntakeResult> {
  const email = data.email?.trim().toLowerCase()
  const contactName = data.contact_name?.trim()
  const company = data.company_name?.trim()
  const phone = data.phone?.trim()

  if (!token) return { ok: false, error: "invalid_token" }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "invalid_email" }
  }
  if (!contactName) return { ok: false, error: "contact_name_required" }
  if (!company) return { ok: false, error: "company_required" }
  if (!phone) return { ok: false, error: "phone_required" }

  const industries = (data.industries ?? []).filter((ind) =>
    (INDUSTRIES as readonly string[]).includes(ind),
  )
  if (industries.length === 0) return { ok: false, error: "industry_invalid" }

  const supabase = await createClient()

  const { data: success, error } = await supabase.rpc("submit_client_intake", {
    p_token: token,
    p_payload: {
      contact_name: contactName,
      email,
      phone,
      company_name: company,
      industries,
      country: data.country?.trim() || null,
      address: data.address?.trim() || null,
      website: data.website?.trim() || null,
      tax_code: data.tax_code?.trim() || null,
      tagline: data.tagline?.trim() || null,
      company_description: data.company_description?.trim() || null,
      main_products: data.main_products?.trim() || null,
      production_capacity: data.production_capacity?.trim() || null,
      moq: data.moq?.trim() || null,
      lead_time_days: data.lead_time_days?.trim() || null,
      usp_points: data.usp_points ?? [],
      logo_url: data.logo_url?.trim() || null,
      cover_image_url: data.cover_image_url?.trim() || null,
      factory_image_urls: data.factory_image_urls ?? [],
      video_url: data.video_url?.trim() || null,
      certifications: data.certifications ?? [],
      certifications_other: data.certifications_other?.trim() || null,
      quality_systems: data.quality_systems ?? [],
      quality_systems_other: data.quality_systems_other?.trim() || null,
      oem_odm: data.oem_odm ?? [],
      company_scale: data.company_scale?.trim() || null,
      export_since_year: data.export_since_year?.trim() || null,
      export_markets: data.export_markets ?? [],
      export_markets_other: data.export_markets_other?.trim() || null,
      traceability: data.traceability ?? [],
      fda_status: data.fda_status?.trim() || null,
      fda_number: data.fda_number?.trim() || null,
      fda_expires_at: data.fda_expires_at?.trim() || null,
      staff_engineers_count: data.staff_engineers_count?.trim() || null,
      staff_workers_count: data.staff_workers_count?.trim() || null,
      work_hours_start: data.work_hours_start?.trim() || null,
      work_hours_end: data.work_hours_end?.trim() || null,
      work_days_per_week: data.work_days_per_week?.trim() || null,
      food_safety_training_regular: data.food_safety_training_regular ?? null,
      equipment_calibration_regular: data.equipment_calibration_regular ?? null,
      water_source: data.water_source ?? [],
      water_source_other: data.water_source_other?.trim() || null,
      water_testing: data.water_testing ?? null,
      near_pollution_source: data.near_pollution_source ?? null,
      pollution_source_note: data.pollution_source_note?.trim() || null,
      audit_readiness: data.audit_readiness ?? [],
      audit_owner: data.audit_owner?.trim() || null,
      incoterms: data.incoterms ?? [],
      payment_policy: data.payment_policy?.trim() || null,
      oem_policy: data.oem_policy?.trim() || null,
      odm_policy: data.odm_policy?.trim() || null,
      has_export_dept: data.has_export_dept ?? null,
      has_english_staff: data.has_english_staff ?? null,
      pricing_decision_maker: data.pricing_decision_maker?.trim() || null,
      commitments: data.commitments ?? [],
      project_priority: data.project_priority?.trim() || null,
    },
  })

  if (error) {
    console.error("[v0] submit_client_intake RPC error:", error.message)
    return { ok: false, error: "submit_failed" }
  }
  if (!success) {
    return { ok: false, error: "link_expired" }
  }

  return { ok: true }
}
