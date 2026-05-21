"use server"

/**
 * AI Export Readiness Coach
 *
 * Phân tích câu trả lời từ wizard và đánh giá mức độ sẵn sàng xuất khẩu
 * của client theo 4 tiêu chí:
 * - Product Info (20%): Sản phẩm, chứng chỉ, năng lực sản xuất
 * - Compliance (35%): FDA, HACCP, COA, tài liệu nhà máy
 * - Export Experience (25%): Kinh nghiệm, thị trường, buyer relationships
 * - Business Readiness (20%): Giao tiếp, MOQ, thanh toán, lead time
 *
 * Output: Readiness Score (0-100), Tier (Gold/Potential/Pending),
 *         Strengths, Gaps, và Action Plan với giọng tư vấn cá nhân hóa.
 */

import type {
  AssessmentAnswers,
  ReadinessStrength,
  ReadinessGap,
  ActionPlanItem,
  ScoreBreakdown,
  ReadinessTier,
} from "@/lib/types/readiness"

// ============================================================
// Scoring Constants
// ============================================================

const SCORE_WEIGHTS = {
  product: 20,
  compliance: 35,
  experience: 25,
  business: 20,
} as const

const TIER_THRESHOLDS = {
  gold: 75, // >= 75 = Gold
  potential: 50, // >= 50 = Potential
  // < 50 = Pending
} as const

// ============================================================
// Main Analysis Function
// ============================================================

export interface AnalyzeReadinessResult {
  scoreBreakdown: ScoreBreakdown
  strengths: ReadinessStrength[]
  gaps: ReadinessGap[]
  actionPlan: ActionPlanItem[]
}

export async function analyzeReadiness(
  answers: AssessmentAnswers
): Promise<AnalyzeReadinessResult> {
  // Calculate scores for each category
  const productScore = calculateProductScore(answers.productInfo)
  const complianceScore = calculateComplianceScore(answers.compliance)
  const experienceScore = calculateExperienceScore(answers.exportExperience)
  const businessScore = calculateBusinessScore(answers.businessReadiness)

  const totalScore = Math.round(
    productScore + complianceScore + experienceScore + businessScore
  )

  const tier = calculateTier(totalScore)

  const scoreBreakdown: ScoreBreakdown = {
    productScore,
    complianceScore,
    experienceScore,
    businessScore,
    totalScore,
    tier,
  }

  // Identify strengths and gaps
  const strengths = identifyStrengths(answers, scoreBreakdown)
  const gaps = identifyGaps(answers, scoreBreakdown)

  // Generate personalized action plan
  const actionPlan = await generateActionPlan(gaps, strengths, answers)

  return {
    scoreBreakdown,
    strengths,
    gaps,
    actionPlan,
  }
}

// ============================================================
// Tier Calculation
// ============================================================

export function calculateTier(score: number): ReadinessTier {
  if (score >= TIER_THRESHOLDS.gold) return "gold"
  if (score >= TIER_THRESHOLDS.potential) return "potential"
  return "pending"
}

// ============================================================
// Product Score (Max 20 points)
// ============================================================

function calculateProductScore(
  productInfo: AssessmentAnswers["productInfo"]
): number {
  if (!productInfo) return 0

  let score = 0

  // Main products defined (2 points)
  if (productInfo.mainProducts && productInfo.mainProducts.length > 0) {
    score += 2
  }

  // Product categories (2 points)
  if (productInfo.productCategories && productInfo.productCategories.length > 0) {
    score += 2
  }

  // Production capacity (6 points)
  const capacityScores: Record<string, number> = {
    under_10_tons: 1,
    "10_to_50_tons": 3,
    "50_to_200_tons": 5,
    "200_to_500_tons": 6,
    over_500_tons: 6,
  }
  score += capacityScores[productInfo.monthlyCapacity] || 0

  // Certifications (6 points max - 1.5 per cert, max 4)
  const certCount = Math.min(productInfo.certifications?.length || 0, 4)
  score += certCount * 1.5

  // Private label capability (2 points)
  if (productInfo.canPrivateLabel) {
    score += 2
  }

  // Own brand (2 points)
  if (productInfo.hasOwnBrand) {
    score += 2
  }

  return Math.min(score, SCORE_WEIGHTS.product)
}

