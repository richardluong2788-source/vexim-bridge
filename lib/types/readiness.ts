/**
 * Export Readiness Assessment Types
 *
 * Types cho module AI Export Readiness Coach - đánh giá mức độ sẵn sàng
 * xuất khẩu của client thông qua wizard "Khai bệnh → Chẩn đoán → Kê đơn".
 */

// ============================================================
// Database Types
// ============================================================

export type ReadinessTier = "gold" | "potential" | "pending"
export type AssessmentStatus = "in_progress" | "completed" | "expired"

export interface ReadinessAssessment {
  id: string
  client_id: string
  readiness_score: number | null
  tier: ReadinessTier | null
  strengths: ReadinessStrength[]
  gaps: ReadinessGap[]
  action_plan: ActionPlanItem[]
  answers: AssessmentAnswers
  status: AssessmentStatus
  current_step: number
  started_at: string
  completed_at: string | null
  created_at: string
  updated_at: string
}

// ============================================================
// Questionnaire Types
// ============================================================

export interface AssessmentAnswers {
  // Step 1: Product Information
  productInfo?: {
    mainProducts: string[]
    productCategories: ProductCategory[]
    monthlyCapacity: CapacityRange
    certifications: string[]
    hasOwnBrand: boolean
    canPrivateLabel: boolean
  }

  // Step 2: Compliance & Documents
  compliance?: {
    hasFDA: boolean
    fdaNumber?: string
    fdaExpiryDate?: string
    hasHACCP: boolean
    hasISO22000: boolean
    hasOrganic: boolean
    organicCertBody?: string
    hasFactoryVideo: boolean
    hasFactoryPhotos: boolean
    hasCOA: boolean
    coaLabName?: string
  }

  // Step 3: Export Experience
  exportExperience?: {
    hasExportedBefore: boolean
    yearsExporting?: YearsExportingRange
    previousMarkets?: string[]
    currentBuyers?: number
    biggestOrderValue?: OrderValueRange
    hasUsMarketExperience: boolean
    mainChallenges?: string[]
  }

  // Step 4: Business Readiness
  businessReadiness?: {
    hasEnglishSpeaker: boolean
    responseTimeHours: ResponseTimeRange
    moqFlexibility: MOQFlexibility
    paymentTermsAccepted: string[]
    leadTimeWeeks: LeadTimeRange
    canProvideSamples: boolean
    sampleLeadTimeDays?: number
  }
}

// ============================================================
// Enum Types for Questions
// ============================================================

export type ProductCategory =
  | "food_beverage"
  | "seafood"
  | "agriculture"
  | "coffee_tea"
  | "nuts_dried_fruits"
  | "spices"
  | "textiles"
  | "furniture"
  | "handicrafts"
  | "other"

export type CapacityRange =
  | "under_10_tons"
  | "10_to_50_tons"
  | "50_to_200_tons"
  | "200_to_500_tons"
  | "over_500_tons"

export type YearsExportingRange =
  | "never"
  | "under_2_years"
  | "2_to_5_years"
  | "5_to_10_years"
  | "over_10_years"

export type OrderValueRange =
  | "under_10k"
  | "10k_to_50k"
  | "50k_to_200k"
  | "200k_to_500k"
  | "over_500k"

export type ResponseTimeRange =
  | "under_4_hours"
  | "4_to_12_hours"
  | "12_to_24_hours"
  | "24_to_48_hours"
  | "over_48_hours"

export type MOQFlexibility =
  | "very_flexible" // Can do trial orders
  | "somewhat_flexible" // Lower MOQ for first order
  | "standard" // Fixed MOQ
  | "high_moq" // High MOQ only

export type LeadTimeRange =
  | "under_2_weeks"
  | "2_to_4_weeks"
  | "4_to_8_weeks"
  | "8_to_12_weeks"
  | "over_12_weeks"

// ============================================================
// Analysis Result Types
// ============================================================

