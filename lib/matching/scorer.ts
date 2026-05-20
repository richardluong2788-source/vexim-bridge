/**
 * AI Matching System - Rule-Based Scoring Engine
 *
 * Calculates match scores between buyers (leads) and Account Executives (AEs).
 * Each factor is scored 0-100 and weighted to produce a final score.
 *
 * NEW SCORING FORMULA (based on LR form spec):
 * 1. HS Code Match (40%): Exact/prefix HS code matching
 * 2. Product Match (25%): Keywords and product category overlap
 * 3. Country Match (20%): Geographic market + import countries
 * 4. Logistics Match (10%): Ports and container type alignment
 * 5. Priority Bonus (5%): LR priority rating (1-5)
 * 
 * BONUS: +10 points if buyer already has VN supplier (warm lead)
 *
 * HYBRID MODE (v2):
 * When semantic embeddings are available, uses 70% semantic + 30% rule-based
 * for product matching, significantly improving match accuracy.
 */

import type {
  ScoringContext,
  ScoringFactors,
  ScoringResult,
  FactorBreakdown,
  ScoringWeights,
  MatchingThresholds,
  AEContext,
  BuyerContext,
} from "./types"
import { DEFAULT_SCORING_WEIGHTS, DEFAULT_THRESHOLDS, normalizeWeights } from "./types"
import {
  calculateSemanticProductScore,
  type SemanticScoreResult,
} from "./semantic-scorer"

// ============================================================
// Main Scoring Function (Synchronous - Rule-Based Only)
// ============================================================

export function calculateScore(
  context: ScoringContext,
  thresholds: MatchingThresholds = DEFAULT_THRESHOLDS
): ScoringResult {
  const { buyer, ae } = context
  // Normalize weights to handle legacy format from database
  const weights = normalizeWeights(context.weights)

  // Calculate individual factors using new formula
  const factors: ScoringFactors = {
    hsCodeMatch: calculateHSCodeMatch(buyer, ae),
    productMatch: calculateProductMatch(buyer, ae),
    countryMatch: calculateCountryMatch(buyer, ae),
    logisticsMatch: calculateLogisticsMatch(buyer, ae),
    priorityBonus: calculatePriorityBonus(buyer),
    vnSupplierBonus: calculateVNSupplierBonus(buyer),
  }

  // Build breakdown with weighted scores
  const breakdown: FactorBreakdown[] = [
    {
      factor: "HS Code Match",
      rawScore: factors.hsCodeMatch,
      weight: weights.hs_code_match,
      weightedScore: (factors.hsCodeMatch * weights.hs_code_match) / 100,
      details: getHSCodeMatchDetails(buyer, ae),
    },
    {
      factor: "Product Match",
      rawScore: factors.productMatch,
      weight: weights.product_match,
      weightedScore: (factors.productMatch * weights.product_match) / 100,
      details: getProductMatchDetails(buyer, ae),
    },
    {
      factor: "Country Match",
      rawScore: factors.countryMatch,
      weight: weights.country_match,
      weightedScore: (factors.countryMatch * weights.country_match) / 100,
      details: getCountryMatchDetails(buyer, ae),
    },
    {
      factor: "Logistics Match",
      rawScore: factors.logisticsMatch,
      weight: weights.logistics_match,
      weightedScore: (factors.logisticsMatch * weights.logistics_match) / 100,
      details: getLogisticsMatchDetails(buyer, ae),
    },
    {
      factor: "Priority Bonus",
      rawScore: factors.priorityBonus,
      weight: weights.priority_bonus,
      weightedScore: (factors.priorityBonus * weights.priority_bonus) / 100,
      details: getPriorityDetails(buyer),
    },
  ]

  // Calculate total weighted score
  let totalScore = breakdown.reduce((sum, b) => sum + b.weightedScore, 0)

  // Add VN supplier bonus (flat +10 points)
  if (factors.vnSupplierBonus > 0) {
    totalScore += 10
    breakdown.push({
      factor: "VN Supplier Bonus",
      rawScore: factors.vnSupplierBonus,
      weight: 10, // Flat bonus
      weightedScore: 10,
      details: "Buyer already has VN supplier - warm lead",
    })
  }

  // Cap at 100
  totalScore = Math.min(100, totalScore)

  // Determine recommendation based on thresholds
  let recommendation: "auto_assign" | "inbox" | "skip"
  if (totalScore >= thresholds.auto_assign) {
    recommendation = "auto_assign"
  } else if (totalScore >= thresholds.inbox_min) {
    recommendation = "inbox"
  } else {
    recommendation = "skip"
  }

  return {
    accountManagerId: ae.profile.id,
    totalScore: Math.round(totalScore * 100) / 100,
    factors,
    breakdown,
    recommendation,
  }
}

