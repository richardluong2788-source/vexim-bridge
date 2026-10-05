"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClientAccount, type CreateClientInput } from "@/app/admin/clients/new/actions"
import { upsertAssessment, type AssessmentInput } from "@/lib/assessment/actions"
import { seedProductsFromMainProducts } from "@/lib/client-intake/split-main-products"
import { INDUSTRIES, type Industry } from "@/lib/constants/industries"
import {
  deriveProfileSourceStatus,
  isProfileSourceStatus,
  isSupplierEntityType,
  isUsSalesChannelStatus,
  normalizeManufacturingSources,
  normalizeSupportNeeds,
  type ManufacturingSourceEntry,
  type ProfileSourceStatus,
  type SupplierEntityType,
  type UsSalesChannelStatus,
} from "@/lib/client-intake/sourcing"

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
  certification_image_urls?: string[]
  quality_systems?: string[]
  quality_systems_other?: string | null
  oem_odm?: string[]
  company_scale?: string | null
  export_since_year?: number | null
  export_markets?: string[] | null
  export_markets_other?: string | null
  traceability?: string[]
  supplier_entity_type?: SupplierEntityType | null
  manufacturing_sources?: ManufacturingSourceEntry[]
  source_verification_status?: ProfileSourceStatus | null
  source_verification_consent?: boolean | null
  source_change_acknowledged?: boolean | null
  us_sales_channel_status?: UsSalesChannelStatus | null
  us_sales_channel_notes?: string | null
  vexim_support_needs?: string[]
  vexim_support_other?: string | null
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
  const manufacturingSources = normalizeManufacturingSources(fields.manufacturing_sources, {
    preserveReviewFields: true,
  })
  if (manufacturingSources.some((source) =>
    source.verification_status === "verified" && !source.verification_notes.trim(),
  )) {
    return { ok: false, error: "verification_notes_required" }
  }
  const supplierEntityType = isSupplierEntityType(fields.supplier_entity_type)
    ? fields.supplier_entity_type
    : undefined
  const usSalesChannelStatus = isUsSalesChannelStatus(fields.us_sales_channel_status)
    ? fields.us_sales_channel_status
    : undefined
  const certifications = (Array.isArray(fields.certifications) ? fields.certifications : []).filter(
    (value): value is string =>
      typeof value === "string" &&
      value.trim() !== "" &&
      value.trim().toLowerCase() !== "fda registration",
  )
  const sourceVerificationStatus = manufacturingSources.length > 0
    ? deriveProfileSourceStatus(manufacturingSources)
    : isProfileSourceStatus(fields.source_verification_status)
      ? fields.source_verification_status
      : "awaiting_details"

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
    certifications,
    certifications_other: fields.certifications_other?.trim() || null,
    certification_image_urls: fields.certification_image_urls ?? [],
    quality_systems: fields.quality_systems ?? [],
    quality_systems_other: fields.quality_systems_other?.trim() || null,
    oem_odm: fields.oem_odm ?? [],
    company_scale: fields.company_scale?.trim() || null,
    export_since_year: fields.export_since_year ?? null,
    export_markets: fields.export_markets ?? [],
    export_markets_other: fields.export_markets_other?.trim() || null,
    traceability: fields.traceability ?? [],
    supplier_entity_type: supplierEntityType,
    manufacturing_sources: manufacturingSources as unknown as Record<string, unknown>[],
    source_verification_status: sourceVerificationStatus,
    source_verification_consent: fields.source_verification_consent ?? false,
    source_change_acknowledged: fields.source_change_acknowledged ?? false,
    us_sales_channel_status: usSalesChannelStatus,
    us_sales_channel_notes: fields.us_sales_channel_notes?.trim() || null,
    vexim_support_needs: normalizeSupportNeeds(fields.vexim_support_needs),
    vexim_support_other: fields.vexim_support_other?.trim() || null,
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
    .select("id, status, ae_id, client_id, email")
    .eq("id", id)
    .single() as { data: { id: string; status: string; ae_id: string; client_id: string | null; email: string | null } | null; error: any }

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
  const manufacturingSources = normalizeManufacturingSources(fields.manufacturing_sources, {
    preserveReviewFields: true,
  })
  if (manufacturingSources.some((source) =>
    source.verification_status === "verified" && !source.verification_notes.trim(),
  )) {
    return { ok: false, error: "verification_notes_required" }
  }
  const supplierEntityType: SupplierEntityType = isSupplierEntityType(fields.supplier_entity_type)
    ? fields.supplier_entity_type
    : "unknown"
  const usSalesChannelStatus: UsSalesChannelStatus = isUsSalesChannelStatus(fields.us_sales_channel_status)
    ? fields.us_sales_channel_status
    : "unknown"
  const supportNeeds = normalizeSupportNeeds(fields.vexim_support_needs)
  const requestedSourceStatus: ProfileSourceStatus = isProfileSourceStatus(fields.source_verification_status)
    ? fields.source_verification_status
    : "awaiting_details"
  const sourceStatusFromRows = manufacturingSources.length > 0
    ? deriveProfileSourceStatus(manufacturingSources)
    : null
  let existingProfileForNoSourceUpdate: {
    id: string
    email: string | null
    source_verification_status: string | null
  } | null = null
  if (manufacturingSources.length === 0) {
    let profileQuery = admin
      .from("profiles")
      .select("id, email, source_verification_status")
    if (submission.client_id) {
      profileQuery = profileQuery.eq("id", submission.client_id)
    } else {
      const emailToMatch = (fields.email || submission.email || "").trim().toLowerCase()
      if (emailToMatch) profileQuery = profileQuery.eq("email", emailToMatch)
    }
    if (submission.client_id || (fields.email || submission.email || "").trim()) {
      const { data, error } = await profileQuery.maybeSingle()
      if (error) {
        console.error("[intake approval] existing profile source-status lookup failed:", error.message)
        return { ok: false, error: "profile_lookup_failed" }
      }
      existingProfileForNoSourceUpdate = data
    }
  }
  const existingSourceStatus = isProfileSourceStatus(
    existingProfileForNoSourceUpdate?.source_verification_status,
  )
    ? existingProfileForNoSourceUpdate.source_verification_status
    : null
  if (
    manufacturingSources.length === 0 &&
    requestedSourceStatus === "verified" &&
    existingSourceStatus !== "verified"
  ) {
    return { ok: false, error: "verified_source_required" }
  }
  const sourceVerificationConsent = fields.source_verification_consent === true
  const sourceChangeAcknowledged = fields.source_change_acknowledged === true

  const editResult = await updateIntakeSubmission(id, {
    ...fields,
    manufacturing_sources: manufacturingSources,
    supplier_entity_type: supplierEntityType,
    source_verification_status: sourceStatusFromRows ?? existingSourceStatus ?? requestedSourceStatus,
    us_sales_channel_status: usSalesChannelStatus,
    vexim_support_needs: supportNeeds,
  })
  if (!editResult.ok) return editResult

  let clientId: string

  // Supplement flow: if intake was generated for an existing client, reuse that client_id directly.
  if (submission.client_id) {
    clientId = submission.client_id
    const nextSourceStatus = sourceStatusFromRows ?? existingSourceStatus ?? "awaiting_details"

    const { error: accountUpdateError } = await admin
      .from("profiles")
      .update({
        company_name: fields.company_name || undefined,
        full_name: fields.contact_name || undefined,
        phone: fields.phone || undefined,
        industries: fields.industries?.length ? fields.industries : undefined,
        supplier_entity_type: supplierEntityType,
        source_verification_status: nextSourceStatus,
        source_verification_consent: sourceVerificationConsent,
        source_change_acknowledged: sourceChangeAcknowledged,
        us_sales_channel_status: usSalesChannelStatus,
        us_sales_channel_notes: fields.us_sales_channel_notes?.trim() || null,
        vexim_support_needs: supportNeeds,
        vexim_support_other: fields.vexim_support_other?.trim() || null,
      })
      .eq("id", clientId)
    if (accountUpdateError) {
      console.error("[intake approval] supplier sourcing mirror failed:", accountUpdateError.message)
      return { ok: false, error: "profile_update_failed" }
    }
  } else {
    const createInput: CreateClientInput = {
      email: fields.email,
      full_name: fields.contact_name,
      company_name: fields.company_name,
      industries: fields.industries,
      phone: fields.phone,
      country: fields.country ?? null,
      supplier_entity_type: supplierEntityType,
      source_verification_status: sourceStatusFromRows ?? requestedSourceStatus,
      source_verification_consent: sourceVerificationConsent,
      source_change_acknowledged: sourceChangeAcknowledged,
      us_sales_channel_status: usSalesChannelStatus,
      us_sales_channel_notes: fields.us_sales_channel_notes?.trim() || null,
      vexim_support_needs: supportNeeds,
      vexim_support_other: fields.vexim_support_other?.trim() || null,
      sourced_by: isSR ? caller.id : null,
    }

    const createResult = await createClientAccount(createInput)
    if (createResult.ok && createResult.userId) {
      clientId = createResult.userId
      // The generic account-creation action only accepts pre-verification
      // statuses. Intake approval has already validated reviewer decisions,
      // so now persist the derived source status (including verified).
      const { error: sourceStatusSaveError } = await admin
        .from("profiles")
        .update({ source_verification_status: sourceStatusFromRows ?? requestedSourceStatus })
        .eq("id", clientId)
      if (sourceStatusSaveError) {
        console.error("[intake approval] new-client source status save failed:", sourceStatusSaveError.message)
        return { ok: false, error: "profile_update_failed" }
      }
    } else if (createResult.error === "email_exists") {
      // Fallback supplement flow via email match
      let existingProfile = existingProfileForNoSourceUpdate
      if (!existingProfile?.id) {
        const { data, error } = await admin
          .from("profiles")
          .select("id, email, source_verification_status")
          .eq("email", fields.email.trim().toLowerCase())
          .maybeSingle()
        if (error) {
          console.error("[intake approval] fallback profile lookup failed:", error.message)
          return { ok: false, error: "profile_lookup_failed" }
        }
        existingProfile = data
      }
      if (!existingProfile?.id) {
        return { ok: false, error: "email_exists_but_profile_not_found" }
      }
      clientId = existingProfile.id
      const fallbackSourceStatus = sourceStatusFromRows ?? (
        isProfileSourceStatus(existingProfile.source_verification_status)
          ? existingProfile.source_verification_status
          : "awaiting_details"
      )
      const { error: fallbackProfileUpdateError } = await admin
        .from("profiles")
        .update({
          company_name: fields.company_name || undefined,
          full_name: fields.contact_name || undefined,
          phone: fields.phone || undefined,
          industries: fields.industries?.length ? fields.industries : undefined,
          supplier_entity_type: supplierEntityType,
          source_verification_status: fallbackSourceStatus,
          source_verification_consent: sourceVerificationConsent,
          source_change_acknowledged: sourceChangeAcknowledged,
          us_sales_channel_status: usSalesChannelStatus,
          us_sales_channel_notes: fields.us_sales_channel_notes?.trim() || null,
          vexim_support_needs: supportNeeds,
          vexim_support_other: fields.vexim_support_other?.trim() || null,
        })
        .eq("id", clientId)
      if (fallbackProfileUpdateError) {
        console.error("[intake approval] fallback supplier sourcing mirror failed:", fallbackProfileUpdateError.message)
        return { ok: false, error: "profile_update_failed" }
      }
    } else {
      return { ok: false, error: (createResult as any).error ?? "create_failed" }
    }
  }

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

  // Persist factory/source identities separately from company/public-profile
  // fields. These locations and verification notes remain internal-only.
  const sourceRowsToSave = manufacturingSources.map((source, index) => {
    const isVerified = source.verification_status === "verified"
    return {
      client_id: clientId,
      intake_submission_id: id,
      source_index: index,
      facility_name: source.facility_name || null,
      facility_address: source.facility_address || null,
      product_names: source.product_names,
      relationship_type: source.relationship_type || null,
      relationship_notes: source.relationship_notes || null,
      verification_contact_name: source.verification_contact_name || null,
      verification_contact_email: source.verification_contact_email || null,
      verification_contact_phone: source.verification_contact_phone || null,
      evidence_note: source.evidence_note || null,
      verification_status: source.verification_status,
      verification_notes: source.verification_notes || null,
      verification_consent: sourceVerificationConsent,
      source_change_acknowledged: sourceChangeAcknowledged,
      verified_by: isVerified ? caller.id : null,
      verified_at: isVerified ? new Date().toISOString() : null,
      created_by: caller.id,
    }
  })

  if (sourceRowsToSave.length > 0) {
    const { error: sourceSaveError } = await admin
      .from("client_manufacturing_sources")
      .upsert(sourceRowsToSave, { onConflict: "intake_submission_id,source_index" })
    if (sourceSaveError) {
      console.error("[intake approval] internal manufacturing source save failed:", sourceSaveError.message)
      return { ok: false, error: "source_save_failed" }
    }
  }
  const { data: sourceRowsForSubmission } = await admin
    .from("client_manufacturing_sources")
    .select("id, source_index")
    .eq("intake_submission_id", id)
  const staleSourceIds = (sourceRowsForSubmission ?? [])
    .filter((row) => row.source_index !== null && row.source_index >= sourceRowsToSave.length)
    .map((row) => row.id)
  if (staleSourceIds.length > 0) {
    const { error: staleDeleteError } = await admin
      .from("client_manufacturing_sources")
      .delete()
      .in("id", staleSourceIds)
    if (staleDeleteError) {
      console.error("[intake approval] stale internal source cleanup failed:", staleDeleteError.message)
      return { ok: false, error: "source_save_failed" }
    }
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
      description: fields.company_description || null,
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

  // ---- Mirror certification images into compliance_docs ----------------------
  // FDA is intentionally reviewed later against the buyer/product/facility.
  try {
    const complianceDocsToInsert: Array<{
      owner_id: string
      kind: "fda_certificate" | "other"
      title: string | null
      url: string
      mime_type: string | null
      notes: string | null
      uploaded_by: string | null
    }> = []

    if (fields.certification_image_urls && fields.certification_image_urls.length > 0) {
      for (const url of fields.certification_image_urls) {
        if (!url) continue
        complianceDocsToInsert.push({
          owner_id: clientId,
          kind: "other",
          title: "Certification",
          url,
          mime_type: "image/jpeg",
          notes: null,
          uploaded_by: caller.id,
        })
      }
    }

    if (complianceDocsToInsert.length > 0) {
      const { data: insertedDocs, error: docsErr } = await admin
        .from("compliance_docs")
        .insert(complianceDocsToInsert)
        .select("id")

      if (docsErr) {
        console.error("[v0] compliance_docs insert from intake failed:", docsErr.message)
      } else if (insertedDocs && insertedDocs.length > 0) {
        // Auto-feature these docs on the profile so they show on public page
        const docIds = insertedDocs.map((d: any) => d.id)
        // Fetch current featured to merge
        const { data: existingProfile } = await admin
          .from("client_profiles")
          .select("featured_certifications")
          .eq("client_id", clientId)
          .maybeSingle()

        const currentFeatured = (existingProfile as any)?.featured_certifications ?? []
        const mergedFeatured = Array.from(new Set([...currentFeatured, ...docIds]))

        await admin
          .from("client_profiles")
          .update({ featured_certifications: mergedFeatured, updated_by: caller.id })
          .eq("client_id", clientId)

      }
    }
  } catch (docErr) {
    console.error("[v0] compliance_docs mirror from intake unexpected error:", docErr)
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
