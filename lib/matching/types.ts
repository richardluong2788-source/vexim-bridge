/**
 * AI Matching System - Type Definitions
 *
 * Defines the core types used throughout the AE matching system.
 * These types are used for scoring calculations, inbox management,
 * and API responses.
 */

import { z } from "zod"
import type {
  Lead,
  Profile,
  AEMatchScore,
  AEMatchInbox,
  AEWorkloadSummary,
  AEWinRateByIndustry,
  AEClientProducts,
} from "@/lib/supabase/types"

// ============================================================
// Scoring Factor Schemas
// ============================================================

export const ScoringFactorsSchema = z.object({
  productMatch: z.number().min(0).max(100),
  industryMatch: z.number().min(0).max(100),
  fdaCompliance: z.number().min(0).max(100),
  workload: z.number().min(0).max(100),
  winRate: z.number().min(0).max(100),
  countryMatch: z.number().min(0).max(100),
})

export type ScoringFactors = z.infer<typeof ScoringFactorsSchema>

export const ScoringWeightsSchema = z.object({
  product_match: z.number().min(0).max(100),
  industry_match: z.number().min(0).max(100),
  workload: z.number().min(0).max(100),
  win_rate: z.number().min(0).max(100),
  fda_compliance: z.number().min(0).max(100),
  country_match: z.number().min(0).max(100),
})

export type ScoringWeights = z.infer<typeof ScoringWeightsSchema>

export const MatchingThresholdsSchema = z.object({
  auto_assign: z.number().min(0).max(100),
  inbox_min: z.number().min(0).max(100),
  inbox_max: z.number().min(0).max(100),
})

export type MatchingThresholds = z.infer<typeof MatchingThresholdsSchema>

// ============================================================
// Default Configuration
// ============================================================

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  product_match: 25,
  industry_match: 20,
  workload: 20,
  win_rate: 20,
  fda_compliance: 10,
  country_match: 5,
}

export const DEFAULT_THRESHOLDS: MatchingThresholds = {
  auto_assign: 75,
  inbox_min: 50,
  inbox_max: 75,
}

// ============================================================
// Scoring Context - Data needed to calculate scores
// ============================================================

export interface BuyerContext {
  lead: Lead
  hsCodesNormalized: string[]
  keywordsNormalized: string[]
}

export interface AEContext {
  profile: Profile
  workload: AEWorkloadSummary | null
  winRateByIndustry: AEWinRateByIndustry[]
  clientProducts: AEClientProducts[]
}

export interface ScoringContext {
  buyer: BuyerContext
  ae: AEContext
  weights: ScoringWeights
}

// ============================================================
// Scoring Results
// ============================================================

export interface FactorBreakdown {
  factor: string
  rawScore: number
  weight: number
  weightedScore: number
  details?: string
}

export interface ScoringResult {
  accountManagerId: string
  totalScore: number
  factors: ScoringFactors
  breakdown: FactorBreakdown[]
  recommendation: "auto_assign" | "inbox" | "skip"
}

// ============================================================
// Matching Pipeline Types
// ============================================================

export interface MatchingRequest {
  leadId: string
  triggeredBy: string
  useLLMAugmentation?: boolean
}

export interface MatchingResult {
  leadId: string
  scores: ScoringResult[]
  topCandidate: ScoringResult | null
  autoAssigned: boolean
  assignedTo: string | null
  inboxItems: {
    accountManagerId: string
    priority: "high" | "medium" | "low"
  }[]
  timestamp: string
}

// ============================================================
// API Response Types
// ============================================================

export interface ScoreAPIResponse {
  success: boolean
  result?: MatchingResult
  error?: string
}

export interface InboxActionResponse {
  success: boolean
  opportunityId?: string
  error?: string
}

// ============================================================
// Enriched Types for UI
// ============================================================

export interface MatchScoreWithAE extends AEMatchScore {
  ae: Pick<Profile, "id" | "full_name" | "email" | "avatar_url">
}

export interface InboxItemWithDetails extends AEMatchInbox {
  lead: Lead
  score: AEMatchScore | null
}

export interface BuyerWithMatches extends Lead {
  matchScores: MatchScoreWithAE[]
  topScore: number | null
  hasOpportunity: boolean
  assignedCount: number
}

// ============================================================
// LLM Augmentation Types
// ============================================================

export interface LLMAugmentationRequest {
  buyer: BuyerContext
  candidates: Array<{
    ae: AEContext
    ruleBasedScore: number
  }>
  topN: number
}

export interface LLMAugmentedScore {
  accountManagerId: string
  adjustedScore: number
  reasoning: string
  confidence: number
}

export interface LLMAugmentationResult {
  augmentedScores: LLMAugmentedScore[]
  model: string
  processingTimeMs: number
}
