"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { INDUSTRIES, type Industry } from "@/lib/constants/industries"
import { translateSupplierTextFields } from "@/lib/ai/supplier-content-translation"
import { notifyAeOfIntakeSubmission } from "@/lib/notifications/intake-submitted-email"
import {
  isSupplierEntityType,
  isUsSalesChannelStatus,
  normalizeManufacturingSources,
  normalizeSupportNeeds,
  type ManufacturingSourceEntry,
  type SupplierEntityType,
  type UsSalesChannelStatus,
  type VeximSupportNeed,
} from "@/lib/client-intake/sourcing"

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
  certification_image_urls?: string[]
  quality_systems?: string[]
  quality_systems_other?: string
  oem_odm?: string[]
  company_scale?: string
  export_since_year?: string
  export_markets?: string[]
  export_markets_other?: string
  traceability?: string[]
  supplier_entity_type?: SupplierEntityType
  manufacturing_sources?: ManufacturingSourceEntry[]
  source_verification_consent?: boolean
  source_change_acknowledged?: boolean
  us_sales_channel_status?: UsSalesChannelStatus
  us_sales_channel_notes?: string
  vexim_support_needs?: VeximSupportNeed[]
  vexim_support_other?: string
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
  if (data.source_verification_consent !== true || data.source_change_acknowledged !== true) {
    return { ok: false, error: "source_confirmation_required" }
  }

  const supplierEntityType = isSupplierEntityType(data.supplier_entity_type)
    ? data.supplier_entity_type
    : "unknown"
  const usSalesChannelStatus = isUsSalesChannelStatus(data.us_sales_channel_status)
    ? data.us_sales_channel_status
    : "unknown"
  const manufacturingSources = normalizeManufacturingSources(data.manufacturing_sources)
  const supportNeeds = normalizeSupportNeeds(data.vexim_support_needs)
  const certifications = (Array.isArray(data.certifications) ? data.certifications : []).filter(
    (value): value is string =>
      typeof value === "string" &&
      value.trim() !== "" &&
      value.trim().toLowerCase() !== "fda registration",
  )

  // Reject invalid/replayed links before making a billable AI request. The RPC
  // below remains the final authority (it atomically checks status + expiry).
  const admin = createAdminClient()
  const { data: pendingSubmission, error: preflightError } = await admin
    .from("client_intake_submissions")
    .select("id")
    .eq("token", token)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle()

  if (preflightError) {
    console.error("[client intake] token preflight failed:", preflightError.message)
    return { ok: false, error: "submit_failed" }
  }
  if (!pendingSubmission) return { ok: false, error: "link_expired" }

  // Only descriptive/business text is sent for translation. Legal company and
  // contact names, email, phone, tax IDs, documents, and selected enum values
  // are intentionally kept as entered.
  const textFields: Record<string, string | undefined> = {
    tagline: data.tagline,
    company_description: data.company_description,
    main_products: data.main_products,
    production_capacity: data.production_capacity,
    moq: data.moq,
    lead_time_days: data.lead_time_days,
    certifications_other: data.certifications_other,
    quality_systems_other: data.quality_systems_other,
    company_scale: data.company_scale,
    export_markets_other: data.export_markets_other,
    payment_policy: data.payment_policy,
    oem_policy: data.oem_policy,
    odm_policy: data.odm_policy,
    us_sales_channel_notes: data.us_sales_channel_notes,
    vexim_support_other: data.vexim_support_other,
  }
  for (const [index, point] of (data.usp_points ?? []).entries()) {
    textFields[`usp_points.${index}.title`] = point.title
  }
  for (const [index, source] of manufacturingSources.entries()) {
    textFields[`manufacturing_sources.${index}.products`] = source.product_names.join("\n")
    textFields[`manufacturing_sources.${index}.relationship_notes`] = source.relationship_notes
    textFields[`manufacturing_sources.${index}.evidence_note`] = source.evidence_note
  }

  const translation = await translateSupplierTextFields(textFields)
  if (translation.status === "failed") {
    return { ok: false, error: "translation_failed" }
  }

  const translatedValue = (key: string, value?: string) =>
    translation.translatedTexts[key] ?? value?.trim() ?? null
  const uspPoints = (data.usp_points ?? []).map((point, index) => ({
    ...point,
    title: translation.translatedTexts[`usp_points.${index}.title`] ?? point.title.trim(),
  }))
  const splitTranslatedProducts = (value: string) =>
    value
      .split(/\r?\n|;/)
      .map((item) => item.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 20)
  const translatedSources = manufacturingSources.map((source, index) => ({
    ...source,
    product_names: splitTranslatedProducts(
      translatedValue(
        `manufacturing_sources.${index}.products`,
        source.product_names.join("\n"),
      ) ?? "",
    ),
    relationship_notes:
      translatedValue(
        `manufacturing_sources.${index}.relationship_notes`,
        source.relationship_notes,
      ) ?? "",
    evidence_note:
      translatedValue(
        `manufacturing_sources.${index}.evidence_note`,
        source.evidence_note,
      ) ?? "",
  }))

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
      tagline: translatedValue("tagline", data.tagline),
      company_description: translatedValue("company_description", data.company_description),
      main_products: translatedValue("main_products", data.main_products),
      production_capacity: translatedValue("production_capacity", data.production_capacity),
      moq: translatedValue("moq", data.moq),
      lead_time_days: translatedValue("lead_time_days", data.lead_time_days),
      usp_points: uspPoints,
      logo_url: data.logo_url?.trim() || null,
      cover_image_url: data.cover_image_url?.trim() || null,
      factory_image_urls: data.factory_image_urls ?? [],
      video_url: data.video_url?.trim() || null,
      certifications,
      certifications_other: translatedValue("certifications_other", data.certifications_other),
      certification_image_urls: data.certification_image_urls ?? [],
      quality_systems: data.quality_systems ?? [],
      quality_systems_other: translatedValue("quality_systems_other", data.quality_systems_other),
      oem_odm: data.oem_odm ?? [],
      company_scale: translatedValue("company_scale", data.company_scale),
      export_since_year: data.export_since_year?.trim() || null,
      export_markets: data.export_markets ?? [],
      export_markets_other: translatedValue("export_markets_other", data.export_markets_other),
      traceability: data.traceability ?? [],
      supplier_entity_type: supplierEntityType,
      manufacturing_sources: translatedSources,
      source_verification_consent: true,
      source_change_acknowledged: true,
      us_sales_channel_status: usSalesChannelStatus,
      us_sales_channel_notes: translatedValue(
        "us_sales_channel_notes",
        data.us_sales_channel_notes,
      ),
      vexim_support_needs: supportNeeds,
      vexim_support_other: translatedValue("vexim_support_other", data.vexim_support_other),
      audit_readiness: data.audit_readiness ?? [],
      audit_owner: data.audit_owner?.trim() || null,
      incoterms: data.incoterms ?? [],
      payment_policy: translatedValue("payment_policy", data.payment_policy),
      oem_policy: translatedValue("oem_policy", data.oem_policy),
      odm_policy: translatedValue("odm_policy", data.odm_policy),
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

  // Best-effort: let the AE know a submission just came in. Never fail the
  // client's submission over this — the row is already saved above.
  notifyAeOfIntakeSubmission(token).catch((err) => {
    console.error("[v0] notifyAeOfIntakeSubmission unexpected error:", err)
  })

  return { ok: true }
}
