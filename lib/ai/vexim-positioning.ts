/**
 * Vexim Positioning & Mapping Engine — V4 Soft 60/40
 *
 * Triết lý V4 sau feedback:
 * - Văn phong hiện tại ~60% chuẩn (compliance consulting)
 * - 40% còn lại phải nói về sản phẩm buyer đang nhập + tính mùa vụ
 * - Dữ liệu buyer/supplier chỉ dùng để tư duy nội bộ, đối chiếu, chọn góc tiếp cận
 * - TUYỆT ĐỐI KHÔNG đưa raw data lên email (HS code, tên supplier, số lượng, peak months cụ thể...)
 * - Dùng ngôn từ mềm mại: "premium cashew kernels", "peak year-end sourcing period"
 * - Vexim = compliance consulting cho DN Việt xuất khẩu Mỹ, đối tác đạt chuẩn tuân thủ Hoa Kỳ
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
// Vexim Compliance Consulting — 60% positioning
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
`.trim()

// ---------------------------------------------------------------------------
// Soft Product Description — from main_product to soft premium wording
// ---------------------------------------------------------------------------

export function getSoftProductDescription(mainProduct: string | null): string {
  if (!mainProduct) return "your product category"
  const lower = mainProduct.toLowerCase()
  // Map common products to soft premium descriptions
  if (lower.includes("cashew")) {
    if (lower.includes("w320") || lower.includes("w240")) return "premium cashew kernels"
    if (lower.includes("kernel")) return "premium cashew kernels"
    return "cashew kernels"
  }
  if (lower.includes("coffee")) {
    if (lower.includes("arabica")) return "premium arabica coffee"
    if (lower.includes("robusta")) return "robusta coffee"
    return "specialty coffee"
  }
  if (lower.includes("pepper") || lower.includes("black pepper")) return "black pepper"
  if (lower.includes("coconut")) return "coconut products"
  if (lower.includes("rice")) return "premium rice"
  if (lower.includes("seafood") || lower.includes("shrimp") || lower.includes("fish")) return "seafood"
  // Default: use main_product but without HS code, cleaned
  return mainProduct.split(",")[0].trim().toLowerCase()
}

// ---------------------------------------------------------------------------
// Soft Seasonality Hook — from peak_months + current date to soft seasonal language
// DO NOT expose exact months like "Oct, Nov, Dec" or "your peak is Oct-Dec"
// Instead use soft: "peak year-end sourcing period", "Q4 peak season", "summer restocking"
// ---------------------------------------------------------------------------

export function getSoftSeasonalityHook(peakMonths: string | null, currentDate: Date = new Date()): string {
  if (!peakMonths) {
    // No peak data — use generic current season hook
    const month = currentDate.getMonth() + 1 // 1-12
    if (month >= 9 && month <= 11) return "peak year-end sourcing period"
    if (month >= 12 || month <= 2) return "first-quarter planning period"
    if (month >= 3 && month <= 5) return "mid-year sourcing window"
    if (month >= 6 && month <= 8) return "pre-peak preparation period"
    return "upcoming sourcing cycle"
  }

  const lower = peakMonths.toLowerCase()
  // Detect year-end peak
  if (lower.includes("oct") || lower.includes("nov") || lower.includes("dec") || lower.includes("10") || lower.includes("11") || lower.includes("12")) {
    const month = currentDate.getMonth() + 1
    if (month >= 7 && month <= 9) return "peak year-end sourcing period"
    if (month >= 10 && month <= 12) return "peak year-end season"
    if (month >= 1 && month <= 3) return "post-peak restocking and Q1 planning"
    return "year-end peak season"
  }
  // Summer peak
  if (lower.includes("jun") || lower.includes("jul") || lower.includes("aug") || lower.includes("6") || lower.includes("7") || lower.includes("8")) {
    return "summer peak season"
  }
  // Q1 peak
  if (lower.includes("jan") || lower.includes("feb") || lower.includes("mar")) {
    return "first-quarter peak"
  }
  // Q2 peak
  if (lower.includes("apr") || lower.includes("may")) {
    return "spring sourcing period"
  }
  // Generic
  return "peak season"
}

export function getSeasonalCapacityAngle(seasonHook: string): string {
  // Returns soft angle about securing capacity/compliant supply
  if (seasonHook.includes("year-end")) {
    return "securing consistent capacity and compliant supply is likely top of mind"
  }
  if (seasonHook.includes("summer")) {
    return "ensuring stable supply and compliance readiness is probably a priority"
  }
  if (seasonHook.includes("first-quarter") || seasonHook.includes("Q1")) {
    return "planning for consistent supply and compliance is likely on your agenda"
  }
  return "securing reliable capacity and compliant supply is likely important"
}

// ---------------------------------------------------------------------------
// Internal reasoning summaries (for AI reasoning, NOT verbatim)
// ---------------------------------------------------------------------------

export function buildBuyerInsightSummary(buyer: BuyerIntel): string {
  const parts: string[] = []
  parts.push(`[INTERNAL] Buyer: ${buyer.companyName} — ${buyer.country || "unknown"} — Main product: ${buyer.mainProduct || "unknown"}`)
  parts.push(`[INTERNAL] Product soft: ${getSoftProductDescription(buyer.mainProduct || null)} — USE THIS SOFT DESCRIPTION IN EMAIL, NOT HS CODE`)
  if (buyer.hsCode) parts.push(`[INTERNAL] HS: ${buyer.hsCode} — DO NOT mention HS in email, use to understand compliance needs`)
  if (buyer.topPeakMonths) {
    const hook = getSoftSeasonalityHook(buyer.topPeakMonths)
    parts.push(`[INTERNAL] Peak months: ${buyer.topPeakMonths} → soft hook: "${hook}" — USE SOFT HOOK "${hook}" IN EMAIL, DO NOT mention exact months like "${buyer.topPeakMonths}"`)
    parts.push(`[INTERNAL] Capacity angle: "${getSeasonalCapacityAngle(hook)}" — use this angle`)
  } else {
    parts.push(`[INTERNAL] No peak data — use generic seasonal hook based on current date`)
  }
  if (buyer.purchaseHistory) parts.push(`[INTERNAL] Purchase history exists — indicates familiarity with Vietnam or diversification need — DO NOT mention supplier names/years/volumes`)
  if (buyer.mainImportCountries) parts.push(`[INTERNAL] Sources from multiple origins — use soft "many buyers in your space" — DO NOT list countries`)
  return parts.join("\n")
}

export function buildSupplierTrustSignals(supplier: SupplierVetting): string {
  const signals: string[] = []
  signals.push(`[INTERNAL] Supplier: ${supplier.companyName || "factory"} — DO NOT name factory in first email, say "factory we work with"`)
  if (supplier.certifications) signals.push(`[INTERNAL] Certs: ${supplier.certifications.slice(0,2).join(", ")} — soft "has been through our compliance program including ${supplier.certifications.slice(0,2).join(" and ")}"`)
  if (supplier.fdaStatus) signals.push(`[INTERNAL] FDA: ${supplier.fdaStatus} — soft "FDA registration and traceability in place" — DO NOT give FDA number`)
  signals.push(`[INTERNAL] Capacity/lead time: internal fit check — soft "verified capacity and lead time for this category" — DO NOT mention exact tons/days`)
  return signals.join("\n")
}

export function buildBuyerSupplierMapping(buyer: BuyerIntel, supplier: SupplierVetting): string {
  const mappings: string[] = []
  mappings.push(`[INTERNAL MAPPING — 60% compliance + 40% buyer product & seasonality, soft language]`)
  const productSoft = getSoftProductDescription(buyer.mainProduct || null)
  const seasonHook = getSoftSeasonalityHook(buyer.topPeakMonths || null)
  const capacityAngle = getSeasonalCapacityAngle(seasonHook)
  mappings.push(`Product angle (40%): Buyer has strong presence in ${productSoft} for US market — use soft "${productSoft}" not HS code`)
  mappings.push(`Seasonality angle (40%): As we approach ${seasonHook}, ${capacityAngle} — use soft hook "${seasonHook}" not exact months "${buyer.topPeakMonths || "N/A"}"`)
  mappings.push(`Compliance angle (60%): Vexim compliance consulting — FDA, HACCP, traceability, audit — only US-compliant factories join network`)
  mappings.push(`Combined example: "I noticed ${buyer.companyName} has a strong presence in ${productSoft} for the US market. As we approach ${seasonHook}, ${capacityAngle}. We work as a compliance consulting partner..."`)
  return mappings.join("\n")
}

// ---------------------------------------------------------------------------
// Soft positioning snippets — 60/40 split safe
// ---------------------------------------------------------------------------

export function getVeximPositioningSnippet(context: "requirement" | "introduction", buyerCountry?: string | null): string {
  if (context === "requirement") {
    return `
We work as a compliance consulting partner for Vietnamese factories exporting to the US — helping them meet FDA, HACCP, and traceability requirements that US buyers expect.

Our factories go through our US compliance program and audit before joining our network — direct factory, not trading companies, only those meeting US standards.
`.trim()
  } else {
    return `
The factory we work with has been through our US compliance program and audit — not a trading company.

They have FDA registration, HACCP, and traceability from raw material in place, and we have verified capacity and lead time for this category.

We can arrange a video call tour if helpful.
`.trim()
  }
}

// ---------------------------------------------------------------------------
// Spam + Surveillance Risk Assessment — V4
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

  const spamTriggers = ["best price", "cheapest", "guaranteed", "act now", "limited time", "free sample", "click here", "buy now", "discount", "!!!", "$$$"]
  const foundTriggers = spamTriggers.filter(t => lowerContent.includes(t) || lowerSubject.includes(t))
  if (foundTriggers.length > 0) {
    factors.push(`Contains spam trigger phrases: ${foundTriggers.join(", ")}`)
    riskScore += foundTriggers.length * 2
    recommendations.push("Remove salesy phrases, use compliance advisor language")
  }

  // Surveillance triggers — must avoid in V4
  const surveillancePatterns = [
    { pattern: /hs\s*\d{4}/i, desc: "HS code" },
    { pattern: /\b\d{1,3}(,\d{3})*kg\b/i, desc: "exact kg volume" },
    { pattern: /\b\d+\s*shipments?\b/i, desc: "shipment counts" },
    { pattern: /\bteu\b/i, desc: "TEU" },
    { pattern: /peak.*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec).*\d/i, desc: "exact peak months" },
    { pattern: /i noticed you import.*from.*and/i, desc: "surveillance-like import origins" },
    { pattern: /visimex|olam|procesadora/i, desc: "specific supplier names from purchase_history" },
  ]
  const foundSurveillance = surveillancePatterns.filter(p => p.pattern.test(emailContent))
  if (foundSurveillance.length > 0) {
    factors.push(`Contains surveillance-like specifics: ${foundSurveillance.map(s => s.desc).join(", ")} — buyer will feel monitored`)
    riskScore += 3
    recommendations.push("Remove raw buyer data (HS, supplier names, kg, shipment counts, TEU, exact peak months, origin list) — use soft category + seasonality hook")
  }

  if (/[A-Z]{5,}/.test(emailContent)) {
    factors.push("Contains excessive ALL CAPS")
    riskScore += 2
    recommendations.push("Avoid ALL CAPS")
  }

  const exclamCount = (emailContent.match(/!/g) || []).length
  if (exclamCount > 1) {
    factors.push(`Multiple exclamation marks (${exclamCount})`)
    riskScore += 1
  }

  const linkCount = (emailContent.match(/https?:\/\//g) || []).length
  if (linkCount > 0) {
    factors.push(`Contains ${linkCount} links — cold email should have 0 links`)
    riskScore += 3
    recommendations.push("Remove links from first email")
  }

  const wordCount = emailContent.split(/\s+/).length
  if (wordCount > 200) {
    factors.push(`Email too long (${wordCount} words) — keep 120-170 for soft approach`)
    riskScore += 1
  }

  if (lowerSubject.startsWith("re:") || lowerSubject.startsWith("fwd:")) {
    factors.push("Fake Re:/Fwd in subject")
    riskScore += 5
  }

  // Check 60/40 balance
  const hasProductMention = /premium|cashew|coffee|pepper|coconut|rice|seafood|your.*category/i.test(emailContent)
  const hasSeasonality = /peak|season|sourcing period|capacity|compliant supply|top of mind/i.test(emailContent)
  const hasCompliance = /compliance|fda|haccp|traceability|audit/i.test(emailContent)
  
  if (!hasProductMention) {
    factors.push("Missing buyer product insight (40% part) — should mention product category softly")
    riskScore += 1
    recommendations.push("Add soft product mention: 'strong presence in premium cashew kernels for US market'")
  }
  if (!hasSeasonality) {
    factors.push("Missing seasonality hook (40% part) — should mention seasonal timing softly")
    riskScore += 1
    recommendations.push("Add soft seasonality: 'As we approach peak year-end sourcing period, securing capacity...'")
  }
  if (!hasCompliance) {
    factors.push("Missing compliance consulting positioning (60% part)")
    riskScore += 1
    recommendations.push("Add compliance: 'We work as compliance consulting partner for Vietnamese factories exporting to US'")
  }

  let riskLevel: "low" | "medium" | "high" = "low"
  if (riskScore >= 5) riskLevel = "high"
  else if (riskScore >= 2) riskLevel = "medium"

  if (riskLevel === "low") {
    factors.push("Passes checks: no surveillance data, soft product + seasonality (40%) + compliance consulting (60%), short, no spam triggers")
  }

  return { riskLevel, factors, recommendations }
}
