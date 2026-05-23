/**
 * Buyer Analyzer - Pure calculation functions
 * 
 * Analyzes ImportYeti data to provide insights:
 * 1. Buyer Health Score (0-100)
 * 2. Supplier Loyalty Score (0-100)
 * 3. Vietnam Readiness Score (0-100)
 */

import type {
  ImportYetiAPIData,
  ImportYetiSupplier,
  ImportYetiTimeSeriesEntry,
} from "@/lib/importyeti/api-transformer"

// ══════════════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════════════

export interface BuyerHealthBreakdown {
  trendScore: number          // 0-25: Based on YoY change
  stabilityScore: number      // 0-25: Based on coefficient of variation
  consistencyScore: number    // 0-25: Based on months with activity
  growthScore: number         // 0-25: Based on 3-year growth trajectory
  growthRate: number          // Raw YoY % change
  riskLevel: "low" | "medium" | "high"
}

export interface SupplierLoyaltyBreakdown {
  switchingRate: number       // % of shipments from new suppliers in 12m
  topSupplierTenure: string   // e.g., "9y 2m"
  newSupplierRate: number     // % of suppliers that are new
  concentration: number       // % of shipments from top 3 suppliers
  topSupplierName: string
  topSupplierCountry: string
}

export interface VietnamSupplierInfo {
  name: string
  firstYear: string | null
  shipments: number
  businessLength: string
}

export interface VietnamReadinessBreakdown {
  hasVnHistory: boolean
  vnSuppliers: VietnamSupplierInfo[]
  asiaExperience: string[]    // List of Asian countries buyer imports from
  productMatchScore: number   // 0-40: Based on HS codes matching VN export strength
  vnHistoryScore: number      // 0-30: Based on VN supplier history
  asiaScore: number           // 0-30: Based on Asia sourcing experience
}

export interface BuyerAnalysisResult {
  healthScore: number
  healthBreakdown: BuyerHealthBreakdown
  loyaltyScore: number
  loyaltyBreakdown: SupplierLoyaltyBreakdown
  vietnamReadiness: number
  vietnamBreakdown: VietnamReadinessBreakdown
  companyName: string
  totalShipments: number
  yearsActive: number
}

// ══════════════════════════════════════════════════════════════════════════════
// Constants - Vietnam export strength HS codes
// ══════════════════════════════════════════════════════════════════════════════

const VN_STRONG_HS_CODES: Record<string, number> = {
  // Textiles & Apparel (VN top export)
  "61": 10, "62": 10, "63": 8, "64": 9, // Apparel, footwear
  // Furniture & Wood
  "94": 10, "44": 8,
  // Electronics
  "85": 9, "84": 7,
  // Seafood
  "03": 10, "16": 8,
  // Coffee, Cashew, Agriculture
  "09": 10, "08": 9, "20": 7,
  // Rubber & Plastics
  "40": 7, "39": 6,
  // Steel & Metals
  "72": 5, "73": 6,
  // Leather goods
  "42": 8,
  // Ceramic & Handicraft
  "69": 7, "46": 8,
}

const ASIA_COUNTRIES = [
  "China", "CN",
  "Thailand", "TH",
  "Indonesia", "ID",
  "India", "IN",
  "Bangladesh", "BD",
  "Cambodia", "KH",
  "Malaysia", "MY",
  "Philippines", "PH",
  "Taiwan", "TW",
  "South Korea", "KR",
  "Japan", "JP",
  "Pakistan", "PK",
  "Sri Lanka", "LK",
]

// ══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ══════════════════════════════════════════════════════════════════════════════

function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2))
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length
  return Math.sqrt(avgSquaredDiff)
}

function calculateCoefficientOfVariation(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  if (mean === 0) return 0
  const stdDev = calculateStandardDeviation(values)
  return (stdDev / mean) * 100
}

