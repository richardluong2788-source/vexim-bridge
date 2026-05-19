/**
 * OpenAI Embeddings Service for Semantic Product Matching
 *
 * Generates and manages vector embeddings for semantic search between
 * buyer product interests and client product offerings.
 *
 * Uses text-embedding-3-small via Vercel AI Gateway for cost efficiency
 * (~$0.02 per 1M tokens).
 */

"use server"

import { embed, embedMany } from "ai"
import { createAdminClient } from "@/lib/supabase/admin"

// Model via Vercel AI Gateway - no API key needed in v0
const EMBEDDING_MODEL = "openai/text-embedding-3-small"
const EMBEDDING_DIMENSIONS = 1536

export interface EmbeddingInput {
  id: string
  text: string
}

export interface EmbeddingSyncResult {
  success: boolean
  count: number
  error?: string
}

/**
 * Generate a single embedding vector for a text string.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: EMBEDDING_MODEL,
    value: text,
  })
  return embedding
}

/**
 * Generate embeddings for multiple texts in batch.
 * More efficient than calling generateEmbedding() in a loop.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  const { embeddings } = await embedMany({
    model: EMBEDDING_MODEL,
    values: texts,
  })
  return embeddings
}

/**
 * Build a combined text string from client product data for embedding.
 * Includes category, subcategory, and any notes/descriptions.
 */
function buildClientProductText(product: {
  category: string | null
  subcategory: string | null
  notes: string | null
  hs_codes?: string[] | null
}): string {
  const parts: string[] = []

  if (product.category) parts.push(product.category)
  if (product.subcategory) parts.push(product.subcategory)
  if (product.notes) parts.push(product.notes)
  if (product.hs_codes && product.hs_codes.length > 0) {
    parts.push(`HS Codes: ${product.hs_codes.join(", ")}`)
  }

  return parts.join(" | ")
}

/**
 * Sync embeddings for all products of a specific client.
 * Deletes existing embeddings and generates fresh ones.
 */
