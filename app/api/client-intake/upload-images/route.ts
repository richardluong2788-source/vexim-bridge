import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Public upload for client-intake/[token] – supplier does not have login
 * but has a valid client_intake_submissions token (get_intake_submission_by_token RPC).
 * Validates token before issuing Blob token.
 *
 * Spec B: 5MB max, client compresses to 300-800KB webp before upload.
 */

export const MAX_FILE_SIZE = 5 * 1024 * 1024
export const MAX_FILES = 10
export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

export async function POST(request: NextRequest) {
  const body = (await request.json()) as HandleUploadBody

  try {
    const url = new URL(request.url)
    const queryToken = url.searchParams.get('token')

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
    // Validate via RPC get_intake_submission_by_token – same as page.tsx
    // We can't call RPC that returns full row? We can check existence via query on client_intake_submissions
    const { data: submission } = await admin
      .from("client_intake_submissions")
      .select("id, expires_at, status")
      .eq("token", token)
      .maybeSingle()

    if (!submission) {
      return NextResponse.json({ error: "Invalid link" }, { status: 403 })
    }

    // Check expiry – pending links have expires_at, submitted links may have no expiry? Allow if not expired
    if (submission.expires_at && new Date(submission.expires_at) < new Date()) {
      return NextResponse.json({ error: "Link expired" }, { status: 403 })
    }

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_FILE_SIZE,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ token, submissionId: submission.id }),
        }
      },
      onUploadCompleted: async () => {},
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    console.error("[v0] client-intake upload token error:", error)
    return NextResponse.json(
      { error: (error as Error).message || "Upload thất bại" },
      { status: 400 }
    )
  }
}
