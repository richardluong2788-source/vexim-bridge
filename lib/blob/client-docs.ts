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
 * The Blob store is configured as `private`, so the `url` returned by
 * `put()` is NOT publicly reachable. We store the **pathname** in
 * `compliance_docs.url` and serve files through the authenticated
 * proxy at `/api/files?path=...` (see `lib/blob/file-url.ts`).
 * Tokenized sharing (`/share/[token]`) validates the token in the
 * proxy and streams the file without requiring the viewer to log in.
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
}): Promise<{ pathname: string }> {
  const { ownerId, kind, file } = args
  const pathname = `clients/${ownerId}/${kind}/${Date.now()}-${safeFilename(
    file.name,
  )}`

  const blob = await put(pathname, file, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: file.type,
  })

  // `blob.url` from a private store is NOT publicly accessible — we
  // persist the pathname and serve it through `/api/files`.
  return { pathname: blob.pathname }
}

/**
 * Best-effort delete — swallows errors so orphaned rows never block UI.
 * Accepts either the pathname (preferred, new rows) or a legacy absolute
 * URL (rows inserted before the private migration). `del()` handles both.
 */
export async function deleteComplianceDocByUrl(
  pathOrUrl: string,
): Promise<void> {
  try {
    await del(pathOrUrl)
  } catch (err) {
    console.error("[v0] deleteComplianceDocByUrl failed", err)
  }
}
