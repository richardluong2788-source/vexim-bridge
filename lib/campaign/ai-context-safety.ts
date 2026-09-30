import type { BuyerContext } from "./types"

/**
 * Narrow the data sent to campaign models according to the deterministic match.
 * This is an enforcement boundary, not just prompt advice:
 * - product: verified product text may be personalized (unless a conflict exists)
 * - category: expose only the category, never a specific buyer product
 * - industry, conflict, or legacy/unclassified: discovery-only; redact product data
 */
export function campaignSafeAIContext(context: BuyerContext): BuyerContext {
  const match = context.campaign_match ?? {
    level: null,
    confidence: null,
    reason: null,
    evidence: [],
    requires_human_review: false,
  }
  const safeProductMatch = match.level === "product" && !match.requires_human_review
  const safeCategoryMatch = match.level === "category" && !match.requires_human_review
  // Only a clean product-level match may expose buyer product descriptors.
  // Category-level outreach gets the campaign category, not the descriptor used to infer it.

  const matchedTargetProduct = context.campaign.target_product_name ?? "UNKNOWN"
  const matchReason = safeProductMatch
    ? `Deterministic LR product text matched the campaign target “${matchedTargetProduct}”. Reference only this target; do not infer any other product need.`
    : safeCategoryMatch
      ? `LR product information supports the broad category “${context.campaign.product_category ?? "UNKNOWN"}” only. The specific buyer product has not been verified as the campaign target.`
      : match.requires_human_review
        ? "The classifier recorded unresolved or conflicting evidence. Use discovery-only language; do not state or imply a product need."
        : match.level === "industry"
          ? `Industry-only candidate (${context.buyer.industry ?? "unknown industry"}); no product-level need is established. Use discovery-only language.`
          : "No persisted product/category match is available. Do not infer product interest; use only broad, factual discovery language."

  const safeEvidence = safeProductMatch
    ? [`LR product-text match confirmed for campaign target “${matchedTargetProduct}”; raw descriptors and HS values withheld.`]
    : safeCategoryMatch
      ? [`LR product descriptors support category “${context.campaign.product_category ?? "UNKNOWN"}”; specific product evidence withheld from copy generation.`]
      : match.level === "industry"
        ? [`Buyer industry on file: ${context.buyer.industry ?? "UNKNOWN"}; this is not product-demand evidence.`]
        : []

  const safeCampaignName = safeProductMatch
    ? `Product-specific outreach: ${context.campaign.target_product_name ?? context.campaign.product_category ?? "campaign target"}`
    : safeCategoryMatch
      ? `Category-level outreach: ${context.campaign.product_category ?? "campaign category"}`
      : "Industry-level discovery outreach"

  return {
    ...context,
    import_data: {
      // Only the campaign target name may reach copy generation after a clean
      // LR product-text match. Raw trade descriptors, HS, and history stay internal.
      hs_codes: "UNKNOWN",
      main_products: safeProductMatch ? matchedTargetProduct : "UNKNOWN",
      purchase_history: "UNKNOWN",
      vietnam_supplier_exists: "UNKNOWN",
      shipment_count: "UNKNOWN",
      peak_months: "UNKNOWN",
    },
    campaign: {
      ...context.campaign,
      name: safeCampaignName,
      description: null,
      target_segment: null,
      target_product_name: safeProductMatch ? context.campaign.target_product_name : null,
      product_category: safeProductMatch || safeCategoryMatch ? context.campaign.product_category : null,
      // Industry-only rows can support a general discovery question, not a
      // product or category claim. HS targets are never sent to the model.
      target_industries: context.campaign.target_industries,
      target_hs_codes: [],
    },
    campaign_match: {
      ...match,
      reason: matchReason,
      evidence: safeEvidence,
    },
    // buyer_analysis.productMatchScore measures Vietnam-export readiness, not
    // buyer demand; keep that research out of campaign product claims entirely.
    research: {
      buyer_analysis: "UNKNOWN",
      buyer_strategy: "UNKNOWN",
      analysis_age_days: "UNKNOWN",
    },
  }
}
