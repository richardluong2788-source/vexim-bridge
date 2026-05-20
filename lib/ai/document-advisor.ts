"use server"

/**
 * AI Document Advisor - Phân tích sản phẩm buyer và gợi ý hồ sơ cần thiết cho client
 *
 * Flow:
 * 1. Nhận thông tin buyer (HS code, product, industry, destination country)
 * 2. AI phân tích và xác định yêu cầu hồ sơ dựa trên:
 *    - Loại sản phẩm (food, agriculture, seafood, etc.)
 *    - Thị trường đích (US, EU, etc.) → FDA, CE Mark, etc.
 *    - Quy định nhập khẩu (phytosanitary, health cert, etc.)
 * 3. So sánh với compliance_docs của client
 * 4. Trả về gap analysis: có gì, thiếu gì, sắp hết hạn
 */

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateText } from "ai"

// ============================================================
// Types
// ============================================================

export interface RequiredDocument {
  code: string // e.g. "fda_certificate", "phytosanitary", "coa"
  name: string // Human-readable name
  nameVi: string // Vietnamese name
  description: string // Why it's required
  priority: "critical" | "high" | "medium" | "low"
  regulatoryBody?: string // e.g. "FDA", "USDA", "EU Commission"
  markets?: string[] // Which markets require this (empty = all markets)
}

export interface ClientDocument {
  id: string
  kind: string
  title: string | null
  url: string
  expiresAt: string | null
  issuedAt: string | null
  status: "valid" | "expiring_soon" | "expired" | "no_expiry"
  daysUntilExpiry: number | null
}

export interface DocumentGapAnalysis {
  // What buyer needs
  buyerProduct: string
  buyerIndustry: string | null
  destinationCountry: string
  destinationMarket: MarketCode // NEW: Market code for display
  hsCode: string | null

  // Required documents based on product/market
  requiredDocuments: RequiredDocument[]

  // Client's current documents
  clientDocuments: ClientDocument[]

  // Gap analysis
  documentStatus: {
    code: string
    name: string
    nameVi: string
    status: "has_valid" | "has_expiring" | "has_expired" | "missing"
    clientDoc?: ClientDocument
    priority: "critical" | "high" | "medium" | "low"
    action: string // Suggested action in Vietnamese
  }[]

  // Summary
  summary: {
    total: number
    valid: number
    expiringSoon: number
    expired: number
    missing: number
    readinessScore: number // 0-100
  }

  // AI recommendation
  aiRecommendation: string
}

// ============================================================
// Market-specific Document Requirements
// ============================================================

type MarketCode = "US" | "EU" | "CN" | "JP" | "KR" | "ASEAN" | "OTHER"

