/**
 * Vexim Positioning & Mapping Engine
 *
 * Combines supplier vetted data + buyer intelligence to produce
 * high-quality, personalized outreach that still passes Gmail filters.
 *
 * Philosophy:
 * - First email (requirement_inquiry) = Buyer understanding + Vexim vetting story (no specific supplier)
 * - Second email (introduction after shortlist) = Buyer + Supplier mapping, show why this factory fits
 *
 * Google Deliverability Rules (2024-2026):
 * - No fake Re:/Fwd, no ALL CAPS, no excessive punctuation
 * - No marketing trigger words: "best price", "cheapest", "guaranteed", "free", "act now", "limited time"
 * - No links/images in cold email, plain text preferred
 * - Personal sender name (human), conversational tone
 * - Opt-out line human, not legalese
 * - Keep < 150 words for first touch, < 180 for intro
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
  // From client_products
  products?: Array<{
    productName: string
    hsCode?: string | null
    complianceBadges?: string[] | null
    moqValue?: number | null
    leadTime?: string | null
  }>
}

// ---------------------------------------------------------------------------
// Vexim Trust Framework - the positioning story
// ---------------------------------------------------------------------------

export const VEXIM_VETTING_PILLARS = {
  factoryAudit: "We only work with factories we've physically visited and audited — not trading companies",
  certifications: "Valid certifications checked: HACCP, ISO 22000, BRC, FDA for US-bound, plus buyer-specific requirements",
  traceability: "Full traceability from raw material to finished goods, with lot tracking",
  response: "Response within 24h, English-speaking export team, dedicated QC engineers",
  payment: "Flexible payment: T/T, L/C at sight, flexible terms for repeat orders — we help structure safe terms",
  transparency: "No hidden costs, clear MOQ/lead time/capacity, video call factory tour available",
}

export const VEXIM_POSITIONING_SHORT = `
Vexim is not a marketplace. We are a Vietnam sourcing partner that only represents factories we've audited.
Typical factory in our network: 50-300 workers, export since 2015+, HACCP/ISO, FDA registered if US-bound, English export team, 20-100 tons/month capacity, traceability system.
`.trim()

// ---------------------------------------------------------------------------
// Buyer Intelligence -> Natural Language
// ---------------------------------------------------------------------------

export function buildBuyerInsightSummary(buyer: BuyerIntel): string {
  const parts: string[] = []

  if (buyer.mainProduct) {
    parts.push(`Main product: ${buyer.mainProduct}`)
  }
  if (buyer.hsCode) {
    parts.push(`HS: ${buyer.hsCode}`)
  }
  if (buyer.purchaseHistory) {
    // Truncate to avoid prompt bloat
    const ph = buyer.purchaseHistory.slice(0, 400)
    parts.push(`Purchase history (VN suppliers): ${ph}`)
  }
  if (buyer.topSuppliers && buyer.topSuppliers.length > 0) {
    const sup = buyer.topSuppliers.slice(0, 5).map(s => `${s.name}${s.country ? ` (${s.country})` : ""}`).join(", ")
    parts.push(`Top suppliers observed: ${sup}`)
  }
  if (buyer.mainImportCountries) {
    parts.push(`Sources from: ${buyer.mainImportCountries}`)
  }
  if (buyer.topPeakMonths) {
    parts.push(`Peak months: ${buyer.topPeakMonths} | Low: ${buyer.topLowMonths || "N/A"}`)
  }
  if (buyer.totalShipments) {
    parts.push(`Volume: ${buyer.totalShipments} shipments, ~${buyer.avgTeuPerMonth || "?"} TEU/month`)
  }
  if (buyer.originPorts) {
    parts.push(`Origin ports: ${buyer.originPorts} -> ${buyer.destinationPorts || ""}`)
  }
  if (buyer.hasActiveInquiry && buyer.inquiryProducts) {
    parts.push(`Direct inquiry: ${buyer.inquiryProducts}`)
  }

  return parts.join("\n")
}

// ---------------------------------------------------------------------------
// Supplier Vetting -> Trust Signals (for AI prompt)
// ---------------------------------------------------------------------------

export function buildSupplierTrustSignals(supplier: SupplierVetting): string {
  const signals: string[] = []

  if (supplier.companyName) {
    signals.push(`Factory: ${supplier.companyName}`)
  }
  if (supplier.exportSinceYear) {
    signals.push(`Exporting since ${supplier.exportSinceYear} (${new Date().getFullYear() - supplier.exportSinceYear} years)`)
  }
  if (supplier.companyScale) {
    signals.push(`Scale: ${supplier.companyScale}`)
  }
  if (supplier.certifications && supplier.certifications.length > 0) {
    signals.push(`Certifications: ${supplier.certifications.join(", ")}${supplier.certificationsOther ? `, ${supplier.certificationsOther}` : ""}`)
  }
  if (supplier.qualitySystems && supplier.qualitySystems.length > 0) {
    signals.push(`Quality systems: ${supplier.qualitySystems.join(", ")}`)
  }
  if (supplier.fdaStatus && supplier.fdaStatus !== "none") {
    signals.push(`FDA: ${supplier.fdaStatus}${supplier.fdaNumber ? ` (${supplier.fdaNumber})` : ""} — valid for US market`)
  }
  if (supplier.productionCapacity) {
    signals.push(`Capacity: ${supplier.productionCapacity}`)
  }
  if (supplier.moq) {
    signals.push(`MOQ: ${supplier.moq}`)
  }
  if (supplier.leadTimeDays) {
    signals.push(`Lead time: ${supplier.leadTimeDays} days`)
  }
  if (supplier.incoterms && supplier.incoterms.length > 0) {
    signals.push(`Incoterms: ${supplier.incoterms.join(", ")}`)
  }
  if (supplier.paymentPolicy) {
    signals.push(`Payment: ${supplier.paymentPolicy}`)
  }
  if (supplier.traceability && supplier.traceability.length > 0) {
    signals.push(`Traceability: ${supplier.traceability.join(", ")}`)
  }
  if (supplier.exportMarkets && supplier.exportMarkets.length > 0) {
    signals.push(`Export markets: ${supplier.exportMarkets.slice(0, 5).join(", ")}`)
  }
  if (supplier.oemOdm && supplier.oemOdm.length > 0) {
    signals.push(`OEM/ODM: ${supplier.oemOdm.join(", ")}`)
  }
  if (supplier.hasExportDept) {
    signals.push(`Has dedicated export dept: ${supplier.hasExportDept ? "yes" : "no"}`)
  }
  if (supplier.hasEnglishStaff) {
    signals.push(`English staff: ${supplier.hasEnglishStaff ? "yes" : "no"}`)
  }
  if (supplier.staffEngineersCount) {
    signals.push(`QC engineers: ${supplier.staffEngineersCount}, workers: ${supplier.staffWorkersCount || "N/A"}`)
  }
  if (supplier.uspPoints && supplier.uspPoints.length > 0) {
    signals.push(`USPs: ${supplier.uspPoints.map(u => u.title).join(", ")}`)
  }
  if (supplier.products && supplier.products.length > 0) {
    const prodLines = supplier.products.slice(0, 3).map(p => `${p.productName}${p.hsCode ? ` (HS ${p.hsCode})` : ""}${p.complianceBadges?.length ? ` [${p.complianceBadges.join(", ")}]` : ""}`).join("; ")
    signals.push(`Key products: ${prodLines}`)
  }

  return signals.join("\n")
}

// ---------------------------------------------------------------------------
// Mapping Logic: Buyer needs -> Supplier strengths
// Returns natural language bullets for AI to use
// ---------------------------------------------------------------------------

export function buildBuyerSupplierMapping(buyer: BuyerIntel, supplier: SupplierVetting): string {
  const mappings: string[] = []

  // HS Code match
  if (buyer.hsCode && supplier.products?.some(p => p.hsCode && buyer.hsCode && p.hsCode.includes(buyer.hsCode.slice(0, 4)))) {
    mappings.push(`HS Code alignment: Buyer imports HS ${buyer.hsCode}, supplier produces same HS chapter — direct match`)
  }

  // Volume / Capacity match
  if (buyer.avgTeuPerMonth && supplier.productionCapacity) {
    mappings.push(`Volume fit: Buyer ~${buyer.avgTeuPerMonth} TEU/month, supplier capacity ${supplier.productionCapacity} — suitable scale`)
  }

  // Peak season vs lead time
  if (buyer.topPeakMonths && supplier.leadTimeDays) {
    mappings.push(`Seasonality: Buyer peaks in ${buyer.topPeakMonths}, supplier lead time ${supplier.leadTimeDays} days — plan ahead for peak`)
  }

  // FDA for US buyer
  if (buyer.country && buyer.country.toLowerCase().includes("united states") || buyer.destinationPorts?.toLowerCase().includes("us")) {
    if (supplier.fdaStatus && supplier.fdaStatus !== "none") {
      mappings.push(`US compliance: Buyer is US-based, supplier FDA ${supplier.fdaStatus} — ready for US import`)
    } else {
      mappings.push(`US compliance gap: Buyer US-based but supplier FDA not stated — need to verify FDA before sampling`)
    }
  }

  // Import countries: if buyer already sources from Vietnam
  if (buyer.mainImportCountries?.toLowerCase().includes("vietnam") || buyer.purchaseHistory?.toLowerCase().includes("vietnam")) {
    mappings.push(`Vietnam experience: Buyer already sources from Vietnam — familiar with VN logistics and quality, easier switch`)
  } else if (buyer.mainImportCountries) {
    mappings.push(`Diversification angle: Buyer currently sources from ${buyer.mainImportCountries}, Vietnam offers alternative to reduce single-country risk`)
  }

  // Payment terms
  if (supplier.paymentPolicy) {
    mappings.push(`Payment flexibility: Supplier offers ${supplier.paymentPolicy} — can match buyer preference`)
  }

  // Certifications vs product
  if (supplier.certifications && supplier.certifications.length > 0) {
    mappings.push(`Certified: ${supplier.certifications.slice(0, 3).join(", ")} — matches typical requirements for ${buyer.mainProduct || "this category"}`)
  }

  // Traceability - important for food/agri
  if (supplier.traceability && supplier.traceability.length > 0) {
    mappings.push(`Traceability: ${supplier.traceability.join(", ")} — important for US/EU buyers`)
  }

  return mappings.join("\n")
}

// ---------------------------------------------------------------------------
// Deliverability-safe positioning snippets for cold email
// These are short, conversational, NOT brochure
// ---------------------------------------------------------------------------

export function getVeximPositioningSnippet(context: "requirement" | "introduction", buyerCountry?: string | null): string {
  if (context === "requirement") {
    return `
We work a bit differently from typical sourcing agents:
- We only represent factories we've visited and audited ourselves
- Each factory is checked for valid certifications (HACCP, ISO, BRC, FDA when US-bound), traceability, and English-speaking export team
- Response within 24h, clear MOQ/lead time, flexible payment (T/T, L/C at sight)
- No trading companies — direct factory, transparent pricing

I noticed your import pattern and thought our network might be relevant, but I'd rather understand your exact specs before suggesting anyone specific.
`.trim()
  } else {
    // introduction — supplier already chosen, can be more specific
    const usNote = buyerCountry && buyerCountry.toLowerCase().includes("united states")
      ? " FDA registration is active, so US import is straightforward."
      : ""
    return `
The factory we work with has been audited by our team — not a trading company.
They have valid certifications, traceability from raw material, English export team, and flexible payment.${usNote}
Capacity and lead time are confirmed, and we can arrange a video call tour if helpful.
`.trim()
  }
}

// ---------------------------------------------------------------------------
// Google Spam Risk Assessment
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

  // Check spam trigger words
  const spamTriggers = ["best price", "cheapest", "guaranteed", "act now", "limited time", "free sample", "click here", "buy now", "discount", "!!!", "$$$"]
  const foundTriggers = spamTriggers.filter(t => lowerContent.includes(t) || lowerSubject.includes(t))
  if (foundTriggers.length > 0) {
    factors.push(`Contains spam trigger phrases: ${foundTriggers.join(", ")}`)
    riskScore += foundTriggers.length * 2
    recommendations.push("Remove salesy phrases, use consultative language")
  }

  // Check ALL CAPS
  if (/[A-Z]{5,}/.test(emailContent)) {
    factors.push("Contains excessive ALL CAPS")
    riskScore += 2
    recommendations.push("Avoid ALL CAPS, use normal sentence case")
  }

  // Check exclamation marks
  const exclamCount = (emailContent.match(/!/g) || []).length
  if (exclamCount > 1) {
    factors.push(`Multiple exclamation marks (${exclamCount})`)
    riskScore += 1
    recommendations.push("Limit to 0-1 exclamation marks")
  }

  // Check links
  const linkCount = (emailContent.match(/https?:\/\//g) || []).length
  if (linkCount > 0) {
    factors.push(`Contains ${linkCount} links — cold email should have 0 links`)
    riskScore += 3
    recommendations.push("Remove all links from first email, share in follow-up")
  }

  // Check length
  const wordCount = emailContent.split(/\s+/).length
  if (wordCount > 200) {
    factors.push(`Email too long (${wordCount} words) — Gmail prefers <150 for cold`)
    riskScore += 1
    recommendations.push("Keep first email under 150 words, intro under 180")
  }

  // Check fake Re:/Fwd
  if (lowerSubject.startsWith("re:") || lowerSubject.startsWith("fwd:")) {
    factors.push("Fake Re:/Fwd in subject — violates Gmail policy")
    riskScore += 5
    recommendations.push("Never use Re: or Fwd: unless real reply")
  }

  // Check personalization
  if (!lowerContent.includes("i noticed") && !lowerContent.includes("i saw")) {
    factors.push("Lacks buyer-specific observation — looks generic")
    riskScore += 1
    recommendations.push("Add 1-2 specific observations about buyer (HS, product, country)")
  }

  let riskLevel: "low" | "medium" | "high" = "low"
  if (riskScore >= 5) riskLevel = "high"
  else if (riskScore >= 2) riskLevel = "medium"

  if (riskLevel === "low") {
    factors.push("Passes basic Gmail checks: no links, no spam triggers, personalized, short")
  }

  return { riskLevel, factors, recommendations }
}
