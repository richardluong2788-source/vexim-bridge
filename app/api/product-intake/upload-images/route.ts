import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Public upload for product-intake/[token] – supplier does not have login
 * but has a valid product_intake_links token.
 * Validates token query param ?token=xxx before issuing Blob token.
 *
 * Spec B: 5MB max, client compresses to 300-800KB webp before upload.
 */

export const MAX_FILE_SIZE = 5 * 1024 * 1024
export const MAX_FILES = 10
export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

export async function POST(request: NextRequest) {
  const body = (await request.json()) as HandleUploadBody

  try {
    // Token can be in tokenPayload (from client) or in query ?token=
    const url = new URL(request.url)
    const queryToken = url.searchParams.get('token')

    // Try to extract token from payload if present
    let payloadToken: string | null = null
    try {
      const payload = (body as any)?.payload ? JSON.parse((body as any).payload) : null
      payloadToken = payload?.token || null
    } catch {}

    const token = queryToken || payloadToken
    if (!token) {
      return NextResponse.json({ error: "Missing intake token" }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: link } = await admin
      .from("product_intake_links")
      .select("id, expires_at")
      .eq("token", token)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle()

    if (!link) {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 403 })
    }

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_FILE_SIZE,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ token, intakeLinkId: link.id }),
        }
      },
      onUploadCompleted: async () => {},
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    console.error("[v0] product-intake upload token error:", error)
    return NextResponse.json(
      { error: (error as Error).message || "Upload thất bại" },
      { status: 400 }
    )
  }
}