const MARKET_SPECIFIC_REQUIREMENTS: Record<MarketCode, RequiredDocument[]> = {
  US: [
    {
      code: "fda_certificate",
      name: "FDA Registration Certificate",
      nameVi: "Giấy đăng ký FDA",
      description: "Required for all food/drug products to USA",
      priority: "critical",
      regulatoryBody: "FDA",
      markets: ["US"],
    },
    {
      code: "fda_prior_notice",
      name: "FDA Prior Notice",
      nameVi: "Thông báo trước FDA",
      description: "Must be filed before food shipment arrives in USA",
      priority: "critical",
      regulatoryBody: "FDA",
      markets: ["US"],
    },
    {
      code: "lacey_act",
      name: "Lacey Act Declaration",
      nameVi: "Tờ khai Lacey Act",
      description: "Legal wood sourcing declaration for US",
      priority: "critical",
      regulatoryBody: "USDA",
      markets: ["US"],
    },
    {
      code: "carb_cert",
      name: "CARB/EPA Formaldehyde Certificate",
      nameVi: "Chứng nhận CARB/EPA",
      description: "Required for wood/composite products to California",
      priority: "high",
      regulatoryBody: "EPA",
      markets: ["US"],
    },
  ],

  EU: [
    {
      code: "ce_mark",
      name: "CE Marking",
      nameVi: "Chứng nhận CE",
      description: "Mandatory conformity marking for EU market",
      priority: "critical",
      regulatoryBody: "EU Commission",
      markets: ["EU"],
    },
    {
      code: "eu_health_certificate",
      name: "EU Health Certificate",
      nameVi: "Giấy chứng nhận y tế EU",
      description: "Required for animal products entering EU",
      priority: "critical",
      regulatoryBody: "EU Commission",
      markets: ["EU"],
    },
    {
      code: "eur1",
      name: "EUR.1 Movement Certificate",
      nameVi: "Giấy chứng nhận EUR.1",
      description: "For preferential tariff under EU-VN FTA (EVFTA)",
      priority: "high",
      regulatoryBody: "Customs",
      markets: ["EU"],
    },
    {
      code: "reach_compliance",
      name: "REACH Compliance",
      nameVi: "Tuân thủ REACH",
      description: "Chemical safety regulation for EU",
      priority: "high",
      regulatoryBody: "ECHA",
      markets: ["EU"],
    },
    {
      code: "eudr",
      name: "EU Deforestation Regulation",
      nameVi: "Quy định chống phá rừng EU (EUDR)",
      description: "Required for wood, coffee, cocoa, palm oil, soy, rubber, cattle",
      priority: "critical",
      regulatoryBody: "EU Commission",
      markets: ["EU"],
    },
    {
      code: "flegt",
      name: "FLEGT License",
      nameVi: "Giấy phép FLEGT",
      description: "Forest Law Enforcement for timber to EU",
      priority: "high",
      regulatoryBody: "EU Commission",
      markets: ["EU"],
    },
    {
      code: "iuu_catch_certificate",
      name: "IUU Catch Certificate",
      nameVi: "Giấy chứng nhận IUU",
      description: "Mandatory for all seafood imports to EU",
      priority: "critical",
      regulatoryBody: "EU Commission",
      markets: ["EU"],
    },
  ],

  CN: [
    {
      code: "ccc_cert",
      name: "CCC Certification",
      nameVi: "Chứng nhận CCC (3C)",
      description: "China Compulsory Certification for certain products",
      priority: "critical",
      regulatoryBody: "CNCA",
      markets: ["CN"],
    },
    {
      code: "china_label",
      name: "Chinese Label Compliance",
      nameVi: "Nhãn mác tiếng Trung",
      description: "All products must have Chinese language labels",
      priority: "high",
      regulatoryBody: "SAMR",
      markets: ["CN"],
    },
    {
      code: "aqsiq_registration",
      name: "GACC/AQSIQ Registration",
      nameVi: "Đăng ký GACC/AQSIQ",
      description: "Food facility registration with China customs",
      priority: "critical",
      regulatoryBody: "GACC",
      markets: ["CN"],
    },
  ],

  JP: [
    {
      code: "jis_cert",
      name: "JIS Certification",
      nameVi: "Chứng nhận JIS",
      description: "Japanese Industrial Standards mark",
      priority: "medium",
      regulatoryBody: "JISC",
      markets: ["JP"],
    },
    {
      code: "japan_food_sanitation",
      name: "Japan Food Sanitation Law Compliance",
      nameVi: "Tuân thủ Luật vệ sinh thực phẩm Nhật",
      description: "Required for all food imports to Japan",
      priority: "critical",
      regulatoryBody: "MHLW",
      markets: ["JP"],
    },
    {
      code: "jfoodo_cert",
      name: "JFOODO Registration",
      nameVi: "Đăng ký JFOODO",
      description: "Optional but recommended for food marketing in Japan",
      priority: "low",
      regulatoryBody: "JETRO",
      markets: ["JP"],
    },
  ],

  KR: [
    {
      code: "kc_mark",
      name: "KC Mark Certification",
      nameVi: "Chứng nhận KC",
      description: "Korea Certification mark for safety",
      priority: "critical",
      regulatoryBody: "KATS",
      markets: ["KR"],
    },
    {
      code: "korea_food_import",
      name: "Korea Food Import Declaration",
      nameVi: "Khai báo nhập khẩu thực phẩm Hàn Quốc",
      description: "Required for all food products to Korea",
      priority: "critical",
      regulatoryBody: "MFDS",
      markets: ["KR"],
    },
  ],

  ASEAN: [
    {
      code: "form_d",
      name: "ASEAN Form D",
      nameVi: "Form D ASEAN",
      description: "Certificate of Origin for ASEAN preferential tariff (ATIGA)",
      priority: "high",
      regulatoryBody: "Customs",
      markets: ["ASEAN"],
    },
    {
      code: "halal_cert",
      name: "Halal Certification",
      nameVi: "Chứng nhận Halal",
      description: "Required for food exports to Muslim-majority ASEAN countries",
      priority: "high",
      markets: ["ASEAN"],
    },
  ],

  OTHER: [],
}

