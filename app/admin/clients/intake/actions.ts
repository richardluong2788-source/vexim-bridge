"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClientAccount, type CreateClientInput } from "@/app/admin/clients/new/actions"
import { INDUSTRIES, type Industry } from "@/lib/constants/industries"

export interface IntakeEditableFields {
  contact_name: string
  email: string
  phone: string
  company_name: string
  industries: Industry[]
  country?: string | null
  address?: string | null
  website?: string | null
  tax_code?: string | null
  tagline?: string | null
  company_description?: string | null
  main_products?: string | null
  production_capacity?: string | null
  moq?: string | null
  lead_time_days?: string | null
  usp_points?: { icon: string; title: string }[]
  logo_url?: string | null
  cover_image_url?: string | null
  factory_image_urls?: string[]
  video_url?: string | null
  certifications?: string[]
  certifications_other?: string | null
  quality_systems?: string[]
  quality_systems_other?: string | null
  oem_odm?: string[]
  company_scale?: string | null
  export_since_year?: number | null
  export_markets?: string[]
  export_markets_other?: string | null
  traceability?: string[]
  fda_status?: string | null
  fda_number?: string | null
  fda_expires_at?: string | null
  staff_engineers_count?: number | null
  staff_workers_count?: number | null
  work_hours_start?: string | null
  work_hours_end?: string | null
  work_days_per_week?: number | null
  food_safety_training_regular?: boolean | null
  equipment_calibration_regular?: boolean | null
  water_source?: string[]
  water_source_other?: string | null
  water_testing?: boolean | null
  near_pollution_source?: boolean | null
  pollution_source_note?: string | null
  audit_readiness?: string[]
  audit_owner?: string | null
  incoterms?: string[]
  payment_policy?: string | null
  oem_policy?: string | null
  odm_policy?: string | null
  has_export_dept?: boolean | null
  has_english_staff?: boolean | null
  pricing_decision_maker?: string | null
  commitments?: string[]
  project_priority?: string | null
}

interface ActionResult {
  ok: boolean
  error?: string
}

async function getCallerOrForbidden() {
  const supabase = await createClient()
  const {
    data: { user: caller },
  } = await supabase.auth.getUser()
  if (!caller) return { caller: null, callerProfile: null, supabase }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", caller.id)
    .single()

  return { caller, callerProfile, supabase }
}

const REVIEWER_ROLES = ["admin", "staff", "super_admin", "account_executive"]

/**
 * AE-only: save edits made while reviewing a submission (e.g. AE contacted
 * the client and filled in a missing field). Does not change status.
 */