// ============================================================
// Compliance Score (Max 35 points) - Most important
// ============================================================

function calculateComplianceScore(
  compliance: AssessmentAnswers["compliance"]
): number {
  if (!compliance) return 0

  let score = 0

  // FDA Registration (12 points) - Critical for US market
  if (compliance.hasFDA) {
    score += 12
    // Bonus if FDA number provided
    if (compliance.fdaNumber) {
      score += 1
    }
  }

  // HACCP (8 points)
  if (compliance.hasHACCP) {
    score += 8
  }

  // ISO 22000 (4 points)
  if (compliance.hasISO22000) {
    score += 4
  }

  // Organic certification (3 points)
  if (compliance.hasOrganic) {
    score += 3
  }

  // COA available (4 points)
  if (compliance.hasCOA) {
    score += 4
  }

  // Factory documentation (3 points)
  if (compliance.hasFactoryVideo) {
    score += 1.5
  }
  if (compliance.hasFactoryPhotos) {
    score += 1.5
  }

  return Math.min(score, SCORE_WEIGHTS.compliance)
}

// ============================================================
// Experience Score (Max 25 points)
// ============================================================

function calculateExperienceScore(
  experience: AssessmentAnswers["exportExperience"]
): number {
  if (!experience) return 0

  let score = 0

  // Has exported before (5 points base)
  if (experience.hasExportedBefore) {
    score += 5

    // Years of experience (5 points)
    const yearsScores: Record<string, number> = {
      under_2_years: 1,
      "2_to_5_years": 3,
      "5_to_10_years": 4,
      over_10_years: 5,
    }
    score += yearsScores[experience.yearsExporting || ""] || 0

    // Previous markets (3 points)
    const marketCount = Math.min(experience.previousMarkets?.length || 0, 3)
    score += marketCount

    // Current buyers (4 points)
    if (experience.currentBuyers) {
      if (experience.currentBuyers >= 10) score += 4
      else if (experience.currentBuyers >= 5) score += 3
      else if (experience.currentBuyers >= 2) score += 2
      else score += 1
    }

    // Order value (4 points)
    const orderScores: Record<string, number> = {
      under_10k: 1,
      "10k_to_50k": 2,
      "50k_to_200k": 3,
      "200k_to_500k": 4,
      over_500k: 4,
    }
    score += orderScores[experience.biggestOrderValue || ""] || 0
  }

  // US market experience (4 points) - Very important
  if (experience.hasUsMarketExperience) {
    score += 4
  }

  return Math.min(score, SCORE_WEIGHTS.experience)
}

// ============================================================
// Business Readiness Score (Max 20 points)
// ============================================================

function calculateBusinessScore(
  business: AssessmentAnswers["businessReadiness"]
): number {
  if (!business) return 0

  let score = 0

  // English speaker (4 points)
  if (business.hasEnglishSpeaker) {
    score += 4
  }

  // Response time (4 points)
  const responseScores: Record<string, number> = {
    under_4_hours: 4,
    "4_to_12_hours": 3,
    "12_to_24_hours": 2,
    "24_to_48_hours": 1,
    over_48_hours: 0,
  }
  score += responseScores[business.responseTimeHours] || 0

  // MOQ flexibility (4 points)
  const moqScores: Record<string, number> = {
    very_flexible: 4,
    somewhat_flexible: 3,
    standard: 2,
    high_moq: 1,
  }
  score += moqScores[business.moqFlexibility] || 0

  // Payment terms accepted (3 points)
  const paymentCount = Math.min(business.paymentTermsAccepted?.length || 0, 3)
  score += paymentCount

  // Lead time (3 points)
  const leadTimeScores: Record<string, number> = {
    under_2_weeks: 3,
    "2_to_4_weeks": 3,
    "4_to_8_weeks": 2,
    "8_to_12_weeks": 1,
    over_12_weeks: 0,
  }
  score += leadTimeScores[business.leadTimeWeeks] || 0

  // Can provide samples (2 points)
  if (business.canProvideSamples) {
    score += 2
  }

  return Math.min(score, SCORE_WEIGHTS.business)
}

// ============================================================
// Identify Strengths
// ============================================================