// Country to market mapping
const COUNTRY_TO_MARKET: Record<string, MarketCode> = {
  // US
  "united states": "US",
  usa: "US",
  us: "US",
  "united states of america": "US",
  america: "US",

  // EU countries
  germany: "EU",
  france: "EU",
  italy: "EU",
  spain: "EU",
  netherlands: "EU",
  belgium: "EU",
  poland: "EU",
  sweden: "EU",
  austria: "EU",
  denmark: "EU",
  finland: "EU",
  ireland: "EU",
  portugal: "EU",
  greece: "EU",
  "czech republic": "EU",
  romania: "EU",
  hungary: "EU",
  slovakia: "EU",
  bulgaria: "EU",
  croatia: "EU",
  slovenia: "EU",
  lithuania: "EU",
  latvia: "EU",
  estonia: "EU",
  cyprus: "EU",
  luxembourg: "EU",
  malta: "EU",
  eu: "EU",

  // China
  china: "CN",
  cn: "CN",
  prc: "CN",
  "hong kong": "CN",
  hk: "CN",

  // Japan
  japan: "JP",
  jp: "JP",

  // Korea
  korea: "KR",
  "south korea": "KR",
  kr: "KR",
  "republic of korea": "KR",

  // ASEAN
  singapore: "ASEAN",
  malaysia: "ASEAN",
  thailand: "ASEAN",
  indonesia: "ASEAN",
  philippines: "ASEAN",
  myanmar: "ASEAN",
  cambodia: "ASEAN",
  laos: "ASEAN",
  brunei: "ASEAN",
}

function getMarketCode(country: string | null): MarketCode {
  if (!country) return "US" // Default to US
  const normalized = country.toLowerCase().trim()
  return COUNTRY_TO_MARKET[normalized] || "OTHER"
}

// ============================================================
// Document Requirements by Product Category
// ============================================================