export async function updateIntakeSubmission(
  id: string,
  fields: IntakeEditableFields,
): Promise<ActionResult> {
  const { caller, callerProfile } = await getCallerOrForbidden()
  if (!caller) return { ok: false, error: "unauthenticated" }
  if (!callerProfile || !REVIEWER_ROLES.includes(callerProfile.role)) {
    return { ok: false, error: "forbidden" }
  }

  const industries = (fields.industries ?? []).filter((ind) =>
    (INDUSTRIES as readonly string[]).includes(ind),
  )
  if (industries.length === 0) return { ok: false, error: "industry_invalid" }

  const admin = createAdminClient()
  const isAE = callerProfile.role === "account_executive"

  let q = admin.from("client_intake_submissions").update({
    contact_name: fields.contact_name?.trim() || null,
    email: fields.email?.trim().toLowerCase() || null,
    phone: fields.phone?.trim() || null,
    company_name: fields.company_name?.trim() || null,
    industries,
    country: fields.country?.trim() || null,
    address: fields.address?.trim() || null,
    website: fields.website?.trim() || null,
    tax_code: fields.tax_code?.trim() || null,
    tagline: fields.tagline?.trim() || null,
    company_description: fields.company_description?.trim() || null,
    main_products: fields.main_products?.trim() || null,
    production_capacity: fields.production_capacity?.trim() || null,
    moq: fields.moq?.trim() || null,
    lead_time_days: fields.lead_time_days?.trim() || null,
    usp_points: fields.usp_points ?? [],
    logo_url: fields.logo_url?.trim() || null,
    cover_image_url: fields.cover_image_url?.trim() || null,
    factory_image_urls: fields.factory_image_urls ?? [],
    video_url: fields.video_url?.trim() || null,
    certifications: fields.certifications ?? [],
    certifications_other: fields.certifications_other?.trim() || null,
  }).eq("id", id)

  if (isAE) q = q.eq("ae_id", caller.id)

  const { error } = await q
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/admin/clients/intake/${id}`)
  return { ok: true }
}

/**
 * AE-only: approve a submitted intake. Provisions the client account
 * (reusing the same `createClientAccount` flow as manual admin creation),
 * then mirrors the capability-profile fields into `client_profiles` so
 * "Quản lý hồ sơ" opens already populated. Marks the submission approved
 * and links it to the new profile id.
 */
export async function approveIntakeSubmission(
  id: string,
  fields: IntakeEditableFields,
  reviewNotes?: string,
): Promise<ActionResult & { clientId?: string }> {
  const { caller, callerProfile } = await getCallerOrForbidden()
  if (!caller) return { ok: false, error: "unauthenticated" }
  if (!callerProfile || !REVIEWER_ROLES.includes(callerProfile.role)) {
    return { ok: false, error: "forbidden" }
  }

  const admin = createAdminClient()

  // Re-fetch the row directly (bypassing RLS is fine — caller role already
  // checked) to confirm it's still awaiting review and not already acted on
  // by someone else / re-approved twice.
  const { data: submission, error: fetchErr } = await admin
    .from("client_intake_submissions")
    .select("id, status, ae_id")
    .eq("id", id)
    .single()

  if (fetchErr || !submission) return { ok: false, error: "not_found" }
  if (submission.status === "approved") {
    return { ok: false, error: "already_approved" }
  }
  if (submission.status === "rejected") {
    return { ok: false, error: "already_rejected" }
  }

  const isAE = callerProfile.role === "account_executive"
  if (isAE && submission.ae_id !== caller.id) {
    return { ok: false, error: "forbidden" }
  }

  // Persist any last-minute AE edits first.
  const editResult = await updateIntakeSubmission(id, fields)
  if (!editResult.ok) return editResult

  // ---- Provision the client account (registration fields) -----------------
  const createInput: CreateClientInput = {
    email: fields.email,
    full_name: fields.contact_name,
    company_name: fields.company_name,
    industries: fields.industries,
    phone: fields.phone,
    country: fields.country ?? null,
  }

  const createResult = await createClientAccount(createInput)
  if (!createResult.ok || !createResult.userId) {
    return { ok: false, error: createResult.error ?? "create_failed" }
  }

  const clientId = createResult.userId

  // ---- Mirror capability-profile fields into client_profiles ---------------
  const slugBase = fields.company_name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || `client-${clientId.slice(0, 8)}`

  const { data: slugCollision } = await admin
    .from("client_profiles")
    .select("id")
    .eq("slug", slugBase)
    .maybeSingle()

  const slug = slugCollision ? `${slugBase}-${clientId.slice(0, 6)}` : slugBase

  const { error: profileErr } = await admin.from("client_profiles").upsert(
    {
      client_id: clientId,
      slug,
      display_name: fields.company_name,
      tagline: fields.tagline || null,
      logo_url: fields.logo_url || null,
      cover_image_url: fields.cover_image_url || null,
      video_url: fields.video_url || null,
      usp_points: fields.usp_points ?? [],
      production_capacity: fields.production_capacity || null,
      moq: fields.moq || null,
      lead_time_days: fields.lead_time_days || null,
      is_published: false,
      created_by: caller.id,
      updated_by: caller.id,
    },
    { onConflict: "client_id" },
  )

  if (profileErr) {
    console.error("[v0] client_profiles upsert after intake approval failed:", profileErr.message)
    // Don't fail the whole approval — the account exists; AE can fill the
    // profile manually in "Quản lý hồ sơ" if this mirror step had an issue.
  }

  // ---- Mark submission approved --------------------------------------------
  await admin
    .from("client_intake_submissions")
    .update({
      status: "approved",
      reviewed_by: caller.id,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes?.trim() || null,
      created_client_id: clientId,
    })
    .eq("id", id)

  await admin.from("activities").insert({
    user_id: caller.id,
    action: "client_intake_approved",
    details: { submission_id: id, new_client_id: clientId },
  })

  revalidatePath("/admin/clients/intake")
  revalidatePath("/admin/clients")

  return { ok: true, clientId }
}

/**
 * AE-only: reject a submission (e.g. industry not a fit, or client never
 * followed up on missing info). Does not touch `profiles` at all.
 */
export async function rejectIntakeSubmission(
  id: string,
  reason: string,
): Promise<ActionResult> {
  const { caller, callerProfile } = await getCallerOrForbidden()
  if (!caller) return { ok: false, error: "unauthenticated" }
  if (!callerProfile || !REVIEWER_ROLES.includes(callerProfile.role)) {
    return { ok: false, error: "forbidden" }
  }

  const admin = createAdminClient()
  const isAE = callerProfile.role === "account_executive"

  let q = admin
    .from("client_intake_submissions")
    .update({
      status: "rejected",
      reviewed_by: caller.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason?.trim() || null,
    })
    .eq("id", id)
    .eq("status", "submitted")

  if (isAE) q = q.eq("ae_id", caller.id)

  const { error } = await q
  if (error) return { ok: false, error: error.message }

  await admin.from("activities").insert({
    user_id: caller.id,
    action: "client_intake_rejected",
    details: { submission_id: id, reason },
  })

  revalidatePath("/admin/clients/intake")
  return { ok: true }
}