function identifyStrengths(
  answers: AssessmentAnswers,
  scores: ScoreBreakdown
): ReadinessStrength[] {
  const strengths: ReadinessStrength[] = []

  // Product strengths
  if (answers.productInfo) {
    const pi = answers.productInfo

    if (pi.certifications && pi.certifications.length >= 2) {
      strengths.push({
        category: "product",
        code: "multiple_certs",
        title: "Multiple Certifications",
        titleVi: "Nhiều chứng chỉ",
        description: `Has ${pi.certifications.length} industry certifications`,
        descriptionVi: `Có ${pi.certifications.length} chứng chỉ ngành`,
        impactScore: 8,
      })
    }

    if (pi.canPrivateLabel) {
      strengths.push({
        category: "product",
        code: "private_label",
        title: "Private Label Capability",
        titleVi: "Có thể gia công nhãn riêng",
        description: "Can produce under buyer's brand - highly valued by US buyers",
        descriptionVi: "Có thể sản xuất dưới thương hiệu của buyer - rất được US buyers đánh giá cao",
        impactScore: 7,
      })
    }

    const highCapacity = ["50_to_200_tons", "200_to_500_tons", "over_500_tons"]
    if (highCapacity.includes(pi.monthlyCapacity)) {
      strengths.push({
        category: "product",
        code: "high_capacity",
        title: "Strong Production Capacity",
        titleVi: "Năng lực sản xuất mạnh",
        description: "Can handle large orders consistently",
        descriptionVi: "Có thể xử lý đơn hàng lớn ổn định",
        impactScore: 8,
      })
    }
  }

  // Compliance strengths
  if (answers.compliance) {
    const comp = answers.compliance

    if (comp.hasFDA && comp.fdaNumber) {
      strengths.push({
        category: "compliance",
        code: "fda_ready",
        title: "FDA Registered",
        titleVi: "Đã đăng ký FDA",
        description: "Ready to export to US market immediately",
        descriptionVi: "Sẵn sàng xuất khẩu sang thị trường Mỹ ngay lập tức",
        impactScore: 10,
      })
    }

    if (comp.hasHACCP && comp.hasISO22000) {
      strengths.push({
        category: "compliance",
        code: "food_safety_certs",
        title: "Comprehensive Food Safety",
        titleVi: "An toàn thực phẩm toàn diện",
        description: "Has both HACCP and ISO 22000 certifications",
        descriptionVi: "Có cả chứng chỉ HACCP và ISO 22000",
        impactScore: 9,
      })
    }

    if (comp.hasFactoryVideo && comp.hasFactoryPhotos && comp.hasCOA) {
      strengths.push({
        category: "compliance",
        code: "full_documentation",
        title: "Complete Documentation",
        titleVi: "Hồ sơ đầy đủ",
        description: "Has factory video, photos, and COA ready for buyers",
        descriptionVi: "Có video nhà máy, ảnh và COA sẵn sàng cho buyer",
        impactScore: 8,
      })
    }
  }

  // Experience strengths
  if (answers.exportExperience) {
    const exp = answers.exportExperience

    if (exp.hasUsMarketExperience) {
      strengths.push({
        category: "experience",
        code: "us_experience",
        title: "US Market Experience",
        titleVi: "Có kinh nghiệm thị trường Mỹ",
        description: "Already familiar with US buyer requirements",
        descriptionVi: "Đã quen với yêu cầu của US buyer",
        impactScore: 9,
      })
    }

    const highExperience = ["5_to_10_years", "over_10_years"]
    if (exp.yearsExporting && highExperience.includes(exp.yearsExporting)) {
      strengths.push({
        category: "experience",
        code: "veteran_exporter",
        title: "Experienced Exporter",
        titleVi: "Nhà xuất khẩu giàu kinh nghiệm",
        description: "Over 5 years of export experience",
        descriptionVi: "Trên 5 năm kinh nghiệm xuất khẩu",
        impactScore: 8,
      })
    }

    const highValue = ["50k_to_200k", "200k_to_500k", "over_500k"]
    if (exp.biggestOrderValue && highValue.includes(exp.biggestOrderValue)) {
      strengths.push({
        category: "experience",
        code: "large_order_history",
        title: "Large Order Track Record",
        titleVi: "Có lịch sử đơn hàng lớn",
        description: "Has successfully handled orders over $50,000",
        descriptionVi: "Đã xử lý thành công đơn hàng trên $50,000",
        impactScore: 7,
      })
    }
  }

  // Business strengths
  if (answers.businessReadiness) {
    const bus = answers.businessReadiness

    if (bus.hasEnglishSpeaker) {
      strengths.push({
        category: "business",
        code: "english_capability",
        title: "English Communication",
        titleVi: "Có khả năng tiếng Anh",
        description: "Can communicate directly with US buyers",
        descriptionVi: "Có thể giao tiếp trực tiếp với US buyer",
        impactScore: 8,
      })
    }

    if (bus.moqFlexibility === "very_flexible") {
      strengths.push({
        category: "business",
        code: "flexible_moq",
        title: "Flexible MOQ",
        titleVi: "MOQ linh hoạt",
        description: "Willing to accept trial orders - great for new relationships",
        descriptionVi: "Sẵn sàng nhận đơn thử - rất tốt cho quan hệ mới",
        impactScore: 7,
      })
    }

    const fastResponse = ["under_4_hours", "4_to_12_hours"]
    if (fastResponse.includes(bus.responseTimeHours)) {
      strengths.push({
        category: "business",
        code: "fast_response",
        title: "Fast Response Time",
        titleVi: "Phản hồi nhanh",
        description: "Can respond to inquiries within 12 hours",
        descriptionVi: "Có thể phản hồi yêu cầu trong vòng 12 giờ",
        impactScore: 6,
      })
    }
  }

  return strengths.sort((a, b) => b.impactScore - a.impactScore)
}

