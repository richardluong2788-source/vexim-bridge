/**
 * AI Matching System - Orchestrator
 *
 * Coordinates the end-to-end matching pipeline:
 * 1. Load buyer and all AE data
 * 2. Calculate rule-based scores for each AE
 * 3. (Optional) Apply LLM augmentation to top candidates
 * 4. Store scores in database
 * 5. Auto-assign or create inbox items based on thresholds
 *
 * This is the main entry point for the matching system.
 */

import { createClient } from "@/lib/supabase/server"
import { dispatchNotification } from "@/lib/notifications/dispatcher"
import { normalizeIndustry } from "@/lib/constants/industries"
import type { Lead, Profile } from "@/lib/supabase/types"
import {
  calculateScoresForBuyer,
  calculateHybridScoresForBuyer,
  normalizeHSCodes,
  normalizeKeywords,
  type HybridScoringResult,
} from "./scorer"
import type {
  MatchingRequest,
  MatchingResult,
  ScoringResult,
  AEContext,
  BuyerContext,
  ScoringWeights,
  MatchingThresholds,
} from "./types"
import { DEFAULT_SCORING_WEIGHTS, DEFAULT_THRESHOLDS, normalizeWeights } from "./types"
import { MAX_CLIENTS_PER_BUYER } from "@/lib/buyers/constants"

// ============================================================
// Main Orchestrator Function
// ============================================================

export async function runMatchingPipeline(
  request: MatchingRequest
): Promise<MatchingResult> {
  const { leadId, triggeredBy, useLLMAugmentation } = request
  const supabase = await createClient()

  // 1. Load configuration
  const config = await loadMatchingConfig(supabase)

  // 2. Load buyer data
  const buyer = await loadBuyerContext(supabase, leadId)
  if (!buyer) {
    throw new Error(`Buyer not found: ${leadId}`)
  }

  // 3. Load all AEs with their context
  const aes = await loadAllAEContexts(supabase)
  if (aes.length === 0) {
    return {
      leadId,
      scores: [],
      topCandidate: null,
      autoAssigned: false,
      assignedTo: null,
      inboxItems: [],
      timestamp: new Date().toISOString(),
    }
  }

  // 3b. Hard filter: only AEs whose primary industry matches the buyer's
  // industry are eligible to be scored. This is a hard gate, not a scoring
  // factor — an AE in a different industry must never be assigned a buyer,
  // regardless of how well HS code / product / country line up.
  //
  // If the buyer has no industry, or no AE currently covers that industry,
  // there is no eligible candidate to score. Rather than silently fall back
  // to scoring every AE (which would defeat the gate), the buyer is routed
  // to a shared inbox visible to every AE — first to claim it wins.
  const buyerIndustry = normalizeIndustry(buyer.lead.industry)
  const eligibleAes = buyerIndustry
    ? aes.filter((ae) => normalizeIndustry(ae.profile.industry) === buyerIndustry)
    : []

  if (eligibleAes.length === 0) {
    return await routeToSharedInbox(supabase, leadId, buyer, aes, triggeredBy)
  }

  // 4. Calculate scores for all AEs using HYBRID scoring (semantic + rules)
  // This is the key change - using semantic embeddings when available
  const scores = await calculateHybridScoresForBuyer(
    buyer,
    eligibleAes,
    config.weights,
    config.thresholds
  )

  // 5. Store scores in database (enhanced to include semantic data)
  await storeScores(supabase, leadId, scores, triggeredBy)

  // 6. Process results based on thresholds
  const result = await processResults(
    supabase,
    leadId,
    buyer,
    scores,
    config.thresholds,
    triggeredBy
  )

  return result
}

// ============================================================
// Data Loading Functions
// ============================================================

interface MatchingConfig {
  weights: ScoringWeights
  thresholds: MatchingThresholds
}

