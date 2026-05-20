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
  destinationMarket: MarketCode
  hsCode: string | null

  // PRIMARY: 5 hồ sơ năng lực cốt lõi mà buyer quan tâm khi chào hàng
  primaryDocuments: RequiredDocument[]

  // SECONDARY: Kho tài liệu thứ cấp - không hiện mặc định, cung cấp khi buyer hỏi
  secondaryDocuments: RequiredDocument[]

  // Client's current documents (tất cả)
  clientDocuments: ClientDocument[]

  // Gap analysis chỉ trên primary documents
  documentStatus: {
    code: string
    name: string
    nameVi: string
    status: "has_valid" | "has_expiring" | "has_expired" | "missing"
    clientDoc?: ClientDocument
    priority: "critical" | "high" | "medium" | "low"
    action: string
  }[]

  // Summary (chỉ tính primary)
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
// PRIMARY DOCUMENTS — "Bộ Hồ sơ Tối thiểu" cho giai đoạn chào hàng
// Đây là thứ buyer thực sự hỏi: sản phẩm có an toàn không? chất lượng tốt không?
// Tối đa 5 mục, thay đổi theo ngành sản phẩm + thị trường.
// ============================================================

type ProductCategory = "food_beverage" | "seafood" | "agriculture" | "textiles" | "furniture" | "general"