export async function syncClientProductEmbeddings(
  clientId: string
): Promise<EmbeddingSyncResult> {
  const supabase = createAdminClient()

  try {
    // 1. Get client's products from client_products table
    const { data: products, error: fetchError } = await supabase
      .from("client_products")
      .select("id, category, subcategory, notes, hs_codes")
      .eq("client_id", clientId)

    if (fetchError) {
      console.error("[embeddings] Failed to fetch client products:", fetchError)
      return { success: false, count: 0, error: fetchError.message }
    }

    if (!products || products.length === 0) {
      // No products to embed - clean up any existing embeddings
      await supabase
        .from("product_embeddings")
        .delete()
        .eq("client_id", clientId)
      return { success: true, count: 0 }
    }

    // 2. Build text descriptions for each product
    const textsToEmbed: string[] = []
    const validProducts: typeof products = []

    for (const product of products) {
      const text = buildClientProductText(product)
      if (text.trim().length > 0) {
        textsToEmbed.push(text)
        validProducts.push(product)
      }
    }

    if (textsToEmbed.length === 0) {
      return { success: true, count: 0 }
    }

    // 3. Generate embeddings in batch
    const embeddings = await generateEmbeddings(textsToEmbed)

    // 4. Delete existing embeddings for this client
    await supabase.from("product_embeddings").delete().eq("client_id", clientId)

    // 5. Insert new embeddings
    const rows = validProducts.map((product, i) => ({
      client_id: clientId,
      source_type: "product" as const,
      source_text: textsToEmbed[i],
      // pgvector expects array format as string
      embedding: `[${embeddings[i].join(",")}]`,
      model_version: "text-embedding-3-small",
    }))

    const { error: insertError } = await supabase
      .from("product_embeddings")
      .insert(rows)

    if (insertError) {
      console.error("[embeddings] Failed to insert embeddings:", insertError)
      return { success: false, count: 0, error: insertError.message }
    }

    return { success: true, count: rows.length }
  } catch (error) {
    console.error("[embeddings] Unexpected error:", error)
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Build combined text from buyer/lead data for embedding.
 * Uses new fields from migration 043: main_product, hs_code, secondary_hs_codes.
 */
function buildBuyerText(lead: {
  main_product: string | null
  hs_code: string | null
  secondary_hs_codes: string | null
  industry: string | null
  bol_description: string | null
  enriched_data: Record<string, unknown> | null
}): string {
  const parts: string[] = []

  // Primary product info from new schema
  if (lead.main_product) parts.push(lead.main_product)
  if (lead.industry) parts.push(lead.industry)
  if (lead.bol_description) parts.push(lead.bol_description)

  // HS codes from new schema
  const hsCodes: string[] = []
  if (lead.hs_code) hsCodes.push(lead.hs_code)
  if (lead.secondary_hs_codes) {
    hsCodes.push(...lead.secondary_hs_codes.split(",").map(s => s.trim()).filter(Boolean))
  }
  if (hsCodes.length > 0) {
    parts.push(`HS Codes: ${hsCodes.join(", ")}`)
  }

  // Fallback to enriched_data for legacy data
  const enriched = lead.enriched_data || {}
  const keywords = (enriched.product_keywords as string[]) || []
  const topProducts = (enriched.top_products as string[]) || []

  if (keywords.length > 0) {
    parts.push(`Keywords: ${keywords.join(", ")}`)
  }
  if (topProducts.length > 0) {
    parts.push(`Products: ${topProducts.join(", ")}`)
  }

  return parts.join(" | ")
}

/**
 * Generate and store embedding for a specific buyer/lead.
 * Returns the embedding vector for immediate use.
 */
export async function generateBuyerEmbedding(
  leadId: string
): Promise<number[] | null> {
  const supabase = createAdminClient()

  try {
    // 1. Fetch lead data using new schema fields
    const { data: lead, error: fetchError } = await supabase
      .from("leads")
      .select("id, main_product, hs_code, secondary_hs_codes, industry, bol_description, enriched_data")
      .eq("id", leadId)
      .single()

    if (fetchError || !lead) {
      console.error("[embeddings] Failed to fetch lead:", fetchError)
      return null
    }

    // 2. Build combined text
    const text = buildBuyerText(lead)
    if (!text.trim()) {
      console.log("[embeddings] No text to embed for lead:", leadId)
      return null
    }

    // 3. Generate embedding
    const embedding = await generateEmbedding(text)

    // 4. Upsert into buyer_embeddings
    const { error: upsertError } = await supabase
      .from("buyer_embeddings")
      .upsert(
        {
          lead_id: leadId,
          source_type: "combined",
          source_text: text,
          embedding: `[${embedding.join(",")}]`,
          model_version: "text-embedding-3-small",
        },
        { onConflict: "lead_id,source_type" }
      )

    if (upsertError) {
      console.error("[embeddings] Failed to upsert buyer embedding:", upsertError)
      // Still return the embedding for immediate use
    }

    return embedding
  } catch (error) {
    console.error("[embeddings] Unexpected error generating buyer embedding:", error)
    return null
  }
}

/**
 * Get cached buyer embedding or generate if not exists.
 */
export async function getBuyerEmbedding(
  leadId: string
): Promise<number[] | null> {
  const supabase = createAdminClient()

  // Try to get cached embedding first
  const { data: cached } = await supabase
    .from("buyer_embeddings")
    .select("embedding")
    .eq("lead_id", leadId)
    .eq("source_type", "combined")
    .single()

  if (cached?.embedding) {
    // Parse the embedding from pgvector format
    return cached.embedding as unknown as number[]
  }

  // Generate new embedding if not cached
  return generateBuyerEmbedding(leadId)
}

/**
 * Bulk sync embeddings for multiple clients.
 * Used by cron job for daily refresh.
 */
export async function bulkSyncClientEmbeddings(
  clientIds: string[]
): Promise<{ synced: number; failed: number }> {
  let synced = 0
  let failed = 0

  for (const clientId of clientIds) {
    const result = await syncClientProductEmbeddings(clientId)
    if (result.success) {
      synced++
    } else {
      failed++
      console.error(`[embeddings] Failed to sync client ${clientId}:`, result.error)
    }
  }

  return { synced, failed }
}

/**
 * Bulk generate embeddings for multiple leads.
 * Used by cron job for daily refresh.
 */
export async function bulkGenerateBuyerEmbeddings(
  leadIds: string[]
): Promise<{ generated: number; failed: number }> {
  let generated = 0
  let failed = 0

  for (const leadId of leadIds) {
    const embedding = await generateBuyerEmbedding(leadId)
    if (embedding) {
      generated++
    } else {
      failed++
    }
  }

  return { generated, failed }
}

/**
 * Check if embeddings exist for a client.
 */
export async function hasClientEmbeddings(clientId: string): Promise<boolean> {
  const supabase = createAdminClient()

  const { count } = await supabase
    .from("product_embeddings")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId)

  return (count ?? 0) > 0
}

/**
 * Check if embedding exists for a lead.
 */
export async function hasBuyerEmbedding(leadId: string): Promise<boolean> {
  const supabase = createAdminClient()

  const { count } = await supabase
    .from("buyer_embeddings")
    .select("*", { count: "exact", head: true })
    .eq("lead_id", leadId)
    .eq("source_type", "combined")

  return (count ?? 0) > 0
}
