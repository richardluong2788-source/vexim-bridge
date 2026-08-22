import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Client-side direct upload for email attachments.
 *
 * The browser uploads the file bytes straight to Vercel Blob storage using
 * a short-lived token issued here — the file body never passes through this
 * serverless function, so it is not subject to the ~4.5MB request-body
 * limit (or function memory) that a proxy `formData()` upload would hit.
 */

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
export const MAX_FILES = 5
export const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
]

export type UploadedAttachment = {
  url: string
  pathname: string
  filename: string
  size: number
  contentType: string
}

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
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const originalName = clientPayload ? JSON.parse(clientPayload).filename : pathname

        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_FILE_SIZE,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ userId: user.id, filename: originalName }),
        }
      },
      onUploadCompleted: async () => {
        // No DB write needed — attachments are ephemeral and referenced
        // directly by URL in the email draft until sent.
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    console.error("[v0] attachment upload token error:", error)
    return NextResponse.json(
      { error: (error as Error).message || "Upload failed" },
      { status: 400 }
    )
  }
}
