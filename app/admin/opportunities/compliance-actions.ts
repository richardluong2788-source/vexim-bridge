"use server"

import { revalidatePath } from "next/cache"
import { requireCap, type GuardSuccess } from "@/lib/auth/guard"
import { CAPS } from "@/lib/auth/permissions"
import { uploadDealDoc, type DealDocKind } from "@/lib/blob/deal-docs"
import { assessCountryRisk, type RiskAssessment } from "@/lib/risk/country-risk"

type AdminSB = GuardSuccess["admin"]

// ---------------------------------------------------------------------------
// SPRINT A — Closing & Compliance server actions (SOP Phase 3)
// R-05 hardened: Segregation of Duties on Swift verification.
// ---------------------------------------------------------------------------
// These helpers cover three flows:
//   1. uploadDealDocumentAction — admin uploads PO, Swift copy, or B-L
//      scan. For Swift uploads we ALSO record swift_uploaded_by /
//      swift_uploaded_at so the DB can enforce that the verifier is a
//      DIFFERENT person (CHECK constraint `deals_swift_sod_check`).
//   2. verifySwiftAction — admin attests that the Swift wire landed on
//      our bank. Rejected (application + DB) if the current user is the
//      one who uploaded the Swift doc.
//   3. getOpportunityComplianceState — server-side query used by the
//      opportunity detail sheet. Returns `canSelfVerifySwift = false`
//      when the current admin is the uploader, so the UI can render the
//      dual-control warning.
// ---------------------------------------------------------------------------

type ActionError =
  | "notAuthenticated"
  | "forbidden"
  | "notFound"
  | "invalidInput"
  | "invalidFile"
  | "invalidType"
  | "fileTooLarge"
  | "uploadFailed"
  | "missingToken"
  | "dealCreateFailed"
  | "dbError"
  | "sodViolation"
  | "swiftMissing"

// ---------------------------------------------------------------------------
// Compliance writes (Sprint A) gate on CAPS.DEAL_COMPLIANCE_WRITE:
//   admin, super_admin, account_executive, staff (legacy)
// Lead researchers and finance are intentionally excluded — they have
// separate capability paths.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Ensure a deal row exists for an opportunity.
// ---------------------------------------------------------------------------
async function ensureDeal(
  admin: AdminSB,
  opportunityId: string,
  userId: string,
): Promise<string | null> {
  const { data: existing } = await admin
    .from("deals")
    .select("id")
    .eq("opportunity_id", opportunityId)
    .maybeSingle()

  if (existing?.id) return existing.id

  const { data: inserted, error } = await admin
    .from("deals")
    .insert({ opportunity_id: opportunityId, created_by: userId })
    .select("id")
    .single()

  if (error || !inserted) {
    console.error("[v0] ensureDeal insert failed", error)
    return null
  }
  return inserted.id
}

// ---------------------------------------------------------------------------
// 1. Upload a deal document (PO / Swift / B-L) to Vercel Blob.
// ---------------------------------------------------------------------------
export interface UploadDealDocumentResult {
  ok: boolean
  error?: ActionError
  url?: string
}

export async function uploadDealDocumentAction(
  formData: FormData,
): Promise<UploadDealDocumentResult> {
  const guard = await requireCap(CAPS.DEAL_COMPLIANCE_WRITE)
  if (!guard.ok) {
    return {
      ok: false,
      error: guard.error === "unauthenticated" ? "notAuthenticated" : "forbidden",
    }
  }
  const { admin, userId } = guard

  const opportunityId = String(formData.get("opportunityId") ?? "")
  const kindRaw = String(formData.get("kind") ?? "")
  const file = formData.get("file")

  const allowedKinds: DealDocKind[] = ["po", "swift", "bl"]
  if (!opportunityId || !allowedKinds.includes(kindRaw as DealDocKind)) {
    return { ok: false, error: "invalidInput" }
  }
  if (!(file instanceof File)) {
    return { ok: false, error: "invalidFile" }
  }

  const dealId = await ensureDeal(admin, opportunityId, userId)
  if (!dealId) return { ok: false, error: "dealCreateFailed" }

  const uploaded = await uploadDealDoc({
    dealId,
    kind: kindRaw as DealDocKind,
    file,
  })
  if (!uploaded.ok || !uploaded.url) {
    return { ok: false, error: uploaded.error ?? "uploadFailed" }
  }

  // Map the kind to the right column + record uploader metadata for Swift.
  // The DB trigger `deals_swift_reupload_resets_verification` will also
  // reset swift_verified/_at/_by whenever swift_doc_url changes, so we
  // always re-enter the "awaiting dual-control verification" state.
  const patch: Record<string, unknown> = {}
  if (kindRaw === "po") {
    patch.po_doc_url = uploaded.url
  } else if (kindRaw === "bl") {
    patch.bl_doc_url = uploaded.url
  } else {
    // swift
    patch.swift_doc_url = uploaded.url
    patch.swift_uploaded_by = userId
    patch.swift_uploaded_at = new Date().toISOString()
  }

  const { error: updErr } = await admin.from("deals").update(patch).eq("id", dealId)

  if (updErr) {
    console.error("[v0] uploadDealDocumentAction update failed", updErr)
    return { ok: false, error: "dbError" }
  }

  await admin.from("activities").insert({
    opportunity_id: opportunityId,
    action_type: "deal_doc_uploaded",
    description: `${kindRaw.toUpperCase()} document uploaded`,
    performed_by: userId,
  })

  revalidatePath("/admin/pipeline")
  revalidatePath("/admin")
  return { ok: true, url: uploaded.url }
}