const DOCUMENT_REQUIREMENTS: Record<string, RequiredDocument[]> = {
  // Food & Beverage (Coffee, Tea, Spices, etc.)
  food_beverage: [
    {
      code: "fda_certificate",
      name: "FDA Registration Certificate",
      nameVi: "Giấy đăng ký FDA",
      description: "Required for all food products exported to USA",
      priority: "critical",
      regulatoryBody: "FDA",
    },
    {
      code: "coa",
      name: "Certificate of Analysis (COA)",
      nameVi: "Giấy phân tích chất lượng",
      description: "Lab test results for product quality and safety",
      priority: "critical",
    },
    {
      code: "phytosanitary",
      name: "Phytosanitary Certificate",
      nameVi: "Giấy kiểm dịch thực vật",
      description: "Required for plant-based products",
      priority: "high",
      regulatoryBody: "APHIS/USDA",
    },
    {
      code: "health_certificate",
      name: "Health Certificate",
      nameVi: "Giấy chứng nhận y tế",
      description: "Confirms product meets health standards",
      priority: "high",
    },
    {
      code: "origin_certificate",
      name: "Certificate of Origin",
      nameVi: "Giấy chứng nhận xuất xứ (C/O)",
      description: "Required for customs clearance and tariff benefits",
      priority: "medium",
    },
    {
      code: "haccp",
      name: "HACCP Certification",
      nameVi: "Chứng nhận HACCP",
      description: "Food safety management system certification",
      priority: "high",
    },
    {
      code: "organic_cert",
      name: "Organic Certification (if applicable)",
      nameVi: "Chứng nhận hữu cơ",
      description: "Required if product is marketed as organic",
      priority: "medium",
    },
  ],

  // Seafood
  seafood: [
    {
      code: "fda_certificate",
      name: "FDA Registration Certificate",
      nameVi: "Giấy đăng ký FDA",
      description: "Required for all seafood exported to USA",
      priority: "critical",
      regulatoryBody: "FDA",
    },
    {
      code: "coa",
      name: "Certificate of Analysis (COA)",
      nameVi: "Giấy phân tích chất lượng",
      description: "Lab test for heavy metals, antibiotics, bacteria",
      priority: "critical",
    },
    {
      code: "health_certificate",
      name: "Health Certificate",
      nameVi: "Giấy chứng nhận y tế",
      description: "Issued by Vietnam's NAFIQAD",
      priority: "critical",
      regulatoryBody: "NAFIQAD",
    },
    {
      code: "haccp",
      name: "HACCP Certification",
      nameVi: "Chứng nhận HACCP",
      description: "Mandatory for seafood processing facilities",
      priority: "critical",
    },
    {
      code: "catch_certificate",
      name: "Catch Certificate (IUU)",
      nameVi: "Giấy chứng nhận đánh bắt (IUU)",
      description: "Proves legal fishing, required by EU & US",
      priority: "high",
    },
    {
      code: "origin_certificate",
      name: "Certificate of Origin",
      nameVi: "Giấy chứng nhận xuất xứ (C/O)",
      description: "Required for customs and tariff benefits",
      priority: "medium",
    },
    {
      code: "brc_ifs",
      name: "BRC/IFS Certification",
      nameVi: "Chứng nhận BRC/IFS",
      description: "Global food safety standard, preferred by EU retailers",
      priority: "medium",
    },
  ],

  // Agricultural Products
  agriculture: [
    {
      code: "phytosanitary",
      name: "Phytosanitary Certificate",
      nameVi: "Giấy kiểm dịch thực vật",
      description: "Mandatory for all plant products",
      priority: "critical",
      regulatoryBody: "APHIS/USDA",
    },
    {
      code: "coa",
      name: "Certificate of Analysis (COA)",
      nameVi: "Giấy phân tích chất lượng",
      description: "Pesticide residue, aflatoxin tests",
      priority: "critical",
    },
    {
      code: "fumigation_cert",
      name: "Fumigation Certificate",
      nameVi: "Giấy chứng nhận xông khử trùng",
      description: "Required for wood packaging and some crops",
      priority: "high",
    },
    {
      code: "origin_certificate",
      name: "Certificate of Origin",
      nameVi: "Giấy chứng nhận xuất xứ (C/O)",
      description: "For customs and preferential tariffs",
      priority: "medium",
    },
    {
      code: "organic_cert",
      name: "Organic Certification",
      nameVi: "Chứng nhận hữu cơ",
      description: "USDA Organic or equivalent if sold as organic",
      priority: "medium",
    },
    {
      code: "global_gap",
      name: "GlobalGAP Certification",
      nameVi: "Chứng nhận GlobalGAP",
      description: "Good Agricultural Practices certification",
      priority: "medium",
    },
  ],

  // Textiles & Apparel
  textiles: [
    {
      code: "oeko_tex",
      name: "OEKO-TEX Standard 100",
      nameVi: "Chứng nhận OEKO-TEX",
      description: "Textile safety certification",
      priority: "high",
    },
    {
      code: "origin_certificate",
      name: "Certificate of Origin",
      nameVi: "Giấy chứng nhận xuất xứ (C/O)",
      description: "Critical for textile tariffs",
      priority: "critical",
    },
    {
      code: "gots",
      name: "GOTS Certification",
      nameVi: "Chứng nhận GOTS",
      description: "Global Organic Textile Standard",
      priority: "medium",
    },
    {
      code: "test_report",
      name: "Product Test Report",
      nameVi: "Báo cáo kiểm nghiệm sản phẩm",
      description: "Flammability, lead content, phthalates tests",
      priority: "high",
    },
  ],

  // Furniture & Wood Products
  furniture: [
    {
      code: "fumigation_cert",
      name: "Fumigation Certificate",
      nameVi: "Giấy chứng nhận xông khử trùng",
      description: "ISPM-15 compliance for wood packaging",
      priority: "critical",
    },
    {
      code: "lacey_act",
      name: "Lacey Act Declaration",
      nameVi: "Tờ khai Lacey Act",
      description: "Legal wood sourcing declaration for US",
      priority: "critical",
      regulatoryBody: "USDA",
    },
    {
      code: "fsc",
      name: "FSC Certification",
      nameVi: "Chứng nhận FSC",
      description: "Forest Stewardship Council certification",
      priority: "high",
    },
    {
      code: "carb_cert",
      name: "CARB/EPA Certification",
      nameVi: "Chứng nhận CARB/EPA",
      description: "Formaldehyde emission standards",
      priority: "high",
      regulatoryBody: "EPA",
    },
    {
      code: "origin_certificate",
      name: "Certificate of Origin",
      nameVi: "Giấy chứng nhận xuất xứ (C/O)",
      description: "Required for customs clearance",
      priority: "medium",
    },
  ],

  // Default/General
  general: [
    {
      code: "origin_certificate",
      name: "Certificate of Origin",
      nameVi: "Giấy chứng nhận xuất xứ (C/O)",
      description: "Required for customs clearance",
      priority: "high",
    },
    {
      code: "commercial_invoice",
      name: "Commercial Invoice",
      nameVi: "Hóa đơn thương mại",
      description: "Standard export document",
      priority: "critical",
    },
    {
      code: "packing_list",
      name: "Packing List",
      nameVi: "Phiếu đóng gói",
      description: "Detailed shipment contents",
      priority: "high",
    },
    {
      code: "bill_of_lading",
      name: "Bill of Lading",
      nameVi: "Vận đơn (B/L)",
      description: "Shipping document",
      priority: "critical",
    },
  ],
}

