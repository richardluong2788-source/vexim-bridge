/**
 * Cron Job: Sync Semantic Embeddings
 *
 * Triggered daily to keep product and buyer embeddings fresh.
 * This ensures the semantic matching system has up-to-date vectors.
 *
 * Schedule: Daily at 03:00 UTC (off-peak hours)
 * Auth: Requires CRON_SECRET Bearer token
 *
 * What it does:
 * 1. Sync product embeddings for all clients with products
 * 2. Generate buyer embeddings for recent/active leads
 * 3. Log results for monitoring
 */

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  syncClientProductEmbeddings,
  generateBuyerEmbedding,
} from "@/lib/ai/embeddings"

// Use Node.js runtime for OpenAI SDK
export const runtime = "nodejs"
// Never cache - always fresh execution
export const dynamic = "force-dynamic"
// Allow up to 5 minutes for large syncs
export const maxDuration = 300

interface SyncResult {
  clientsSynced: number
  clientsFailed: number
  buyersSynced: number
  buyersFailed: number
  durationMs: number
  errors: string[]
}

export async function GET(request: Request) {
  const startTime = Date.now()
  const errors: string[] = []

  // ---- 1. Authenticate the call ----------------------------------------
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    )
  }

  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()

  // ---- 2. Sync Client Product Embeddings -------------------------------
  // Get all clients who have products
  const { data: clientsWithProducts } = await supabase
    .from("client_products")
    .select("client_id")
    .limit(500)

  // Deduplicate client IDs
  const uniqueClientIds = [
    ...new Set(clientsWithProducts?.map((c) => c.client_id) || []),
  ]

  let clientsSynced = 0
  let clientsFailed = 0

  for (const clientId of uniqueClientIds) {
    try {
      const result = await syncClientProductEmbeddings(clientId)
      if (result.success) {
        clientsSynced++
      } else {
        clientsFailed++
        if (result.error) {
          errors.push(`Client ${clientId}: ${result.error}`)
        }
      }
    } catch (err) {
      clientsFailed++
      errors.push(
        `Client ${clientId}: ${err instanceof Error ? err.message : "Unknown error"}`
      )
    }

    // Rate limiting - avoid overwhelming OpenAI API
    if (clientsSynced % 10 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  // ---- 3. Sync Buyer Embeddings ----------------------------------------
  // Get leads that:
  // - Don't have embeddings yet, OR
  // - Were updated in the last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Leads without embeddings
  const { data: leadsWithoutEmbeddings } = await supabase
    .from("leads")
    .select("id")
    .is("enriched_data", null)
    .eq("status", "pending")
    .limit(100)

  // Recently updated leads
  const { data: recentLeads } = await supabase
    .from("leads")
    .select("id")
    .gte("updated_at", sevenDaysAgo)
    .not("enriched_data", "is", null)
    .limit(100)

  // Combine and deduplicate
  const allLeadIds = [
    ...new Set([
      ...(leadsWithoutEmbeddings?.map((l) => l.id) || []),
      ...(recentLeads?.map((l) => l.id) || []),
    ]),
  ]

  let buyersSynced = 0
  let buyersFailed = 0

  for (const leadId of allLeadIds) {
    try {
      const embedding = await generateBuyerEmbedding(leadId)
      if (embedding) {
        buyersSynced++
      } else {
        // No embedding generated (no text data) - not an error
        buyersFailed++
      }
    } catch (err) {
      buyersFailed++
      errors.push(
        `Lead ${leadId}: ${err instanceof Error ? err.message : "Unknown error"}`
      )
    }

    // Rate limiting
    if (buyersSynced % 10 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  // ---- 4. Log results to semantic_match_logs ---------------------------
  const durationMs = Date.now() - startTime

  await supabase.from("semantic_match_logs").insert({
    operation: "bulk_sync",
    input_data: {
      total_clients: uniqueClientIds.length,
      total_buyers: allLeadIds.length,
    },
    result_data: {
      clients_synced: clientsSynced,
      clients_failed: clientsFailed,
      buyers_synced: buyersSynced,
      buyers_failed: buyersFailed,
      errors: errors.slice(0, 10), // Limit stored errors
    },
    execution_time_ms: durationMs,
  })

  // ---- 5. Return response ----------------------------------------------
  const result: SyncResult = {
    clientsSynced,
    clientsFailed,
    buyersSynced,
    buyersFailed,
    durationMs,
    errors: errors.slice(0, 20), // Limit returned errors
  }

  const status = clientsFailed > 0 || buyersFailed > 0 ? 207 : 200

  return NextResponse.json(
    {
      success: true,
      result,
      timestamp: new Date().toISOString(),
    },
    { status }
  )
}

/**
 * POST handler - for manual triggering with options
 */
export async function POST(request: Request) {
  // ---- 1. Authenticate ------------------------------------------------
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    )
  }

  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ---- 2. Parse options -----------------------------------------------
  let options: { clientIds?: string[]; leadIds?: string[] } = {}
  try {
    options = await request.json()
  } catch {
    // No body - use defaults
  }

  const supabase = createAdminClient()
  const startTime = Date.now()
  const errors: string[] = []

  let clientsSynced = 0
  let clientsFailed = 0
  let buyersSynced = 0
  let buyersFailed = 0

  // ---- 3. Sync specific clients if provided ---------------------------
  if (options.clientIds && options.clientIds.length > 0) {
    for (const clientId of options.clientIds) {
      try {
        const result = await syncClientProductEmbeddings(clientId)
        if (result.success) {
          clientsSynced++
        } else {
          clientsFailed++
          if (result.error) errors.push(`Client ${clientId}: ${result.error}`)
        }
      } catch (err) {
        clientsFailed++
        errors.push(
          `Client ${clientId}: ${err instanceof Error ? err.message : "Unknown"}`
        )
      }
    }
  }

  // ---- 4. Sync specific leads if provided -----------------------------
  if (options.leadIds && options.leadIds.length > 0) {
    for (const leadId of options.leadIds) {
      try {
        const embedding = await generateBuyerEmbedding(leadId)
        if (embedding) {
          buyersSynced++
        } else {
          buyersFailed++
        }
      } catch (err) {
        buyersFailed++
        errors.push(
          `Lead ${leadId}: ${err instanceof Error ? err.message : "Unknown"}`
        )
      }
    }
  }

  const durationMs = Date.now() - startTime

  return NextResponse.json({
    success: true,
    result: {
      clientsSynced,
      clientsFailed,
      buyersSynced,
      buyersFailed,
      durationMs,
      errors: errors.slice(0, 20),
    },
    timestamp: new Date().toISOString(),
  })
}
