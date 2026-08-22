import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Client-side direct upload for profile branding media (cover image, logo,
 * factory image, factory video). The browser uploads straight to Vercel
 * Blob using a short-lived token issued here, so large files (especially
 * video) never pass through this function's request body.
 */

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB
export const MAX_VIDEO_SIZE = 200 * 1024 * 1024 // 200MB
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"]

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
          allowedContentTypes: [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES],
          maximumSizeInBytes: MAX_VIDEO_SIZE,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ userId: user.id }),
        }
      },
      onUploadCompleted: async () => {
        // Profile fields are written client-side after upload (the form
        // just needs the resulting URL to save alongside the rest of the profile).
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    console.error("[v0] profile media upload token error:", error)
    return NextResponse.json(
      { error: (error as Error).message || "Upload thất bại" },
      { status: 400 }
    )
  }
}
