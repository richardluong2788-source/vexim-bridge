/**
 * API endpoint for pricing suggestions
 */

import { NextRequest, NextResponse } from "next/server"
import { suggestPricing } from "@/lib/pricing/suggestions"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      opportunityId,
      productName,
      quantity,
      originCountry,
      destinationPort,
      incoterm,
      industry,
    } = body

    if (!opportunityId || !productName) {
      return NextResponse.json(
        { error: "Missing required fields: opportunityId, productName" },
        { status: 400 }
      )
    }

    const suggestion = await suggestPricing({
      opportunityId,
      productName,
      quantity,
      originCountry,
      destinationPort,
      incoterm,
      industry,
    })

    if (!suggestion) {
      return NextResponse.json(
        { error: "Unable to generate pricing suggestion" },
        { status: 500 }
      )
    }

    return NextResponse.json(suggestion)
  } catch (error) {
    console.error("[v0] Pricing suggestion API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
