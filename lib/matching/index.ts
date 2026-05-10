/**
 * AI Matching System - Public API
 *
 * This module exports the public interface for the AE matching system.
 * Import from here rather than individual files.
 */

// Types
export * from "./types"

// Scoring engine
export {
  calculateScore,
  calculateScoresForBuyer,
  normalizeHSCodes,
  normalizeKeywords,
} from "./scorer"

// Orchestrator
export {
  runMatchingPipeline,
  acceptInboxItem,
  rejectInboxItem,
  getMatchScoresForBuyer,
  getInboxItemsForAE,
  getBuyerPoolWithScores,
} from "./orchestrator"
