"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  uploadComplianceDoc,
  validateComplianceFile,
  deleteComplianceDocByUrl,
  type ComplianceDocKind,
  COMPLIANCE_DOC_KINDS,
} from "@/lib/blob/client-docs"

type ActionError =
  | "notAuthenticated"
  | "invalidInput"
  | "invalidFile"
  | "invalidType"
  | "fileTooLarge"
  | "uploadFailed"
  | "dbError"
  | "notFound"

export interface UploadComplianceDocResult {
  ok: boolean
  error?: ActionError
  docId?: string
}

/**
 * Client uploads a compliance document.
 * The owner_id is automatically set to the current user.
 */
export async function uploadClientComplianceDocAction(
  formData: FormData
): Promise<UploadComplianceDocResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: "notAuthenticated" }
  }

  const kindRaw = String(formData.get("kind") ?? "")
  const title = String(formData.get("title") ?? "").trim()
  const expiresAt = String(formData.get("expiresAt") ?? "").trim() || null
  const issuedAt = String(formData.get("issuedAt") ?? "").trim() || null
  const notes = String(formData.get("notes") ?? "").trim() || null
  const file = formData.get("file")

  if (!COMPLIANCE_DOC_KINDS.includes(kindRaw as ComplianceDocKind)) {
    return { ok: false, error: "invalidInput" }
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "invalidFile" }
  }

  const validation = validateComplianceFile(file)
  if (!validation.ok) {
    return { ok: false, error: validation.errorKey }
  }

  // Upload to Blob
  let pathname: string
  try {
    const result = await uploadComplianceDoc({
      ownerId: user.id,
      kind: kindRaw as ComplianceDocKind,
      file,
    })
    pathname = result.pathname
  } catch (err) {
    console.error("[v0] uploadClientComplianceDocAction blob error:", err)
    return { ok: false, error: "uploadFailed" }
  }

  // Insert into compliance_docs
  const admin = createAdminClient()
  const { data: inserted, error: insertErr } = await admin
    .from("compliance_docs")
    .insert({
      owner_id: user.id,
      kind: kindRaw as ComplianceDocKind,
      title: title || null,
      url: pathname,
      mime_type: file.type,
      size_bytes: file.size,
      issued_at: issuedAt,
      expires_at: expiresAt,
      notes,
      uploaded_by: user.id,
    })
    .select("id")
    .single()

  if (insertErr || !inserted) {
    console.error("[v0] uploadClientComplianceDocAction db error:", insertErr)
    // Clean up blob on failure
    await deleteComplianceDocByUrl(pathname)
    return { ok: false, error: "dbError" }
  }

  revalidatePath("/client/documents")
  return { ok: true, docId: inserted.id }
}

export interface DeleteComplianceDocResult {
  ok: boolean
  error?: ActionError
}

/**
 * Client deletes their own compliance document.
 */
export async function deleteClientComplianceDocAction(
  docId: string
): Promise<DeleteComplianceDocResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: "notAuthenticated" }
  }

  if (!docId) {
    return { ok: false, error: "invalidInput" }
  }

  const admin = createAdminClient()

  // Fetch the doc to verify ownership
  const { data: doc, error: fetchErr } = await admin
    .from("compliance_docs")
    .select("id, url, owner_id")
    .eq("id", docId)
    .single()

  if (fetchErr || !doc) {
    return { ok: false, error: "notFound" }
  }

  // Verify ownership
  if (doc.owner_id !== user.id) {
    return { ok: false, error: "notAuthenticated" }
  }

  // Delete from blob
  if (doc.url) {
    await deleteComplianceDocByUrl(doc.url)
  }

  // Delete from DB
  const { error: delErr } = await admin
    .from("compliance_docs")
    .delete()
    .eq("id", docId)

  if (delErr) {
    console.error("[v0] deleteClientComplianceDocAction db error:", delErr)
    return { ok: false, error: "dbError" }
  }

  revalidatePath("/client/documents")
  return { ok: true }
}

export interface UpdateComplianceDocResult {
  ok: boolean
  error?: ActionError
}

/**
 * Client updates metadata of their compliance document (title, dates, notes).
 */
export async function updateClientComplianceDocAction(
  docId: string,
  data: {
    title?: string | null
    expiresAt?: string | null
    issuedAt?: string | null
    notes?: string | null
  }
): Promise<UpdateComplianceDocResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: "notAuthenticated" }
  }

  if (!docId) {
    return { ok: false, error: "invalidInput" }
  }

  const admin = createAdminClient()

  // Verify ownership
  const { data: doc, error: fetchErr } = await admin
    .from("compliance_docs")
    .select("id, owner_id")
    .eq("id", docId)
    .single()

  if (fetchErr || !doc) {
    return { ok: false, error: "notFound" }
  }

  if (doc.owner_id !== user.id) {
    return { ok: false, error: "notAuthenticated" }
  }

  // Update
  const patch: Record<string, unknown> = {}
  if (data.title !== undefined) patch.title = data.title || null
  if (data.expiresAt !== undefined) patch.expires_at = data.expiresAt || null
  if (data.issuedAt !== undefined) patch.issued_at = data.issuedAt || null
  if (data.notes !== undefined) patch.notes = data.notes || null

  if (Object.keys(patch).length === 0) {
    return { ok: true } // Nothing to update
  }

  const { error: updErr } = await admin
    .from("compliance_docs")
    .update(patch)
    .eq("id", docId)

  if (updErr) {
    console.error("[v0] updateClientComplianceDocAction db error:", updErr)
    return { ok: false, error: "dbError" }
  }

  revalidatePath("/client/documents")
  return { ok: true }
}
