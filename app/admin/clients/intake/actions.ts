"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClientAccount, type CreateClientInput } from "@/app/admin/clients/new/actions"
import { upsertAssessment, type AssessmentInput } from "@/lib/assessment/actions"
import { seedProductsFromMainProducts } from "@/lib/client-intake/split-main-products"
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
  export_markets?: string[] | null
  export_markets_other?: string | null
  traceability?: string[]
  fda_status?: string | null
  fda_number?: string | null
  fda_expires_at?: string | null
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

// Reviewers: admin/super_admin (oversight), AE (own submissions) and
// Supplier Researcher — SR owns the supplier pipeline end-to-end in the
// new operating model (LR sources buyers, SR sources suppliers, AE connects).
const REVIEWER_ROLES = [
  "admin",
  "staff",
  "super_admin",
  "account_executive",
  "supplier_researcher",
]

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
    quality_systems: fields.quality_systems ?? [],
    quality_systems_other: fields.quality_systems_other?.trim() || null,
    oem_odm: fields.oem_odm ?? [],
    company_scale: fields.company_scale?.trim() || null,
    export_since_year: fields.export_since_year ?? null,
    export_markets: fields.export_markets ?? [],
    export_markets_other: fields.export_markets_other?.trim() || null,
    traceability: fields.traceability ?? [],
    fda_status: fields.fda_status?.trim() || null,
    fda_number: fields.fda_number?.trim() || null,
    fda_expires_at: fields.fda_expires_at || null,
    audit_readiness: fields.audit_readiness ?? [],
    audit_owner: fields.audit_owner?.trim() || null,
    incoterms: fields.incoterms ?? [],
    payment_policy: fields.payment_policy?.trim() || null,
    oem_policy: fields.oem_policy?.trim() || null,
    odm_policy: fields.odm_policy?.trim() || null,
    has_export_dept: fields.has_export_dept ?? null,
    has_english_staff: fields.has_english_staff ?? null,
    pricing_decision_maker: fields.pricing_decision_maker?.trim() || null,
    commitments: fields.commitments ?? [],
    project_priority: fields.project_priority?.trim() || null,
  }).eq("id", id)

  if (isAE) q = q.eq("ae_id", caller.id)

  const { error } = await q
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/admin/clients/intake/${id}`)
  return { ok: true }
}

export interface ApproveIntakeOptions {
  seedProductsFromIntake?: boolean
}

export async function approveIntakeSubmission(
  id: string,
  fields: IntakeEditableFields,
  reviewNotes?: string,
  options: ApproveIntakeOptions = {},
): Promise<ActionResult & { clientId?: string; seededProducts?: number }> {
  const { caller, callerProfile } = await getCallerOrForbidden()
  if (!caller) return { ok: false, error: "unauthenticated" }
  if (!callerProfile || !REVIEWER_ROLES.includes(callerProfile.role)) {
    return { ok: false, error: "forbidden" }
  }

  const admin = createAdminClient()

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
  const isSR = callerProfile.role === "supplier_researcher"

  const editResult = await updateIntakeSubmission(id, fields)
  if (!editResult.ok) return editResult

  const createInput: CreateClientInput = {
    email: fields.email,
    full_name: fields.contact_name,
    company_name: fields.company_name,
    industries: fields.industries,
    phone: fields.phone,
    country: fields.country ?? null,
    sourced_by: isSR ? caller.id : null,
  }

  const createResult = await createClientAccount(createInput)
  if (!createResult.ok || !createResult.userId) {
    return { ok: false, error: createResult.error ?? "create_failed" }
  }

  const clientId = createResult.userId

  const toNumber = (value: number | null | undefined) => value ?? null
  const assessmentInput: AssessmentInput = {
    quality_systems: fields.quality_systems ?? [],
    quality_systems_other: fields.quality_systems_other ?? null,
    oem_odm: fields.oem_odm ?? [],
    company_scale: fields.company_scale ?? null,
    export_since_year: toNumber(fields.export_since_year),
    export_markets: fields.export_markets ?? [],
    export_markets_other: fields.export_markets_other ?? null,
    traceability: fields.traceability ?? [],
    audit_readiness: fields.audit_readiness ?? [],
    audit_owner: fields.audit_owner ?? null,
    incoterms: fields.incoterms ?? [],
    payment_policy: fields.payment_policy ?? null,
    oem_policy: fields.oem_policy ?? null,
    odm_policy: fields.odm_policy ?? null,
    has_export_dept: fields.has_export_dept ?? null,
    has_english_staff: fields.has_english_staff ?? null,
    pricing_decision_maker: fields.pricing_decision_maker ?? null,
    commitments: fields.commitments ?? [],
    project_priority: fields.project_priority ?? null,
    moq: fields.moq ?? null,
    lead_time_days: fields.lead_time_days ?? null,
    production_capacity: fields.production_capacity ?? null,
  }
  const assessmentResult = await upsertAssessment(clientId, assessmentInput)
  if (!assessmentResult.success) {
    console.error("[v0] factory assessment mirror after intake approval failed:", assessmentResult.error)
    return { ok: false, error: "assessment_create_failed" }
  }

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
  }

  let seededProducts = 0
  if (options.seedProductsFromIntake !== false) {
    const seeded = await seedProductsFromMainProducts(admin, {
      clientId,
      mainProducts: fields.main_products,
      submissionId: id,
      createdBy: caller.id,
      companyName: fields.company_name,
      status: "inactive",
      onlyWhenClientEmpty: true,
    })
    if (!seeded.ok) {
      console.error("[v0] intake product seeding failed after approval:", seeded.error)
    } else {
      seededProducts = seeded.inserted
    }
  }

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

  try {
    await admin.from("activities").insert({
      opportunity_id: null,
      action_type: "client_intake_approved",
      description: JSON.stringify({
        submission_id: id,
        new_client_id: clientId,
        seeded_products: seededProducts,
      }),
      performed_by: caller.id,
    })
  } catch (auditErr) {
    console.error("[v0] approveIntakeSubmission: audit log failed:", auditErr)
  }

  revalidatePath("/admin/clients/intake")
  revalidatePath("/admin/clients")

  return { ok: true, clientId, seededProducts }
}

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

  try {
    await admin.from("activities").insert({
      opportunity_id: null,
      action_type: "client_intake_rejected",
      description: JSON.stringify({ submission_id: id, reason }),
      performed_by: caller.id,
    })
  } catch (auditErr) {
    console.error("[v0] rejectIntakeSubmission: audit log failed:", auditErr)
  }

  revalidatePath("/admin/clients/intake")
  return { ok: true }
}