// ============================================================
// Hybrid Scoring Function (Async - Uses Semantic Embeddings)
// ============================================================

/**
 * Extended scoring result with semantic match details
 */
export interface HybridScoringResult extends ScoringResult {
  semanticScore?: SemanticScoreResult
  hybridProductScore?: number
  scoringMode: "hybrid" | "rule-based"
}

/**
 * Calculate score using hybrid approach: 70% semantic + 30% rule-based
 * for product matching when embeddings are available.
 *
 * Falls back to pure rule-based if semantic scoring fails or has no data.
 */
export async function calculateHybridScore(
  context: ScoringContext,
  thresholds: MatchingThresholds = DEFAULT_THRESHOLDS
): Promise<HybridScoringResult> {
  const { buyer, ae } = context
  // Normalize weights to handle legacy format from database
  const weights = normalizeWeights(context.weights)

  // Calculate semantic score (async)
  let semanticResult: SemanticScoreResult | null = null
  try {
    semanticResult = await calculateSemanticProductScore(buyer, ae)
  } catch (error) {
    console.error("[scorer] Semantic scoring failed, using rule-based:", error)
  }

  // Calculate rule-based product match
  const ruleBasedProductScore = calculateProductMatch(buyer, ae)

  // Hybrid product score: 70% semantic + 30% rule-based
  // If semantic unavailable, fall back to 100% rule-based
  let hybridProductScore: number
  let scoringMode: "hybrid" | "rule-based"

  if (semanticResult && semanticResult.hasEmbeddings) {
    hybridProductScore = Math.round(
      semanticResult.score * 0.7 + ruleBasedProductScore * 0.3
    )
    scoringMode = "hybrid"
  } else {
    hybridProductScore = ruleBasedProductScore
    scoringMode = "rule-based"
  }

  // Calculate other factors using NEW formula
  const factors: ScoringFactors = {
    hsCodeMatch: calculateHSCodeMatch(buyer, ae),
    productMatch: hybridProductScore, // Use hybrid score for product
    countryMatch: calculateCountryMatch(buyer, ae),
    logisticsMatch: calculateLogisticsMatch(buyer, ae),
    priorityBonus: calculatePriorityBonus(buyer),
    vnSupplierBonus: calculateVNSupplierBonus(buyer),
  }

  // Build breakdown with semantic details in product match
  const productMatchDetails =
    scoringMode === "hybrid" && semanticResult
      ? buildHybridProductMatchDetails(buyer, ae, semanticResult, ruleBasedProductScore)
      : getProductMatchDetails(buyer, ae)

  const breakdown: FactorBreakdown[] = [
    {
      factor: "HS Code Match",
      rawScore: factors.hsCodeMatch,
      weight: weights.hs_code_match,
      weightedScore: (factors.hsCodeMatch * weights.hs_code_match) / 100,
      details: getHSCodeMatchDetails(buyer, ae),
    },
    {
      factor: "Product Match",
      rawScore: factors.productMatch,
      weight: weights.product_match,
      weightedScore: (factors.productMatch * weights.product_match) / 100,
      details: productMatchDetails,
    },
    {
      factor: "Country Match",
      rawScore: factors.countryMatch,
      weight: weights.country_match,
      weightedScore: (factors.countryMatch * weights.country_match) / 100,
      details: getCountryMatchDetails(buyer, ae),
    },
    {
      factor: "Logistics Match",
      rawScore: factors.logisticsMatch,
      weight: weights.logistics_match,
      weightedScore: (factors.logisticsMatch * weights.logistics_match) / 100,
      details: getLogisticsMatchDetails(buyer, ae),
    },
    {
      factor: "Priority Bonus",
      rawScore: factors.priorityBonus,
      weight: weights.priority_bonus,
      weightedScore: (factors.priorityBonus * weights.priority_bonus) / 100,
      details: getPriorityDetails(buyer),
    },
  ]

  // Calculate total weighted score
  let totalScore = breakdown.reduce((sum, b) => sum + b.weightedScore, 0)

  // Add VN supplier bonus (flat +10 points)
  if (factors.vnSupplierBonus > 0) {
    totalScore += 10
    breakdown.push({
      factor: "VN Supplier Bonus",
      rawScore: factors.vnSupplierBonus,
      weight: 10,
      weightedScore: 10,
      details: "Buyer already has VN supplier - warm lead",
    })
  }

  // Cap at 100
  totalScore = Math.min(100, totalScore)

  // Determine recommendation
  let recommendation: "auto_assign" | "inbox" | "skip"
  if (totalScore >= thresholds.auto_assign) {
    recommendation = "auto_assign"
  } else if (totalScore >= thresholds.inbox_min) {
    recommendation = "inbox"
  } else {
    recommendation = "skip"
  }

  return {
    accountManagerId: ae.profile.id,
    totalScore: Math.round(totalScore * 100) / 100,
    factors,
    breakdown,
    recommendation,
    semanticScore: semanticResult || undefined,
    hybridProductScore,
    scoringMode,
  }
}

