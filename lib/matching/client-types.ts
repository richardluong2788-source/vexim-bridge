/**
 * AI Match: Buyer (lead) ↔ Client (Vietnamese exporter) matching.
 *
 * This is a SEPARATE scoring system from `lib/matching/scorer.ts`, which
 * matches Buyers ↔ Account Executives. This module matches a specific
 * buyer's requirements against a client's product catalog + operational
 * trust signals, and answers "which clients can serve this buyer, and how
 * well" — not "who owns this lead".
 *
 * Design principle (see v0_plans/deep-method.md):
 *   - Match Score  = product/technical/compliance fit (can the client make it?)
 *   - Commercial   = negotiable terms (price/incoterm/payment/lead time) —
 *                    shown as flags, never subtracted from Match Score.
 *   - Trust Score  = operational reliability of the client (KYC, factory
 *                    audit, transaction history) — kept separate from
 *                    product compliance (FDA/certs live in Match Score).
 */

import type { FactorBreakdown } from "./types"

// ============================================================
// Inputs
// ============================================================

/** Buyer requirement fields pulled from `leads`. */
export interface BuyerMatchInput {
  id: string
  hs_code: string | null
  main_product: string | null
  secondary_hs_codes: string | null
  main_import_countries: string | null
  avg_teu_per_month: number | null
  origin_ports: string | null
  destination_ports: string | null
  container_types: string | null
  purchase_history: string | null
  bol_description: string | null
  priority_rating: number | null
}

/** A single active product row from `client_products`. */
export interface ClientProductInput {
  id: string
  client_id: string
  product_name: string
  category: string | null
  subcategory: string | null
  description: string | null
  hs_code: string | null
  key_specifications: string | null
  country_of_origin: string | null
  min_unit_price: number | null
  max_unit_price: number | null
  currency: string
  monthly_capacity_units: number | null
  moq_value: number | null
  moq_unit: string | null
  lead_time: string | null
  incoterm: string | null
  payment_terms: string | null
  compliance_badges: string[]
}

/** Client-level identity + trust inputs, joined from `profiles` and friends. */
export interface ClientTrustInput {
  client_id: string
  company_name: string | null
  full_name: string | null
  is_verified: boolean
  fda_registration_number: string | null
  fda_expires_at: string | null
  /** `client_factory_assessments.score_total`, null if never assessed. */
  factoryScoreTotal: number | null
  /** Total deals ever created for this client (via opportunities). */
  dealsTotal: number
  /** Subset of dealsTotal where `swift_verified = true`. */
  dealsSwiftVerified: number
  /** Has minimal company profile filled in (company_name + phone, etc). */
  hasCompanyProfile: boolean
}

// ============================================================
// Outputs
// ============================================================

export type TrustLabel = "verified" | "factory_assessed" | "new_supplier"

export type CommercialFlagLevel = "green" | "yellow" | "red" | "unknown"

export interface CommercialFlag {
  factor: "price" | "incoterm" | "payment_terms" | "lead_time"
  level: CommercialFlagLevel
  note: string
}

export interface ClientMatchResult {
  clientId: string
  clientName: string
  productId: string
  productName: string
  /** 0-100, product/technical/compliance fit only — never mixed with trust. */
  matchScore: number
  /** 0-100, operational trust — used for ranking, shown as a label not a %. */
  trustScore: number
  trustLabel: TrustLabel
  /** 0-100, weighted blend used for sorting the Top 10. */
  finalScore: number
  matchBreakdown: FactorBreakdown[]
  trustBreakdown: FactorBreakdown[]
  commercialFlags: CommercialFlag[]
  /** Existing eligibility rule (valid FDA, not already attached to buyer). */
  eligible: boolean
  ineligibleReason:
    | "fda_missing"
    | "fda_expired"
    | "already_attached"
    | "buyer_shortlist_full"
    | null
}

// ============================================================
// Weights
// ============================================================

/**
 * These are FINAL-SCORE weights (sum to 100 across Match + Trust factors),
 * matching the 80/20 Match/Trust split agreed in the plan. Match factors
 * are also re-normalized to their own 0-100 scale (divided by 0.8) so the
 * UI can show a clean "Match %" untainted by trust.
 */
export const CLIENT_MATCH_WEIGHTS = {
  hsCode: 25,
  specMatch: 25,
  capacityMoq: 15,
  compliance: 10,
  logistics: 5,
} as const

export const CLIENT_TRUST_WEIGHTS = {
  kyc: 30,
  factoryAssessment: 30,
  transactionHistory: 30,
  companyProfile: 10,
} as const

export const MATCH_SCORE_SHARE = 0.8
export const TRUST_SCORE_SHARE = 0.2

export const MAX_AI_MATCH_RESULTS = 10