// 5 hồ sơ cốt lõi mà buyer quan tâm khi chào hàng, theo ngành
const PRIMARY_DOCUMENTS: Record<ProductCategory, RequiredDocument[]> = {
  // Food & Beverage / Seafood / Agriculture — buyer US hỏi: "Nhà máy có đăng ký FDA chưa? COA đâu? HACCP đâu?"
  food_beverage: [
    {
      code: "coa",
      name: "Certificate of Analysis (COA)",
      nameVi: "Giấy phân tích chất lượng (COA)",
      description: "Kết quả kiểm nghiệm chất lượng sản phẩm — bằng chứng thép cho buyer",
      priority: "critical",
    },
    {
      code: "haccp",
      name: "HACCP / ISO 22000 Certification",
      nameVi: "Chứng nhận HACCP hoặc ISO 22000",
      description: "Chứng minh nhà máy sản xuất chuyên nghiệp và an toàn thực phẩm",
      priority: "critical",
    },
    {
      code: "fda_certificate",
      name: "FDA Registration Certificate",
      nameVi: "Giấy đăng ký FDA",
      description: "Tấm vé vào cửa thị trường Mỹ — không có coi như chưa chào được",
      priority: "critical",
      regulatoryBody: "FDA",
    },
    {
      code: "organic_cert",
      name: "Organic Certification",
      nameVi: "Chứng nhận Hữu cơ (Organic)",
      description: "Vũ khí tạo sự khác biệt và bán được giá cao hơn đối thủ",
      priority: "medium",
    },
    {
      code: "product_photos",
      name: "Professional Product Photos",
      nameVi: "Ảnh sản phẩm chuyên nghiệp",
      description: "Thứ đầu tiên buyer nhìn thấy — thể hiện sự chuyên nghiệp",
      priority: "high",
    },
  ],

  seafood: [
    {
      code: "coa",
      name: "Certificate of Analysis (COA)",
      nameVi: "Giấy phân tích chất lượng (COA)",
      description: "Kiểm nghiệm kim loại nặng, kháng sinh, vi khuẩn — buyer bắt buộc yêu cầu",
      priority: "critical",
    },
    {
      code: "haccp",
      name: "HACCP Certification",
      nameVi: "Chứng nhận HACCP",
      description: "Bắt buộc cho cơ sở chế biến thủy sản xuất khẩu",
      priority: "critical",
    },
    {
      code: "health_certificate",
      name: "Health Certificate (NAFIQAD)",
      nameVi: "Giấy chứng nhận y tế (NAFIQAD/DIA)",
      description: "Chứng nhận đủ điều kiện ATTP do cơ quan thẩm quyền VN cấp",
      priority: "critical",
      regulatoryBody: "NAFIQAD",
    },
    {
      code: "fda_certificate",
      name: "FDA Registration Certificate",
      nameVi: "Giấy đăng ký FDA",
      description: "Bắt buộc nếu buyer là Mỹ",
      priority: "high",
      regulatoryBody: "FDA",
    },
    {
      code: "product_photos",
      name: "Professional Product Photos",
      nameVi: "Ảnh sản phẩm chuyên nghiệp",
      description: "Ảnh thực tế sản phẩm, bao bì, kho xưởng",
      priority: "high",
    },
  ],

  agriculture: [
    {
      code: "coa",
      name: "Certificate of Analysis (COA)",
      nameVi: "Giấy phân tích chất lượng (COA)",
      description: "Kiểm nghiệm dư lượng thuốc trừ sâu, aflatoxin — buyer bắt buộc xem",
      priority: "critical",
    },
    {
      code: "haccp",
      name: "HACCP / GlobalGAP Certification",
      nameVi: "Chứng nhận HACCP hoặc GlobalGAP",
      description: "Chứng minh quy trình canh tác/chế biến đạt chuẩn quốc tế",
      priority: "high",
    },
    {
      code: "fda_certificate",
      name: "FDA Registration Certificate",
      nameVi: "Giấy đăng ký FDA",
      description: "Bắt buộc với hàng nông sản xuất Mỹ",
      priority: "critical",
      regulatoryBody: "FDA",
    },
    {
      code: "organic_cert",
      name: "Organic Certification",
      nameVi: "Chứng nhận Hữu cơ (Organic)",
      description: "Lợi thế cạnh tranh lớn nếu sản phẩm đạt chuẩn hữu cơ",
      priority: "medium",
    },
    {
      code: "product_photos",
      name: "Professional Product Photos",
      nameVi: "Ảnh sản phẩm chuyên nghiệp",
      description: "Ảnh thực tế sản phẩm, vườn, kho bãi",
      priority: "high",
    },
  ],

  textiles: [
    {
      code: "oeko_tex",
      name: "OEKO-TEX Standard 100",
      nameVi: "Chứng nhận OEKO-TEX",
      description: "Buyer dệt may quốc tế luôn yêu cầu — chứng minh vải an toàn sức khỏe",
      priority: "critical",
    },
    {
      code: "test_report",
      name: "Product Test Report",
      nameVi: "Báo cáo kiểm nghiệm sản phẩm",
      description: "Kiểm tra chì, phthalate, độ bền màu — theo tiêu chuẩn buyer yêu cầu",
      priority: "critical",
    },
    {
      code: "gots",
      name: "GOTS / Organic Textile Certification",
      nameVi: "Chứng nhận GOTS / Dệt may hữu cơ",
      description: "Lợi thế bán hàng cao cấp cho thị trường EU, US",
      priority: "medium",
    },
    {
      code: "factory_audit",
      name: "Factory Audit Report (BSCI/SMETA)",
      nameVi: "Báo cáo kiểm toán nhà máy (BSCI/SMETA)",
      description: "Buyer lớn thường yêu cầu trước khi đặt hàng lần đầu",
      priority: "high",
    },
    {
      code: "product_photos",
      name: "Professional Product Photos / Tech Pack",
      nameVi: "Ảnh sản phẩm và Tech Pack",
      description: "Ảnh mẫu hàng thực tế và tài liệu kỹ thuật",
      priority: "high",
    },
  ],

  furniture: [
    {
      code: "fsc",
      name: "FSC Certification",
      nameVi: "Chứng nhận FSC",
      description: "Buyer đồ gỗ Mỹ/EU luôn hỏi đầu tiên — chứng minh gỗ hợp pháp bền vững",
      priority: "critical",
      regulatoryBody: "FSC",
    },
    {
      code: "carb_cert",
      name: "CARB P2 / EPA TSCA Title VI",
      nameVi: "Chứng nhận CARB P2 (Formaldehyde)",
      description: "Bắt buộc cho đồ gỗ, ván ép, MDF vào thị trường Mỹ",
      priority: "critical",
      regulatoryBody: "EPA/CARB",
    },
    {
      code: "coa",
      name: "Test Report / Certificate of Analysis",
      nameVi: "Báo cáo kiểm nghiệm sản phẩm",
      description: "Kiểm tra formaldehyde, chì, độ bền — theo yêu cầu thị trường",
      priority: "high",
    },
    {
      code: "factory_audit",
      name: "Factory Audit / Compliance Report",
      nameVi: "Báo cáo kiểm toán nhà máy",
      description: "Chứng minh năng lực sản xuất, quy mô, chất lượng",
      priority: "high",
    },
    {
      code: "product_photos",
      name: "Professional Product Photos / Catalogue",
      nameVi: "Ảnh sản phẩm và Catalogue",
      description: "Catalogue chuyên nghiệp, ảnh thực tế nhà máy và sản phẩm",
      priority: "high",
    },
  ],

  general: [
    {
      code: "coa",
      name: "Certificate of Analysis / Test Report",
      nameVi: "Giấy phân tích/kiểm nghiệm chất lượng",
      description: "Bằng chứng chất lượng sản phẩm cơ bản nhất",
      priority: "critical",
    },
    {
      code: "haccp",
      name: "Quality Management Certification",
      nameVi: "Chứng nhận hệ thống quản lý chất lượng",
      description: "ISO 9001, HACCP hoặc tương đương",
      priority: "high",
    },
    {
      code: "fda_certificate",
      name: "Market Compliance Certificate",
      nameVi: "Chứng nhận tuân thủ thị trường",
      description: "Chứng nhận phù hợp với quy định thị trường đích",
      priority: "high",
    },
    {
      code: "organic_cert",
      name: "Organic / Premium Certification",
      nameVi: "Chứng nhận Hữu cơ / Cao cấp",
      description: "Chứng nhận tạo sự khác biệt với đối thủ",
      priority: "medium",
    },
    {
      code: "product_photos",
      name: "Professional Product Photos",
      nameVi: "Ảnh sản phẩm chuyên nghiệp",
      description: "Ảnh thực tế sản phẩm chất lượng cao",
      priority: "high",
    },
  ],
}

