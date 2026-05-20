import { NextResponse } from "next/server"
import { getTotalSuggestionsCount, MIN_SUGGESTIONS_REQUIRED } from "@/lib/pricing/suggestions"

export async function GET() {
  try {
    const totalSuggestions = await getTotalSuggestionsCount()
    const isUnlocked = totalSuggestions >= MIN_SUGGESTIONS_REQUIRED
    const remaining = Math.max(0, MIN_SUGGESTIONS_REQUIRED - totalSuggestions)

    return NextResponse.json({
      totalSuggestions,
      minRequired: MIN_SUGGESTIONS_REQUIRED,
      isUnlocked,
      remaining,
    })
  } catch (error) {
    console.error("[v0] Error fetching pricing status:", error)
    return NextResponse.json(
      { error: "Failed to fetch pricing status" },
      { status: 500 }
    )
  }
}