/**
 * Build details string for hybrid product match
 */
function buildHybridProductMatchDetails(
  buyer: BuyerContext,
  ae: AEContext,
  semantic: SemanticScoreResult,
  ruleBased: number
): string {
  const parts: string[] = []

  parts.push(`Hybrid: ${semantic.score} semantic + ${ruleBased} rules`)

  if (semantic.topMatches.length > 0) {
    const top = semantic.topMatches[0]
    const similarityPct = Math.round(top.similarity * 100)
    parts.push(`Top match: "${top.matchedProduct.slice(0, 40)}..." (${similarityPct}%)`)
  }

  return parts.join(". ")
}

/**
 * Calculate hybrid scores for multiple AEs (async)
 */
export async function calculateHybridScoresForBuyer(
  buyer: BuyerContext,
  aes: AEContext[],
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
  thresholds: MatchingThresholds = DEFAULT_THRESHOLDS
): Promise<HybridScoringResult[]> {
  const results = await Promise.all(
    aes.map((ae) =>
      calculateHybridScore(
        {
          buyer,
          ae,
          weights,
        },
        thresholds
      )
    )
  )

  return results.sort((a, b) => b.totalScore - a.totalScore)
}

// ============================================================
// Factor Calculation Functions (NEW FORMULA)
// ============================================================

/**
 * HS Code Match (0-100) - Weight: 40%
 * Exact or prefix matching of buyer's HS codes with AE's clients' products.
 */
function calculateHSCodeMatch(buyer: BuyerContext, ae: AEContext): number {
  if (ae.clientProducts.length === 0) return 0

  const buyerHSCodes = buyer.hsCodesNormalized
  if (buyerHSCodes.length === 0) return 30 // Neutral if no HS codes

  // Collect all HS codes from AE's clients
  const aeHSCodes = new Set<string>()
  for (const client of ae.clientProducts) {
    for (const cat of client.product_categories) {
      // Extract HS-like patterns from categories
      const hsMatch = cat.match(/\d{4,6}/)
      if (hsMatch) aeHSCodes.add(hsMatch[0])
    }
  }

  if (aeHSCodes.size === 0) return 20 // Low score if no HS data

  let exactMatches = 0
  let prefixMatches = 0

  for (const buyerHS of buyerHSCodes) {
    const buyerPrefix = buyerHS.slice(0, 4)
    
    // Check exact match (6-digit)
    if (aeHSCodes.has(buyerHS)) {
      exactMatches++
      continue
    }
    
    // Check 4-digit prefix match
    for (const aeHS of aeHSCodes) {
      if (aeHS.startsWith(buyerPrefix) || buyerHS.startsWith(aeHS.slice(0, 4))) {
        prefixMatches++
        break
      }
    }
  }

  // Exact match = 100, prefix match = 70, partial = based on ratio
  if (exactMatches > 0) return 100
  if (prefixMatches > 0) return 70 + Math.min(30, (prefixMatches / buyerHSCodes.length) * 30)
  return 20
}

/**
 * Product Match (0-100) - Weight: 25%
 * Measures overlap between buyer's product keywords and AE's clients' products.
 */