// Market-specific PRIMARY override: chỉ thêm khi thực sự khác biệt so với general
// Ví dụ: EU cần CE mark cho đồ gỗ/điện tử, ASEAN cần Halal cho thực phẩm
const MARKET_PRIMARY_OVERRIDE: Partial<Record<MarketCode, Partial<Record<ProductCategory, RequiredDocument[]>>>> = {
  EU: {
    furniture: [
      {
        code: "fsc",
        name: "FSC Certification",
        nameVi: "Chứng nhận FSC",
        description: "Bắt buộc với đồ gỗ vào EU theo quy định EUDR",
        priority: "critical",
        regulatoryBody: "FSC",
        markets: ["EU"],
      },
      {
        code: "eudr",
        name: "EU Deforestation Regulation (EUDR)",
        nameVi: "Tuân thủ EUDR",
        description: "Quy định mới của EU 2024 — chứng minh gỗ không phá rừng",
        priority: "critical",
        regulatoryBody: "EU Commission",
        markets: ["EU"],
      },
      {
        code: "carb_cert",
        name: "Formaldehyde Test Report",
        nameVi: "Kiểm nghiệm Formaldehyde (EN 717)",
        description: "Tiêu chuẩn phát thải formaldehyde theo quy định EU",
        priority: "critical",
        markets: ["EU"],
      },
      {
        code: "factory_audit",
        name: "Factory Audit Report",
        nameVi: "Báo cáo kiểm toán nhà máy",
        description: "Buyer EU thường yêu cầu trước đơn hàng đầu tiên",
        priority: "high",
        markets: ["EU"],
      },
      {
        code: "product_photos",
        name: "Professional Product Photos / Catalogue",
        nameVi: "Ảnh sản phẩm và Catalogue",
        description: "Catalogue chuyên nghiệp theo chuẩn EU",
        priority: "high",
        markets: ["EU"],
      },
    ],
  },
  ASEAN: {
    food_beverage: [
      {
        code: "halal_cert",
        name: "Halal Certification",
        nameVi: "Chứng nhận Halal",
        description: "Bắt buộc tại Malaysia, Indonesia, Brunei — lợi thế lớn tại ASEAN",
        priority: "critical",
        markets: ["ASEAN"],
      },
      {
        code: "coa",
        name: "Certificate of Analysis (COA)",
        nameVi: "Giấy phân tích chất lượng (COA)",
        description: "Kết quả kiểm nghiệm sản phẩm",
        priority: "critical",
        markets: ["ASEAN"],
      },
      {
        code: "haccp",
        name: "HACCP / ISO 22000",
        nameVi: "Chứng nhận HACCP hoặc ISO 22000",
        description: "Hầu hết buyer ASEAN đều yêu cầu",
        priority: "high",
        markets: ["ASEAN"],
      },
      {
        code: "organic_cert",
        name: "Organic Certification",
        nameVi: "Chứng nhận Hữu cơ",
        description: "Lợi thế cạnh tranh tại thị trường ASEAN cao cấp",
        priority: "medium",
        markets: ["ASEAN"],
      },
      {
        code: "product_photos",
        name: "Professional Product Photos",
        nameVi: "Ảnh sản phẩm chuyên nghiệp",
        description: "Ảnh thực tế sản phẩm, bao bì",
        priority: "high",
        markets: ["ASEAN"],
      },
    ],
    seafood: [
      {
        code: "halal_cert",
        name: "Halal Certification",
        nameVi: "Chứng nhận Halal",
        description: "Bắt buộc xuất thủy sản sang Malaysia, Indonesia",
        priority: "critical",
        markets: ["ASEAN"],
      },
      {
        code: "coa",
        name: "Certificate of Analysis (COA)",
        nameVi: "Giấy phân tích chất lượng (COA)",
        description: "Kiểm nghiệm ATTP bắt buộc",
        priority: "critical",
        markets: ["ASEAN"],
      },
      {
        code: "haccp",
        name: "HACCP Certification",
        nameVi: "Chứng nhận HACCP",
        description: "Tiêu chuẩn chế biến thủy sản",
        priority: "critical",
        markets: ["ASEAN"],
      },
      {
        code: "health_certificate",
        name: "Health Certificate",
        nameVi: "Giấy chứng nhận y tế",
        description: "Do NAFIQAD/DIA cấp",
        priority: "high",
        markets: ["ASEAN"],
      },
      {
        code: "product_photos",
        name: "Professional Product Photos",
        nameVi: "Ảnh sản phẩm chuyên nghiệp",
        description: "Ảnh thực tế sản phẩm và bao bì",
        priority: "high",
        markets: ["ASEAN"],
      },
    ],
  },
}