function parseBusinessLength(businessLength: string): number {
  // Parse "9y 2m 24d" to years (decimal)
  const yearMatch = businessLength.match(/(\d+)y/)
  const monthMatch = businessLength.match(/(\d+)m/)
  const years = yearMatch ? parseInt(yearMatch[1]) : 0
  const months = monthMatch ? parseInt(monthMatch[1]) : 0
  return years + months / 12
}

function isAsianCountry(country: string): boolean {
  return ASIA_COUNTRIES.some(c => 
    country.toLowerCase().includes(c.toLowerCase()) ||
    c.toLowerCase().includes(country.toLowerCase())
  )
}

function isVietnamCountry(country: string): boolean {
  const vnNames = ["vietnam", "viet nam", "vn", "việt nam"]
  return vnNames.some(n => country.toLowerCase().includes(n))
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Analysis Functions
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate Buyer Health Score (0-100)
 * 
 * Components:
 * - Trend Score (0-25): YoY change - positive growth = higher score
 * - Stability Score (0-25): Lower CV = more stable = higher score
 * - Consistency Score (0-25): More active months = higher score
 * - Growth Score (0-25): 3-year trajectory
 */
export function calculateBuyerHealthScore(
  timeSeries: Record<string, ImportYetiTimeSeriesEntry>,
  avgTeuPerMonth: { "12m": number; "24m": number; "36m": number; "12_24m": number; "24_36m": number }
): { score: number; breakdown: BuyerHealthBreakdown } {
  
  // 1. Trend Score (0-25) - Based on YoY change
  const current12m = avgTeuPerMonth["12m"] || 0
  const previous12m = avgTeuPerMonth["12_24m"] || 0
  let growthRate = 0
  if (previous12m > 0) {
    growthRate = ((current12m - previous12m) / previous12m) * 100
  }
  
  // Map growth rate to score: -50% = 0, 0% = 12.5, +50% = 25
  let trendScore = Math.min(25, Math.max(0, (growthRate + 50) / 4))
  
  // 2. Stability Score (0-25) - Based on coefficient of variation
  const monthlyTeus = Object.values(timeSeries).map(m => m.teu)
  const cv = calculateCoefficientOfVariation(monthlyTeus)
  // Lower CV = more stable. CV of 0% = 25, CV of 100% = 0
  const stabilityScore = Math.min(25, Math.max(0, 25 - (cv / 4)))
  
  // 3. Consistency Score (0-25) - Active months in last 24 months
  const now = new Date()
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), 1)
  
  let activeMonths = 0
  Object.entries(timeSeries).forEach(([dateStr, data]) => {
    const parts = dateStr.split("/")
    const date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, 1)
    if (date >= twoYearsAgo && data.shipments > 0) {
      activeMonths++
    }
  })
  // 24 active months = 25, 12 months = 12.5, 0 months = 0
  const consistencyScore = Math.min(25, (activeMonths / 24) * 25)
  
  // 4. Growth Score (0-25) - 3-year trajectory
  const year1Avg = avgTeuPerMonth["24_36m"] || 0
  const year2Avg = avgTeuPerMonth["12_24m"] || 0
  const year3Avg = avgTeuPerMonth["12m"] || 0
  
  let growthScore = 12.5 // Default neutral
  if (year1Avg > 0 && year2Avg > 0 && year3Avg > 0) {
    const trend1to2 = (year2Avg - year1Avg) / year1Avg
    const trend2to3 = (year3Avg - year2Avg) / year2Avg
    // Consistent growth = high score
    if (trend1to2 > 0 && trend2to3 > 0) {
      growthScore = Math.min(25, 15 + (trend2to3 * 50))
    } else if (trend1to2 < 0 && trend2to3 < 0) {
      growthScore = Math.max(0, 10 + (trend2to3 * 50))
    } else {
      growthScore = 12.5 // Mixed signals
    }
  }
  
  const totalScore = Math.round(trendScore + stabilityScore + consistencyScore + growthScore)
  
  // Risk Level
  let riskLevel: "low" | "medium" | "high" = "medium"
  if (totalScore >= 70) riskLevel = "low"
  else if (totalScore <= 40) riskLevel = "high"
  
  return {
    score: totalScore,
    breakdown: {
      trendScore: Math.round(trendScore),
      stabilityScore: Math.round(stabilityScore),
      consistencyScore: Math.round(consistencyScore),
      growthScore: Math.round(growthScore),
      growthRate: Math.round(growthRate * 10) / 10,
      riskLevel,
    }
  }
}

