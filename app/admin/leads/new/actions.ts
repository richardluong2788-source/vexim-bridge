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

/**
 * Extract key supplier information from purchase history.
 * Input: "Mua của Visimex Corp Joint Stock Com (VN) từ năm 2024, năm 2025 mua của Procesadora De Alimentos Santa Isab (Chile) số lượng 16.800kg"
 * Output: { vietnamSupplier: "Visimex Corp Joint Stock Com", vietnamYear: "2024", currentSupplier: "Procesadora De Alimentos Santa Isab", currentYear: "2025", volume: "16,800kg" }
 */
function extractPurchaseHistoryData(purchaseHistory: string | null): {
  vietnamSupplier: string | null
  vietnamYear: string | null
  currentSupplier: string | null
  currentYear: string | null
  volume: string | null
} {
  const result = {
    vietnamSupplier: null,
    vietnamYear: null,
    currentSupplier: null,
    currentYear: null,
    volume: null,
  }

  if (!purchaseHistory?.trim()) return result

  const text = purchaseHistory.toLowerCase()

  // Extract Vietnam supplier and year: "Mua của [NAME] (VN) từ năm [YEAR]" or just "[NAME] (VN)" + year mention
  const vnMatch = purchaseHistory.match(/[Mm]ua\s+của\s+(.+?)\s*\((?:VN|Việt\s*Nam|Vietnam)\)(?:.*?từ\s+năm\s+(\d{4}))?/)
  if (vnMatch) {
    result.vietnamSupplier = vnMatch[1].trim()
    result.vietnamYear = vnMatch[2] || null
  }

  // Extract current/recent supplier: Look for supplier name after year or after "(Chile/Brazil/etc)"
  // Pattern: "năm 2025 mua của [NAME] ([COUNTRY])" or just specific country pattern
  const currentMatch = purchaseHistory.match(/năm\s+(\d{4})\s+mua\s+của\s+(.+?)\s*\(([^)]+)\)/)
  if (currentMatch) {
    result.currentYear = currentMatch[1]
    result.currentSupplier = currentMatch[2].trim()
  }

  // Extract volume: "số lượng [NUMBER]kg" or "[NUMBER]kg"
  const volumeMatch = purchaseHistory.match(/(?:số\s+lượng\s+)?(\d+[\.,]\d+)(?:\s*kg)?/)
  if (volumeMatch) {
    result.volume = volumeMatch[1].replace(",", ",") + "kg"
  }

  return result
}

/** Mot lien he bo sung (them nguoi khac o chinh man hinh tao buyer, khong can vao lai chi tiet buyer). */
export interface AdditionalContactInput {
  fullName: string
  title?: string | null
  department?: string | null
  marketRegion?: string | null
  email?: string | null
  phone?: string | null
  isDecisionMaker?: boolean
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
  /** Cac lien he khac cua cong ty (phong ban / dai dien thi truong khac) nhap ngay luc tao. */
  additionalContacts?: AdditionalContactInput[]
  
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

  // Section 7: NHU CẦU THỰC TẾ (direct inquiry — migration 068)
  // TRUE khi buyer chủ động có nhu cầu từ bên ngoài (email/phone/Zalo/hội
  // chợ/giới thiệu) — không phải buyer research từ ImportYeti.
  hasActiveInquiry?: boolean
  inquiryProducts?: string | null
  inquiryQuantity?: string | null
  inquiryTargetPrice?: string | null
  inquiryTimeline?: string | null
  inquiryChannel?: string | null
  inquiryNotes?: string | null

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
      // Direct inquiry (nhu cầu thực tế) được ưu tiên nhận diện hơn
      // ImportYeti — link ImportYeti vẫn lưu ở source_ref.
      source: input.hasActiveInquiry
        ? "direct_inquiry"
        : input.importYetiLink
          ? "importyeti"
          : null,
      
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

      // Section 7: NHU CẦU THỰC TẾ (direct inquiry — migration 068)
      has_active_inquiry: input.hasActiveInquiry ?? false,
      inquiry_products: input.hasActiveInquiry
        ? (input.inquiryProducts?.trim() ?? null)
        : null,
      inquiry_quantity: input.hasActiveInquiry
        ? (input.inquiryQuantity?.trim() ?? null)
        : null,
      inquiry_target_price: input.hasActiveInquiry
        ? (input.inquiryTargetPrice?.trim() ?? null)
        : null,
      inquiry_timeline: input.hasActiveInquiry
        ? (input.inquiryTimeline?.trim() ?? null)
        : null,
      inquiry_channel: input.hasActiveInquiry
        ? (input.inquiryChannel ?? null)
        : null,
      inquiry_notes: input.hasActiveInquiry
        ? (input.inquiryNotes?.trim() ?? null)
        : null,
      inquiry_received_at: input.hasActiveInquiry ? new Date().toISOString() : null,

      created_by: user.id,
    })
    .select()
    .single()

  if (leadError || !lead) {
    console.error("[v0] createLeadWithAIMatchingAction lead insert failed:", leadError)
    return { success: false, error: leadError?.message ?? "Failed to create lead" }
  }

  // 1b. Tao dong tuong ung trong buyer_contacts (danh ba nhieu lien he).
  // Truoc day chi ghi vao leads.contact_* nen ngay sau khi tao buyer, tab
  // "Lien he" tren trang chi tiet luon rong - phai vao sua/them lai lien he
  // vua nhap. O day dong bo ca lien he chinh (Section 1) va cac lien he bo
  // sung (phong ban / dai dien thi truong khac) nhap ngay luc tao.
  const contactRows: {
    lead_id: string
    full_name: string
    title: string | null
    department: string | null
    market_region: string | null
    email: string | null
    phone: string | null
    is_primary: boolean
    is_decision_maker: boolean
    status: "active"
    created_by: string
  }[] = []

  if (input.contactPerson?.trim() || input.contactEmail?.trim()) {
    contactRows.push({
      lead_id: lead.id,
      full_name: input.contactPerson?.trim() || "Chưa rõ tên",
      title: input.contactTitle?.trim() ?? null,
      department: null,
      market_region: null,
      email: input.contactEmail?.trim() ?? null,
      phone: input.contactPhone?.trim() ?? null,
      is_primary: true,
      is_decision_maker: true,
      status: "active",
      created_by: user.id,
    })
  }

  for (const c of input.additionalContacts ?? []) {
    if (!c.fullName?.trim()) continue
    contactRows.push({
      lead_id: lead.id,
      full_name: c.fullName.trim(),
      title: c.title?.trim() || null,
      department: c.department?.trim() || null,
      market_region: c.marketRegion?.trim() || null,
      email: c.email?.trim() || null,
      phone: c.phone?.trim() || null,
      is_primary: false,
      is_decision_maker: c.isDecisionMaker ?? false,
      status: "active",
      created_by: user.id,
    })
  }

  if (contactRows.length > 0) {
    const { error: contactsError } = await supabase.from("buyer_contacts").insert(contactRows)
    if (contactsError) {
      console.error("[v0] createLeadWithAIMatchingAction buyer_contacts insert failed:", contactsError)
      // Non-fatal — buyer da duoc tao, LR co the them lai lien he thu cong.
    }
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
    await runMatchingPipeline({
      leadId: lead.id,
      triggeredBy: user.id,
    })
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

