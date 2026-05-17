import { NextRequest, NextResponse } from "next/server"
import { getDownloadUrl } from "@vercel/blob"

/**
 * Proxy route for private Vercel Blob images
 * Usage: /api/blob?url=<encoded-blob-url>
 */
export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url")

    if (!url) {
      return NextResponse.json(
        { error: "Missing url parameter" },
        { status: 400 }
      )
    }

    // Get a temporary signed download URL for the private blob
    const downloadUrl = await getDownloadUrl(url)

    // Redirect to the signed URL (faster, less server load)
    return NextResponse.redirect(downloadUrl)
  } catch (error) {
    console.error("[v0] Blob proxy error:", error)
    return NextResponse.json(
      { error: "Failed to get image" },
      { status: 500 }
    )
  }
}
