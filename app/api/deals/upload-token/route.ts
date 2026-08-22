import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { type NextRequest, NextResponse } from "next/server"
import { requireCap } from "@/lib/auth/guard"
import { CAPS } from "@/lib/auth/permissions"
import { DEAL_DOC_ALLOWED_MIME, DEAL_DOC_MAX_SIZE_BYTES } from "@/lib/blob/deal-docs"

/**
 * Issues short-lived client tokens for deal document uploads (PO / Swift /
 * B-L scans). The browser uploads straight to Vercel Blob — the file body
 * never passes through this function, avoiding both the Server Action 1MB
 * body limit and the ~4.5MB Serverless Function request limit.
 *
 * The Blob store is private: only the token generated here (scoped to the
 * `deals/{dealId}/{kind}/` prefix the client already built via
 * `prepareDealDocumentUploadAction`) is allowed to write to that path.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as HandleUploadBody

  try {
    const guard = await requireCap(CAPS.DEAL_COMPLIANCE_WRITE)
    if (!guard.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("deals/")) {
          throw new Error("Invalid pathname")
        }

        return {
          allowedContentTypes: DEAL_DOC_ALLOWED_MIME,
          maximumSizeInBytes: DEAL_DOC_MAX_SIZE_BYTES,
          addRandomSuffix: true,
        }
      },
      onUploadCompleted: async () => {
        // DB write happens in finalizeDealDocumentUploadAction once the
        // browser confirms the upload — no webhook needed here.
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    console.error("[v0] deal doc upload token error:", error)
    return NextResponse.json(
      { error: (error as Error).message || "Upload failed" },
      { status: 400 }
    )
  }
}
