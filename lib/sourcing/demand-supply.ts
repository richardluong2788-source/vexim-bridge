/**
 * Demand ↔ Supply board — the Supplier Researcher's compass.
 *
 * Operating model (migration 069 / role supplier_researcher):
 *   LR  sources BUYERS   → they appear here as DEMAND (per industry,
 *                          has_active_inquiry marks real, current demand)
 *   SR  sources SUPPLIERS→ they appear here as SUPPLY (profiles.role =
 *                          'client', industries array)
 *   AE  connects the two sides.
 *
 * This module aggregates BOTH sides per canonical industry so SR can
 * prioritise sourcing where demand exists but supply does not.
 *
 * PRIVACY: this is an aggregate-only view. It never returns buyer names,
 * contacts, or any other buyer PII — only counts per industry and the
 * free-text product lists buyers asked for (inquiry_products), which SR
 * needs to qualify matching suppliers.
 */
import { INDUSTRIES, normalizeIndustry, type Industry } from "@/lib/constants/industries"
import type { createAdminClient } from "@/lib/supabase/admin"

type AdminSB = ReturnType<typeof createAdminClient>

export interface IndustryDemandSupply {
  industry: Industry
  /** Researched buyer leads in this industry (the whole buyer pipeline). */
  buyers: number
  /** Buyers with a REAL, current inquiry (leads.has_active_inquiry). */
  activeInquiries: number
  /** Suppliers (profiles.role = 'client') covering this industry. */
  suppliers: number
  /** Distinct inquiry_products texts from active buyers (max 6). */
  requestedProducts: string[]
}

export interface DemandSupplyBoard {
  /** Sorted: active demand first, then total buyers, then supplier gap. */
  rows: IndustryDemandSupply[]
  totalBuyers: number
  totalActiveInquiries: number
  totalSuppliers: number
  newSuppliers30d: number
  /** Industries with active buyer demand but ZERO suppliers — SR's TODO. */
  urgentIndustries: number
}