// ---------------------------------------------------------------------------
// 2. Admin verifies / unverifies the Swift wire copy.
//    R-05: rejects same-user verification at both app + DB layers.
// ---------------------------------------------------------------------------
export interface VerifySwiftInput {
  opportunityId: string
  verified: boolean
  transactionReference?: string | null
}

export interface VerifySwiftResult {
  ok: boolean
  error?: ActionError
}

export async function verifySwiftAction(
  input: VerifySwiftInput,
): Promise<VerifySwiftResult> {
  const guard = await requireCap(CAPS.DEAL_COMPLIANCE_WRITE)
  if (!guard.ok) {
    return {
      ok: false,
      error: guard.error === "unauthenticated" ? "notAuthenticated" : "forbidden",
    }
  }
  const { admin, userId } = guard

  if (!input?.opportunityId) return { ok: false, error: "invalidInput" }

  // Fetch current deal state so we can enforce SoD at the application
  // layer BEFORE calling UPDATE. The DB CHECK is a safety net — this is
  // the user-facing check that returns a friendly error.
  const { data: existingDeal } = await admin
    .from("deals")
    .select("id, swift_doc_url, swift_uploaded_by")
    .eq("opportunity_id", input.opportunityId)
    .maybeSingle()

  if (input.verified) {
    if (!existingDeal?.swift_doc_url) {
      return { ok: false, error: "swiftMissing" }
    }
    if (existingDeal.swift_uploaded_by && existingDeal.swift_uploaded_by === userId) {
      // Segregation of Duties violation. Caught here so we can log it
      // and return a user-friendly message instead of a CHECK error.
      await admin.from("activities").insert({
        opportunity_id: input.opportunityId,
        action_type: "swift_sod_blocked",
        description:
          "Chặn xác minh Swift: người upload không được tự xác minh (R-05 Segregation of Duties).",
        performed_by: userId,
      })
      return { ok: false, error: "sodViolation" }
    }
  }

  const dealId = existingDeal?.id ?? (await ensureDeal(admin, input.opportunityId, userId))
  if (!dealId) return { ok: false, error: "dealCreateFailed" }

  const patch: Record<string, unknown> = {
    swift_verified: input.verified,
    swift_verified_at: input.verified ? new Date().toISOString() : null,
    swift_verified_by: input.verified ? userId : null,
  }
  if (input.transactionReference !== undefined) {
    const ref = (input.transactionReference ?? "").trim()
    patch.transaction_reference = ref.length > 0 ? ref.slice(0, 120) : null
  }

  const { error } = await admin.from("deals").update(patch).eq("id", dealId)
  if (error) {
    console.error("[v0] verifySwiftAction update failed", error)
    // If our app-level SoD check somehow missed it, Postgres will still
    // reject via the deals_swift_sod_check constraint.
    const msg = (error.message ?? "").toLowerCase()
    if (msg.includes("deals_swift_sod_check")) {
      return { ok: false, error: "sodViolation" }
    }
    return { ok: false, error: "dbError" }
  }

  await admin.from("activities").insert({
    opportunity_id: input.opportunityId,
    action_type: input.verified ? "swift_verified" : "swift_unverified",
    description: input.verified
      ? "Admin xác minh Swift wire transfer đã hạch toán (dual-control)."
      : "Admin thu hồi xác minh Swift wire transfer.",
    performed_by: userId,
  })

  revalidatePath("/admin/pipeline")
  revalidatePath("/admin")
  return { ok: true }
}