// ============================================================
// Identify Gaps
// ============================================================

function identifyGaps(
  answers: AssessmentAnswers,
  scores: ScoreBreakdown
): ReadinessGap[] {
  const gaps: ReadinessGap[] = []

  // Compliance gaps (most critical)
  if (answers.compliance) {
    const comp = answers.compliance

    if (!comp.hasFDA) {
      gaps.push({
        category: "compliance",
        code: "no_fda",
        title: "No FDA Registration",
        titleVi: "Chưa đăng ký FDA",
        description: "Cannot legally export food products to US without FDA registration",
        descriptionVi: "Không thể xuất khẩu thực phẩm sang Mỹ hợp pháp mà không có đăng ký FDA",
        severity: "critical",
        suggestedAction: "Register with FDA Food Facility Registration portal",
        suggestedActionVi: "Đăng ký tại cổng FDA Food Facility Registration",
        estimatedTimeToFix: "2-4 weeks",
        estimatedCost: "$150-500",
        veximService: "Vexim Global - FDA Registration Support",
        scoreBoostIfFixed: 13,
      })
    }

    if (!comp.hasHACCP) {
      gaps.push({
        category: "compliance",
        code: "no_haccp",
        title: "No HACCP Certification",
        titleVi: "Chưa có chứng chỉ HACCP",
        description: "Most US buyers require HACCP for food safety assurance",
        descriptionVi: "Hầu hết US buyer yêu cầu HACCP để đảm bảo an toàn thực phẩm",
        severity: "high",
        suggestedAction: "Implement HACCP system and get certified by accredited body",
        suggestedActionVi: "Triển khai hệ thống HACCP và được chứng nhận bởi tổ chức uy tín",
        estimatedTimeToFix: "3-6 months",
        estimatedCost: "$3,000-10,000",
        scoreBoostIfFixed: 8,
      })
    }

    if (!comp.hasCOA) {
      gaps.push({
        category: "compliance",
        code: "no_coa",
        title: "No Certificate of Analysis",
        titleVi: "Chưa có giấy phân tích chất lượng",
        description: "Buyers need COA to verify product quality and safety",
        descriptionVi: "Buyer cần COA để xác minh chất lượng và an toàn sản phẩm",
        severity: "high",
        suggestedAction: "Get product tested at accredited lab",
        suggestedActionVi: "Kiểm nghiệm sản phẩm tại phòng thí nghiệm uy tín",
        estimatedTimeToFix: "1-2 weeks",
        estimatedCost: "$200-500 per test",
        scoreBoostIfFixed: 4,
      })
    }

    if (!comp.hasFactoryVideo || !comp.hasFactoryPhotos) {
      gaps.push({
        category: "compliance",
        code: "no_factory_docs",
        title: "Missing Factory Documentation",
        titleVi: "Thiếu tài liệu nhà máy",
        description: "Factory video and photos build trust with buyers",
        descriptionVi: "Video và ảnh nhà máy giúp xây dựng niềm tin với buyer",
        severity: "medium",
        suggestedAction: "Create professional factory tour video and photo set",
        suggestedActionVi: "Tạo video tham quan nhà máy và bộ ảnh chuyên nghiệp",
        estimatedTimeToFix: "1-2 weeks",
        estimatedCost: "$500-2,000",
        scoreBoostIfFixed: 3,
      })
    }
  } else {
    // No compliance info at all - critical
    gaps.push({
      category: "compliance",
      code: "no_compliance_info",
      title: "No Compliance Information",
      titleVi: "Chưa có thông tin tuân thủ",
      description: "Compliance documentation is essential for US market entry",
      descriptionVi: "Hồ sơ tuân thủ là thiết yếu để thâm nhập thị trường Mỹ",
      severity: "critical",
      suggestedAction: "Complete compliance assessment",
      suggestedActionVi: "Hoàn thành đánh giá tuân thủ",
      estimatedTimeToFix: "1-3 months",
    })
  }

  // Experience gaps
  if (answers.exportExperience) {
    const exp = answers.exportExperience

    if (!exp.hasExportedBefore) {
      gaps.push({
        category: "experience",
        code: "no_export_experience",
        title: "No Export Experience",
        titleVi: "Chưa có kinh nghiệm xuất khẩu",
        description: "First-time exporters face steeper learning curve",
        descriptionVi: "Người xuất khẩu lần đầu sẽ gặp nhiều thách thức hơn",
        severity: "high",
        suggestedAction: "Partner with experienced trading company like Vexim",
        suggestedActionVi: "Hợp tác với công ty thương mại có kinh nghiệm như Vexim",
        veximService: "Vexim Bridge - Export Partnership Program",
        scoreBoostIfFixed: 9,
      })
    }

    if (exp.hasExportedBefore && !exp.hasUsMarketExperience) {
      gaps.push({
        category: "experience",
        code: "no_us_experience",
        title: "No US Market Experience",
        titleVi: "Chưa có kinh nghiệm thị trường Mỹ",
        description: "US market has specific requirements and buyer expectations",
        descriptionVi: "Thị trường Mỹ có yêu cầu và kỳ vọng đặc thù của buyer",
        severity: "medium",
        suggestedAction: "Work with US market specialists to understand requirements",
        suggestedActionVi: "Làm việc với chuyên gia thị trường Mỹ để hiểu yêu cầu",
        veximService: "Vexim Bridge - US Market Entry Support",
        scoreBoostIfFixed: 4,
      })
    }
  }

  // Business gaps
  if (answers.businessReadiness) {
    const bus = answers.businessReadiness

    if (!bus.hasEnglishSpeaker) {
      gaps.push({
        category: "business",
        code: "no_english",
        title: "No English Communication",
        titleVi: "Không có khả năng giao tiếp tiếng Anh",
        description: "Direct communication with US buyers is essential",
        descriptionVi: "Giao tiếp trực tiếp với US buyer là thiết yếu",
        severity: "high",
        suggestedAction: "Hire bilingual staff or work through Vexim as intermediary",
        suggestedActionVi: "Tuyển nhân viên song ngữ hoặc làm việc qua Vexim làm trung gian",
        veximService: "Vexim Bridge - Communication Support",
        scoreBoostIfFixed: 4,
      })
    }

    const slowResponse = ["24_to_48_hours", "over_48_hours"]
    if (slowResponse.includes(bus.responseTimeHours)) {
      gaps.push({
        category: "business",
        code: "slow_response",
        title: "Slow Response Time",
        titleVi: "Thời gian phản hồi chậm",
        description: "US buyers expect responses within 24 hours due to time zone",
        descriptionVi: "US buyer mong đợi phản hồi trong 24 giờ do múi giờ",
        severity: "medium",
        suggestedAction: "Improve communication processes or use Vexim for US timezone coverage",
        suggestedActionVi: "Cải thiện quy trình giao tiếp hoặc dùng Vexim để phủ múi giờ Mỹ",
      })
    }

    if (bus.moqFlexibility === "high_moq") {
      gaps.push({
        category: "business",
        code: "inflexible_moq",
        title: "High MOQ Only",
        titleVi: "Chỉ nhận MOQ cao",
        description: "New buyers prefer to start with smaller trial orders",
        descriptionVi: "Buyer mới thường muốn bắt đầu với đơn thử nhỏ hơn",
        severity: "medium",
        suggestedAction: "Consider offering trial order options for new relationships",
        suggestedActionVi: "Cân nhắc cung cấp tùy chọn đơn thử cho quan hệ mới",
      })
    }
  }

  // Product gaps
  if (answers.productInfo) {
    const pi = answers.productInfo

    if (!pi.certifications || pi.certifications.length === 0) {
      gaps.push({
        category: "product",
        code: "no_certifications",
        title: "No Product Certifications",
        titleVi: "Không có chứng chỉ sản phẩm",
        description: "Certifications differentiate you from competitors",
        descriptionVi: "Chứng chỉ giúp bạn khác biệt với đối thủ",
        severity: "medium",
        suggestedAction: "Pursue relevant certifications for your product category",
        suggestedActionVi: "Theo đuổi các chứng chỉ phù hợp cho danh mục sản phẩm của bạn",
      })
    }

    if (pi.monthlyCapacity === "under_10_tons") {
      gaps.push({
        category: "product",
        code: "low_capacity",
        title: "Limited Production Capacity",
        titleVi: "Năng lực sản xuất hạn chế",
        description: "May limit ability to serve large US buyers",
        descriptionVi: "Có thể hạn chế khả năng phục vụ US buyer lớn",
        severity: "low",
        suggestedAction: "Focus on specialty/niche buyers or plan capacity expansion",
        suggestedActionVi: "Tập trung vào buyer chuyên biệt/ngách hoặc lên kế hoạch mở rộng công suất",
      })
    }
  }

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  return gaps.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
}

