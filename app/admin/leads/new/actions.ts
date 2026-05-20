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

/**
 * Parse top suppliers string into JSONB array format.
 * Input: "Thao Tam (VN), Tai Nhung (VN), Comextra Majora (Indonesia)"
 * Output: [{ name: "Thao Tam", country: "VN" }, ...]
 */
function parseTopSuppliers(suppliersStr: string): { name: string; country: string | null }[] {
  if (!suppliersStr.trim()) return []
  
  return suppliersStr.split(",").map(s => {
    const trimmed = s.trim()
    // Match pattern: "Name (Country)" or just "Name"
    const match = trimmed.match(/^(.+?)\s*\(([^)]+)\)$/)
    if (match) {
      return { name: match[1].trim(), country: match[2].trim() }
    }
    return { name: trimmed, country: null }
  }).filter(s => s.name)
}

export interface CreateLeadWithAIMatchingInput {
  companyName: string
  contactPerson?: string | null
  contactTitle?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  country?: string | null
  website?: string | null
  notes?: string | null
  
  // Section 1: THÔNG TIN ĐỊNH DANH
  importAddress?: string | null
  importYetiLink?: string | null
  
  // Section 2: DỮ LIỆU ĐỊNH LƯỢNG (ImportYeti data)
  totalShipments?: number | null
  lastShipmentDate?: string | null
  avgTeuPerMonth?: number | null
  topPeakMonths?: string | null
  topLowMonths?: string | null
  peakMonthsDataYear?: number | null
  importTrend?: string | null
  
  // Section 3: MÃ HS & SẢN PHẨM
  industry?: string | null
  mainProduct?: string | null
  hsCode?: string | null
  secondaryHsCodes?: string | null
  
  // Section 4: CHUỖI CUNG ỨNG
  topSuppliers?: string | null
  mainImportCountries?: string | null
  
  // Section 5: LOGISTICS
  originPorts?: string | null
  destinationPorts?: string | null
  containerTypes?: string | null
  
  // Section 6: GHI CHÚ CHO AI
  bolDescription?: string | null
  purchaseHistory?: string | null
  competitors?: string | null
  priorityRating?: number | null
  
  // Legacy fields for AI matching
  productKeyword?: string | null
  capacityNeeded?: number | null
  potentialValue?: number | null
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

  // 1. Create the lead with all 7 sections of data
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert({
      // Basic info
      company_name: input.companyName.trim(),
      contact_person: input.contactPerson?.trim() ?? null,
      contact_title: input.contactTitle?.trim() ?? null,
      contact_email: input.contactEmail?.trim() ?? null,
      contact_phone: input.contactPhone?.trim() ?? null,
      country: input.country?.trim() ?? null,
      website: input.website?.trim() ?? null,
      notes: input.notes?.trim() ?? null,
      
      // Section 1: THÔNG TIN ĐỊNH DANH
      import_address: input.importAddress?.trim() ?? null,
      source_ref: input.importYetiLink?.trim() ?? null,
      source: input.importYetiLink ? "importyeti" : null,
      
      // Section 2: DỮ LIỆU ĐỊNH LƯỢNG
      total_shipments: input.totalShipments ?? null,
      last_shipment_date: input.lastShipmentDate ?? null,
      avg_teu_per_month: input.avgTeuPerMonth ?? null,
      top_peak_months: input.topPeakMonths?.trim() ?? null,
      top_low_months: input.topLowMonths?.trim() ?? null,
      peak_months_data_year: input.peakMonthsDataYear ?? null,
      import_trend: input.importTrend?.trim() ?? null,
      
      // Section 3: MÃ HS & SẢN PHẨM
      industry: input.industry ?? null,
      main_product: input.mainProduct?.trim() ?? null,
      hs_code: input.hsCode?.trim() ?? null,
      secondary_hs_codes: input.secondaryHsCodes?.trim() ?? null,
      
      // Section 4: CHUỖI CUNG ỨNG
      top_suppliers: input.topSuppliers ? parseTopSuppliers(input.topSuppliers) : null,
      main_import_countries: input.mainImportCountries?.trim() ?? null,
      
      // Section 5: LOGISTICS
      origin_ports: input.originPorts?.trim() ?? null,
      destination_ports: input.destinationPorts?.trim() ?? null,
      container_types: input.containerTypes?.trim() ?? null,
      
      // Section 6: GHI CHÚ CHO AI
      bol_description: input.bolDescription?.trim() ?? null,
      purchase_history: input.purchaseHistory?.trim() ?? null,
      competitors: input.competitors?.trim() ?? null,
      peak_months: input.peakMonths?.trim() ?? null,
      priority_rating: input.priorityRating ?? null,
      
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

