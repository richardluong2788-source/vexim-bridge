/**
 * ImportYeti Buyer Analysis Endpoint
 * 
 * POST /api/importyeti/analyze
 * 
 * Accepts an ImportYeti URL, fetches company data, runs analysis,
 * and generates AI-powered strategy recommendations.
 * 
 * Request body:
 *   { importYetiLink: "https://importyeti.com/company/walmart" }
 * 
 * Response:
 *   { 
 *     success: true, 
 *     analysis: { healthScore, loyaltyScore, vietnamReadiness, ... },
 *     strategy: { recommendedAngle, talkingPoints, riskFactors, ... },
 *     meta: {
 *       companyName, timestamp,
 *       strategySource: "ai" | "fallback",
 *       model: string | null   // null when the fallback strategy was used
 *     }
 *   }
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { extractSlugFromUrl, fetchRawImportYetiCompany } from "@/lib/importyeti/api-transformer"
import type { ImportYetiAPIResponse } from "@/lib/importyeti/api-transformer"
import { analyzeBuyer } from "@/lib/ai/buyer-analyzer"
import {
  analyzeAndGenerateStrategy,
  BUYER_STRATEGY_MODEL,
} from "@/lib/ai/buyer-strategy-generator"

export const maxDuration = 30 // Allow up to 30 seconds for AI generation

export async function POST(request: NextRequest) {
  // 1. Authenticate user
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { success: false, error: "Not authenticated" },
      { status: 401 }
    )
  }

  // 2. Verify user has permission (lead_researcher, admin, super_admin, ae)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const role = profile?.role
  if (!role || !["super_admin", "admin", "lead_researcher", "ae"].includes(role)) {
    return NextResponse.json(
      { success: false, error: "Insufficient permissions" },
      { status: 403 }
    )
  }

  // 3. Parse request body
  let body: { importYetiLink?: string; rawData?: ImportYetiAPIResponse["data"] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  const { importYetiLink, rawData } = body

  // Allow either rawData directly or importYetiLink
  let apiData: ImportYetiAPIResponse["data"]

  if (rawData) {
    // Use provided raw data (for when client already has the data)
    apiData = rawData
  } else if (importYetiLink) {
    // Fetch from API
    const slug = extractSlugFromUrl(importYetiLink)

    if (!slug) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Invalid ImportYeti URL. Expected format: https://importyeti.com/company/company-name" 
        },
        { status: 400 }
      )
    }

    const apiKey = process.env.IMPORTYETI_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { 
          success: false, 
          error: "ImportYeti API key is not configured." 
        },
        { status: 500 }
      )
    }

    // Fetch raw data from ImportYeti.
    //
    // Was an inline fetch() duplicating the URL construction, auth header and
    // error handling that already live in fetchRawImportYetiCompany (also used
    // by /api/importyeti/brief and scripts/backfill-buyer-analysis.mjs).
    // Behaviour change worth noting: a 404/429 now returns its real status
    // instead of a blanket 400, and an upstream 5xx returns 502 rather than
    // 500 — callers only branch on `success`, so this is a reporting fix.
    const raw = await fetchRawImportYetiCompany(slug, apiKey)

    if (!raw.success) {
      console.error(`[ImportYeti Analyze] Fetch failed: ${raw.error}`)
      return NextResponse.json(
        { success: false, error: raw.error },
        {
          status:
            raw.status && raw.status >= 400 && raw.status < 500
              ? raw.status
              : 502,
        }
      )
    }

    apiData = raw.data
  } else {
    return NextResponse.json(
      { success: false, error: "Either importYetiLink or rawData is required" },
      { status: 400 }
    )
  }

  // 4. Run analysis
  try {
    const analysis = analyzeBuyer(apiData)
    
    // 5. Generate AI strategy
    const fullAnalysis = await analyzeAndGenerateStrategy(analysis, apiData)

    return NextResponse.json({
      success: true,
      analysis: fullAnalysis.analysis,
      strategy: fullAnalysis.strategy,
      meta: {
        companyName: apiData.title,
        timestamp: new Date().toISOString(),
        // Persisted by the caller into leads.buyer_analysis_model so the AE can
        // tell later which model produced the strategy (migration 079).
        // `model` is null when the LLM call failed and the deterministic
        // fallback strategy was used instead — attributing that to a model
        // name would be a lie.
        strategySource: fullAnalysis.strategySource,
        model:
          fullAnalysis.strategySource === "ai" ? BUYER_STRATEGY_MODEL : null,
      }
    })
  } catch (error) {
    console.error("[ImportYeti Analyze] Analysis error:", error)
    return NextResponse.json(
      { success: false, error: "Analysis failed. Please try again." },
      { status: 500 }
    )
  }
}