// ============================================================
// SECONDARY DOCUMENTS — "Kho Tài liệu Thứ cấp"
// Không hiện mặc định. AE lấy ra khi buyer yêu cầu cụ thể.
// ============================================================

const SECONDARY_DOCUMENTS: Record<ProductCategory, RequiredDocument[]> = {
  food_beverage: [
    { code: "phytosanitary", name: "Phytosanitary Certificate", nameVi: "Giấy kiểm dịch thực vật", description: "Cơ quan kiểm dịch VN cấp khi có lô hàng", priority: "medium" },
    { code: "health_certificate", name: "Health Certificate", nameVi: "Giấy chứng nhận y tế", description: "Cơ quan thẩm quyền VN cấp theo yêu cầu buyer", priority: "medium" },
    { code: "origin_certificate", name: "Certificate of Origin (C/O)", nameVi: "Giấy chứng nhận xuất xứ (C/O)", description: "Cấp khi có đơn hàng để hưởng ưu đãi thuế quan", priority: "medium" },
    { code: "business_license", name: "Business Registration", nameVi: "Giấy đăng ký kinh doanh", description: "Cung cấp khi buyer yêu cầu xác minh pháp nhân", priority: "low" },
  ],
  seafood: [
    { code: "catch_certificate", name: "Catch Certificate (IUU)", nameVi: "Giấy chứng nhận đánh bắt (IUU)", description: "EU yêu cầu khi thông quan — cấp theo từng lô hàng", priority: "medium" },
    { code: "origin_certificate", name: "Certificate of Origin (C/O)", nameVi: "Giấy chứng nhận xuất xứ (C/O)", description: "Hưởng ưu đãi thuế EVFTA, CPTPP", priority: "medium" },
    { code: "brc_ifs", name: "BRC/IFS Certification", nameVi: "Chứng nhận BRC/IFS", description: "Buyer siêu thị EU thường yêu cầu thêm", priority: "medium" },
    { code: "business_license", name: "Business Registration", nameVi: "Giấy đăng ký kinh doanh", description: "Khi buyer cần xác minh pháp nhân", priority: "low" },
  ],
  agriculture: [
    { code: "phytosanitary", name: "Phytosanitary Certificate", nameVi: "Giấy kiểm dịch thực vật", description: "Bắt buộc khi thông quan — cấp theo lô hàng", priority: "medium" },
    { code: "fumigation_cert", name: "Fumigation Certificate", nameVi: "Giấy chứng nhận xông khử trùng", description: "Bắt buộc với bao bì gỗ theo ISPM-15", priority: "medium" },
    { code: "origin_certificate", name: "Certificate of Origin (C/O)", nameVi: "Giấy chứng nhận xuất xứ (C/O)", description: "Hưởng ưu đãi thuế quan theo FTA", priority: "medium" },
    { code: "business_license", name: "Business Registration", nameVi: "Giấy đăng ký kinh doanh", description: "Khi buyer cần xác minh pháp nhân", priority: "low" },
  ],
  textiles: [
    { code: "origin_certificate", name: "Certificate of Origin (C/O)", nameVi: "Giấy chứng nhận xuất xứ (C/O)", description: "Quan trọng cho tariff rate với dệt may — cấp theo lô hàng", priority: "medium" },
    { code: "business_license", name: "Business Registration", nameVi: "Giấy đăng ký kinh doanh", description: "Khi buyer cần xác minh pháp nhân", priority: "low" },
  ],
  furniture: [
    { code: "lacey_act", name: "Lacey Act Declaration", nameVi: "Tờ khai Lacey Act", description: "Khai báo khi nhập khẩu vào Mỹ — buyer Mỹ cần xem mẫu", priority: "medium", regulatoryBody: "USDA" },
    { code: "fumigation_cert", name: "Fumigation Certificate (ISPM-15)", nameVi: "Giấy chứng nhận xông khử trùng (ISPM-15)", description: "Bắt buộc với bao bì gỗ — cấp theo lô hàng", priority: "medium" },
    { code: "origin_certificate", name: "Certificate of Origin (C/O)", nameVi: "Giấy chứng nhận xuất xứ (C/O)", description: "Hưởng ưu đãi thuế — cấp theo lô hàng", priority: "medium" },
    { code: "business_license", name: "Business Registration", nameVi: "Giấy đăng ký kinh doanh", description: "Khi buyer cần xác minh pháp nhân", priority: "low" },
  ],
  general: [
    { code: "origin_certificate", name: "Certificate of Origin (C/O)", nameVi: "Giấy chứng nhận xuất xứ (C/O)", description: "Hưởng ưu đãi thuế — cấp theo lô hàng", priority: "medium" },
    { code: "business_license", name: "Business Registration", nameVi: "Giấy đăng ký kinh doanh", description: "Khi buyer cần xác minh pháp nhân", priority: "low" },
  ],
}