export interface ReadinessStrength {
  category: "product" | "compliance" | "experience" | "business"
  code: string
  title: string
  titleVi: string
  description: string
  descriptionVi: string
  impactScore: number // 1-10
}

export interface ReadinessGap {
  category: "product" | "compliance" | "experience" | "business"
  code: string
  title: string
  titleVi: string
  description: string
  descriptionVi: string
  severity: "critical" | "high" | "medium" | "low"
  suggestedAction: string
  suggestedActionVi: string
  estimatedTimeToFix?: string
  estimatedCost?: string
  veximService?: string // Cross-sell opportunity
  scoreBoostIfFixed?: number // How many points fixing this gap adds to score
}

export interface ActionPlanItem {
  priority: "urgent" | "important" | "nice_to_have"
  order: number
  title: string
  titleVi: string
  description: string
  descriptionVi: string
  // Advisor-tone motivational context shown below the description
  advisorNote?: string
  advisorNoteVi?: string
  category: "product" | "compliance" | "experience" | "business"
  relatedGapCode?: string
  estimatedTimeToComplete: string
  resources?: string[]
  veximCanHelp: boolean
  veximServiceName?: string
  // CTA button that links to the relevant Vexim service page
  veximCtaLabel?: string
  veximCtaLabelVi?: string
  veximCtaUrl?: string
}

// ============================================================
// Scoring Types
// ============================================================

export interface ScoreBreakdown {
  productScore: number // 0-20
  complianceScore: number // 0-35
  experienceScore: number // 0-25
  businessScore: number // 0-20
  totalScore: number // 0-100
  tier: ReadinessTier
}

// ============================================================
// UI Types
// ============================================================

export interface WizardStep {
  id: number
  key: keyof AssessmentAnswers
  title: string
  titleVi: string
  description: string
  descriptionVi: string
  icon: string
}

export const WIZARD_STEPS: WizardStep[] = [
  {
    id: 1,
    key: "productInfo",
    title: "Product Information",
    titleVi: "Thông tin sản phẩm",
    description: "Tell us about your products and production capacity",
    descriptionVi: "Giới thiệu về sản phẩm và năng lực sản xuất của bạn",
    icon: "Package",
  },
  {
    id: 2,
    key: "compliance",
    title: "Compliance & Documents",
    titleVi: "Chứng chỉ & Hồ sơ",
    description: "Your certifications and compliance documents",
    descriptionVi: "Các chứng chỉ và hồ sơ tuân thủ của bạn",
    icon: "FileCheck",
  },
  {
    id: 3,
    key: "exportExperience",
    title: "Export Experience",
    titleVi: "Kinh nghiệm xuất khẩu",
    description: "Your history and experience in international trade",
    descriptionVi: "Lịch sử và kinh nghiệm trong thương mại quốc tế",
    icon: "Globe",
  },
  {
    id: 4,
    key: "businessReadiness",
    title: "Business Readiness",
    titleVi: "Sẵn sàng kinh doanh",
    description: "Your operational readiness for US market",
    descriptionVi: "Sự sẵn sàng vận hành cho thị trường Mỹ",
    icon: "Briefcase",
  },
]

// ============================================================
// Question Definitions
// ============================================================

export interface QuestionOption {
  value: string
  label: string
  labelVi: string
}

export interface QuestionDefinition {
  id: string
  type: "select" | "multiselect" | "radio" | "checkbox" | "text" | "number"
  label: string
  labelVi: string
  description?: string
  descriptionVi?: string
  options?: QuestionOption[]
  required?: boolean
  dependsOn?: {
    field: string
    value: unknown
  }
}