// ============================================================
// Helper: Determine product category from HS code or industry
// ============================================================

function determineProductCategory(
  hsCode: string | null,
  industry: string | null,
  productName: string | null
): string {
  const searchText = `${hsCode || ""} ${industry || ""} ${productName || ""}`.toLowerCase()

  // HS Code patterns
  if (hsCode) {
    const hs2 = hsCode.substring(0, 2)
    const hs4 = hsCode.substring(0, 4)

    // Seafood: 03xx, 1604, 1605
    if (hs2 === "03" || hs4 === "1604" || hs4 === "1605") return "seafood"

    // Coffee, Tea, Spices: 09xx
    if (hs2 === "09") return "food_beverage"

    // Vegetables, Fruits: 07xx, 08xx
    if (hs2 === "07" || hs2 === "08") return "agriculture"

    // Cereals, Grains: 10xx, 11xx
    if (hs2 === "10" || hs2 === "11") return "agriculture"

    // Textiles: 50-63
    const hs2Num = parseInt(hs2)
    if (hs2Num >= 50 && hs2Num <= 63) return "textiles"

    // Furniture, Wood: 44xx, 94xx
    if (hs2 === "44" || hs2 === "94") return "furniture"

    // Food preparations: 16xx-21xx
    if (hs2Num >= 16 && hs2Num <= 21) return "food_beverage"
  }

  // Keyword matching
  if (/seafood|shrimp|fish|crab|lobster|squid|tuna|pangasius/i.test(searchText)) {
    return "seafood"
  }
  if (/coffee|tea|pepper|spice|cinnamon|cashew|cocoa/i.test(searchText)) {
    return "food_beverage"
  }
  if (/rice|fruit|vegetable|cassava|rubber|coconut|mango|dragon/i.test(searchText)) {
    return "agriculture"
  }
  if (/textile|garment|apparel|clothing|fabric|yarn/i.test(searchText)) {
    return "textiles"
  }
  if (/furniture|wood|timber|plywood|rattan/i.test(searchText)) {
    return "furniture"
  }
  if (/food|beverage|snack|sauce|noodle/i.test(searchText)) {
    return "food_beverage"
  }

  return "general"
}

// ============================================================
// Helper: Map compliance_docs.kind to document codes
// ============================================================

function mapComplianceKindToCode(kind: string): string[] {
  const mapping: Record<string, string[]> = {
    fda_certificate: ["fda_certificate"],
    coa: ["coa"],
    price_floor: [], // Not a compliance doc
    factory_video: [], // Not a compliance doc
    factory_photo: [], // Not a compliance doc
    other: [], // Could be anything
  }
  return mapping[kind] || []
}

// ============================================================
// Main Function: Analyze Documents for Opportunity
// ============================================================