function calculateProductMatch(buyer: BuyerContext, ae: AEContext): number {
  if (ae.clientProducts.length === 0) return 0

  const buyerKeywords = buyer.keywordsNormalized
  if (buyerKeywords.length === 0) return 40 // Neutral if no keywords

  // Collect all AE client categories and subcategories
  const aeCategories = new Set<string>()
  const aeSubcategories = new Set<string>()

  for (const client of ae.clientProducts) {
    for (const cat of client.product_categories) {
      aeCategories.add(cat.toLowerCase())
    }
    for (const sub of client.product_subcategories) {
      aeSubcategories.add(sub.toLowerCase())
    }
  }

  let matchCount = 0

  for (const keyword of buyerKeywords) {
    const kw = keyword.toLowerCase()
    const hasMatch =
      [...aeCategories].some((cat) => cat.includes(kw) || kw.includes(cat)) ||
      [...aeSubcategories].some((sub) => sub.includes(kw) || kw.includes(sub))
    if (hasMatch) matchCount++
  }

  // Normalize to 0-100
  return Math.min(100, Math.round((matchCount / buyerKeywords.length) * 100))
}

/**
 * Country Match (0-100) - Weight: 20%
 * Checks buyer's import countries and origin against AE's export experience.
 */
function calculateCountryMatch(buyer: BuyerContext, ae: AEContext): number {
  const buyerCountry = buyer.lead.country?.toLowerCase() || ""
  const mainImportCountries = buyer.lead.main_import_countries?.toLowerCase() || ""
  
  if (!buyerCountry && !mainImportCountries) return 50 // Neutral

  // Check if buyer imports from Vietnam (our target market)
  const importsFromVN = mainImportCountries.includes("vietnam") || 
                        mainImportCountries.includes("vn") ||
                        mainImportCountries.includes("viet nam")
  
  if (importsFromVN) return 100 // Perfect match - already imports from VN

  // Check if AE has clients in buyer's country/region
  const aeCountries = new Set<string>()
  for (const client of ae.clientProducts) {
    if (client.client_country) {
      aeCountries.add(client.client_country.toLowerCase())
    }
  }

  // Buyer's country matches AE's client countries
  if (buyerCountry && aeCountries.has(buyerCountry)) return 80

  return 40 // No specific match
}

/**
 * Logistics Match (0-100) - Weight: 10%
 * Checks ports and container type alignment.
 */
function calculateLogisticsMatch(buyer: BuyerContext, ae: AEContext): number {
  const originPorts = buyer.lead.origin_ports?.toLowerCase() || ""
  const destPorts = buyer.lead.destination_ports?.toLowerCase() || ""
  const containerTypes = buyer.lead.container_types?.toLowerCase() || ""

  if (!originPorts && !destPorts && !containerTypes) return 50 // Neutral

  let score = 50

  // Bonus for Vietnamese ports in origin
  const vnPorts = ["hcmc", "ho chi minh", "hai phong", "da nang", "cat lai", "cai mep"]
  for (const port of vnPorts) {
    if (originPorts.includes(port)) {
      score += 30
      break
    }
  }

  // Bonus for common container types
  if (containerTypes.includes("40") || containerTypes.includes("20")) {
    score += 20
  }

  return Math.min(100, score)
}

/**
 * Priority Bonus (0-100) - Weight: 5%
 * Based on LR priority rating (1-5 scale).
 */
function calculatePriorityBonus(buyer: BuyerContext): number {
  const priority = buyer.lead.priority_rating
  if (!priority || priority <= 0) return 0

  // Convert 1-5 scale to 0-100
  return Math.min(100, priority * 20)
}

/**
 * VN Supplier Bonus (0 or 100) - Flat +10 points
 * Returns 100 if buyer already has a Vietnamese supplier (warm lead).
 */
function calculateVNSupplierBonus(buyer: BuyerContext): number {
  const suppliers = buyer.lead.top_suppliers
  if (!suppliers || !Array.isArray(suppliers)) return 0

  for (const supplier of suppliers) {
    const country = supplier.country?.toLowerCase() || ""
    if (country.includes("vietnam") || country.includes("vn") || country === "viet nam") {
      return 100
    }
  }

  return 0
}

// ============================================================
// Legacy Factor Functions (kept for backward compatibility)
// ============================================================

/**
 * @deprecated Use calculateHSCodeMatch instead
 * Industry Match (0-100)
 */
