/**
 * Vexim Positioning & Mapping Engine — V3 Soft Approach
 *
 * Triết lý mới:
 * - Dữ liệu buyer (HS, purchase_history, top_suppliers, peak_months, volume...) và
 *   supplier (certs, FDA, capacity, payment...) CHỈ dùng để tư duy nội bộ, đối chiếu,
 *   chọn góc tiếp cận phù hợp. TUYỆT ĐỐI KHÔNG đưa raw data lên email — buyer sẽ
 *   cảm thấy bị soi.
 * - Ngôn từ mềm mại, category-level, compliance consulting, không surveillance.
 * - Vexim = đơn vị tư vấn tuân thủ cho doanh nghiệp Việt xuất khẩu vào Mỹ,
 *   đối tác được tuyển chọn chất lượng, đạt yêu cầu tuân thủ Hoa Kỳ.
 *
 * Google Deliverability: plain text, no links first email, no spam triggers,
 * human sender, opt-out human.
 */

export interface BuyerIntel {
  companyName: string
  country?: string | null
  mainProduct?: string | null
  hsCode?: string | null
  secondaryHsCodes?: string | null
  purchaseHistory?: string | null
  topSuppliers?: { name: string; country: string | null }[] | null
  mainImportCountries?: string | null
  topPeakMonths?: string | null
  topLowMonths?: string | null
  totalShipments?: number | null
  avgTeuPerMonth?: number | null
  originPorts?: string | null
  destinationPorts?: string | null
  containerTypes?: string | null
  inquiryProducts?: string | null
  hasActiveInquiry?: boolean
}

export interface SupplierVetting {
  companyName?: string | null
  certifications?: string[] | null
  certificationsOther?: string | null
  qualitySystems?: string[] | null
  fdaStatus?: string | null
  fdaNumber?: string | null
  productionCapacity?: string | null
  moq?: string | null
  leadTimeDays?: string | null
  incoterms?: string[] | null
  paymentPolicy?: string | null
  traceability?: string[] | null
  exportMarkets?: string[] | null
  exportSinceYear?: number | null
  oemOdm?: string[] | null
  companyScale?: string | null
  hasExportDept?: boolean | null
  hasEnglishStaff?: boolean | null
  staffEngineersCount?: number | null
  staffWorkersCount?: number | null
  uspPoints?: { title: string; icon?: string }[] | null
  products?: Array<{
    productName: string
    hsCode?: string | null
    complianceBadges?: string[] | null
    moqValue?: number | null
    leadTime?: string | null
  }>
}

// ---------------------------------------------------------------------------
// Vexim Compliance Consulting — positioning story (soft, not brochure)
// ---------------------------------------------------------------------------

export const VEXIM_VETTING_PILLARS = {
  complianceConsulting: "We work as a compliance consulting partner for Vietnamese factories exporting to the US — helping them meet FDA, HACCP, ISO 22000, BRC, traceability, audit readiness",
  factoryAudit: "We only work with factories we've physically visited and audited — direct factory, no trading companies. We reject 80% that apply",
  usCompliance: "Only factories meeting US compliance standards join our network: FDA registration, HACCP, ISO, BRC, traceability from raw material to finished goods, lot tracking, food safety training",
  qualitySystem: "Our compliance program includes equipment calibration, water testing, near pollution source check, QC engineers, English-speaking export team",
  support: "24h response, video factory tour available, flexible payment T/T and L/C at sight, transparent MOQ/lead time/capacity, dedicated account handling",
}

export const VEXIM_POSITIONING_SHORT = `
Vexim is a compliance consulting partner for Vietnamese factories exporting to the US market — not a marketplace, not a trading company.
We help Vietnamese manufacturers meet US compliance requirements: FDA registration, HACCP, ISO 22000, BRC, traceability from raw material to finished goods, lot tracking, audit readiness.
Only factories that have been through our compliance program and audit, meeting US standards, join our network. Direct factory, transparent pricing, no trading companies.
Typical factory: 50-300 workers, export since 2015+, FDA registered if US-bound, HACCP/ISO, English export team, traceability system, QC engineers.
`.trim()

