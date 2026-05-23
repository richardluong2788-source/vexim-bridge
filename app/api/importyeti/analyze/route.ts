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
 *     strategy: { recommendedAngle, talkingPoints, riskFactors, ... }
 *   }
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { extractSlugFromUrl } from "@/lib/importyeti/api-transformer"
import type { ImportYetiAPIResponse } from "@/lib/importyeti/api-transformer"
import { analyzeBuyer } from "@/lib/ai/buyer-analyzer"
import { analyzeAndGenerateStrategy } from "@/lib/ai/buyer-strategy-generator"

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

    // Fetch raw data from ImportYeti
    try {
      const apiUrl = `https://data.importyeti.com/v1.0/company/${encodeURIComponent(slug)}`
      const response = await fetch(apiUrl, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        return NextResponse.json(
          { success: false, error: `ImportYeti API error: ${response.status} - ${errorText}` },
          { status: 400 }
        )
      }

      const apiResponse: ImportYetiAPIResponse = await response.json()
      apiData = apiResponse.data
    } catch (error) {
      console.error("[ImportYeti Analyze] Fetch error:", error)
      return NextResponse.json(
        { success: false, error: "Failed to fetch data from ImportYeti" },
        { status: 500 }
      )
    }
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
