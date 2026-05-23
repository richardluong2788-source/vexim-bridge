/**
 * ImportYeti API Transform Endpoint
 * 
 * POST /api/importyeti/transform
 * 
 * Accepts an ImportYeti URL, extracts the company slug, calls the ImportYeti API,
 * transforms the response, and returns data ready for Lead form auto-fill.
 * 
 * Request body:
 *   { importYetiLink: "https://importyeti.com/company/walmart" }
 * 
 * Response:
 *   { success: true, data: { companyName: "Walmart", ... } }
 *   or
 *   { success: false, error: "Error message" }
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { 
  extractSlugFromUrl, 
  fetchAndTransformImportYetiData 
} from "@/lib/importyeti/api-transformer"

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

  // 2. Verify user has permission (lead_researcher, admin, super_admin)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const role = profile?.role
  if (!role || !["super_admin", "admin", "lead_researcher"].includes(role)) {
    return NextResponse.json(
      { success: false, error: "Insufficient permissions" },
      { status: 403 }
    )
  }

  // 3. Parse request body
  let body: { importYetiLink?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  const { importYetiLink } = body

  if (!importYetiLink) {
    return NextResponse.json(
      { success: false, error: "importYetiLink is required" },
      { status: 400 }
    )
  }

  // 4. Extract company slug from URL
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

  // 5. Get API key from environment
  const apiKey = process.env.IMPORTYETI_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { 
        success: false, 
        error: "ImportYeti API key is not configured. Please add IMPORTYETI_API_KEY to environment variables." 
      },
      { status: 500 }
    )
  }

  // 6. Fetch and transform data
  const result = await fetchAndTransformImportYetiData(slug, apiKey)

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 }
    )
  }

  // 7. Return transformed data
  return NextResponse.json({
    success: true,
    data: result.data,
    meta: {
      slug,
      apiCreditsUsed: 1,
    }
  })
}