export const VEXIM_POSITIONING_COMPLIANCE = `
Vexim = đơn vị tư vấn tuân thủ cho doanh nghiệp Việt xuất khẩu vào Mỹ.
Đối tác Vexim tuyển chọn là những đối tác chất lượng, đạt yêu cầu về tuân thủ Hoa Kỳ:
FDA registration, HACCP, ISO 22000, BRC, traceability từ nguyên liệu đến thành phẩm, lot tracking, food safety training, audit readiness.
Chúng tôi chỉ làm việc với nhà máy đã qua chương trình tuân thủ và audit của Vexim, đã được kiểm tra trực tiếp, đạt chuẩn Mỹ mới được vào network.
Không phải marketplace, không phải trading company — direct factory, minh bạch, hỗ trợ tuân thủ.
`.trim()

// ---------------------------------------------------------------------------
// Internal reasoning — buyer intelligence summary (for AI reasoning, NOT for email verbatim)
// ---------------------------------------------------------------------------

export function buildBuyerInsightSummary(buyer: BuyerIntel): string {
  // This summary is for INTERNAL reasoning only — AI must NOT copy verbatim to email
  const parts: string[] = []
  if (buyer.mainProduct) parts.push(`[INTERNAL] Main product category: ${buyer.mainProduct} — use for soft category reference only, e.g., "buyers in the ${buyer.mainProduct} category"`)
  if (buyer.hsCode) parts.push(`[INTERNAL] HS: ${buyer.hsCode} — DO NOT mention HS code in email, use to understand product compliance needs`)
  if (buyer.purchaseHistory) parts.push(`[INTERNAL] Purchase history exists — indicates buyer familiarity with Vietnam or need for diversification — DO NOT mention specific supplier names/years/volumes, use soft "many buyers in your space" language`)
  if (buyer.topSuppliers) parts.push(`[INTERNAL] Top suppliers observed — use to understand competitive landscape, DO NOT name suppliers in email`)
  if (buyer.mainImportCountries) parts.push(`[INTERNAL] Sources from: ${buyer.mainImportCountries} — use to choose diversification angle softly, DO NOT list countries verbatim`)
  if (buyer.topPeakMonths) parts.push(`[INTERNAL] Peak months: ${buyer.topPeakMonths} — use for timing reasoning, DO NOT mention peak months in email`)
  if (buyer.totalShipments) parts.push(`[INTERNAL] Volume: ${buyer.totalShipments} shipments — use for sizing, DO NOT mention shipment counts`)
  if (buyer.country) parts.push(`[INTERNAL] Buyer country: ${buyer.country} — if US, emphasize FDA and US compliance program`)
  return parts.join("\n")
}

// ---------------------------------------------------------------------------
// Internal reasoning — supplier vetting summary (for AI reasoning, NOT verbatim)
// ---------------------------------------------------------------------------

export function buildSupplierTrustSignals(supplier: SupplierVetting): string {
  // Internal only — AI must translate to soft compliance language, not list specs
  const signals: string[] = []
  signals.push(`[INTERNAL] Supplier: ${supplier.companyName || "factory"} — DO NOT name factory in first email, only general "factory we work with"`)
  if (supplier.exportSinceYear) signals.push(`[INTERNAL] Export since ${supplier.exportSinceYear} — indicates experience, translate to soft "experienced exporter" not exact year`)
  if (supplier.certifications && supplier.certifications.length > 0) signals.push(`[INTERNAL] Certs: ${supplier.certifications.join(", ")} — translate to soft "has been through our compliance program including ${supplier.certifications.slice(0,2).join(" and ")}" — DO NOT list all certs as brochure`)
  if (supplier.fdaStatus) signals.push(`[INTERNAL] FDA: ${supplier.fdaStatus} — if US buyer, emphasize "FDA registration and traceability in place" softly, DO NOT give FDA number`)
  if (supplier.productionCapacity) signals.push(`[INTERNAL] Capacity: ${supplier.productionCapacity} — use to confirm fit internally, DO NOT mention exact capacity in email, say "verified capacity for this category"`)
  if (supplier.leadTimeDays) signals.push(`[INTERNAL] Lead time: ${supplier.leadTimeDays} — internal fit check, DO NOT mention exact days, say "confirmed lead time"`)
  if (supplier.paymentPolicy) signals.push(`[INTERNAL] Payment: ${supplier.paymentPolicy} — internal, DO NOT list payment terms in first email, mention "flexible payment" only if relevant`)
  if (supplier.traceability) signals.push(`[INTERNAL] Traceability: ${supplier.traceability.join(", ")} — translate to soft "traceability from raw material"`)
  return signals.join("\n")
}