async function loadMatchingConfig(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<MatchingConfig> {
  const { data: configs } = await supabase
    .from("matching_config")
    .select("config_key, config_value")

  // Use normalizeWeights to handle both old and new database formats
  const rawWeights = configs?.find((c) => c.config_key === "scoring_weights")?.config_value
  const weights = normalizeWeights(rawWeights as Partial<ScoringWeights> | null)

  const thresholds =
    (configs?.find((c) => c.config_key === "thresholds")
      ?.config_value as MatchingThresholds) || DEFAULT_THRESHOLDS

  return { weights, thresholds }
}

async function loadBuyerContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string
): Promise<BuyerContext | null> {
  const { data: lead, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single<Lead>()

  if (error || !lead) return null

  // Use dedicated columns from migration 043, fall back to enriched_data
  const enrichedData = lead.enriched_data as Record<string, unknown> | null
  
  // HS codes: prefer hs_code + secondary_hs_codes, then enriched_data.hs_codes
  let hsCodes: string[] = []
  if (lead.hs_code) {
    hsCodes.push(lead.hs_code)
  }
  if (lead.secondary_hs_codes) {
    // secondary_hs_codes is comma-separated
    hsCodes.push(...lead.secondary_hs_codes.split(',').map(s => s.trim()).filter(Boolean))
  }
  if (hsCodes.length === 0 && enrichedData?.hs_codes) {
    hsCodes = enrichedData.hs_codes as string[]
  }
  
  // Product keywords: prefer main_product, then enriched_data.product_keywords
  let productKeywords: string[] = []
  if (lead.main_product) {
    productKeywords.push(lead.main_product)
  }
  if (productKeywords.length === 0 && enrichedData?.product_keywords) {
    productKeywords = enrichedData.product_keywords as string[]
  }

  return {
    lead,
    hsCodesNormalized: normalizeHSCodes(hsCodes),
    keywordsNormalized: normalizeKeywords(productKeywords),
  }
}

async function loadAllAEContexts(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<AEContext[]> {
  // Get all AEs
  const { data: aes } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "account_executive")

  if (!aes || aes.length === 0) return []

  // Load workload data
  const { data: workloads } = await supabase
    .from("ae_workload_summary")
    .select("*")

  // Load win rates
  const { data: winRates } = await supabase
    .from("ae_win_rate_by_industry")
    .select("*")

  // Load client products for each AE
  const { data: clientProducts } = await supabase
    .from("ae_client_products")
    .select("*")

  // Build context for each AE
  return aes.map((ae) => ({
    profile: ae as Profile,
    workload: workloads?.find((w) => w.account_manager_id === ae.id) || null,
    winRateByIndustry:
      winRates?.filter((wr) => wr.account_manager_id === ae.id) || [],
    clientProducts:
      clientProducts?.filter((cp) => cp.account_manager_id === ae.id) || [],
  }))
}

// ============================================================
// Score Storage
// ============================================================

async function storeScores(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string,
  scores: HybridScoringResult[],
  triggeredBy: string
): Promise<void> {
  // Filter out any scores that don't have valid totalScore
  const validScores = scores.filter(
    (score) => score.totalScore !== null && score.totalScore !== undefined && !isNaN(score.totalScore)
  )

  if (validScores.length === 0) {
    console.log("[v0] No valid scores to store for lead:", leadId)
    return
  }

  // Delete existing scores for this lead
  await supabase.from("ae_match_scores").delete().eq("lead_id", leadId)

  // Insert new scores with semantic data (using new scoring formula fields)
  const scoreRows = validScores.map((score) => ({
    lead_id: leadId,
    account_manager_id: score.accountManagerId,
    total_score: score.totalScore,
    // New formula fields
    product_match_score: score.factors.productMatch ?? 0,
    country_match_score: score.factors.countryMatch ?? 0,
    // Store new factors in JSON (hsCodeMatch, logisticsMatch, priorityBonus, vnSupplierBonus)
    // Legacy fields - set to 0 for backward compat
    industry_match_score: score.factors.industryMatch ?? 0,
    fda_compliance_score: score.factors.fdaCompliance ?? 0,
    workload_score: score.factors.workload ?? 0,
    win_rate_score: score.factors.winRate ?? 0,
    factors: {
      breakdown: score.breakdown,
      recommendation: score.recommendation,
      triggered_by: triggeredBy,
      // New formula factors
      hs_code_match: score.factors.hsCodeMatch,
      logistics_match: score.factors.logisticsMatch,
      priority_bonus: score.factors.priorityBonus,
      vn_supplier_bonus: score.factors.vnSupplierBonus,
      // Include semantic scoring data when available
      scoring_mode: score.scoringMode,
      semantic_score: score.semanticScore?.score,
      semantic_top_matches: score.semanticScore?.topMatches?.slice(0, 3),
      hybrid_product_score: score.hybridProductScore,
    },
  }))

  const { error } = await supabase.from("ae_match_scores").insert(scoreRows)

  if (error) {
    console.error("[v0] Failed to store match scores:", error)
    throw new Error(`Failed to store scores: ${error.message}`)
  }
}

// ============================================================
// Result Processing
// ============================================================

async function processResults(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string,
  buyer: BuyerContext,
  scores: HybridScoringResult[],
  thresholds: MatchingThresholds,
  triggeredBy: string
): Promise<MatchingResult> {
  const topCandidate = scores[0] || null
  let autoAssigned = false
  let assignedTo: string | null = null
  const inboxItems: { accountManagerId: string; priority: "high" | "medium" | "low" }[] = []

  // Clear existing inbox items for this lead
  await supabase.from("ae_match_inbox").delete().eq("lead_id", leadId)

  // Get buyer name for notifications
  const buyerName = buyer.lead.company_name || buyer.lead.contact_person || "Unknown Buyer"

  if (topCandidate) {
    if (topCandidate.recommendation === "auto_assign") {
      // Auto-assign: Mark the score as assigned
      const { error: assignError } = await supabase
        .from("ae_match_scores")
        .update({
          assignment_source: "auto",
          assigned_at: new Date().toISOString(),
          assigned_by: triggeredBy,
        })
        .eq("lead_id", leadId)
        .eq("account_manager_id", topCandidate.accountManagerId)

      if (!assignError) {
        autoAssigned = true
        assignedTo = topCandidate.accountManagerId

        // Notify the auto-assigned AE
        dispatchNotification({
          userId: topCandidate.accountManagerId,
          category: "new_assignment",
          linkPath: `/admin/buyers/${leadId}`,
          dedupKey: `ai_auto_assigned:${leadId}:${topCandidate.accountManagerId}`,
          title: {
            vi: "Buyer mới được AI gán tự động",
            en: "New Buyer Auto-Assigned by AI",
          },
          body: {
            vi: `${buyerName} đã được AI matching gán cho bạn với điểm ${topCandidate.totalScore.toFixed(0)}`,
            en: `${buyerName} has been auto-assigned to you with score ${topCandidate.totalScore.toFixed(0)}`,
          },
          ctaLabel: {
            vi: "Xem chi tiết",
            en: "View details",
          },
        }).catch((err) => {
          console.error("[matching] notification dispatch failed", err)
        })

        // Log activity
        await logMatchingActivity(
          supabase,
          leadId,
          topCandidate.accountManagerId,
          "auto_assigned",
          triggeredBy,
          topCandidate.totalScore
        )
      }
    } else {
      // Add inbox items for candidates meeting minimum threshold
      const inboxCandidates = scores.filter(
        (s) => s.totalScore >= thresholds.inbox_min
      )

      for (const candidate of inboxCandidates) {
        const priority = determinePriority(candidate.totalScore, thresholds)

        const { error } = await supabase.from("ae_match_inbox").insert({
          lead_id: leadId,
          account_manager_id: candidate.accountManagerId,
          match_score_id: null, // Will be linked via a separate query if needed
          priority,
          status: "pending",
          expires_at: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ).toISOString(), // 7 days
        })

        if (!error) {
          inboxItems.push({
            accountManagerId: candidate.accountManagerId,
            priority,
          })

          // Notify the AE about new inbox item
          dispatchNotification({
            userId: candidate.accountManagerId,
            category: "action_required",
            linkPath: `/admin/ae-inbox`,
            dedupKey: `ai_inbox_item:${leadId}:${candidate.accountManagerId}`,
            title: {
              vi: `Buyer mới trong inbox (${priority === "high" ? "Ưu tiên cao" : priority === "medium" ? "Trung bình" : "Thấp"})`,
              en: `New Buyer in Inbox (${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority)`,
            },
            body: {
              vi: `${buyerName} - Điểm matching: ${candidate.totalScore.toFixed(0)}. Xem và chọn client phù hợp.`,
              en: `${buyerName} - Match score: ${candidate.totalScore.toFixed(0)}. Review and select a suitable client.`,
            },
            ctaLabel: {
              vi: "Xem inbox",
              en: "View inbox",
            },
          }).catch((err) => {
            console.error("[matching] notification dispatch failed for inbox item", err)
          })
        }
      }
    }
  }

  return {
    leadId,
    scores,
    topCandidate,
    autoAssigned,
    assignedTo,
    inboxItems,
    timestamp: new Date().toISOString(),
  }
}