export async function getDemandSupplyBoard(
  admin: AdminSB,
): Promise<DemandSupplyBoard> {
  // Demand side: every buyer lead (aggregate only — see privacy note).
  const { data: leads } = await admin
    .from("leads")
    .select("industry, has_active_inquiry, inquiry_products")
    .limit(10000)

  // Supply side: every supplier profile.
  const { data: suppliers } = await admin
    .from("profiles")
    .select("industry, industries, created_at")
    .eq("role", "client")
    .limit(10000)

  const buyersByIndustry = new Map<Industry, number>()
  const inquiriesByIndustry = new Map<Industry, number>()
  const productsByIndustry = new Map<Industry, Set<string>>()
  const suppliersByIndustry = new Map<Industry, number>()

  let totalBuyers = 0
  let totalActiveInquiries = 0

  for (const lead of leads ?? []) {
    const ind = normalizeIndustry(lead.industry)
    if (!ind) continue
    totalBuyers += 1
    buyersByIndustry.set(ind, (buyersByIndustry.get(ind) ?? 0) + 1)
    if (lead.has_active_inquiry) {
      totalActiveInquiries += 1
      inquiriesByIndustry.set(ind, (inquiriesByIndustry.get(ind) ?? 0) + 1)
      const products = (lead.inquiry_products ?? "").trim()
      if (products) {
        const set = productsByIndustry.get(ind) ?? new Set<string>()
        set.add(products)
        productsByIndustry.set(ind, set)
      }
    }
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  let newSuppliers30d = 0

  for (const supplier of suppliers ?? []) {
    // A supplier covers every industry in its industries array (fallback to
    // the legacy scalar column for rows written before migration 018).
    const covered =
      supplier.industries && supplier.industries.length > 0
        ? supplier.industries
        : supplier.industry
          ? [supplier.industry]
          : []
    const counted = new Set<Industry>()
    for (const raw of covered) {
      const ind = normalizeIndustry(raw)
      if (!ind || counted.has(ind)) continue
      counted.add(ind)
      suppliersByIndustry.set(ind, (suppliersByIndustry.get(ind) ?? 0) + 1)
    }
    if (
      supplier.created_at &&
      new Date(supplier.created_at) >= thirtyDaysAgo
    ) {
      newSuppliers30d += 1
    }
  }

  const rows: IndustryDemandSupply[] = INDUSTRIES.map((industry) => {
    const activeInquiries = inquiriesByIndustry.get(industry) ?? 0
    const buyers = buyersByIndustry.get(industry) ?? 0
    const supplierCount = suppliersByIndustry.get(industry) ?? 0
    const products = productsByIndustry.get(industry)
    return {
      industry,
      buyers,
      activeInquiries,
      suppliers: supplierCount,
      requestedProducts: products ? Array.from(products).slice(0, 6) : [],
    }
  })

  // Sort: actionable first — active demand with no supply, then any demand
  // with no supply, then by active demand, then by total buyers.
  rows.sort((a, b) => {
    const gapA = a.activeInquiries > 0 && a.suppliers === 0 ? 0 : a.buyers > 0 && a.suppliers === 0 ? 1 : 2
    const gapB = b.activeInquiries > 0 && b.suppliers === 0 ? 0 : b.buyers > 0 && b.suppliers === 0 ? 1 : 2
    if (gapA !== gapB) return gapA - gapB
    if (b.activeInquiries !== a.activeInquiries) {
      return b.activeInquiries - a.activeInquiries
    }
    return b.buyers - a.buyers
  })

  return {
    rows,
    totalBuyers,
    totalActiveInquiries,
    totalSuppliers: suppliers?.length ?? 0,
    newSuppliers30d,
    urgentIndustries: rows.filter((r) => r.activeInquiries > 0 && r.suppliers === 0)
      .length,
  }
}

// ---------------------------------------------------------------------------
// Buyer demand list — the concrete "what do buyers need right now" feed for
// the Supplier Researcher. DELIBERATELY selects NO contact-PII columns
// (no contact_email / contact_person / contact_phone): SR sees WHAT buyers
// need, not HOW to reach them — reaching out is the AE's job. The full
// (masked) research history lives at /admin/buyers/[id], which gates PII on
// BUYER_PII_VIEW.
// ---------------------------------------------------------------------------
export interface BuyerDemandItem {
  id: string
  companyName: string
  country: string | null
  industry: string | null
  hasActiveInquiry: boolean
  products: string | null
  quantity: string | null
  targetPrice: string | null
  timeline: string | null
  receivedAt: string | null
  createdAt: string | null
  /** Section 3 (mã HS & sản phẩm) — mã HS chính của buyer. */
  hsCode: string | null
  /** Mã HS phụ (secondary_hs_codes, chuỗi tự do). */
  secondaryHsCodes: string | null
  /** Sản phẩm chính buyer nhập khẩu — fallback khi chưa có inquiry. */
  mainProduct: string | null
}

export async function getBuyerDemandList(
  admin: AdminSB,
): Promise<BuyerDemandItem[]> {
  const { data } = await admin
    .from("leads")
    .select(
      `id, company_name, country, industry, has_active_inquiry,
       inquiry_products, inquiry_quantity, inquiry_target_price,
       inquiry_timeline, inquiry_received_at, created_at,
       hs_code, secondary_hs_codes, main_product`,
    )
    .limit(500)

  const items: BuyerDemandItem[] = (data ?? [])
    .filter((l) => (l as { company_name?: string | null }).company_name)
    .map((l) => {
      const lead = l as {
        id: string
        company_name: string
        country: string | null
        industry: string | null
        has_active_inquiry: boolean
        inquiry_products: string | null
        inquiry_quantity: string | null
        inquiry_target_price: string | null
        inquiry_timeline: string | null
        inquiry_received_at: string | null
        created_at: string | null
        hs_code: string | null
        secondary_hs_codes: string | null
        main_product: string | null
      }
      return {
        id: lead.id,
        companyName: lead.company_name,
        country: lead.country,
        // Normalize so the industry filter options and any "my industries"
        // default filter (SR patch) always match canonical values.
        industry: normalizeIndustry(lead.industry),
        hasActiveInquiry: lead.has_active_inquiry,
        products: lead.inquiry_products,
        quantity: lead.inquiry_quantity,
        targetPrice: lead.inquiry_target_price,
        timeline: lead.inquiry_timeline,
        receivedAt: lead.inquiry_received_at,
        createdAt: lead.created_at,
        hsCode: lead.hs_code,
        secondaryHsCodes: lead.secondary_hs_codes,
        mainProduct: lead.main_product,
      }
    })

  // Real, current demand first (newest inquiry on top), then the rest of
  // the researched pool newest-first — so SR reads the top of the list as
  // their live work queue.
  items.sort((a, b) => {
    if (a.hasActiveInquiry !== b.hasActiveInquiry) {
      return a.hasActiveInquiry ? -1 : 1
    }
    const ta = new Date(a.receivedAt ?? a.createdAt ?? 0).getTime()
    const tb = new Date(b.receivedAt ?? b.createdAt ?? 0).getTime()
    return tb - ta
  })

  return items
}
