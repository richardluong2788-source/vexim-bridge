import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { type NextRequest, NextResponse } from "next/server"

/**
 * Client-upload endpoint for the public (token-gated) client-intake wizard.
 *
 * Uses `handleUpload` so the browser uploads directly to Vercel Blob, avoiding
 * the 4.5MB server body limit — factory / product photos taken on phones are
 * often larger than that. Only image types are accepted.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
          "image/avif",
        ],
        maximumSizeInBytes: 5 * 1024 * 1024, // 5MB per file
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {
        // No-op: the intake wizard stores the returned URL in its form state
        // and persists it on final submit.
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    console.error("[v0] client-intake upload error:", (error as Error).message)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    )
  }
}