// ============================================================
// Shared Inbox (no AE covers the buyer's industry)
// ============================================================

/**
 * Called when the industry hard-filter finds zero eligible AEs — either the
 * buyer has no industry set, or no active AE currently covers it. The buyer
 * is never auto-assigned or scored in this path; it is placed as a pending
 * inbox item for *every* AE (one row each, same UNIQUE(lead_id, account_manager_id)
 * as the normal inbox), so any AE can claim it first-come-first-served.
 * Accepting one copy expires the sibling copies for the other AEs.
 */
async function routeToSharedInbox(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string,
  buyer: BuyerContext,
  aes: AEContext[],
  triggeredBy: string
): Promise<MatchingResult> {
  // Clear any stale scores/inbox rows from a previous run of this pipeline.
  await supabase.from("ae_match_scores").delete().eq("lead_id", leadId)
  await supabase.from("ae_match_inbox").delete().eq("lead_id", leadId)

  const buyerName = buyer.lead.company_name || buyer.lead.contact_person || "Unknown Buyer"
  const inboxItems: { accountManagerId: string; priority: "high" | "medium" | "low" }[] = []

  await supabase.from("activities").insert({
    action_type: "ai_matching_shared_inbox",
    description: `AI Matching: no AE covers industry "${buyer.lead.industry ?? "unknown"}" for ${buyerName} — routed to shared inbox for ${aes.length} AE(s)`,
    performed_by: triggeredBy,
  })

  for (const ae of aes) {
    const { error } = await supabase.from("ae_match_inbox").insert({
      lead_id: leadId,
      account_manager_id: ae.profile.id,
      match_score_id: null,
      priority: "medium",
      status: "pending",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })

    if (!error) {
      inboxItems.push({ accountManagerId: ae.profile.id, priority: "medium" })

      dispatchNotification({
        userId: ae.profile.id,
        category: "action_required",
        linkPath: `/admin/ae-inbox`,
        dedupKey: `ai_shared_inbox:${leadId}:${ae.profile.id}`,
        title: {
          vi: "Buyer chưa có AE chuyên ngành phù hợp",
          en: "Buyer has no matching industry AE",
        },
        body: {
          vi: `${buyerName} - Không có AE nào đang phụ trách ngành hàng này. Buyer được mở cho mọi AE, ai chọn client trước sẽ nhận buyer.`,
          en: `${buyerName} - No AE currently covers this industry. This buyer is open to every AE — first to pick a client wins it.`,
        },
        ctaLabel: {
          vi: "Xem inbox",
          en: "View inbox",
        },
      }).catch((err) => {
        console.error("[matching] notification dispatch failed for shared inbox item", err)
      })
    }
  }

  return {
    leadId,
    scores: [],
    topCandidate: null,
    autoAssigned: false,
    assignedTo: null,
    inboxItems,
    timestamp: new Date().toISOString(),
  }
}

