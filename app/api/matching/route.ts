/**
 * AI Matching System - REST API
 *
 * POST /api/matching
 *   Trigger AI matching for a buyer
 *   Body: { buyerId: string, useLLM?: boolean }
 *
 * GET /api/matching?buyerId=xxx
 *   Get match scores for a buyer
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { runMatchingPipeline, getMatchScoresForBuyer } from "@/lib/matching"
import { can, CAPS } from "@/lib/auth/permissions"
import type { Role } from "@/lib/supabase/types"

// ---------------------------------------------------------------------------
// POST - Trigger AI Matching
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }

    // Get profile for role check
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single()

    if (!profile || !can(profile.role as Role, CAPS.BUYER_WRITE)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 })
    }

    // Parse body
    const body = await request.json()
    const { buyerId, useLLM = false } = body

    if (!buyerId || typeof buyerId !== "string") {
      return NextResponse.json(
        { error: "buyerId is required" },
        { status: 400 }
      )
    }

    // Run matching pipeline
    const result = await runMatchingPipeline({
      leadId: buyerId,
      triggeredBy: user.id,
      useLLMAugmentation: useLLM,
    })

    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error("[v0] Matching API error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// GET - Get Match Scores
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }

    // Get profile for role check
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single()

    if (!profile || !can(profile.role as Role, CAPS.BUYER_VIEW)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 })
    }

    // Get buyerId from query params
    const { searchParams } = new URL(request.url)
    const buyerId = searchParams.get("buyerId")

    if (!buyerId) {
      return NextResponse.json(
        { error: "buyerId query param is required" },
        { status: 400 }
      )
    }

    // Fetch scores
    const scores = await getMatchScoresForBuyer(buyerId)

    return NextResponse.json({ success: true, scores })
  } catch (error) {
    console.error("[v0] Matching API GET error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    )
  }
}
