/**
 * Buyer Intelligence Brief endpoint
 *
 * POST /api/importyeti/brief
 *
 * Request body:
 *   { importYetiLink: "https://importyeti.com/company/walmart" }
 *
 * Response:
 *   {
 *     success: true,
 *     markdown,           // the full brief
 *     filename,           // suggested download name
 *     contentType: "text/markdown",
 *     meta: { companyName, timestamp, strategySource, model, creditsRemaining }
 *   }
 *
 * REWRITTEN. The previous version could not have returned a brief for any
 * input, for four independent reasons:
 *   1. fetchAndTransformImportYetiData(slug, apiKey) takes a SLUG, but was
 *      handed the whole URL -> encodeURIComponent() turned
 *      "https://importyeti.com/company/x" into a path that always 404s.
 *   2. It was called with ONE argument (the apiKey was never passed).
 *   3. Its `{ success, data } | { success, error }` result was fed straight
 *      into analyzeBuyer() and used as the lead, so even on success the
 *      analyzer received an envelope instead of ImportYeti data.
 *   4. generateBuyerStrategy(analysis, rawData) was called with the arguments
 *      swapped.
 * The `if (!transformedData)` guard never fired either — the union is always a
 * truthy object — so failures fell through to a 500 instead of the real error.
 *
 * This version fetches ImportYeti ONCE and derives both shapes from that
 * single response (raw for analyzeBuyer, flattened for the brief's lead
 * section), so a brief costs one ImportYeti credit rather than two. It also
 * authenticates like /api/importyeti/analyze, which the old route did not —
 * an unauthenticated caller could otherwise burn credits and LLM tokens.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  extractSlugFromUrl,
  fetchRawImportYetiCompany,
  transformImportYetiData,
} from "@/lib/importyeti/api-transformer"
import { analyzeBuyer } from "@/lib/ai/buyer-analyzer"
import {
  analyzeAndGenerateStrategy,
  BUYER_STRATEGY_MODEL,
} from "@/lib/ai/buyer-strategy-generator"
import {
  generateBuyerIntelligenceBrief,
  exportBuyerBriefAsText,
} from "@/lib/briefing/buyer-brief-generator"

export const maxDuration = 30 // allow time for the AI strategy call

const ALLOWED_ROLES = ["super_admin", "admin", "lead_researcher", "ae"]

export async function POST(request: NextRequest) {
  // 1. Authenticate
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { success: false, error: "Not authenticated" },
      { status: 401 },
    )
  }

  // 2. Authorize (same roles as /api/importyeti/analyze)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const role = profile?.role
  if (!role || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json(
      { success: false, error: "Insufficient permissions" },
      { status: 403 },
    )
  }

  // 3. Parse body
  let body: { importYetiLink?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    )
  }

  const { importYetiLink } = body
  if (!importYetiLink?.trim()) {
    return NextResponse.json(
      { success: false, error: "ImportYeti link is required" },
      { status: 400 },
    )
  }

  const slug = extractSlugFromUrl(importYetiLink)
  if (!slug) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Invalid ImportYeti URL. Expected format: https://importyeti.com/company/company-name",
      },
      { status: 400 },
    )
  }

  const apiKey = process.env.IMPORTYETI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "ImportYeti API key is not configured." },
      { status: 500 },
    )
  }

  // 4. ONE ImportYeti call -> raw data
  const raw = await fetchRawImportYetiCompany(slug, apiKey)
  if (!raw.success) {
    console.error(`[/api/importyeti/brief] ImportYeti fetch failed: ${raw.error}`)
    return NextResponse.json(
      { success: false, error: raw.error },
      // 401/404/429 are actionable client-side; anything else is upstream noise
      { status: raw.status && raw.status >= 400 && raw.status < 500 ? raw.status : 502 },
    )
  }

  // 5. Analyze + generate strategy (falls back deterministically if the LLM
  //    call fails, so a brief is still produced rather than a 500).
  try {
    const analysis = analyzeBuyer(raw.data)
    const fullAnalysis = await analyzeAndGenerateStrategy(analysis, raw.data)

    // 6. Flattened lead shape for the profile sections — derived from the SAME
    //    response, no second credit.
    const lead = transformImportYetiData(
      raw.data,
      `https://importyeti.com/company/${slug}`,
    )

    const markdown = generateBuyerIntelligenceBrief({
      lead,
      analysis: fullAnalysis.analysis,
      strategy: fullAnalysis.strategy,
      metadata: {
        generatedDate: new Date().toISOString().split("T")[0],
        buyerId: slug,
        documentId: `BRIEF-${Date.now()}`,
        model:
          fullAnalysis.strategySource === "ai" ? BUYER_STRATEGY_MODEL : null,
        strategySource: fullAnalysis.strategySource,
      },
    })

    const { filename } = exportBuyerBriefAsText(
      markdown,
      analysis.companyName || slug,
    )

    return NextResponse.json({
      success: true,
      markdown,
      filename,
      contentType: "text/markdown",
      message: "Buyer intelligence brief generated successfully",
      meta: {
        companyName: analysis.companyName,
        timestamp: new Date().toISOString(),
        strategySource: fullAnalysis.strategySource,
        model:
          fullAnalysis.strategySource === "ai" ? BUYER_STRATEGY_MODEL : null,
        creditsRemaining: raw.creditsRemaining,
        requestCost: raw.requestCost,
      },
    })
  } catch (error) {
    console.error("[/api/importyeti/brief] Error:", error)
    const message = error instanceof Error ? error.message : "Failed to generate brief"
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
