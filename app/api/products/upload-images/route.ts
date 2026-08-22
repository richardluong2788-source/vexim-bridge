import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Client-side direct upload for product images. The browser uploads
 * straight to Vercel Blob using a short-lived token issued here, so
 * large images never pass through this function's request body.
 */

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
export const MAX_FILES = 10
export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

export async function POST(request: NextRequest) {
  const body = (await request.json()) as HandleUploadBody

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_FILE_SIZE,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ userId: user.id }),
        }
      },
      onUploadCompleted: async () => {
        // Product image rows are written client-side after upload
        // (the dialog just needs the resulting URL to save with the form).
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    console.error("[v0] product image upload token error:", error)
    return NextResponse.json(
      { error: (error as Error).message || "Upload thất bại" },
      { status: 400 }
    )
  }
}
