/**
 * AI Matching System - Rule-Based Scoring Engine
 *
 * Calculates match scores between buyers (leads) and Account Executives (AEs).
 * Each factor is scored 0-100 and weighted to produce a final score.
 *
 * Factors:
 * 1. Product Match (25%): HS codes and keywords overlap
 * 2. Industry Match (20%): Buyer industry vs AE's clients' industries
 * 3. Workload (20%): Inverse of current opportunity count
 * 4. Win Rate (20%): Historical win rate in the buyer's industry
 * 5. FDA Compliance (10%): Whether AE's clients have valid FDA
 * 6. Country/Region (5%): Geographic market experience
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
import { DEFAULT_SCORING_WEIGHTS, DEFAULT_THRESHOLDS } from "./types"
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
  const { buyer, ae, weights } = context

  // Calculate individual factors
  const factors: ScoringFactors = {
    productMatch: calculateProductMatch(buyer, ae),
    industryMatch: calculateIndustryMatch(buyer, ae),
    fdaCompliance: calculateFDACompliance(ae),
    workload: calculateWorkloadScore(ae),
    winRate: calculateWinRate(buyer, ae),
    countryMatch: calculateCountryMatch(buyer, ae),
  }

  // Build breakdown with weighted scores
  const breakdown: FactorBreakdown[] = [
    {
      factor: "Product Match",
      rawScore: factors.productMatch,
      weight: weights.product_match,
      weightedScore: (factors.productMatch * weights.product_match) / 100,
      details: getProductMatchDetails(buyer, ae),
    },
    {
      factor: "Industry Match",
      rawScore: factors.industryMatch,
      weight: weights.industry_match,
      weightedScore: (factors.industryMatch * weights.industry_match) / 100,
      details: getIndustryMatchDetails(buyer, ae),
    },
    {
      factor: "FDA Compliance",
      rawScore: factors.fdaCompliance,
      weight: weights.fda_compliance,
      weightedScore: (factors.fdaCompliance * weights.fda_compliance) / 100,
      details: getFDADetails(ae),
    },
    {
      factor: "Workload",
      rawScore: factors.workload,
      weight: weights.workload,
      weightedScore: (factors.workload * weights.workload) / 100,
      details: getWorkloadDetails(ae),
    },
    {
      factor: "Win Rate",
      rawScore: factors.winRate,
      weight: weights.win_rate,
      weightedScore: (factors.winRate * weights.win_rate) / 100,
      details: getWinRateDetails(buyer, ae),
    },
    {
      factor: "Country Match",
      rawScore: factors.countryMatch,
      weight: weights.country_match,
      weightedScore: (factors.countryMatch * weights.country_match) / 100,
      details: getCountryMatchDetails(buyer, ae),
    },
  ]

  // Calculate total weighted score
  const totalScore = breakdown.reduce((sum, b) => sum + b.weightedScore, 0)

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
  const { buyer, ae, weights } = context

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

  // Calculate other factors
  const factors: ScoringFactors = {
    productMatch: hybridProductScore, // Use hybrid score
    industryMatch: calculateIndustryMatch(buyer, ae),
    fdaCompliance: calculateFDACompliance(ae),
    workload: calculateWorkloadScore(ae),
    winRate: calculateWinRate(buyer, ae),
    countryMatch: calculateCountryMatch(buyer, ae),
  }

  // Build breakdown with semantic details in product match
  const productMatchDetails =
    scoringMode === "hybrid" && semanticResult
      ? buildHybridProductMatchDetails(buyer, ae, semanticResult, ruleBasedProductScore)
      : getProductMatchDetails(buyer, ae)

  const breakdown: FactorBreakdown[] = [
    {
      factor: "Product Match",
      rawScore: factors.productMatch,
      weight: weights.product_match,
      weightedScore: (factors.productMatch * weights.product_match) / 100,
      details: productMatchDetails,
    },
    {
      factor: "Industry Match",
      rawScore: factors.industryMatch,
      weight: weights.industry_match,
      weightedScore: (factors.industryMatch * weights.industry_match) / 100,
      details: getIndustryMatchDetails(buyer, ae),
    },
    {
      factor: "FDA Compliance",
      rawScore: factors.fdaCompliance,
      weight: weights.fda_compliance,
      weightedScore: (factors.fdaCompliance * weights.fda_compliance) / 100,
      details: getFDADetails(ae),
    },
    {
      factor: "Workload",
      rawScore: factors.workload,
      weight: weights.workload,
      weightedScore: (factors.workload * weights.workload) / 100,
      details: getWorkloadDetails(ae),
    },
    {
      factor: "Win Rate",
      rawScore: factors.winRate,
      weight: weights.win_rate,
      weightedScore: (factors.winRate * weights.win_rate) / 100,
      details: getWinRateDetails(buyer, ae),
    },
    {
      factor: "Country Match",
      rawScore: factors.countryMatch,
      weight: weights.country_match,
      weightedScore: (factors.countryMatch * weights.country_match) / 100,
      details: getCountryMatchDetails(buyer, ae),
    },
  ]

  // Calculate total weighted score
  const totalScore = breakdown.reduce((sum, b) => sum + b.weightedScore, 0)

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
// Factor Calculation Functions
// ============================================================

/**
 * Product Match (0-100)
 * Measures overlap between buyer's HS codes/keywords and AE's clients' products.
 */