function determinePriority(
  score: number,
  thresholds: MatchingThresholds
): "high" | "medium" | "low" {
  const midPoint = (thresholds.inbox_max + thresholds.inbox_min) / 2

  if (score >= thresholds.inbox_max - 5) return "high"
  if (score >= midPoint) return "medium"
  return "low"
}

// ============================================================
// Activity Logging
// ============================================================

async function logMatchingActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string,
  accountManagerId: string,
  action: "auto_assigned" | "manual_assigned" | "inbox_created",
  performedBy: string,
  score: number
): Promise<void> {
  // Find or create an opportunity for logging
  // For now, we log to a general activity (without opportunity_id)
  // This can be enhanced to create an opportunity on assignment

  const description = `AI Matching: ${action} with score ${score.toFixed(1)}`

  await supabase.from("activities").insert({
    action_type: `ai_matching_${action}`,
    description,
    performed_by: performedBy,
    // opportunity_id will be set when an opportunity is created
  })
}

// ============================================================
// Helper: Build opportunity notes from lead data
// ============================================================

function buildOpportunityNotes(
  lead: Lead | null | undefined,
  matchScoreId: string | null
): string {
  const parts: string[] = []

  // AI Matching source
  parts.push(`Created via AI Matching (score: ${matchScoreId ? "see score" : "N/A"})`)

  if (lead) {
    // Industry info
    if (lead.industry) {
      parts.push(`Industry: ${lead.industry}`)
    }

    // HS Code info
    if (lead.hs_code) {
      parts.push(`HS Code: ${lead.hs_code}`)
    }

    // Import volume info
    if (lead.total_shipments) {
      parts.push(`Total Shipments: ${lead.total_shipments}`)
    }

    if (lead.avg_teu_per_month) {
      parts.push(`Avg TEU/month: ${lead.avg_teu_per_month}`)
    }

    // Supplier info
    if (lead.top_suppliers && Array.isArray(lead.top_suppliers) && lead.top_suppliers.length > 0) {
      const supplierNames = lead.top_suppliers
        .slice(0, 3)
        .map((s: { name?: string }) => s.name || "Unknown")
        .join(", ")
      parts.push(`Top Suppliers: ${supplierNames}`)
    }

    // Import countries
    if (lead.main_import_countries) {
      parts.push(`Main Import Countries: ${lead.main_import_countries}`)
    }

    // Origin ports
    if (lead.origin_ports) {
      parts.push(`Origin Ports: ${lead.origin_ports}`)
    }
  }

  return parts.join("\n")
}