// ============================================================
// Generate Action Plan with Advisor Tone + Cross-sell CTAs
// ============================================================

// Maps a gap code to a human, advisor-tone prescription
const GAP_ADVISOR_NOTES: Record<string, { en: string; vi: string }> = {
  no_fda: {
    en: "This is the single most important step you can take right now. Without FDA registration, US buyers simply cannot place an order with you — no matter how great your product is. The good news: it only takes 2-4 weeks and Vexim can handle the entire process for you.",
    vi: "Đây là bước quan trọng nhất bạn cần làm ngay lúc này. Không có đăng ký FDA, US buyer không thể đặt hàng từ bạn dù sản phẩm tốt đến đâu. Tin tốt là: chỉ mất 2-4 tuần và Vexim có thể xử lý toàn bộ quy trình cho bạn.",
  },
  no_haccp: {
    en: "Many exporters overlook this — and then lose deals because of it. HACCP is your 'food safety passport'. Once you have it, you'll notice buyers' tone changes immediately. Don't wait for a buyer to ask for it.",
    vi: "Nhiều nhà xuất khẩu bỏ qua điều này và sau đó mất hợp đồng vì nó. HACCP là 'hộ chiếu an toàn thực phẩm' của bạn. Khi có chứng chỉ này, bạn sẽ nhận thấy thái độ của buyer thay đổi ngay lập tức. Đừng chờ buyer hỏi mới làm.",
  },
  no_coa: {
    en: "Great news — this is one of the fastest wins available to you. A COA from an accredited lab can be ready in 1-2 weeks and immediately boosts your credibility with every buyer you approach.",
    vi: "Tin tốt — đây là một trong những cải thiện nhanh nhất bạn có thể làm. COA từ phòng thí nghiệm được công nhận có thể hoàn thành trong 1-2 tuần và ngay lập tức tăng độ tin cậy với mọi buyer bạn tiếp cận.",
  },
  no_factory_docs: {
    en: "You'd be surprised how much a professional factory video changes buyer perception. Think of it as your '30-second elevator pitch' — buyers decide if they trust you within the first minute of seeing your facility.",
    vi: "Bạn sẽ ngạc nhiên khi video nhà máy chuyên nghiệp thay đổi nhận thức của buyer như thế nào. Hãy xem nó như 'bài giới thiệu 30 giây' — buyer quyết định có tin bạn không trong vòng 1 phút đầu nhìn thấy cơ sở của bạn.",
  },
  no_export_experience: {
    en: "Every successful exporter started exactly where you are. The key is to not navigate this alone. A strong partner who already knows the US market can cut your learning curve from 2 years to 2 months.",
    vi: "Mọi nhà xuất khẩu thành công đều bắt đầu từ đúng vị trí của bạn. Điều quan trọng là đừng đi một mình. Một đối tác mạnh đã hiểu thị trường Mỹ có thể rút ngắn quá trình học hỏi từ 2 năm xuống còn 2 tháng.",
  },
  no_us_experience: {
    en: "You've already proven you can export — that puts you ahead of 80% of applicants. Now it's about understanding US-specific nuances: FDA, labeling, buyer communication style. This is exactly what Vexim specializes in.",
    vi: "Bạn đã chứng minh được khả năng xuất khẩu — điều này đã đưa bạn vượt qua 80% ứng viên. Bây giờ là về việc hiểu các đặc thù của Mỹ: FDA, nhãn hàng, phong cách giao tiếp với buyer. Đây chính xác là chuyên môn của Vexim.",
  },
  no_english: {
    en: "This is a 'blind spot' many businesses overlook. US buyers expect responses within hours, in clear English. Even a small language barrier can cause deals to fall through. Vexim can bridge this gap for you immediately.",
    vi: "Đây là một 'điểm mù' mà nhiều doanh nghiệp mắc phải. US buyer mong đợi phản hồi trong vài giờ, bằng tiếng Anh rõ ràng. Dù chỉ một rào cản ngôn ngữ nhỏ cũng có thể khiến hợp đồng tuột mất. Vexim có thể lấp đầy khoảng trống này cho bạn ngay lập tức.",
  },
  no_compliance_info: {
    en: "Compliance documentation is the foundation of everything in the US market. Before any buyer conversation, you need to know exactly where you stand. Let's build this foundation together.",
    vi: "Hồ sơ tuân thủ là nền tảng của mọi thứ trên thị trường Mỹ. Trước bất kỳ cuộc trò chuyện nào với buyer, bạn cần biết chính xác mình đang đứng ở đâu. Hãy cùng nhau xây dựng nền tảng này.",
  },
}