function calculateIndustryMatch(buyer: BuyerContext, ae: AEContext): number {
  const buyerIndustry = buyer.lead.industry?.toLowerCase() || ""
  if (!buyerIndustry) return 50 // Neutral if no buyer industry

  if (ae.clientProducts.length === 0) return 0

  // Collect all AE client industries
  const aeIndustries = new Set<string>()
  for (const client of ae.clientProducts) {
    if (client.client_industry) {
      aeIndustries.add(client.client_industry.toLowerCase())
    }
    for (const ind of client.client_industries || []) {
      aeIndustries.add(ind.toLowerCase())
    }
  }

  if (aeIndustries.size === 0) return 30 // Low score if no industry data

  // Exact match
  if (aeIndustries.has(buyerIndustry)) return 100

  // Partial/fuzzy match
  for (const ind of aeIndustries) {
    if (ind.includes(buyerIndustry) || buyerIndustry.includes(ind)) {
      return 80
    }
  }

  // Related industry affinity (simplified - could be expanded)
  const industryGroups: Record<string, string[]> = {
    food: ["seafood", "agricultural", "food processing", "beverage", "dairy"],
    manufacturing: ["electronics", "machinery", "automotive", "textiles"],
    retail: ["consumer goods", "ecommerce", "wholesale"],
  }

  for (const [group, related] of Object.entries(industryGroups)) {
    const buyerInGroup =
      related.some((r) => buyerIndustry.includes(r)) ||
      buyerIndustry.includes(group)
    const aeInGroup = [...aeIndustries].some(
      (ind) => related.some((r) => ind.includes(r)) || ind.includes(group)
    )
    if (buyerInGroup && aeInGroup) return 60
  }

  return 20 // No match
}

/**
 * FDA Compliance (0-100)
 * Penalizes AEs whose clients lack valid FDA registration.
 */
function calculateFDACompliance(ae: AEContext): number {
  if (ae.clientProducts.length === 0) return 50 // Neutral if no clients

  const validFDACount = ae.clientProducts.filter((c) => c.fda_valid).length
  const totalClients = ae.clientProducts.length

  // Score based on percentage of FDA-valid clients
  const validRatio = validFDACount / totalClients
  return Math.round(validRatio * 100)
}

/**
 * Workload Score (0-100)
 * Higher score = lower workload (more capacity)
 * Uses inverse scoring: fewer in-progress opps = higher score
 */
function calculateWorkloadScore(ae: AEContext): number {
  if (!ae.workload) return 50 // Neutral if no data

  const inProgress = ae.workload.in_progress_count

  // Scoring tiers:
  // 0-3 opps: 100 (very available)
  // 4-6 opps: 80
  // 7-10 opps: 60
  // 11-15 opps: 40
  // 16-20 opps: 20
  // 20+ opps: 10

  if (inProgress <= 3) return 100
  if (inProgress <= 6) return 80
  if (inProgress <= 10) return 60
  if (inProgress <= 15) return 40
  if (inProgress <= 20) return 20
  return 10
}

/**
 * Win Rate (0-100)
 * AE's historical win rate in the buyer's industry.
 */
function calculateWinRate(buyer: BuyerContext, ae: AEContext): number {
  const buyerIndustry = buyer.lead.industry?.toLowerCase() || ""

  if (ae.winRateByIndustry.length === 0) return 50 // Neutral if no history

  // Try exact industry match
  const exactMatch = ae.winRateByIndustry.find(
    (wr) => wr.industry?.toLowerCase() === buyerIndustry
  )

  if (exactMatch && exactMatch.total_closed >= 3) {
    // Need at least 3 deals for statistical relevance
    return Math.min(100, Math.round(exactMatch.win_rate))
  }

  // Calculate overall win rate as fallback
  const totalWins = ae.winRateByIndustry.reduce((sum, wr) => sum + wr.wins, 0)
  const totalDeals = ae.winRateByIndustry.reduce(
    (sum, wr) => sum + wr.total_closed,
    0
  )

  if (totalDeals >= 3) {
    return Math.min(100, Math.round((totalWins / totalDeals) * 100))
  }

  return 50 // Not enough data
}

// ============================================================
// Detail Generation Functions (for UI)
// ============================================================

function getHSCodeMatchDetails(buyer: BuyerContext, ae: AEContext): string {
  const hsCount = buyer.hsCodesNormalized.length
  const clientCount = ae.clientProducts.length
  const mainHS = buyer.lead.hs_code || "N/A"

  if (clientCount === 0) return "No clients assigned to this AE"
  if (hsCount === 0) return "No HS codes for buyer"

  return `Buyer HS: ${mainHS} (${hsCount} total). AE manages ${clientCount} clients.`
}

