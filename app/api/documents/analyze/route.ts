import { NextResponse } from "next/server"
import { analyzeDocumentsForOpportunity } from "@/lib/ai/document-advisor"

export async function POST(request: Request) {
  try {
    const { opportunityId } = await request.json()

    if (!opportunityId) {
      return NextResponse.json(
        { error: "opportunityId is required" },
        { status: 400 }
      )
    }

    const analysis = await analyzeDocumentsForOpportunity(opportunityId)

    if (!analysis) {
      return NextResponse.json(
        { error: "Failed to analyze documents" },
        { status: 500 }
      )
    }

    return NextResponse.json(analysis)
  } catch (error) {
    console.error("[v0] Document analysis error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