// ============================================================
// Inbox Actions
// ============================================================

export async function acceptInboxItem(
  inboxItemId: string,
  clientId: string,
  acceptedBy: string
): Promise<{ opportunityId: string | null; error?: string }> {
  const supabase = await createClient()

  // Get inbox item
  const { data: inbox, error: fetchError } = await supabase
    .from("ae_match_inbox")
    .select("*, leads(*)")
    .eq("id", inboxItemId)
    .single()

  if (fetchError || !inbox) {
    return { opportunityId: null, error: "Inbox item not found" }
  }

  if (inbox.status !== "pending") {
    return { opportunityId: null, error: "Inbox item already processed" }
  }

  // Vexim shortlist rule: a buyer must be introduced to a small slate of
  // competing clients (target 3-5, hard cap MAX_CLIENTS_PER_BUYER) instead
  // of being locked to whichever AE claims it first. Count how many
  // DISTINCT clients already have a live opportunity for this buyer before
  // adding another one.
  const { data: existingOpps } = await supabase
    .from("opportunities")
    .select("client_id")
    .eq("lead_id", inbox.lead_id)

  const distinctClientIds = new Set(
    (existingOpps || []).map((o) => o.client_id)
  )

  if (distinctClientIds.size >= MAX_CLIENTS_PER_BUYER) {
    // Shortlist is already full — close this AE's pending copy so it stops
    // showing as actionable, and surface a clear reason instead of a silent
    // insert failure.
    await supabase
      .from("ae_match_inbox")
      .update({
        status: "expired",
        reviewed_at: new Date().toISOString(),
        reviewed_by: acceptedBy,
      })
      .eq("id", inboxItemId)

    return {
      opportunityId: null,
      error: `Buyer already has the maximum of ${MAX_CLIENTS_PER_BUYER} clients introduced`,
    }
  }

  // Extract lead data for mapping to opportunity
  const lead = inbox.leads

  // Create opportunity with mapped data from lead
  // Set account_manager_id to the accepting user for ownership tracking.
  const { data: opportunity, error: oppError } = await supabase
    .from("opportunities")
    .insert({
      client_id: clientId,
      lead_id: inbox.lead_id,
      stage: "new",
      // Map commercial data from lead
      products_interested: lead?.main_product || null,
      destination_port: lead?.destination_ports || null,
      notes: buildOpportunityNotes(lead, inbox.match_score_id),
      account_manager_id: acceptedBy,
    })
    .select("id")
    .single()

  if (oppError) {
    return { opportunityId: null, error: oppError.message }
  }

  // Update this inbox item only. Unlike the old exclusive-claim model,
  // accepting a buyer does NOT expire other AEs' pending copies — the
  // buyer stays visible to other AEs (up to the shortlist cap above) so
  // multiple clients can be introduced to the same buyer, giving the
  // buyer a real choice between competing suppliers.
  await supabase
    .from("ae_match_inbox")
    .update({
      status: "accepted",
      reviewed_at: new Date().toISOString(),
      reviewed_by: acceptedBy,
    })
    .eq("id", inboxItemId)

  // If this acceptance just filled the shortlist, close out any remaining
  // pending copies for other AEs so the buyer stops appearing as
  // actionable once it has enough competing clients.
  if (distinctClientIds.size + 1 >= MAX_CLIENTS_PER_BUYER) {
    await supabase
      .from("ae_match_inbox")
      .update({
        status: "expired",
        reviewed_at: new Date().toISOString(),
        reviewed_by: acceptedBy,
      })
      .eq("lead_id", inbox.lead_id)
      .eq("status", "pending")
      .neq("id", inboxItemId)
  }

  // Update match score
  await supabase
    .from("ae_match_scores")
    .update({
      assignment_source: "manual",
      assigned_at: new Date().toISOString(),
      assigned_by: acceptedBy,
    })
    .eq("lead_id", inbox.lead_id)
    .eq("account_manager_id", inbox.account_manager_id)

  return { opportunityId: opportunity.id }
}

export async function rejectInboxItem(
  inboxItemId: string,
  rejectedBy: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("ae_match_inbox")
    .update({
      status: "rejected",
      rejection_reason: reason || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: rejectedBy,
    })
    .eq("id", inboxItemId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

// ============================================================
// Query Functions
// ============================================================

export async function getMatchScoresForBuyer(leadId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("ae_match_scores")
    .select(
      `
      *,
      profiles:account_manager_id (
        id,
        full_name,
        email,
        avatar_url
      )
    `
    )
    .eq("lead_id", leadId)
    .order("total_score", { ascending: false })

  if (error) return []
  return data
}

export async function getInboxItemsForAE(accountManagerId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("ae_match_inbox")
    .select(
      `
      *,
      leads (*),
      ae_match_scores (*)
    `
    )
    .eq("account_manager_id", accountManagerId)
    .eq("status", "pending")
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false })

  if (error) return []
  return data
}

export async function getBuyerPoolWithScores() {
  const supabase = await createClient()

  const { data, error } = await supabase.from("buyer_pool").select("*")

  if (error) return []
  return data
}
