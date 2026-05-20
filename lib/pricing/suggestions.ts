/**
 * AI Pricing Suggestion Engine
 * 
 * Generates pricing suggestions based on:
 * - Lead data (product type, volume, origin/destination ports)
 * - Historical pricing from similar opportunities
 * - Competitive intelligence
 * - Industry/product category standards
 */

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateText } from "ai"
import { z } from "zod"

export interface PricingSuggestionInput {
  opportunityId: string
  productName: string
  quantity?: string
  originCountry?: string
  destinationPort?: string
  incoterm?: string
  industry?: string
}

export interface PricingSuggestion {
  suggestedPriceUsd: number
  priceUnit: string
  incoterm: string
  paymentTerms: string
  rationale: string
  confidenceLevel: "high" | "medium" | "low"
  comparableDeals: number
}

/**
 * Calculate pricing suggestion using AI
 */
export async function suggestPricing(
  input: PricingSuggestionInput
): Promise<PricingSuggestion | null> {
  try {
    const adminClient = createAdminClient()

    // 1. Fetch historical pricing from similar deals
    const { data: historicalDeals, error: dealsError } = await adminClient
      .from("deals")
      .select(
        `
        id,
        suggested_selling_price,
        unit_label,
        quantity_units,
        opportunity_id,
        opportunities!inner(
          products_interested,
          incoterms,
          payment_terms,
          destination_port,
          leads!inner(
            industry,
            main_product,
            origin_ports,
            destination_ports
          )
        )
      `
      )
      .eq("opportunities.leads.main_product", input.productName)
      .not("suggested_selling_price", "is", null)
      .limit(10)

    if (dealsError) {
      console.error("[v0] Error fetching historical deals:", dealsError)
      return null
    }

    // 2. Fetch current opportunity details
    const { data: opportunity, error: oppError } = await adminClient
      .from("opportunities")
      .select(
        `
        id,
        quantity_required,
        price_unit,
        leads!inner(
          industry,
          avg_teu_per_month,
          top_suppliers,
          origin_ports,
          destination_ports,
          total_shipments
        )
      `
      )
      .eq("id", input.opportunityId)
      .single()

    if (oppError) {
      console.error("[v0] Error fetching opportunity:", oppError)
      return null
    }

    // 3. Build context for AI
    const context = buildPricingContext({
      opportunity,
      historicalDeals: historicalDeals || [],
      input,
    })

    // 4. Call AI to suggest pricing
    const suggestion = await generatePricingSuggestionWithAI(context)

    // 5. Log this for training data
    await logPricingSuggestion(input.opportunityId, suggestion, context)

    return suggestion
  } catch (error) {
    console.error("[v0] Error in suggestPricing:", error)
    return null
  }
}

/**
 * Build context for AI pricing suggestion
 */
function buildPricingContext(data: {
  opportunity: any
  historicalDeals: any[]
  input: PricingSuggestionInput
}): string {
  const { opportunity, historicalDeals, input } = data

  let context = `
# Pricing Suggestion Context

## Current Opportunity
- Product: ${input.productName}
- Quantity: ${opportunity.quantity_required || "Not specified"}
- Incoterm: ${input.incoterm || "Not specified"}
- Destination: ${input.destinationPort || opportunity?.destination_port || "Unknown"}
- Industry: ${input.industry || opportunity?.leads?.[0]?.industry || "Unknown"}

## Buyer Profile
- Monthly Volume: ${opportunity?.leads?.[0]?.avg_teu_per_month || "Unknown"} TEU
- Total Historical Shipments: ${opportunity?.leads?.[0]?.total_shipments || 0}
- Origin Preference: ${opportunity?.leads?.[0]?.origin_ports || "Unknown"}

## Historical Comparables (Last 10 Similar Deals)
`

  if (historicalDeals.length > 0) {
    context += `\nFound ${historicalDeals.length} comparable deals:\n`
    historicalDeals.slice(0, 5).forEach((deal: any, idx: number) => {
      context += `
${idx + 1}. Price: $${deal.suggested_selling_price}/${deal.unit_label}
   - Quantity: ${deal.quantity_units} ${deal.unit_label}
   - Incoterm: ${deal.opportunities?.[0]?.incoterms || "Unknown"}
   - Payment: ${deal.opportunities?.[0]?.payment_terms || "Unknown"}
   - Destination: ${deal.opportunities?.[0]?.destination_port || "Unknown"}
`
    })
  } else {
    context += `\nNo historical comparable deals found for this product.\n`
  }

  context += `

## Pricing Guidelines
- For new markets: Consider 5-10% premium over domestic pricing
- For volume: Standard volume discount 10-15% for +50% quantity
- Incoterm impact: CIF typically +15-20% over FOB for same lane
- Payment terms: COD/50% prepay standard; full prepay may warrant 3-5% discount
- Lead time: Rush orders (+1-2 weeks delivery) warrant 5-10% premium

Based on this context, suggest a competitive price that:
1. Is competitive against historical comparable deals
2. Accounts for buyer volume and reliability
3. Includes appropriate margin for logistics/handling
4. Considers payment terms and lead time

Respond with: price_usd, price_unit, incoterm, payment_terms, and brief rationale.
`

  return context
}