/**
 * Analyze Supplier Loyalty (0-100)
 * 
 * Higher score = MORE loyal (harder to switch)
 * Lower score = Less loyal (easier to approach)
 */
export function analyzeSupplierLoyalty(
  suppliers: ImportYetiSupplier[]
): { score: number; breakdown: SupplierLoyaltyBreakdown } {
  
  if (!suppliers || suppliers.length === 0) {
    return {
      score: 50,
      breakdown: {
        switchingRate: 0,
        topSupplierTenure: "N/A",
        newSupplierRate: 0,
        concentration: 0,
        topSupplierName: "Unknown",
        topSupplierCountry: "Unknown",
      }
    }
  }
  
  // Sort by shipments
  const sortedSuppliers = [...suppliers].sort(
    (a, b) => b.total_shipments_company - a.total_shipments_company
  )
  
  const topSupplier = sortedSuppliers[0]
  const totalShipments = suppliers.reduce((sum, s) => sum + s.total_shipments_company, 0)
  
  // 1. Concentration (% from top 3)
  const top3Shipments = sortedSuppliers.slice(0, 3).reduce((sum, s) => sum + s.total_shipments_company, 0)
  const concentration = totalShipments > 0 ? (top3Shipments / totalShipments) * 100 : 0
  
  // 2. New Supplier Rate
  const newSuppliers = suppliers.filter(s => s.is_new_supplier)
  const newSupplierRate = (newSuppliers.length / suppliers.length) * 100
  
  // 3. Switching Rate (shipments from new suppliers in 12m)
  const newSupplierShipments12m = newSuppliers.reduce((sum, s) => sum + (s.shipments_12m || 0), 0)
  const totalShipments12m = suppliers.reduce((sum, s) => sum + (s.shipments_12m || 0), 0)
  const switchingRate = totalShipments12m > 0 ? (newSupplierShipments12m / totalShipments12m) * 100 : 0
  
  // 4. Top Supplier Tenure
  const topSupplierTenure = topSupplier?.business_length || "N/A"
  const tenureYears = topSupplier ? parseBusinessLength(topSupplierTenure) : 0
  
  // Calculate loyalty score
  // High concentration + low switching + long tenure = HIGH loyalty (hard to approach)
  const concentrationScore = concentration * 0.4 // 0-40
  const switchingPenalty = Math.max(0, 30 - switchingRate) // 0-30 (lower switching = higher loyalty)
  const tenureScore = Math.min(30, tenureYears * 3) // 0-30
  
  const loyaltyScore = Math.min(100, Math.round(concentrationScore + switchingPenalty + tenureScore))
  
  return {
    score: loyaltyScore,
    breakdown: {
      switchingRate: Math.round(switchingRate * 10) / 10,
      topSupplierTenure,
      newSupplierRate: Math.round(newSupplierRate * 10) / 10,
      concentration: Math.round(concentration * 10) / 10,
      topSupplierName: topSupplier?.supplier_name || "Unknown",
      topSupplierCountry: topSupplier?.supplier_address_country || "Unknown",
    }
  }
}

/**
 * Calculate Vietnam Readiness Score (0-100)
 * 
 * Higher score = More likely to buy from Vietnam
 */