// Product categories with labels
export const PRODUCT_CATEGORY_OPTIONS: QuestionOption[] = [
  { value: "food_beverage", label: "Food & Beverage", labelVi: "Thực phẩm & Đồ uống" },
  { value: "seafood", label: "Seafood", labelVi: "Thủy hải sản" },
  { value: "agriculture", label: "Agriculture", labelVi: "Nông sản" },
  { value: "coffee_tea", label: "Coffee & Tea", labelVi: "Cà phê & Trà" },
  { value: "nuts_dried_fruits", label: "Nuts & Dried Fruits", labelVi: "Hạt & Trái cây sấy" },
  { value: "spices", label: "Spices & Herbs", labelVi: "Gia vị & Thảo mộc" },
  { value: "textiles", label: "Textiles & Garments", labelVi: "Dệt may" },
  { value: "furniture", label: "Furniture & Wood", labelVi: "Nội thất & Gỗ" },
  { value: "handicrafts", label: "Handicrafts", labelVi: "Thủ công mỹ nghệ" },
  { value: "other", label: "Other", labelVi: "Khác" },
]

export const CAPACITY_OPTIONS: QuestionOption[] = [
  { value: "under_10_tons", label: "Under 10 tons/month", labelVi: "Dưới 10 tấn/tháng" },
  { value: "10_to_50_tons", label: "10-50 tons/month", labelVi: "10-50 tấn/tháng" },
  { value: "50_to_200_tons", label: "50-200 tons/month", labelVi: "50-200 tấn/tháng" },
  { value: "200_to_500_tons", label: "200-500 tons/month", labelVi: "200-500 tấn/tháng" },
  { value: "over_500_tons", label: "Over 500 tons/month", labelVi: "Trên 500 tấn/tháng" },
]

export const CERTIFICATION_OPTIONS: QuestionOption[] = [
  { value: "haccp", label: "HACCP", labelVi: "HACCP" },
  { value: "iso22000", label: "ISO 22000", labelVi: "ISO 22000" },
  { value: "brc", label: "BRC", labelVi: "BRC" },
  { value: "organic_usda", label: "USDA Organic", labelVi: "USDA Organic" },
  { value: "organic_eu", label: "EU Organic", labelVi: "EU Organic" },
  { value: "globalgap", label: "GlobalGAP", labelVi: "GlobalGAP" },
  { value: "fsc", label: "FSC (Wood)", labelVi: "FSC (Gỗ)" },
  { value: "fair_trade", label: "Fair Trade", labelVi: "Fair Trade" },
  { value: "kosher", label: "Kosher", labelVi: "Kosher" },
  { value: "halal", label: "Halal", labelVi: "Halal" },
]

export const YEARS_EXPORTING_OPTIONS: QuestionOption[] = [
  { value: "never", label: "Never exported", labelVi: "Chưa từng xuất khẩu" },
  { value: "under_2_years", label: "Under 2 years", labelVi: "Dưới 2 năm" },
  { value: "2_to_5_years", label: "2-5 years", labelVi: "2-5 năm" },
  { value: "5_to_10_years", label: "5-10 years", labelVi: "5-10 năm" },
  { value: "over_10_years", label: "Over 10 years", labelVi: "Trên 10 năm" },
]

export const ORDER_VALUE_OPTIONS: QuestionOption[] = [
  { value: "under_10k", label: "Under $10,000", labelVi: "Dưới $10,000" },
  { value: "10k_to_50k", label: "$10,000 - $50,000", labelVi: "$10,000 - $50,000" },
  { value: "50k_to_200k", label: "$50,000 - $200,000", labelVi: "$50,000 - $200,000" },
  { value: "200k_to_500k", label: "$200,000 - $500,000", labelVi: "$200,000 - $500,000" },
  { value: "over_500k", label: "Over $500,000", labelVi: "Trên $500,000" },
]