// Maps a gap code to a Vexim cross-sell CTA
const GAP_VEXIM_CTA: Record<string, { label: string; labelVi: string; url: string }> = {
  no_fda: {
    label: "Get FDA support from Vexim Global",
    labelVi: "Nhận hỗ trợ FDA từ Vexim Global",
    url: "/client/support?service=fda-registration",
  },
  no_haccp: {
    label: "Connect with HACCP consultants",
    labelVi: "Kết nối với chuyên gia tư vấn HACCP",
    url: "/client/support?service=haccp-certification",
  },
  no_coa: {
    label: "Request lab testing support",
    labelVi: "Yêu cầu hỗ trợ kiểm nghiệm",
    url: "/client/support?service=lab-testing",
  },
  no_export_experience: {
    label: "Join the Vexim Export Partnership",
    labelVi: "Tham gia Chương trình Đối tác Xuất khẩu Vexim",
    url: "/client/support?service=export-partnership",
  },
  no_us_experience: {
    label: "Get US Market Entry support",
    labelVi: "Nhận hỗ trợ thâm nhập thị trường Mỹ",
    url: "/client/support?service=us-market-entry",
  },
  no_english: {
    label: "Use Vexim as your US communicator",
    labelVi: "Dùng Vexim làm cầu nối giao tiếp với Mỹ",
    url: "/client/support?service=communication-support",
  },
}