function getProductMatchDetails(buyer: BuyerContext, ae: AEContext): string {
  const kwCount = buyer.keywordsNormalized.length
  const mainProduct = buyer.lead.main_product || "Unknown"
  const clientCount = ae.clientProducts.length

  if (clientCount === 0) return "No clients assigned to this AE"
  if (kwCount === 0) return "No product keywords for buyer"

  return `Product: ${mainProduct}. AE manages ${clientCount} clients.`
}

function getCountryMatchDetails(buyer: BuyerContext, ae: AEContext): string {
  const country = buyer.lead.country || "Unknown"
  const importCountries = buyer.lead.main_import_countries || "N/A"
  return `Buyer: ${country}. Import from: ${importCountries}`
}

function getLogisticsMatchDetails(buyer: BuyerContext, ae: AEContext): string {
  const origin = buyer.lead.origin_ports || "N/A"
  const dest = buyer.lead.destination_ports || "N/A"
  const containers = buyer.lead.container_types || "N/A"
  return `Origin: ${origin}. Dest: ${dest}. Containers: ${containers}`
}

function getPriorityDetails(buyer: BuyerContext): string {
  const priority = buyer.lead.priority_rating
  if (!priority) return "No priority set"
  return `LR Priority: ${priority}/5`
}

// Legacy detail functions (kept for backward compat)
function getIndustryMatchDetails(buyer: BuyerContext, ae: AEContext): string {
  const buyerIndustry = buyer.lead.industry || "Unknown"
  const aeIndustries = new Set<string>()

  for (const client of ae.clientProducts) {
    if (client.client_industry) aeIndustries.add(client.client_industry)
  }

  return `Buyer: ${buyerIndustry}. AE industries: ${[...aeIndustries].join(", ") || "None"}`
}

function getFDADetails(ae: AEContext): string {
  if (ae.clientProducts.length === 0) return "No clients"

  const validCount = ae.clientProducts.filter((c) => c.fda_valid).length
  return `${validCount}/${ae.clientProducts.length} clients with valid FDA`
}

function getWorkloadDetails(ae: AEContext): string {
  if (!ae.workload) return "No workload data"

  return `${ae.workload.in_progress_count} in-progress (${ae.workload.new_count} new, ${ae.workload.active_count} active)`
}

function getWinRateDetails(buyer: BuyerContext, ae: AEContext): string {
  const buyerIndustry = buyer.lead.industry || ""

  const exactMatch = ae.winRateByIndustry.find(
    (wr) => wr.industry?.toLowerCase() === buyerIndustry.toLowerCase()
  )

  if (exactMatch) {
    return `${exactMatch.win_rate}% win rate in ${buyerIndustry} (${exactMatch.total_closed} deals)`
  }

  const totalDeals = ae.winRateByIndustry.reduce(
    (sum, wr) => sum + wr.total_closed,
    0
  )
  return `No data for ${buyerIndustry || "this industry"}. ${totalDeals} total deals.`
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Normalize HS codes - extract clean codes from various formats
 */
export function normalizeHSCodes(codes: string[] | null | undefined): string[] {
  if (!codes || !Array.isArray(codes)) return []

  return codes
    .map((code) => {
      // Remove non-numeric characters except dots
      const cleaned = code.replace(/[^0-9.]/g, "")
      // Take first 6-10 digits
      return cleaned.slice(0, 10)
    })
    .filter((code) => code.length >= 4)
}

/**
 * Normalize keywords - lowercase and trim
 */
export function normalizeKeywords(
  keywords: string[] | null | undefined
): string[] {
  if (!keywords || !Array.isArray(keywords)) return []

  return keywords
    .map((kw) => kw.toLowerCase().trim())
    .filter((kw) => kw.length >= 2)
}

/**
 * Calculate scores for multiple AEs against a single buyer
 */
export function calculateScoresForBuyer(
  buyer: BuyerContext,
  aes: AEContext[],
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
  thresholds: MatchingThresholds = DEFAULT_THRESHOLDS
): ScoringResult[] {
  return aes
    .map((ae) =>
      calculateScore(
        {
          buyer,
          ae,
          weights,
        },
        thresholds
      )
    )
    .sort((a, b) => b.totalScore - a.totalScore)
}