export function calculateVietnamReadiness(
  data: ImportYetiAPIData
): { score: number; breakdown: VietnamReadinessBreakdown } {
  
  const suppliers = data.suppliers_table || []
  const hsCodes = data.hs_codes || []
  const mapTable = data.map_table
  
  // 1. Check for VN suppliers (0-30)
  const vnSuppliers: VietnamSupplierInfo[] = suppliers
    .filter(s => isVietnamCountry(s.supplier_address_country) || isVietnamCountry(s.country))
    .map(s => ({
      name: s.supplier_name,
      firstYear: s.first_shipment ? s.first_shipment.split("/")[2] : null,
      shipments: s.total_shipments_company,
      businessLength: s.business_length,
    }))
  
  const hasVnHistory = vnSuppliers.length > 0
  let vnHistoryScore = 0
  if (hasVnHistory) {
    // Base 15 points for having VN history
    vnHistoryScore = 15
    // Additional points for recency and volume
    const totalVnShipments = vnSuppliers.reduce((sum, s) => sum + s.shipments, 0)
    const totalShipments = data.total_shipments || 1
    const vnPercentage = (totalVnShipments / totalShipments) * 100
    vnHistoryScore += Math.min(15, vnPercentage * 1.5) // Up to 15 more points
  }
  
  // 2. Asia Experience (0-30)
  const asiaCountries = new Set<string>()
  suppliers.forEach(s => {
    const country = s.supplier_address_country || s.country
    if (country && isAsianCountry(country)) {
      // Normalize country name
      const normalized = country.split(",")[0].trim()
      asiaCountries.add(normalized)
    }
  })
  
  // Also check shipments_by_country
  if (mapTable?.shipments_by_country) {
    Object.keys(mapTable.shipments_by_country).forEach(country => {
      if (isAsianCountry(country)) {
        asiaCountries.add(country)
      }
    })
  }
  
  const asiaExperience = Array.from(asiaCountries)
  // More Asian countries = more ready for VN
  // 1 country = 10, 3 countries = 20, 5+ countries = 30
  const asiaScore = Math.min(30, asiaExperience.length * 6)
  
  // 3. Product Match with VN export strength (0-40)
  let productMatchScore = 0
  hsCodes.forEach(hsCode => {
    const hs2 = hsCode.hs_code.substring(0, 2)
    if (VN_STRONG_HS_CODES[hs2]) {
      // Weight by shipment volume
      const volumeWeight = Math.min(1, (hsCode.shipments || 0) / 1000)
      productMatchScore += VN_STRONG_HS_CODES[hs2] * (0.5 + volumeWeight * 0.5)
    }
  })
  productMatchScore = Math.min(40, Math.round(productMatchScore))
  
  const totalScore = Math.min(100, Math.round(vnHistoryScore + asiaScore + productMatchScore))
  
  return {
    score: totalScore,
    breakdown: {
      hasVnHistory,
      vnSuppliers,
      asiaExperience,
      productMatchScore,
      vnHistoryScore: Math.round(vnHistoryScore),
      asiaScore,
    }
  }
}

/**
 * Main analysis function - combines all scores
 */
export function analyzeBuyer(data: ImportYetiAPIData): BuyerAnalysisResult {
  const health = calculateBuyerHealthScore(data.time_series, data.avg_teu_per_month)
  const loyalty = analyzeSupplierLoyalty(data.suppliers_table)
  const vnReadiness = calculateVietnamReadiness(data)
  
  // Calculate years active
  let yearsActive = 0
  if (data.date_range?.start_date) {
    const startYear = parseInt(data.date_range.start_date.split("/")[2])
    const currentYear = new Date().getFullYear()
    yearsActive = currentYear - startYear
  }
  
  return {
    healthScore: health.score,
    healthBreakdown: health.breakdown,
    loyaltyScore: loyalty.score,
    loyaltyBreakdown: loyalty.breakdown,
    vietnamReadiness: vnReadiness.score,
    vietnamBreakdown: vnReadiness.breakdown,
    companyName: data.title,
    totalShipments: data.total_shipments,
    yearsActive,
  }
}
