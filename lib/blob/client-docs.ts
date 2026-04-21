/**
 * Vercel Blob helpers for *client-level* compliance documents.
 *
 * Scoped to a profile (owner_id) rather than a deal — a single upload
 * (FDA cert, COA, price floor, factory video) can be referenced by every
 * deal that client participates in.
 *
 * Storage layout:
 *   clients/{ownerId}/{kind}/{timestamp}-{safeName}
 *
 * Uploads are written as `access: "public"` so the `url` field works
 * directly from a browser. Sharing is controlled by the tokenized link
 * layer (`/share/[token]`), not by blob ACLs.
 */
import { put, del } from "@vercel/blob"

// Kinds must mirror the CHECK constraint on compliance_docs.kind.
export const COMPLIANCE_DOC_KINDS = [
  "fda_certificate",
  "coa",
  "price_floor",
  "factory_video",
  "factory_photo",
  "other",
] as const

export type ComplianceDocKind = (typeof COMPLIANCE_DOC_KINDS)[number]

// Factory videos can be large, so we give generous headroom; everything
// else in practice is well under 10 MB.
const MAX_FILE_MB = 100
export const MAX_FILE_SIZE_BYTES = MAX_FILE_MB * 1024 * 1024

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
])

export function validateComplianceFile(file: File): {
  ok: boolean
  errorKey?: "fileTooLarge" | "invalidType"
} {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, errorKey: "fileTooLarge" }
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return { ok: false, errorKey: "invalidType" }
  }
  return { ok: true }
}

function safeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "file"
  return base.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(0, 80)
}

export async function uploadComplianceDoc(args: {
  ownerId: string
  kind: ComplianceDocKind
  file: File
}): Promise<{ url: string; pathname: string }> {
  const { ownerId, kind, file } = args
  const pathname = `clients/${ownerId}/${kind}/${Date.now()}-${safeFilename(
    file.name,
  )}`

  const blob = await put(pathname, file, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: file.type,
  })

  return { url: blob.url, pathname }
}

/** Best-effort delete — swallows errors so orphaned rows never block UI. */
export async function deleteComplianceDocByUrl(url: string): Promise<void> {
  try {
    await del(url)
  } catch (err) {
    console.error("[v0] deleteComplianceDocByUrl failed", err)
  }
}