export const EXPORT_MARKETS_OPTIONS: QuestionOption[] = [
  { value: "us", label: "United States", labelVi: "Mỹ" },
  { value: "eu", label: "European Union", labelVi: "Liên minh Châu Âu" },
  { value: "japan", label: "Japan", labelVi: "Nhật Bản" },
  { value: "korea", label: "South Korea", labelVi: "Hàn Quốc" },
  { value: "china", label: "China", labelVi: "Trung Quốc" },
  { value: "australia", label: "Australia", labelVi: "Úc" },
  { value: "middle_east", label: "Middle East", labelVi: "Trung Đông" },
  { value: "asean", label: "ASEAN", labelVi: "ASEAN" },
  { value: "other", label: "Other", labelVi: "Khác" },
]

export const CHALLENGES_OPTIONS: QuestionOption[] = [
  { value: "finding_buyers", label: "Finding buyers", labelVi: "Tìm kiếm buyer" },
  { value: "pricing", label: "Competitive pricing", labelVi: "Định giá cạnh tranh" },
  { value: "documentation", label: "Export documentation", labelVi: "Hồ sơ xuất khẩu" },
  { value: "compliance", label: "Compliance requirements", labelVi: "Yêu cầu tuân thủ" },
  { value: "logistics", label: "Logistics & shipping", labelVi: "Logistics & vận chuyển" },
  { value: "communication", label: "Language/communication", labelVi: "Ngôn ngữ/giao tiếp" },
  { value: "payment", label: "Payment terms & risk", labelVi: "Điều khoản thanh toán & rủi ro" },
  { value: "quality", label: "Quality consistency", labelVi: "Ổn định chất lượng" },
]

export const RESPONSE_TIME_OPTIONS: QuestionOption[] = [
  { value: "under_4_hours", label: "Under 4 hours", labelVi: "Dưới 4 giờ" },
  { value: "4_to_12_hours", label: "4-12 hours", labelVi: "4-12 giờ" },
  { value: "12_to_24_hours", label: "12-24 hours", labelVi: "12-24 giờ" },
  { value: "24_to_48_hours", label: "24-48 hours", labelVi: "24-48 giờ" },
  { value: "over_48_hours", label: "Over 48 hours", labelVi: "Trên 48 giờ" },
]

export const MOQ_FLEXIBILITY_OPTIONS: QuestionOption[] = [
  { value: "very_flexible", label: "Very flexible (trial orders OK)", labelVi: "Rất linh hoạt (nhận đơn thử)" },
  { value: "somewhat_flexible", label: "Somewhat flexible", labelVi: "Tương đối linh hoạt" },
  { value: "standard", label: "Standard MOQ", labelVi: "MOQ tiêu chuẩn" },
  { value: "high_moq", label: "High MOQ only", labelVi: "Chỉ nhận MOQ cao" },
]

export const PAYMENT_TERMS_OPTIONS: QuestionOption[] = [
  { value: "tt_advance", label: "T/T in advance (100%)", labelVi: "T/T trả trước (100%)" },
  { value: "tt_partial", label: "T/T partial (30/70)", labelVi: "T/T một phần (30/70)" },
  { value: "lc_sight", label: "L/C at sight", labelVi: "L/C at sight" },
  { value: "lc_term", label: "L/C at term", labelVi: "L/C có kỳ hạn" },
  { value: "da_dp", label: "D/A or D/P", labelVi: "D/A hoặc D/P" },
  { value: "open_account", label: "Open Account", labelVi: "Ghi sổ (Open Account)" },
]

export const LEAD_TIME_OPTIONS: QuestionOption[] = [
  { value: "under_2_weeks", label: "Under 2 weeks", labelVi: "Dưới 2 tuần" },
  { value: "2_to_4_weeks", label: "2-4 weeks", labelVi: "2-4 tuần" },
  { value: "4_to_8_weeks", label: "4-8 weeks", labelVi: "4-8 tuần" },
  { value: "8_to_12_weeks", label: "8-12 weeks", labelVi: "8-12 tuần" },
  { value: "over_12_weeks", label: "Over 12 weeks", labelVi: "Trên 12 tuần" },
]