/**
 * Call AI to generate pricing suggestion
 */
async function generatePricingSuggestionWithAI(
  context: string
): Promise<PricingSuggestion> {
  const schema = z.object({
    suggestedPriceUsd: z.number().positive().describe("Suggested price in USD"),
    priceUnit: z
      .enum(["kg", "ton", "container", "lb", "box"])
      .describe("Unit of measure"),
    incoterm: z
      .enum(["FOB", "CIF", "CFR", "EXW", "FAS"])
      .describe("Incoterm"),
    paymentTerms: z
      .string()
      .describe("Payment terms e.g. 50% prepay/50% on sight"),
    confidenceLevel: z
      .enum(["high", "medium", "low"])
      .describe("Confidence in suggestion"),
    rationale: z
      .string()
      .describe("Brief explanation of pricing rationale"),
  })

  try {
    const { output } = await generateText({
      model: "openai/gpt-4o-mini",
      system: `You are an expert export pricing consultant. Analyze the provided context and suggest competitive pricing for the opportunity. Return a structured JSON response.`,
      prompt: context,
      schema,
      output: "object",
    })

    return {
      ...output,
      comparableDeals: 0,
    }
  } catch (error) {
    console.error("[v0] Error calling AI for pricing:", error)
    // Return a conservative default suggestion
    return {
      suggestedPriceUsd: 2.5,
      priceUnit: "kg",
      incoterm: "FOB",
      paymentTerms: "50% prepay, 50% on sight",
      confidenceLevel: "low",
      rationale:
        "Unable to calculate suggestion. Please provide comparable pricing data.",
      comparableDeals: 0,
    }
  }
}

/**
 * Log pricing suggestion for training/analytics
 */
async function logPricingSuggestion(
  opportunityId: string,
  suggestion: PricingSuggestion,
  context: string
): Promise<void> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const adminClient = createAdminClient()

    // Extract product name from context
    const productMatch = context.match(/Product: ([^\n]+)/)
    const productName = productMatch ? productMatch[1].trim() : "Unknown"

    // Store in opportunity_pricing_suggestions
    await adminClient.from("opportunity_pricing_suggestions").insert({
      opportunity_id: opportunityId,
      created_by: user?.id,
      suggested_price_usd: suggestion.suggestedPriceUsd,
      price_unit: suggestion.priceUnit,
      incoterm: suggestion.incoterm,
      payment_terms: suggestion.paymentTerms,
      rationale: suggestion.rationale,
      confidence_level: suggestion.confidenceLevel,
      product_name: productName,
      ai_model: "openai/gpt-4o-mini",
    })
  } catch (error) {
    console.error("[v0] Error logging pricing suggestion:", error)
    // Don't throw - logging failure shouldn't block the pricing suggestion
  }
}

/**
 * Fetch pricing history for an opportunity
 */
export async function getPricingHistory(opportunityId: string): Promise<any[]> {
  try {
    const adminClient = createAdminClient()

    const { data: suggestions, error } = await adminClient
      .from("opportunity_pricing_suggestions")
      .select("*")
      .eq("opportunity_id", opportunityId)
      .order("created_at", { ascending: false })
      .limit(10)

    if (error) throw error
    return suggestions || []
  } catch (error) {
    console.error("[v0] Error fetching pricing history:", error)
    return []
  }
}

/**
 * Get total suggestions count system-wide
 * Used to determine if AI has enough training data
 */
export async function getTotalSuggestionsCount(): Promise<number> {
  try {
    const adminClient = createAdminClient()

    const { count, error } = await adminClient
      .from("opportunity_pricing_suggestions")
      .select("*", { count: "exact", head: true })

    if (error) throw error
    return count || 0
  } catch (error) {
    console.error("[v0] Error fetching suggestions count:", error)
    return 0
  }
}

// Minimum suggestions required before AI pricing is unlocked
export const MIN_SUGGESTIONS_REQUIRED = 100