// ---------------------------------------------------------------------------
// 3. Fetch the compliance/risk state for a given opportunity.
// ---------------------------------------------------------------------------
export interface OpportunityComplianceState {
  ok: boolean
  error?: ActionError
  risk?: RiskAssessment
  currentUserId?: string
  /**
   * `true` when the current admin is allowed to verify the Swift wire
   * themselves. `false` when they uploaded it (SoD rule — someone else
   * must verify). Undefined when there is no Swift doc yet.
   */
  canSelfVerifySwift?: boolean
  deal?: {
    id: string
    po_doc_url: string | null
    swift_doc_url: string | null
    bl_doc_url: string | null
    transaction_reference: string | null
    swift_verified: boolean
    swift_verified_at: string | null
    swift_verified_by: string | null
    swift_uploaded_by: string | null
    swift_uploaded_at: string | null
  }
  uploader?: {
    id: string
    full_name: string | null
    email: string | null
  } | null
  verifier?: {
    id: string
    full_name: string | null
    email: string | null
  } | null
  lead?: {
    country: string | null
    company_name: string | null
  }
}

export async function getOpportunityComplianceState(
  opportunityId: string,
): Promise<OpportunityComplianceState> {
  if (!opportunityId) return { ok: false, error: "invalidInput" }

  const guard = await requireCap(CAPS.DEAL_VIEW)
  if (!guard.ok) {
    return {
      ok: false,
      error: guard.error === "unauthenticated" ? "notAuthenticated" : "forbidden",
    }
  }
  const { admin, userId } = guard

  const { data: opp } = await admin
    .from("opportunities")
    .select("id, lead_id, leads:lead_id ( country, company_name )")
    .eq("id", opportunityId)
    .single()

  if (!opp) return { ok: false, error: "notFound" }

  const lead =
    (opp.leads as { country: string | null; company_name: string | null } | null) ?? null
  const risk = assessCountryRisk(lead?.country ?? null)

  const { data: deal } = await admin
    .from("deals")
    .select(
      "id, po_doc_url, swift_doc_url, bl_doc_url, transaction_reference, swift_verified, swift_verified_at, swift_verified_by, swift_uploaded_by, swift_uploaded_at",
    )
    .eq("opportunity_id", opportunityId)
    .maybeSingle()

  // Hydrate the uploader / verifier profiles so the UI can display "Uploaded
  // by: Alice · Verified by: Bob" for audit transparency.
  const profileIds = [deal?.swift_uploaded_by, deal?.swift_verified_by].filter(
    (id): id is string => typeof id === "string" && id.length > 0,
  )
  let profileMap = new Map<string, { id: string; full_name: string | null; email: string | null }>()
  if (profileIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", profileIds)
    profileMap = new Map(
      (profiles ?? []).map((p) => [
        p.id,
        { id: p.id, full_name: p.full_name ?? null, email: p.email ?? null },
      ]),
    )
  }

  const uploader =
    deal?.swift_uploaded_by ? profileMap.get(deal.swift_uploaded_by) ?? null : null
  const verifier =
    deal?.swift_verified_by ? profileMap.get(deal.swift_verified_by) ?? null : null

  const canSelfVerifySwift = deal?.swift_doc_url
    ? deal.swift_uploaded_by !== userId
    : undefined

  return {
    ok: true,
    risk,
    currentUserId: userId,
    canSelfVerifySwift,
    deal: deal
      ? {
          id: deal.id,
          po_doc_url: deal.po_doc_url ?? null,
          swift_doc_url: deal.swift_doc_url ?? null,
          bl_doc_url: deal.bl_doc_url ?? null,
          transaction_reference: deal.transaction_reference ?? null,
          swift_verified: Boolean(deal.swift_verified),
          swift_verified_at: deal.swift_verified_at ?? null,
          swift_verified_by: deal.swift_verified_by ?? null,
          swift_uploaded_by: deal.swift_uploaded_by ?? null,
          swift_uploaded_at: deal.swift_uploaded_at ?? null,
        }
      : undefined,
    uploader,
    verifier,
    lead: {
      country: lead?.country ?? null,
      company_name: lead?.company_name ?? null,
    },
  }
}
