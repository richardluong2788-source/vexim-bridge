import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { type NextRequest, NextResponse } from "next/server"
import { requireCap } from "@/lib/auth/guard"
import { CAPS } from "@/lib/auth/permissions"
import {
  COMPLIANCE_DOC_ALLOWED_MIME,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/blob/client-docs"

/**
 * Issues short-lived client tokens for client-level compliance documents
 * (FDA cert, COA, price floor, and — critically — factory videos up to
 * 100MB). The browser uploads straight to Vercel Blob, so a large video
 * never has to fit inside a server function's request body.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as HandleUploadBody

  try {
    const guard = await requireCap(CAPS.CLIENT_COMPLIANCE_WRITE)
    if (!guard.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("clients/")) {
          throw new Error("Invalid pathname")
        }

        return {
          allowedContentTypes: COMPLIANCE_DOC_ALLOWED_MIME,
          maximumSizeInBytes: MAX_FILE_SIZE_BYTES,
          addRandomSuffix: false,
        }
      },
      onUploadCompleted: async () => {
        // DB write happens in finalizeClientDocUploadAction once the
        // browser confirms the upload — no webhook needed here.
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    console.error("[v0] client doc upload token error:", error)
    return NextResponse.json(
      { error: (error as Error).message || "Upload failed" },
      { status: 400 }
    )
  }
}
