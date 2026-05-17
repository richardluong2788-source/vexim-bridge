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

    // Fetch the image from the signed URL
    const imageResponse = await fetch(downloadUrl)
    
    if (!imageResponse.ok) {
      console.error("[v0] Failed to fetch blob:", imageResponse.status)
      return NextResponse.json(
        { error: "Failed to fetch image" },
        { status: imageResponse.status }
      )
    }

    // Get the image data as array buffer
    const imageBuffer = await imageResponse.arrayBuffer()
    
    // Get content type from the response
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg"

    // Return the image with proper headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (error) {
    console.error("[v0] Blob proxy error:", error)
    return NextResponse.json(
      { error: "Failed to get image" },
      { status: 500 }
    )
  }
}
