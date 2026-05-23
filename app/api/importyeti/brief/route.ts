import { NextRequest, NextResponse } from "next/server"
import { generateBuyerIntelligenceBrief, exportBuyerBriefAsText } from "@/lib/briefing/buyer-brief-generator"
import { fetchAndTransformImportYetiData } from "@/lib/importyeti/api-transformer"
import { analyzeBuyerProfile } from "@/lib/ai/buyer-analyzer"
import { generateBuyerStrategy } from "@/lib/ai/buyer-strategy-generator"

export async function POST(request: NextRequest) {
  try {
    const { importYetiLink } = await request.json()

    if (!importYetiLink) {
      return NextResponse.json(
        { success: false, error: "ImportYeti link is required" },
        { status: 400 }
      )
    }

    // Step 1: Fetch & transform data from ImportYeti API
    const transformedData = await fetchAndTransformImportYetiData(importYetiLink)

    if (!transformedData) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch ImportYeti data" },
        { status: 400 }
      )
    }

    // Step 2: Analyze buyer profile
    const analysis = analyzeBuyerProfile(transformedData)

    // Step 3: Generate strategy with AI
    const strategy = await generateBuyerStrategy(transformedData, analysis)

    // Step 4: Generate markdown brief
    const markdown = generateBuyerIntelligenceBrief({
      lead: transformedData,
      analysis,
      strategy,
      metadata: {
        generatedDate: new Date().toISOString().split("T")[0],
        buyerId: transformedData.companyName?.replace(/\\s+/g, "-").toLowerCase(),
        documentId: `BRIEF-${Date.now()}`,
      },
    })

    // Step 5: Export as text file metadata
    const { filename } = exportBuyerBriefAsText(
      markdown,
      transformedData.companyName || "buyer"
    )

    // Return both markdown content and filename for download
    return NextResponse.json({
      success: true,
      markdown,
      filename,
      contentType: "text/markdown",
      message: "Buyer intelligence brief generated successfully",
    })
  } catch (error) {
    console.error("[/api/importyeti/brief] Error:", error)
    const message = error instanceof Error ? error.message : "Failed to generate brief"
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
