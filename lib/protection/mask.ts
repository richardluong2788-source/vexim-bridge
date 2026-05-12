import type { Stage } from "@/lib/supabase/types"

/**
 * Layered disclosure rules for buyer identity on the client-facing portal.
 *
 * The goal is to prevent disintermediation (client contacting the buyer directly
 * and bypassing VXB commission) while still giving the client enough context to
 * trust the work being done.
 *
 * Disclosure levels:
 *   - level 1 (default, early stages): only anonymous code + industry + region + product needs
 *   - level 2 (price_agreed onwards):  company name + potential value becomes visible, contact info still hidden
 *   - level 3 (shipped+/won):           full contact info + sensitive intel visible (deal is closed / commission locked)
 *
 * Field categories:
 *   - ALWAYS VISIBLE: industry, region/country, product_needed, capacity_needed, hs_code, peak_months
 *   - LEVEL 2+: company_name, potential_value
 *   - LEVEL 3 ONLY: contact info (person, title, email, phone), website, linkedin, purchase_history, competitors, notes
 *
 * NOTE: this is a UI-side safeguard. Server queries and RLS should also enforce
 * that sensitive columns never reach the client bundle for early-stage leads.
 */

export type DisclosureLevel = 1 | 2 | 3

const LEVEL_2_STAGES: ReadonlyArray<Stage> = ["price_agreed", "production", "shipped", "won"]
const LEVEL_3_STAGES: ReadonlyArray<Stage> = ["shipped", "won"]

export function disclosureLevelFor(stage: Stage): DisclosureLevel {
  if (LEVEL_3_STAGES.includes(stage)) return 3
  if (LEVEL_2_STAGES.includes(stage)) return 2
  return 1
}

/**
 * Input interface matching the leads table + enriched_data fields
 */
export interface LeadInput {
  // Identity
  company_name: string
  
  // Contact info (Level 3 only)
  contact_person: string | null
  contact_title: string | null  // "Chức vụ"
  contact_email: string | null
  contact_phone: string | null
  
  // Online presence (Level 3 only)
  website: string | null
  linkedin_url: string | null
  
  // General info (Always visible)
  industry: string | null       // "Ngành hàng"
  region: string | null         // "Khu vực"
  country: string | null        // "Quốc gia"
  
  // Product needs (Always visible - helps client prepare)
  product_needed: string | null     // "Sản phẩm cần"
  capacity_needed: string | null    // "Công suất cần (tấn/tháng)"
  hs_code: string | null            // "Mã HS"
  peak_months: string | null        // "Tháng cao điểm"
  
  // Business intel (Level 2+ for value, Level 3 for sensitive)
  potential_value: number | null    // "Giá trị tiềm năng (USD)"
  purchase_history: string | null   // "Lịch sử mua hàng" - Level 3 only
  competitors: string | null        // "Đối thủ chính" - Level 3 only
  notes: string | null              // "Ghi chú" - Level 3 only
}

/**
 * Output interface with masked fields based on disclosure level
 */
export interface MaskedBuyer {
  /** Always safe to show. Code like "US-1042" replaces the buyer's real company name at level 1. */
  displayName: string
  /** Only present at level >= 2. */
  revealedCompanyName: string | null
  
  // Always visible fields
  industry: string | null
  region: string | null
  country: string | null
  productNeeded: string | null
  capacityNeeded: string | null
  hsCode: string | null
  peakMonths: string | null
  
  // Level 2+ fields
  potentialValue: number | null
  
  // Level 3 only fields
  website: string | null
  linkedinUrl: string | null
  contactPerson: string | null
  contactTitle: string | null
  contactEmail: string | null
  contactPhone: string | null
  purchaseHistory: string | null
  competitors: string | null
  notes: string | null
  
  level: DisclosureLevel
}

/**
 * Masks buyer information based on the opportunity stage.
 * 
 * NOTE: `buyer_code` lives on the **opportunity** (not the lead), so the caller
 * passes it explicitly. This keeps the mask pure and easy to test regardless
 * of where the code originates.
 */
export function maskBuyer(
  lead: LeadInput,
  stage: Stage,
  buyerCode: string | null,
): MaskedBuyer {
  const level = disclosureLevelFor(stage)
  const code = buyerCode ?? "US-XXXX"

  return {
    // Identity - Level 2+ to see real name
    displayName: level >= 2 ? lead.company_name : code,
    revealedCompanyName: level >= 2 ? lead.company_name : null,
    
    // Always visible - general info
    industry: lead.industry,
    region: lead.region,
    country: lead.country,
    
    // Always visible - product needs (client needs this to prepare offer)
    productNeeded: lead.product_needed,
    capacityNeeded: lead.capacity_needed,
    hsCode: lead.hs_code,
    peakMonths: lead.peak_months,
    
    // Level 2+ - business value
    potentialValue: level >= 2 ? lead.potential_value : null,
    
    // Level 3 only - online presence
    website: level >= 3 ? lead.website : null,
    linkedinUrl: level >= 3 ? lead.linkedin_url : null,
    
    // Level 3 only - contact details
    contactPerson: level >= 3 ? lead.contact_person : null,
    contactTitle: level >= 3 ? lead.contact_title : null,
    contactEmail: level >= 3 ? lead.contact_email : null,
    contactPhone: level >= 3 ? lead.contact_phone : null,
    
    // Level 3 only - sensitive business intel
    purchaseHistory: level >= 3 ? lead.purchase_history : null,
    competitors: level >= 3 ? lead.competitors : null,
    notes: level >= 3 ? lead.notes : null,
    
    level,
  }
}

/**
 * Helper to extract LeadInput from a lead record + enriched_data
 * Use this when you have a raw lead from the database
 */
export function toLeadInput(lead: {
  company_name: string
  contact_person?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  linkedin_url?: string | null
  industry?: string | null
  website?: string | null
  region?: string | null
  country?: string | null
  notes?: string | null
  enriched_data?: Record<string, unknown> | null
}): LeadInput {
  const enriched = lead.enriched_data ?? {}
  
  return {
    company_name: lead.company_name,
    contact_person: lead.contact_person ?? null,
    contact_title: (enriched.contact_title as string) ?? null,
    contact_email: lead.contact_email ?? null,
    contact_phone: lead.contact_phone ?? null,
    website: lead.website ?? null,
    linkedin_url: lead.linkedin_url ?? null,
    industry: lead.industry ?? null,
    region: lead.region ?? null,
    country: lead.country ?? null,
    product_needed: (enriched.product_needed as string) ?? null,
    capacity_needed: (enriched.capacity_needed as string) ?? null,
    hs_code: (enriched.hs_code as string) ?? null,
    peak_months: (enriched.peak_months as string) ?? null,
    potential_value: (enriched.potential_value as number) ?? null,
    purchase_history: (enriched.purchase_history as string) ?? null,
    competitors: (enriched.competitors as string) ?? null,
    notes: lead.notes ?? null,
  }
}