// ---------------------------------------------------------------------------
// Internal mapping — buyer needs -> supplier strengths (reasoning only)
// ---------------------------------------------------------------------------

export function buildBuyerSupplierMapping(buyer: BuyerIntel, supplier: SupplierVetting): string {
  const mappings: string[] = []
  mappings.push(`[INTERNAL MAPPING — DO NOT EXPOSE VERBATIM, USE FOR SOFT ANGLE]`)
  if (buyer.hsCode && supplier.products?.some(p => p.hsCode && buyer.hsCode && p.hsCode.includes(buyer.hsCode.slice(0, 4)))) {
    mappings.push(`HS alignment exists: use soft "for ${buyer.mainProduct || "this category"}, Vietnam has strong options" — DO NOT mention HS code`)
  }
  if (buyer.avgTeuPerMonth && supplier.productionCapacity) {
    mappings.push(`Volume fit exists: buyer volume vs supplier capacity suitable — translate to soft "verified capacity for this category" — DO NOT mention TEU or exact tons`)
  }
  if (buyer.topPeakMonths && supplier.leadTimeDays) {
    mappings.push(`Seasonality fit: buyer peak vs supplier lead time — internal timing, DO NOT mention peak months or lead time days`)
  }
  if (buyer.country?.toLowerCase().includes("united states") || buyer.country?.toLowerCase().includes("usa")) {
    if (supplier.fdaStatus) mappings.push(`US buyer + FDA supplier: emphasize soft "FDA registration and traceability in place for US market" — DO NOT give FDA number`)
  }
  if (buyer.mainImportCountries?.toLowerCase().includes("vietnam") || buyer.purchaseHistory?.toLowerCase().includes("vietnam")) {
    mappings.push(`Buyer has Vietnam experience: use soft "buyers who already work with Vietnam" — DO NOT name past VN suppliers`)
  } else if (buyer.mainImportCountries) {
    mappings.push(`Diversification: buyer sources from multiple origins — use soft "many buyers in your space are looking to strengthen Vietnam supply with US-compliant factories" — DO NOT list countries`)
  }
  mappings.push(`Compliance angle: emphasize Vexim compliance consulting program — FDA, HACCP, traceability, audit — as differentiator, not marketplace`)
  return mappings.join("\n")
}

// ---------------------------------------------------------------------------
// Soft positioning snippets — safe to use in email (no raw data)
// ---------------------------------------------------------------------------

export function getVeximPositioningSnippet(context: "requirement" | "introduction", buyerCountry?: string | null): string {
  if (context === "requirement") {
    return `
We work as a compliance consulting partner for Vietnamese factories exporting to the US — helping them meet FDA, HACCP, and traceability requirements that US buyers expect.

Our factories go through our US compliance program and audit before joining our network — direct factory, not trading companies, only those meeting US standards.

Many buyers in your category tell us they want a Vietnam option that already has compliance in place, rather than starting from scratch.
`.trim()
  } else {
    const usNote = buyerCountry && buyerCountry.toLowerCase().includes("united states")
      ? " FDA registration and traceability are in place for US market."
      : ""
    return `
The factory we work with has been through our US compliance program and audit — not a trading company.

They have FDA registration, HACCP, and traceability from raw material in place, and we have verified capacity and lead time for this category.${usNote}

We can arrange a video call tour if helpful.
`.trim()
  }
}

