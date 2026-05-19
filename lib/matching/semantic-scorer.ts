/**
 * Semantic Product Matching Scorer
 *
 * Uses vector similarity (cosine distance via pgvector) to find semantic
 * matches between buyer product interests and AE's client products.
 *
 * This replaces keyword-based matching with semantic understanding:
 * - "frozen shrimp" now matches "prawns", "seafood", "crustaceans"
 * - "coffee beans" matches "arabica", "robusta", "roasted coffee"
 */

"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getBuyerEmbedding } from "@/lib/ai/embeddings"
import type { BuyerContext, AEContext } from "./types"

export interface SemanticMatchResult {
  clientId: string
  similarity: number
  matchedProduct: string
  sourceType: string
}

export interface SemanticScoreResult {
  score: number
  topMatches: SemanticMatchResult[]
  hasEmbeddings: boolean
  debugInfo?: {
    buyerEmbeddingExists: boolean
    productEmbeddingsCount: number
    totalMatchesFound: number
  }
}

/**
 * Calculate semantic product match score between a buyer and an AE's clients.
 *
 * Flow:
 * 1. Get or generate buyer embedding from lead data
 * 2. Query pgvector for similar products among AE's clients
 * 3. Calculate score based on best similarity match
 *
 * Scoring:
 * - Similarity 0.5-1.0 maps to score 0-100
 * - Below 0.5 similarity = 0 score (not relevant)
 * - Above 0.9 similarity = 80+ score (excellent match)
 */
export async function calculateSemanticProductScore(
  buyer: BuyerContext,
  ae: AEContext
): Promise<SemanticScoreResult> {
  const supabase = createAdminClient()

  // 1. Get buyer embedding (cached or generate)
  const buyerEmbedding = await getBuyerEmbedding(buyer.lead.id)

  if (!buyerEmbedding) {
    // No embedding available - return neutral score
    return {
      score: 50,
      topMatches: [],
      hasEmbeddings: false,
      debugInfo: {
        buyerEmbeddingExists: false,
        productEmbeddingsCount: 0,
        totalMatchesFound: 0,
      },
    }
  }

  // 2. Get client IDs managed by this AE
  const aeClientIds = [...new Set(ae.clientProducts.map((cp) => cp.client_id))]

  if (aeClientIds.length === 0) {
    return {
      score: 0,
      topMatches: [],
      hasEmbeddings: true,
      debugInfo: {
        buyerEmbeddingExists: true,
        productEmbeddingsCount: 0,
        totalMatchesFound: 0,
      },
    }
  }

  // 3. Count product embeddings for AE's clients
  const { count: embeddingsCount } = await supabase
    .from("product_embeddings")
    .select("*", { count: "exact", head: true })
    .in("client_id", aeClientIds)

  if (!embeddingsCount || embeddingsCount === 0) {
    // AE's clients have no embeddings yet
    return {
      score: 50, // Neutral - can't determine match
      topMatches: [],
      hasEmbeddings: false,
      debugInfo: {
        buyerEmbeddingExists: true,
        productEmbeddingsCount: 0,
        totalMatchesFound: 0,
      },
    }
  }

  // 4. Query pgvector for semantic matches using RPC function
  const { data: matches, error } = await supabase.rpc("match_buyer_to_products", {
    buyer_embedding: `[${buyerEmbedding.join(",")}]`,
    match_count: 20, // Get more to filter
    similarity_threshold: 0.4, // Lower threshold to catch more
  })

  if (error) {
    console.error("[semantic-scorer] RPC error:", error)
    return {
      score: 50,
      topMatches: [],
      hasEmbeddings: true,
      debugInfo: {
        buyerEmbeddingExists: true,
        productEmbeddingsCount: embeddingsCount,
        totalMatchesFound: 0,
      },
    }
  }

  // 5. Filter to only this AE's clients
  const aeMatches = (matches || []).filter((m: SemanticMatchResult & { source_type: string }) =>
    aeClientIds.includes(m.client_id)
  )

  if (aeMatches.length === 0) {
    // No semantic matches found for this AE
    return {
      score: 20, // Low score - no relevant products
      topMatches: [],
      hasEmbeddings: true,
      debugInfo: {
        buyerEmbeddingExists: true,
        productEmbeddingsCount: embeddingsCount,
        totalMatchesFound: matches?.length || 0,
      },
    }
  }

  // 6. Calculate score from best match
  // Map results to our interface (DB returns snake_case)
  const formattedMatches: SemanticMatchResult[] = aeMatches.map((m: {
    client_id: string
    similarity: number
    source_text: string
    source_type: string
  }) => ({
    clientId: m.client_id,
    similarity: m.similarity,
    matchedProduct: m.source_text,
    sourceType: m.source_type,
  }))

  const topSimilarity = Math.max(...formattedMatches.map((m) => m.similarity))

  // Convert similarity to score:
  // - 0.4 similarity = 0 score
  // - 0.7 similarity = 50 score
  // - 1.0 similarity = 100 score
  const score = Math.round(((topSimilarity - 0.4) / 0.6) * 100)
  const clampedScore = Math.max(0, Math.min(100, score))

  return {
    score: clampedScore,
    topMatches: formattedMatches.slice(0, 3), // Return top 3
    hasEmbeddings: true,
    debugInfo: {
      buyerEmbeddingExists: true,
      productEmbeddingsCount: embeddingsCount,
      totalMatchesFound: aeMatches.length,
    },
  }
}

/**
 * Get semantic match details between a specific buyer and client.
 * Used for displaying match insights in the UI.
 */
export async function getSemanticMatchDetails(
  leadId: string,
  clientId: string
): Promise<{
  maxSimilarity: number
  avgSimilarity: number
  matchCount: number
  topMatches: Array<{ product: string; similarity: number }>
}> {
  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc("get_semantic_match_score", {
    p_lead_id: leadId,
    p_client_id: clientId,
  })

  if (error || !data || data.length === 0) {
    return {
      maxSimilarity: 0,
      avgSimilarity: 0,
      matchCount: 0,
      topMatches: [],
    }
  }

  const result = data[0]
  return {
    maxSimilarity: result.max_similarity || 0,
    avgSimilarity: result.avg_similarity || 0,
    matchCount: result.match_count || 0,
    topMatches: (result.top_matches as Array<{ product: string; similarity: number }>) || [],
  }
}

/**
 * Batch get semantic scores for multiple AEs against one buyer.
 * More efficient than calling calculateSemanticProductScore in a loop.
 */
export async function batchCalculateSemanticScores(
  buyer: BuyerContext,
  aeList: AEContext[]
): Promise<Map<string, SemanticScoreResult>> {
  const results = new Map<string, SemanticScoreResult>()

  // Get buyer embedding once
  const buyerEmbedding = await getBuyerEmbedding(buyer.lead.id)

  if (!buyerEmbedding) {
    // No embedding - return neutral for all
    for (const ae of aeList) {
      results.set(ae.profile.id, {
        score: 50,
        topMatches: [],
        hasEmbeddings: false,
      })
    }
    return results
  }

  // Calculate for each AE
  // Note: Could be optimized further by batching DB queries
  for (const ae of aeList) {
    const result = await calculateSemanticProductScore(buyer, ae)
    results.set(ae.profile.id, result)
  }

  return results
}