export async function analyzeDocumentsForOpportunity(
  opportunityId: string
): Promise<DocumentGapAnalysis | null> {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  // 1. Fetch opportunity with lead and client data
  const { data: opportunity, error: oppError } = await supabase
    .from("opportunities")
    .select(`
      id,
      client_id,
      products_interested,
      destination_port,
      leads (
        id,
        main_product,
        hs_code,
        industry,
        country,
        destination_ports
      )
    `)
    .eq("id", opportunityId)
    .single()

  if (oppError || !opportunity) {
    console.error("[v0] Failed to fetch opportunity:", oppError)
    return null
  }

  const lead = opportunity.leads as {
    main_product?: string
    hs_code?: string
    industry?: string
    country?: string
    destination_ports?: string
  } | null

  // 2. Determine product info
  const productName = opportunity.products_interested || lead?.main_product || "Unknown Product"
  const hsCode = lead?.hs_code || null
  const industry = lead?.industry || null
  const destinationCountry = lead?.country || "USA" // Default to USA

  // 3. Determine product category and market code
  const category = determineProductCategory(hsCode, industry, productName)
  const marketCode = getMarketCode(destinationCountry)

  // 4. Get required documents: category-specific + market-specific + general
  const categoryDocs = DOCUMENT_REQUIREMENTS[category] || []
  const marketDocs = MARKET_SPECIFIC_REQUIREMENTS[marketCode] || []

  // Filter market docs by product category relevance
  const relevantMarketDocs = marketDocs.filter((doc) => {
    // FDA, food sanitation docs only for food categories
    if (
      ["fda_certificate", "fda_prior_notice", "japan_food_sanitation", "korea_food_import", "aqsiq_registration"].includes(doc.code) &&
      !["food_beverage", "seafood", "agriculture"].includes(category)
    ) {
      return false
    }
    // Wood-specific docs only for furniture
    if (
      ["lacey_act", "carb_cert", "flegt", "eudr"].includes(doc.code) &&
      !["furniture"].includes(category) &&
      !productName.toLowerCase().includes("wood") &&
      !productName.toLowerCase().includes("timber")
    ) {
      // EUDR also applies to coffee, cocoa, palm oil, soy, rubber
      if (doc.code === "eudr") {
        const eudrProducts = ["coffee", "cocoa", "palm", "soy", "rubber", "cattle", "wood", "timber"]
        if (!eudrProducts.some((p) => productName.toLowerCase().includes(p))) {
          return false
        }
      } else {
        return false
      }
    }
    // IUU only for seafood
    if (doc.code === "iuu_catch_certificate" && category !== "seafood") {
      return false
    }
    return true
  })

  const requiredDocs = [
    ...categoryDocs,
    // Add market-specific docs that aren't already included
    ...relevantMarketDocs.filter(
      (md) => !categoryDocs.some((cd) => cd.code === md.code)
    ),
    // Always include general documents
    ...DOCUMENT_REQUIREMENTS.general.filter(
      (d) => !categoryDocs.some((r) => r.code === d.code) &&
             !relevantMarketDocs.some((r) => r.code === d.code)
    ),
  ]

  // 4. Fetch client's compliance documents
  const { data: clientDocs, error: docsError } = await adminClient
    .from("compliance_docs")
    .select("id, kind, title, url, expires_at, issued_at")
    .eq("owner_id", opportunity.client_id)
    .order("created_at", { ascending: false })

  if (docsError) {
    console.error("[v0] Failed to fetch client docs:", docsError)
  }

  // 5. Process client documents with expiry status
  const now = new Date()
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const processedClientDocs: ClientDocument[] = (clientDocs || []).map((doc) => {
    let status: ClientDocument["status"] = "no_expiry"
    let daysUntilExpiry: number | null = null

    if (doc.expires_at) {
      const expiryDate = new Date(doc.expires_at)
      daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      if (expiryDate < now) {
        status = "expired"
      } else if (expiryDate < thirtyDaysLater) {
        status = "expiring_soon"
      } else {
        status = "valid"
      }
    }

    return {
      id: doc.id,
      kind: doc.kind,
      title: doc.title,
      url: doc.url,
      expiresAt: doc.expires_at,
      issuedAt: doc.issued_at,
      status,
      daysUntilExpiry,
    }
  })

  // 6. Build document status analysis
  const documentStatus = requiredDocs.map((reqDoc) => {
    // Find matching client document
    const matchingDocs = processedClientDocs.filter((cd) => {
      const mappedCodes = mapComplianceKindToCode(cd.kind)
      if (mappedCodes.includes(reqDoc.code)) return true

      // Also check by title matching
      const titleLower = (cd.title || "").toLowerCase()
      const reqNameLower = reqDoc.name.toLowerCase()
      return titleLower.includes(reqDoc.code) || titleLower.includes(reqNameLower)
    })

    // Get the best matching doc (valid > expiring > expired)
    const validDoc = matchingDocs.find((d) => d.status === "valid" || d.status === "no_expiry")
    const expiringDoc = matchingDocs.find((d) => d.status === "expiring_soon")
    const expiredDoc = matchingDocs.find((d) => d.status === "expired")
    const clientDoc = validDoc || expiringDoc || expiredDoc

    let status: "has_valid" | "has_expiring" | "has_expired" | "missing"
    let action: string

    if (validDoc) {
      status = "has_valid"
      action = "Hồ sơ hợp lệ, tiếp tục theo dõi hạn"
    } else if (expiringDoc) {
      status = "has_expiring"
      action = `Sắp hết hạn trong ${expiringDoc.daysUntilExpiry} ngày! Cần gia hạn gấp`
    } else if (expiredDoc) {
      status = "has_expired"
      action = "Đã hết hạn! Cần cập nhật hồ sơ mới"
    } else {
      status = "missing"
      action = reqDoc.priority === "critical"
        ? "THIẾU - Cần bổ sung ngay trước khi xuất hàng"
        : "Thiếu - Nên bổ sung để hoàn thiện hồ sơ"
    }

    return {
      code: reqDoc.code,
      name: reqDoc.name,
      nameVi: reqDoc.nameVi,
      status,
      clientDoc,
      priority: reqDoc.priority,
      action,
    }
  })

  // 7. Calculate summary
  const summary = {
    total: documentStatus.length,
    valid: documentStatus.filter((d) => d.status === "has_valid").length,
    expiringSoon: documentStatus.filter((d) => d.status === "has_expiring").length,
    expired: documentStatus.filter((d) => d.status === "has_expired").length,
    missing: documentStatus.filter((d) => d.status === "missing").length,
    readinessScore: 0,
  }

  // Calculate readiness score with weights
  const criticalDocs = documentStatus.filter((d) => d.priority === "critical")
  const criticalValid = criticalDocs.filter((d) => d.status === "has_valid").length
  const criticalTotal = criticalDocs.length

  summary.readinessScore = Math.round(
    (criticalTotal > 0 ? (criticalValid / criticalTotal) * 60 : 60) +
    (summary.valid / summary.total) * 40
  )

  // 8. Generate AI recommendation
  const aiRecommendation = await generateAIRecommendation({
    productName,
    category,
    marketCode,
    destinationCountry,
    documentStatus,
    summary,
  })

  return {
    buyerProduct: productName,
    buyerIndustry: industry,
    destinationCountry,
    destinationMarket: marketCode,
    hsCode,
    requiredDocuments: requiredDocs,
    clientDocuments: processedClientDocs,
    documentStatus,
    summary,
    aiRecommendation,
  }
}