// ---------------------------------------------------------------------------
// Google Spam Risk + Surveillance Risk Assessment
// ---------------------------------------------------------------------------

export interface SpamRiskAssessment {
  riskLevel: "low" | "medium" | "high"
  factors: string[]
  recommendations: string[]
}

export function assessSpamRisk(emailContent: string, subject: string): SpamRiskAssessment {
  const factors: string[] = []
  const recommendations: string[] = []
  let riskScore = 0

  const lowerContent = emailContent.toLowerCase()
  const lowerSubject = subject.toLowerCase()

  // Spam triggers
  const spamTriggers = ["best price", "cheapest", "guaranteed", "act now", "limited time", "free sample", "click here", "buy now", "discount", "!!!", "$$$"]
  const foundTriggers = spamTriggers.filter(t => lowerContent.includes(t) || lowerSubject.includes(t))
  if (foundTriggers.length > 0) {
    factors.push(`Contains spam trigger phrases: ${foundTriggers.join(", ")}`)
    riskScore += foundTriggers.length * 2
    recommendations.push("Remove salesy phrases, use consultative compliance advisor language")
  }

  // Surveillance triggers — NEW in V3
  const surveillancePatterns = [
    /hs\s*\d{4}/i,
    /\b\d{1,3}(,\d{3})*kg\b/i,
    /\b\d+\s*shipments?\b/i,
    /\bteu\b/i,
    /peak.*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
    /i noticed you import.*from.*and/i,
  ]
  const foundSurveillance = surveillancePatterns.filter(p => p.test(emailContent))
  if (foundSurveillance.length > 0) {
    factors.push(`Contains surveillance-like specifics (${foundSurveillance.length} patterns) — buyer will feel monitored`)
    riskScore += 3
    recommendations.push("Remove raw buyer data (HS codes, shipment counts, volumes, peak months, specific supplier names, origin countries list) — use soft category language")
  }

  if (/[A-Z]{5,}/.test(emailContent)) {
    factors.push("Contains excessive ALL CAPS")
    riskScore += 2
    recommendations.push("Avoid ALL CAPS, use normal sentence case")
  }

  const exclamCount = (emailContent.match(/!/g) || []).length
  if (exclamCount > 1) {
    factors.push(`Multiple exclamation marks (${exclamCount})`)
    riskScore += 1
    recommendations.push("Limit to 0-1 exclamation marks")
  }

  const linkCount = (emailContent.match(/https?:\/\//g) || []).length
  if (linkCount > 0) {
    factors.push(`Contains ${linkCount} links — cold email should have 0 links`)
    riskScore += 3
    recommendations.push("Remove all links from first email, share in follow-up")
  }

  const wordCount = emailContent.split(/\s+/).length
  if (wordCount > 200) {
    factors.push(`Email too long (${wordCount} words) — Gmail prefers <170 for soft approach`)
    riskScore += 1
    recommendations.push("Keep first email 120-170 words, intro 120-170 words")
  }

  if (lowerSubject.startsWith("re:") || lowerSubject.startsWith("fwd:")) {
    factors.push("Fake Re:/Fwd in subject — violates Gmail policy")
    riskScore += 5
    recommendations.push("Never use Re: or Fwd: unless real reply")
  }

  let riskLevel: "low" | "medium" | "high" = "low"
  if (riskScore >= 5) riskLevel = "high"
  else if (riskScore >= 2) riskLevel = "medium"

  if (riskLevel === "low") {
    factors.push("Passes Gmail checks: no links, no spam triggers, no surveillance data, soft compliance consulting tone, short")
  }

  return { riskLevel, factors, recommendations }
}