const COUNTRY_CODE_MAP = {
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
  return COUNTRY_CODE_MAP[normalized] || "OTHER"
}

// ============================================================
// Helper: Determine product category from HS code / industry / product name
// ============================================================

function determineProductCategory(
  hsCode: string | null,
  industry: string | null,
  productName: string | null
): ProductCategory {
  const searchText = `${hsCode || ""} ${industry || ""} ${productName || ""}`.toLowerCase()

  if (hsCode) {
    const hs2 = hsCode.substring(0, 2)
    const hs4 = hsCode.substring(0, 4)
    const hs2Num = parseInt(hs2)

    if (hs2 === "03" || hs4 === "1604" || hs4 === "1605") return "seafood"
    if (hs2 === "09") return "food_beverage"
    if (hs2 === "07" || hs2 === "08") return "agriculture"
    if (hs2 === "10" || hs2 === "11") return "agriculture"
    if (hs2Num >= 50 && hs2Num <= 63) return "textiles"
    if (hs2 === "44" || hs2 === "94") return "furniture"
    if (hs2Num >= 16 && hs2Num <= 21) return "food_beverage"
  }

  if (/seafood|shrimp|fish|crab|lobster|squid|tuna|pangasius/i.test(searchText)) return "seafood"
  if (/coffee|tea|pepper|spice|cinnamon|cashew|cocoa/i.test(searchText)) return "food_beverage"
  if (/rice|fruit|vegetable|cassava|rubber|coconut|mango|dragon/i.test(searchText)) return "agriculture"
  if (/textile|garment|apparel|clothing|fabric|yarn/i.test(searchText)) return "textiles"
  if (/furniture|wood|timber|plywood|rattan/i.test(searchText)) return "furniture"
  if (/food|beverage|snack|sauce|noodle/i.test(searchText)) return "food_beverage"

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

  // 4. Build PRIMARY documents (5 hồ sơ cốt lõi)
  // Market override takes priority if defined (e.g. EU furniture needs EUDR instead of standard list)
  const marketOverride = MARKET_PRIMARY_OVERRIDE[marketCode]?.[category]
  const primaryDocs: RequiredDocument[] = marketOverride ?? PRIMARY_DOCUMENTS[category]

  // 5. Build SECONDARY documents (kho tài liệu thứ cấp)
  const secondaryDocs: RequiredDocument[] = SECONDARY_DOCUMENTS[category].filter(
    (d) => !primaryDocs.some((p) => p.code === d.code)
  )

  // 6. Fetch client's compliance documents
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

  // 7. Build document status — chỉ trên PRIMARY documents
  const documentStatus = primaryDocs.map((reqDoc) => {
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
        ? "THIẾU - Cần bổ sung trước khi chào hàng"
        : "Thiếu - Nên bổ sung để tăng sức thuyết phục với buyer"
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
    primaryDocuments: primaryDocs,
    secondaryDocuments: secondaryDocs,
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
    KR: "Hàn Quốc (KC)",
    ASEAN: "ASEAN (Halal)",
    OTHER: "Khác",
  }

  const prompt = `Bạn là chuyên gia xuất nhập khẩu Việt Nam. Hãy viết lời khuyên ngắn gọn (3-5 câu) cho AE về tình trạng HỒ SƠ NĂNG LỰC của client trong GIAI ĐOẠN CHÀO HÀNG.

LƯU Ý QUAN TRỌNG: Đây là giai đoạn CHÀO HÀNG, CHƯA CÓ ĐƠN HÀNG. Chỉ đánh giá các hồ sơ chứng minh năng lực (FDA Registration, HACCP, COA, Health Certificate, v.v.). KHÔNG đề cập đến các tài liệu giai đoạn xuất khẩu như B/L, Commercial Invoice, Packing List, Prior Notice vì chưa có hàng để xuất.

Sản phẩm: ${productName}
Ngành: ${category}
Thị trường đích: ${destinationCountry} (${marketName[marketCode]})
Điểm sẵn sàng: ${summary.readinessScore}/100

Tình trạng hồ sơ năng lực:
- Hồ sơ hợp lệ: ${summary.valid}/${summary.total}
- Sắp hết hạn: ${summary.expiringSoon}
- Đã hết hạn: ${summary.expired}
- Còn thiếu: ${summary.missing}

${missingCritical.length > 0 ? `Hồ sơ QUAN TRỌNG còn thiếu: ${missingCritical.map((d) => d.nameVi).join(", ")}` : ""}
${expiringSoon.length > 0 ? `Sắp hết hạn: ${expiringSoon.map((d) => d.nameVi).join(", ")}` : ""}
${expired.length > 0 ? `Đã hết hạn: ${expired.map((d) => d.nameVi).join(", ")}` : ""}

Viết lời khuyên bằng tiếng Việt, tập trung vào:
1. Client có đủ năng lực để chào hàng cho buyer này không?
2. Hồ sơ nào cần bổ sung/gia hạn để tăng độ tin cậy khi chào hàng?
3. Lưu ý gì về quy định thị trường ${marketName[marketCode]}?`

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
      return `Client cần bổ sung ${missingCritical.length} hồ sơ năng lực quan trọng để chào hàng: ${missingCritical.map((d) => d.nameVi).join(", ")}. Vui lòng liên hệ client ngay để chuẩn bị.`
    } else if (expiringSoon.length > 0) {
      return `Có ${expiringSoon.length} hồ sơ sắp hết hạn cần gia hạn: ${expiringSoon.map((d) => d.nameVi).join(", ")}. Nhắc client chuẩn bị gia hạn trước khi chào hàng.`
    } else if (summary.readinessScore >= 80) {
      return `Hồ sơ năng lực của client tương đối đầy đủ (${summary.readinessScore}%). Có thể tự tin chào hàng cho buyer.`
    } else {
      return `Client cần bổ sung thêm ${summary.missing} hồ sơ năng lực để tăng độ tin cậy khi chào hàng. Xem chi tiết bên dưới.`
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

  // Determine category and use PRIMARY documents only
  const category = determineProductCategory(hsCode, industry, productName)
  const primaryDocs = PRIMARY_DOCUMENTS[category]

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

  const missing = primaryDocs
    .filter((r) => !clientDocKinds.has(r.code))
    .map((r) => r.nameVi)

  return {
    category,
    requiredCount: primaryDocs.length,
    clientHas: clientDocKinds.size,
    missing,
    expiringSoon: expiringSoonDocs.map((d) => d.title || d.kind),
  }
}