// ============================================================
// AI Recommendation Generator
// ============================================================

async function generateAIRecommendation(context: {
  productName: string
  category: string
  marketCode: MarketCode
  destinationCountry: string
  documentStatus: DocumentGapAnalysis["documentStatus"]
  summary: DocumentGapAnalysis["summary"]
}): Promise<string> {
  const { productName, category, marketCode, destinationCountry, documentStatus, summary } = context

  const missingCritical = documentStatus.filter(
    (d) => d.status === "missing" && d.priority === "critical"
  )
  const expiringSoon = documentStatus.filter((d) => d.status === "has_expiring")
  const expired = documentStatus.filter((d) => d.status === "has_expired")

  const marketName: Record<MarketCode, string> = {
    US: "Mỹ (FDA, USDA)",
    EU: "EU (CE, REACH, EUDR)",
    CN: "Trung Quốc (CCC, GACC)",
    JP: "Nhật Bản (JIS, MHLW)",
    KR: "Hàn Quốc (KC, MFDS)",
    ASEAN: "ASEAN (Form D, Halal)",
    OTHER: "Khác",
  }

  const prompt = `Bạn là chuyên gia xuất nhập khẩu Việt Nam. Hãy viết lời khuyên ngắn gọn (3-5 câu) cho AE về tình trạng hồ sơ của client khi xuất khẩu sản phẩm này.

Sản phẩm: ${productName}
Ngành: ${category}
Thị trường đích: ${destinationCountry} (${marketName[marketCode]})
Điểm sẵn sàng: ${summary.readinessScore}/100

Tình trạng:
- Hồ sơ hợp lệ: ${summary.valid}/${summary.total}
- Sắp hết hạn: ${summary.expiringSoon}
- Đã hết hạn: ${summary.expired}
- Còn thiếu: ${summary.missing}

${missingCritical.length > 0 ? `Hồ sơ QUAN TRỌNG còn thiếu: ${missingCritical.map((d) => d.nameVi).join(", ")}` : ""}
${expiringSoon.length > 0 ? `Sắp hết hạn: ${expiringSoon.map((d) => d.nameVi).join(", ")}` : ""}
${expired.length > 0 ? `Đã hết hạn: ${expired.map((d) => d.nameVi).join(", ")}` : ""}

Lưu ý các quy định đặc thù của thị trường ${marketName[marketCode]} khi đưa ra lời khuyên.
Viết lời khuyên bằng tiếng Việt, tập trung vào hành động cụ thể AE cần làm ngay.`

  try {
    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      prompt,
      maxTokens: 300,
    })
    return text
  } catch (error) {
    console.error("[v0] AI recommendation error:", error)

    // Fallback recommendation
    if (missingCritical.length > 0) {
      return `⚠️ Client cần bổ sung ${missingCritical.length} hồ sơ quan trọng trước khi xuất hàng: ${missingCritical.map((d) => d.nameVi).join(", ")}. Vui lòng liên hệ client ngay để chuẩn bị.`
    } else if (expiringSoon.length > 0) {
      return `⏰ Có ${expiringSoon.length} hồ sơ sắp hết hạn cần gia hạn: ${expiringSoon.map((d) => d.nameVi).join(", ")}. Nhắc client chuẩn bị gia hạn sớm.`
    } else if (summary.readinessScore >= 80) {
      return `✅ Hồ sơ client tương đối đầy đủ (${summary.readinessScore}%). Có thể tiến hành đàm phán với buyer.`
    } else {
      return `📋 Client cần bổ sung thêm ${summary.missing} hồ sơ để hoàn thiện. Xem chi tiết bên dưới.`
    }
  }
}

