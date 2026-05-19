"use server"

/**
 * Lead Researcher buyer entry — creates lead and triggers AI matching.
 *
 * LR no longer picks the client. Instead:
 *   1. Create the lead with buyer details + optional need signals.
 *   2. Immediately call runMatchingPipeline(leadId).
 *   3. AI ranks AEs, creates ae_match_scores, pushes buyer to best AE's inbox.
 */

import { createClient } from "@/lib/supabase/server"
import { runMatchingPipeline } from "@/lib/matching/orchestrator"
import { sendBuyerInquiryReceivedEmailAction } from "@/app/admin/leads/new/buyer-email-actions"

export interface CreateLeadWithAIMatchingInput {
  // Section 1: Thông tin định danh
  companyName: string
  address?: string | null
  website?: string | null
  importyetiUrl?: string | null

  // Contact info
  contactPerson?: string | null
  contactTitle?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  country?: string | null
  notes?: string | null

  // Section 2: Dữ liệu định lượng (ImportYeti)
  totalShipments?: number | null
  latestShipmentDate?: string | null
  avgTeuPerMonth?: number | null
  topPeakMonths?: string | null
  topLowMonths?: string | null

  // Section 3: Mã HS & Sản phẩm
  mainHsCodes?: string | null
  productDescription?: string | null
  secondaryHsCodes?: string | null

  // Section 4: Chuỗi cung ứng hiện tại
  topSuppliers?: string | null
  importCountries?: string | null

  // Section 5: Logistics
  exportPorts?: string | null
  destinationPorts?: string | null
  containerTypes?: string | null

  // Section 6: Ghi chú cho AI
  sampleBolDescription?: string | null
  lrNotes?: string | null
  priorityRating?: number | null
  contactSource?: string | null

  // Legacy fields (for backward compatibility)
  industry?: string | null
  productKeyword?: string | null
  capacityNeeded?: number | null
  potentialValue?: number | null
  hsCode?: string | null
  purchaseHistory?: string | null
  competitors?: string | null
  peakMonths?: string | null
}

export interface CreateLeadWithAIMatchingResult {
  success: boolean
  leadId?: string
  error?: string
}

export async function createLeadWithAIMatchingAction(
  input: CreateLeadWithAIMatchingInput,
): Promise<CreateLeadWithAIMatchingResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  // Verify caller is lead_researcher or admin/super_admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const role = profile?.role
  if (
    !role ||
    !["super_admin", "admin", "lead_researcher"].includes(role)
  ) {
    return { success: false, error: "Insufficient permissions" }
  }

  // 1. Create the lead with all ImportYeti data
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert({
      // Section 1: Thông tin định danh
      company_name: input.companyName.trim(),
      address: input.address?.trim() ?? null,
      website: input.website?.trim() ?? null,
      importyeti_url: input.importyetiUrl?.trim() ?? null,

      // Contact info
      contact_person: input.contactPerson?.trim() ?? null,
      contact_title: input.contactTitle?.trim() ?? null,
      contact_email: input.contactEmail?.trim() ?? null,
      contact_phone: input.contactPhone?.trim() ?? null,
      country: input.country?.trim() ?? null,
      notes: input.notes?.trim() ?? null,

      // Section 2: Dữ liệu định lượng
      total_shipments: input.totalShipments ?? null,
      latest_shipment_date: input.latestShipmentDate ?? null,
      avg_teu_per_month: input.avgTeuPerMonth ?? null,
      top_peak_months: input.topPeakMonths?.trim() ?? null,
      top_low_months: input.topLowMonths?.trim() ?? null,

      // Section 3: Mã HS & Sản phẩm
      main_hs_codes: input.mainHsCodes?.trim() ?? null,
      product_description: input.productDescription?.trim() ?? null,
      secondary_hs_codes: input.secondaryHsCodes?.trim() ?? null,
      // Legacy field mapping
      hs_code: input.hsCode?.trim() ?? input.mainHsCodes?.trim() ?? null,

      // Section 4: Chuỗi cung ứng hiện tại
      top_suppliers: input.topSuppliers?.trim() ?? null,
      import_countries: input.importCountries?.trim() ?? null,
      // Legacy field
      competitors: input.competitors?.trim() ?? input.topSuppliers?.trim() ?? null,

      // Section 5: Logistics
      export_ports: input.exportPorts?.trim() ?? null,
      destination_ports: input.destinationPorts?.trim() ?? null,
      container_types: input.containerTypes?.trim() ?? null,

      // Section 6: Ghi chú cho AI
      sample_bol_description: input.sampleBolDescription?.trim() ?? null,
      lr_notes: input.lrNotes?.trim() ?? null,
      priority_rating: input.priorityRating ?? null,
      contact_source: input.contactSource?.trim() ?? null,

      // Legacy fields
      industry: input.industry ?? null,
      purchase_history: input.purchaseHistory?.trim() ?? null,
      peak_months: input.peakMonths?.trim() ?? input.topPeakMonths?.trim() ?? null,

      created_by: user.id,
    })
    .select()
    .single()

  if (leadError || !lead) {
    console.error("[v0] createLeadWithAIMatchingAction lead insert failed:", leadError)
    return { success: false, error: leadError?.message ?? "Failed to create lead" }
  }

  // 2. Log activity: lead created
  await supabase.from("activities").insert([
    {
      lead_id: lead.id,
      action_type: "lead_created",
      description: lead.company_name,
      performed_by: user.id,
    },
  ])

  // 3. Trigger AI matching pipeline
  // This will create ae_match_scores, push to ae_match_inbox, etc.
  try {
    const matchingResult = await runMatchingPipeline(lead.id, {
      needsIndustry: input.industry,
      needsProduct: input.productKeyword,
      needsCapacity: input.capacityNeeded,
      potentialValue: input.potentialValue,
    })

    if (!matchingResult.success) {
      console.warn(
        "[v0] runMatchingPipeline partial failure for lead",
        lead.id,
        matchingResult.error,
      )
      // Non-fatal — lead was created, matching just had issues.
      // Log it so support can debug, but return success.
    }
  } catch (err) {
    console.error("[v0] runMatchingPipeline error for lead", lead.id, err)
    // Non-fatal — lead creation succeeded, matching pipeline had an exception.
    // The lead exists and will be manually matched if needed.
  }

  // 4. Send buyer acknowledgement email (fire-and-forget)
  if (input.contactEmail?.trim()) {
    try {
      await sendBuyerInquiryReceivedEmailAction(lead.id)
    } catch (err) {
      console.error("[v0] sendBuyerInquiryReceivedEmailAction failed for lead", lead.id, err)
    }
  }

  return { success: true, leadId: lead.id }
}