async function generateActionPlan(
  gaps: ReadinessGap[],
  strengths: ReadinessStrength[],
  answers: AssessmentAnswers
): Promise<ActionPlanItem[]> {
  const actionPlan: ActionPlanItem[] = []
  let order = 1

  // Critical gaps first (Urgent)
  for (const gap of gaps.filter((g) => g.severity === "critical")) {
    const note = GAP_ADVISOR_NOTES[gap.code]
    const cta = GAP_VEXIM_CTA[gap.code]
    actionPlan.push({
      priority: "urgent",
      order: order++,
      title: gap.title,
      titleVi: gap.titleVi,
      description: gap.suggestedAction,
      descriptionVi: gap.suggestedActionVi,
      advisorNote: note?.en,
      advisorNoteVi: note?.vi,
      category: gap.category,
      relatedGapCode: gap.code,
      estimatedTimeToComplete: gap.estimatedTimeToFix || "1-2 months",
      veximCanHelp: !!gap.veximService || !!cta,
      veximServiceName: gap.veximService,
      veximCtaLabel: cta?.label,
      veximCtaLabelVi: cta?.labelVi,
      veximCtaUrl: cta?.url,
    })
  }

  // High severity gaps (Important)
  for (const gap of gaps.filter((g) => g.severity === "high")) {
    const note = GAP_ADVISOR_NOTES[gap.code]
    const cta = GAP_VEXIM_CTA[gap.code]
    actionPlan.push({
      priority: "important",
      order: order++,
      title: gap.title,
      titleVi: gap.titleVi,
      description: gap.suggestedAction,
      descriptionVi: gap.suggestedActionVi,
      advisorNote: note?.en,
      advisorNoteVi: note?.vi,
      category: gap.category,
      relatedGapCode: gap.code,
      estimatedTimeToComplete: gap.estimatedTimeToFix || "2-4 weeks",
      veximCanHelp: !!gap.veximService || !!cta,
      veximServiceName: gap.veximService,
      veximCtaLabel: cta?.label,
      veximCtaLabelVi: cta?.labelVi,
      veximCtaUrl: cta?.url,
    })
  }

  // Medium/low gaps (Nice to have)
  for (const gap of gaps.filter(
    (g) => g.severity === "medium" || g.severity === "low"
  )) {
    const note = GAP_ADVISOR_NOTES[gap.code]
    const cta = GAP_VEXIM_CTA[gap.code]
    actionPlan.push({
      priority: "nice_to_have",
      order: order++,
      title: gap.title,
      titleVi: gap.titleVi,
      description: gap.suggestedAction,
      descriptionVi: gap.suggestedActionVi,
      advisorNote: note?.en,
      advisorNoteVi: note?.vi,
      category: gap.category,
      relatedGapCode: gap.code,
      estimatedTimeToComplete: gap.estimatedTimeToFix || "1-2 months",
      veximCanHelp: !!gap.veximService || !!cta,
      veximServiceName: gap.veximService,
      veximCtaLabel: cta?.label,
      veximCtaLabelVi: cta?.labelVi,
      veximCtaUrl: cta?.url,
    })
  }

  return actionPlan
}