function calculateProductMatch(buyer: BuyerContext, ae: AEContext): number {
  if (ae.clientProducts.length === 0) return 0

  const buyerHSCodes = buyer.hsCodesNormalized
  const buyerKeywords = buyer.keywordsNormalized

  if (buyerHSCodes.length === 0 && buyerKeywords.length === 0) {
    return 50 // Neutral score if no buyer product data
  }

  let matchCount = 0
  let totalPossible = buyerHSCodes.length + buyerKeywords.length

  // Collect all AE client categories
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

  // Check HS code prefix matches (first 4 digits = chapter + heading)
  for (const hs of buyerHSCodes) {
    const hsPrefix = hs.slice(0, 4)
    for (const cat of aeCategories) {
      if (cat.includes(hsPrefix) || hsPrefix.includes(cat.slice(0, 4))) {
        matchCount++
        break
      }
    }
  }

  // Check keyword matches
  for (const keyword of buyerKeywords) {
    const kw = keyword.toLowerCase()
    const hasMatch =
      [...aeCategories].some((cat) => cat.includes(kw) || kw.includes(cat)) ||
      [...aeSubcategories].some((sub) => sub.includes(kw) || kw.includes(sub))
    if (hasMatch) matchCount++
  }

  // Normalize to 0-100
  if (totalPossible === 0) return 50
  return Math.min(100, Math.round((matchCount / totalPossible) * 100))
}

/**
 * Industry Match (0-100)
 * Measures if buyer's industry aligns with AE's clients' industries.
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

/**
 * Country/Region Match (0-100)
 * Whether AE has experience with the buyer's country/region.
 */
function calculateCountryMatch(buyer: BuyerContext, ae: AEContext): number {
  const buyerCountry = buyer.lead.country?.toLowerCase() || ""
  const buyerRegion = buyer.lead.region?.toLowerCase() || ""

  if (!buyerCountry && !buyerRegion) return 50 // Neutral if no location

  // This would ideally check historical opportunities by country
  // For now, we give a neutral score since we don't have that data in context
  // The LLM augmentation can improve this factor

  return 50
}

// ============================================================
// Detail Generation Functions (for UI)
// ============================================================

function getProductMatchDetails(buyer: BuyerContext, ae: AEContext): string {
  const hsCount = buyer.hsCodesNormalized.length
  const kwCount = buyer.keywordsNormalized.length
  const clientCount = ae.clientProducts.length

  if (clientCount === 0) return "No clients assigned to this AE"
  if (hsCount === 0 && kwCount === 0) return "No product data for buyer"

  return `Buyer has ${hsCount} HS codes, ${kwCount} keywords. AE manages ${clientCount} clients.`
}

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

function getCountryMatchDetails(buyer: BuyerContext, ae: AEContext): string {
  const country = buyer.lead.country || "Unknown"
  const region = buyer.lead.region || ""
  return `Buyer location: ${country}${region ? ` (${region})` : ""}`
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