// ============================================================
// Quick Analysis (without full AI call)
// ============================================================

export async function quickDocumentCheck(
  clientId: string,
  hsCode: string | null,
  industry: string | null,
  productName: string | null
): Promise<{
  category: string
  requiredCount: number
  clientHas: number
  missing: string[]
  expiringSoon: string[]
}> {
  const adminClient = createAdminClient()

  // Determine category
  const category = determineProductCategory(hsCode, industry, productName)
  const requiredDocs = DOCUMENT_REQUIREMENTS[category] || DOCUMENT_REQUIREMENTS.general

  // Fetch client docs
  const { data: clientDocs } = await adminClient
    .from("compliance_docs")
    .select("kind, title, expires_at")
    .eq("owner_id", clientId)

  const now = new Date()
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const clientDocKinds = new Set((clientDocs || []).map((d) => d.kind))
  const expiringSoonDocs = (clientDocs || []).filter((d) => {
    if (!d.expires_at) return false
    const exp = new Date(d.expires_at)
    return exp > now && exp < thirtyDaysLater
  })

  const missing = requiredDocs
    .filter((r) => !clientDocKinds.has(r.code))
    .map((r) => r.nameVi)

  return {
    category,
    requiredCount: requiredDocs.length,
    clientHas: clientDocKinds.size,
    missing,
    expiringSoon: expiringSoonDocs.map((d) => d.title || d.kind),
  }
}
