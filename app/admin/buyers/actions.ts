"use server"

import { revalidatePath } from "next/cache"
import { requireCap } from "@/lib/auth/guard"
import { CAPS } from "@/lib/auth/permissions"

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export interface UpdateBuyerInput {
  id: string
  company_name: string
  contact_person: string | null
  contact_email: string | null
  contact_phone: string | null
  website: string | null
  linkedin_url: string | null
  country: string | null
  industry: string | null
  notes: string | null
}

export interface AssignBuyerToClientInput {
  buyerId: string
  clientId: string
  potentialValue: number | null
}

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string }

// ---------------------------------------------------------------------------
// Update buyer (a.k.a. `leads` row)
// ---------------------------------------------------------------------------

export async function updateBuyer(
  input: UpdateBuyerInput,
): Promise<ActionResult<{ id: string }>> {
  const guard = await requireCap(CAPS.BUYER_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin } = guard

  const companyName = input.company_name.trim()
  if (!companyName) {
    return { ok: false, error: "company_name_required" }
  }

  const { error } = await admin
    .from("leads")
    .update({
      company_name: companyName,
      contact_person: input.contact_person?.trim() || null,
      contact_email: input.contact_email?.trim() || null,
      contact_phone: input.contact_phone?.trim() || null,
      website: input.website?.trim() || null,
      linkedin_url: input.linkedin_url?.trim() || null,
      country: input.country?.trim() || null,
      industry: input.industry?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .eq("id", input.id)

  if (error) return { ok: false, error: error.message }

  revalidatePath("/admin/buyers")
  revalidatePath(`/admin/buyers/${input.id}`)
  return { ok: true, data: { id: input.id } }
}

// ---------------------------------------------------------------------------
// Assign an existing buyer to a Vietnamese client
// ---------------------------------------------------------------------------
//
// Business rules:
//   - Must hold BUYER_WRITE (same cap that creates new buyers).
//   - Client must exist and have a VALID FDA registration (R-02). An
//     expired or missing FDA surfaces as an "override" in smart-lead-form.tsx
//     and is still enforced defensively by the DB trigger in migration 013.
//   - An opportunity must not already exist for (client_id, buyer_id).
//     If it does, return the existing opportunity id so the UI can jump
//     the user to the sheet instead of creating a duplicate.
//
// Side effects:
//   - Writes 1 row into `opportunities` (stage = "new").
//   - Logs 1 row into `activities` for audit trail.
//
export async function assignBuyerToClient(
  input: AssignBuyerToClientInput,
): Promise<ActionResult<{ opportunityId: string; alreadyExisted: boolean }>> {
  const guard = await requireCap(CAPS.BUYER_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin, userId } = guard

  // 1) Load buyer
  const { data: buyer, error: buyerErr } = await admin
    .from("leads")
    .select("id, company_name")
    .eq("id", input.buyerId)
    .single()
  if (buyerErr || !buyer) {
    return { ok: false, error: "buyer_not_found" }
  }

  // 2) Load client + FDA status
  const { data: client, error: clientErr } = await admin
    .from("profiles")
    .select("id, role, full_name, company_name, fda_registration_number, fda_expires_at")
    .eq("id", input.clientId)
    .single()
  if (clientErr || !client) {
    return { ok: false, error: "client_not_found" }
  }
  if (client.role !== "client") {
    return { ok: false, error: "not_a_client" }
  }
  if (!client.fda_registration_number || !client.fda_registration_number.trim()) {
    return { ok: false, error: "fda_missing" }
  }
  if (client.fda_expires_at) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (new Date(client.fda_expires_at) < today) {
      return { ok: false, error: "fda_expired" }
    }
  }

  // 3) Short-circuit if an opportunity already exists — avoids UNIQUE
  //    constraint violation and gives the UI a jump target.
  const { data: existing } = await admin
    .from("opportunities")
    .select("id")
    .eq("client_id", input.clientId)
    .eq("lead_id", input.buyerId)
    .maybeSingle()
  if (existing?.id) {
    return { ok: true, data: { opportunityId: existing.id, alreadyExisted: true } }
  }

  // 4) Create the opportunity
  const { data: opp, error: oppErr } = await admin
    .from("opportunities")
    .insert({
      client_id: input.clientId,
      lead_id: input.buyerId,
      stage: "new",
      potential_value: input.potentialValue,
    })
    .select("id")
    .single()
  if (oppErr || !opp) {
    return { ok: false, error: oppErr?.message ?? "insert_failed" }
  }

  // 5) Audit trail — best-effort
  const clientLabel = client.company_name ?? client.full_name ?? "client"
  await admin.from("activities").insert({
    opportunity_id: opp.id,
    action_type: "opportunity_created",
    description: `${buyer.company_name} → ${clientLabel}`,
    performed_by: userId,
  })

  revalidatePath("/admin/buyers")
  revalidatePath(`/admin/buyers/${input.buyerId}`)
  revalidatePath("/admin/pipeline")

  return { ok: true, data: { opportunityId: opp.id, alreadyExisted: false } }
}
