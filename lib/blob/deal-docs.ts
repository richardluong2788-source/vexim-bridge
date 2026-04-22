import { put } from "@vercel/blob"

/**
 * Vercel Blob integration for deal-related documents
 * (Sprint A — Closing & Compliance, SOP Phase 3).
 *
 * All deal documents are stored with `access: "private"` — only authenticated
 * admin/staff requests that go through our server actions can retrieve them.
 *
 * Key convention (flat, per-deal prefix so list/delete by prefix is easy):
 *   deals/{dealId}/{kind}/{timestamp}-{filename}
 *
 * Allowed MIME types are intentionally narrow (PDF + common image formats)
 * to prevent drive-by uploads of executables.
 */

export type DealDocKind = "po" | "swift" | "bl" | "fda" | "coa"

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
])

const MAX_SIZE_BYTES = 15 * 1024 * 1024 // 15 MB — PO/Swift scans are rarely larger

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
      // The Blob store is configured as `private`; `blob.url` is NOT
      // publicly reachable. We persist the pathname and serve it
      // through `/api/files?path=...` after auth checks.
      access: "private",
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
