import { put } from "@vercel/blob"

/**
 * Vercel Blob integration for deal-related documents
 * (Sprint A — Closing & Compliance, SOP Phase 3).
 *
 * The Blob store backing this project is configured as `public`, so all
 * deal documents are uploaded with `access: "public"`. Access control is
 * still enforced at the app layer: clients only ever reach files through
 * `/api/files?path=...`, which checks the caller's session/role before
 * streaming the blob — the pathname itself is never surfaced to the
 * browser as a raw public URL.
 *
 * Key convention (flat, per-deal prefix so list/delete by prefix is easy):
 *   deals/{dealId}/{kind}/{timestamp}-{filename}
 *
 * Allowed MIME types are intentionally narrow (PDF + common image formats)
 * to prevent drive-by uploads of executables.
 */

export type DealDocKind = "po" | "swift" | "bl" | "fda" | "coa"

// The three kinds accepted by the opportunity compliance upload flow.
export const DEAL_DOC_ALLOWED_KINDS: DealDocKind[] = ["po", "swift", "bl"]

export const DEAL_DOC_ALLOWED_MIME = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]

const ALLOWED_MIME = new Set(DEAL_DOC_ALLOWED_MIME)

export const DEAL_DOC_MAX_SIZE_BYTES = 15 * 1024 * 1024 // 15 MB — PO/Swift scans are rarely larger
const MAX_SIZE_BYTES = DEAL_DOC_MAX_SIZE_BYTES

export interface UploadDealDocInput {
  dealId: string
  kind: DealDocKind
  file: File
}

export interface UploadDealDocResult {
  ok: boolean
  url?: string
  error?:
    | "invalidFile"
    | "invalidType"
    | "fileTooLarge"
    | "uploadFailed"
    | "missingToken"
}

/**
 * Upload a scanned PO / Swift copy / B-L to Vercel Blob.
 * Returns the blob URL on success. Failures never throw so callers can
 * translate the error code to a localized toast.
 */
export async function uploadDealDoc(
  input: UploadDealDocInput,
): Promise<UploadDealDocResult> {
  const { dealId, kind, file } = input

  if (!file || typeof file === "string" || !(file instanceof File)) {
    return { ok: false, error: "invalidFile" }
  }

  if (file.size === 0) return { ok: false, error: "invalidFile" }
  if (file.size > MAX_SIZE_BYTES) return { ok: false, error: "fileTooLarge" }
  if (!ALLOWED_MIME.has(file.type)) return { ok: false, error: "invalidType" }

  // Fail fast in dev if the Blob token wasn't injected by the integration.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { ok: false, error: "missingToken" }
  }

  const safeName = file.name
    .replace(/[^\w.\-]+/g, "_")
    .slice(0, 80) || `${kind}.pdf`

  const path = `deals/${dealId}/${kind}/${Date.now()}-${safeName}`

  try {
    const blob = await put(path, file, {
      // The Blob store is configured as `public`; `blob.url` IS directly
      // reachable, but we still persist only the pathname and always
      // serve it through `/api/files?path=...` so auth checks stay
      // enforced at the app layer.
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    })
    // Persist pathname (not url) in *_doc_url columns so the proxy
    // route can resolve it with `get()`.
    return { ok: true, url: blob.pathname }
  } catch (err) {
    console.error("[v0] uploadDealDoc failed", err)
    return { ok: false, error: "uploadFailed" }
  }
}
