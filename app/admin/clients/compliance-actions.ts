"use server"

/**
 * Server actions for the Client Compliance workspace (Sprint B / SOP §0.2–0.3).
 *
 * Responsibilities:
 *  - Upload / delete compliance documents (FDA cert, COA, price floor,
 *    factory video/photos, other) scoped to a single client profile.
 *  - Create and revoke tokenized share links that buyers can open via
 *    `/share/[token]` without authenticating (default TTL 30 days).
 *
 * Security model:
 *  - All mutations require an authenticated admin. We use the admin Supabase
 *    client to bypass RLS for controlled operations; authorization is
 *    enforced in-process by checking the caller's `profiles.role`.
 */
import { revalidatePath } from "next/cache"
import { requireCap } from "@/lib/auth/guard"
import { CAPS } from "@/lib/auth/permissions"
import {
  uploadComplianceDoc,
  deleteComplianceDocByUrl,
  validateComplianceFile,
  COMPLIANCE_DOC_KINDS,
  type ComplianceDocKind,
} from "@/lib/blob/client-docs"

type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

// All client compliance writes gate on CAPS.CLIENT_COMPLIANCE_WRITE
// (admin, super_admin, account_executive, staff).

// ────────────────────────────────────────────────────────────────────────────
// Compliance Docs
// ────────────────────────────────────────────────────────────────────────────

export async function uploadClientDocAction(
  formData: FormData,
): Promise<ActionResult<{ url: string; id: string }>> {
  const guard = await requireCap(CAPS.CLIENT_COMPLIANCE_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin: adminClient, userId } = guard

  const ownerId = String(formData.get("ownerId") ?? "")
  const kind = String(formData.get("kind") ?? "") as ComplianceDocKind
  const title = String(formData.get("title") ?? "").trim() || null
  const expiresAtRaw = String(formData.get("expiresAt") ?? "").trim()
  const expiresAt = expiresAtRaw || null
  const notes = String(formData.get("notes") ?? "").trim() || null
  const file = formData.get("file") as File | null

  if (!ownerId) return { ok: false, error: "missingClient" }
  if (!COMPLIANCE_DOC_KINDS.includes(kind)) {
    return { ok: false, error: "invalidDocType" }
  }
  if (!file || file.size === 0) return { ok: false, error: "missingFile" }

  const validation = validateComplianceFile(file)
  if (!validation.ok) {
    return { ok: false, error: validation.errorKey! }
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { ok: false, error: "missingToken" }
  }

  let uploaded: { url: string; pathname: string }
  try {
    uploaded = await uploadComplianceDoc({ ownerId, kind, file })
  } catch (err) {
    console.error("[v0] uploadComplianceDoc failed", err)
    return { ok: false, error: "uploadFailed" }
  }

  const { data, error } = await adminClient
    .from("compliance_docs")
    .insert({
      owner_id: ownerId,
      kind,
      title,
      url: uploaded.url,
      mime_type: file.type,
      size_bytes: file.size,
      expires_at: expiresAt,
      notes,
      uploaded_by: userId ?? null,
    })
    .select("id")
    .single()

  if (error || !data) {
    // Roll back the blob so we don't leak orphans.
    await deleteComplianceDocByUrl(uploaded.url)
    console.error("[v0] compliance_docs insert failed", error)
    return { ok: false, error: "dbInsertFailed" }
  }

  // The expiry date lives on the compliance_docs row itself; kanban checks
  // read it from there. No profile update needed.
  revalidatePath(`/admin/clients/${ownerId}`)
  return { ok: true, data: { url: uploaded.url, id: data.id } }
}

export async function deleteClientDocAction(
  docId: string,
): Promise<ActionResult> {
  const guard = await requireCap(CAPS.CLIENT_COMPLIANCE_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin: adminClient } = guard

  const { data: doc, error: fetchErr } = await adminClient
    .from("compliance_docs")
    .select("id, owner_id, url")
    .eq("id", docId)
    .single()

  if (fetchErr || !doc) return { ok: false, error: "notFound" }

  const { error: delErr } = await adminClient
    .from("compliance_docs")
    .delete()
    .eq("id", docId)

  if (delErr) {
    console.error("[v0] compliance_docs delete failed", delErr)
    return { ok: false, error: "dbDeleteFailed" }
  }

  await deleteComplianceDocByUrl(doc.url)
  revalidatePath(`/admin/clients/${doc.owner_id}`)
  return { ok: true }
}

// ────────────────────────────────────────────────────────────────────────────
// Tokenized Share Links (SOP §0.3)
// ────────────────────────────────────────────────────────────────────────────

export async function createShareLinkAction(args: {
  docId: string
  ttlDays?: number
  note?: string | null
}): Promise<ActionResult<{ token: string }>> {
  const guard = await requireCap(CAPS.CLIENT_COMPLIANCE_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin: adminClient, userId } = guard

  const ttlDays = args.ttlDays && args.ttlDays > 0 ? args.ttlDays : 30
  const expiresAt = new Date(
    Date.now() + ttlDays * 24 * 60 * 60 * 1000,
  ).toISOString()

  // Need the doc.owner_id so the row satisfies NOT NULL + matches RLS.
  const { data: doc, error: docErr } = await adminClient
    .from("compliance_docs")
    .select("id, owner_id")
    .eq("id", args.docId)
    .single()

  if (docErr || !doc) return { ok: false, error: "notFound" }

  const { data, error } = await adminClient
    .from("tokenized_share_links")
    .insert({
      doc_id: doc.id,
      owner_id: doc.owner_id,
      expires_at: expiresAt,
      note: args.note ?? null,
      created_by: userId ?? null,
    })
    .select("token")
    .single()

  if (error || !data) {
    console.error("[v0] createShareLink failed", error)
    return { ok: false, error: "dbInsertFailed" }
  }

  revalidatePath(`/admin/clients/${doc.owner_id}`)
  return { ok: true, data: { token: data.token as string } }
}

export async function revokeShareLinkAction(
  token: string,
): Promise<ActionResult> {
  const guard = await requireCap(CAPS.CLIENT_COMPLIANCE_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin: adminClient } = guard

  const { data: link, error: fetchErr } = await adminClient
    .from("tokenized_share_links")
    .select("token, owner_id")
    .eq("token", token)
    .single()

  if (fetchErr || !link) return { ok: false, error: "notFound" }

  const { error } = await adminClient
    .from("tokenized_share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token", token)

  if (error) return { ok: false, error: "dbUpdateFailed" }

  revalidatePath(`/admin/clients/${link.owner_id}`)
  return { ok: true }
}