// ============================================================
// Get Tier Description
// ============================================================

export function getTierDescription(tier: ReadinessTier): {
  title: string
  titleVi: string
  description: string
  descriptionVi: string
  color: string
} {
  switch (tier) {
    case "gold":
      return {
        title: "Gold Partner",
        titleVi: "Đối tác Vàng",
        description:
          "Ready to be matched with US buyers immediately. Your compliance and capabilities meet US market standards.",
        descriptionVi:
          "Sẵn sàng được kết nối với US buyer ngay lập tức. Năng lực tuân thủ và khả năng của bạn đáp ứng tiêu chuẩn thị trường Mỹ.",
        color: "gold",
      }
    case "potential":
      return {
        title: "High Potential",
        titleVi: "Tiềm năng cao",
        description:
          "Good foundation but needs some improvements before matching with top-tier US buyers.",
        descriptionVi:
          "Nền tảng tốt nhưng cần một số cải thiện trước khi kết nối với US buyer hàng đầu.",
        color: "blue",
      }
    case "pending":
      return {
        title: "In Development",
        titleVi: "Đang phát triển",
        description:
          "Significant preparation needed before entering US market. Follow the action plan to improve your readiness.",
        descriptionVi:
          "Cần chuẩn bị đáng kể trước khi thâm nhập thị trường Mỹ. Theo dõi kế hoạch hành động để cải thiện sự sẵn sàng.",
        color: "orange",
      }
  }
}
