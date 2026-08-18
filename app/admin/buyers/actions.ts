"use server"

import { revalidatePath } from "next/cache"
import { requireCap } from "@/lib/auth/guard"
import { CAPS } from "@/lib/auth/permissions"
import { rankClientsForBuyer } from "@/lib/matching/client-scorer"
import type {
  BuyerMatchInput,
  ClientProductInput,
  ClientTrustInput,
  ClientMatchResult,
} from "@/lib/matching/client-types"

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

  // 4) Create the opportunity with account_manager_id for ownership tracking
  const { data: opp, error: oppErr } = await admin
    .from("opportunities")
    .insert({
      client_id: input.clientId,
      lead_id: input.buyerId,
      stage: "new",
      potential_value: input.potentialValue,
      account_manager_id: userId,
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

// ---------------------------------------------------------------------------
// AI Match — suggest Top N clients for this buyer
// ---------------------------------------------------------------------------
//
// SEPARATE scoring system from lib/matching/scorer.ts (Buyer ↔ AE). This
// matches a buyer's product requirement against every active client
// product + a runtime-computed Trust Score, and returns a ranked list —
// never a single "best" client, and never auto-assigns anything.
//
// See lib/matching/client-scorer.ts and v0_plans/deep-method.md for the
// scoring design (Match Score 80% / Trust Score 20% of the final rank).
//
export async function getAIMatchedClients(
  buyerId: string,
): Promise<ActionResult<ClientMatchResult[]>> {
  const guard = await requireCap(CAPS.BUYER_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin } = guard

  // 1) Buyer requirement fields
  const { data: buyerRow, error: buyerErr } = await admin
    .from("leads")
    .select(
      `id, hs_code, main_product, secondary_hs_codes, main_import_countries,
       avg_teu_per_month, origin_ports, destination_ports, container_types,
       purchase_history, bol_description, priority_rating`,
    )
    .eq("id", buyerId)
    .single()
  if (buyerErr || !buyerRow) {
    return { ok: false, error: "buyer_not_found" }
  }
  const buyer: BuyerMatchInput = buyerRow

  // 2) Active products across all clients, joined with client identity
  const { data: rawProducts, error: productsErr } = await admin
    .from("client_products")
    .select(
      `id, client_id, product_name, category, subcategory, description, hs_code,
       key_specifications, country_of_origin, min_unit_price, max_unit_price,
       currency, monthly_capacity_units, moq_value, moq_unit, lead_time,
       incoterm, payment_terms, compliance_badges,
       profiles:client_id (
         id, company_name, full_name, phone, industries,
         is_verified, fda_registration_number, fda_expires_at
       )`,
    )
    .eq("status", "active")
  if (productsErr) {
    return { ok: false, error: productsErr.message }
  }

  const products: ClientProductInput[] = (rawProducts ?? []).map((p: any) => ({
    id: p.id,
    client_id: p.client_id,
    product_name: p.product_name,
    category: p.category,
    subcategory: p.subcategory,
    description: p.description,
    hs_code: p.hs_code,
    key_specifications: p.key_specifications,
    country_of_origin: p.country_of_origin,
    min_unit_price: p.min_unit_price,
    max_unit_price: p.max_unit_price,
    currency: p.currency,
    monthly_capacity_units: p.monthly_capacity_units,
    moq_value: p.moq_value,
    moq_unit: p.moq_unit,
    lead_time: p.lead_time,
    incoterm: p.incoterm,
    payment_terms: p.payment_terms,
    compliance_badges: p.compliance_badges ?? [],
  }))

  if (products.length === 0) {
    return { ok: true, data: [] }
  }

  const clientIds = Array.from(new Set(products.map((p) => p.client_id)))

  // 3) Factory assessment scores (take the most recently scored row per client)
  const { data: assessments } = await admin
    .from("client_factory_assessments")
    .select("client_id, score_total, scored_at")
    .in("client_id", clientIds)

  const factoryScoreByClient = new Map<string, number | null>()
  for (const a of assessments ?? []) {
    const existing = factoryScoreByClient.get(a.client_id)
    if (existing === undefined || (a.scored_at && a.score_total != null)) {
      factoryScoreByClient.set(a.client_id, a.score_total ?? existing ?? null)
    }
  }

  // 4) Transaction history — deals via opportunities.client_id
  const { data: opps } = await admin
    .from("opportunities")
    .select("id, client_id")
    .in("client_id", clientIds)

  const oppIdToClientId = new Map((opps ?? []).map((o) => [o.id, o.client_id]))
  const oppIds = Array.from(oppIdToClientId.keys())

  const dealsTotalByClient = new Map<string, number>()
  const dealsSwiftByClient = new Map<string, number>()
  if (oppIds.length > 0) {
    const { data: deals } = await admin
      .from("deals")
      .select("opportunity_id, swift_verified")
      .in("opportunity_id", oppIds)

    for (const d of deals ?? []) {
      const clientId = oppIdToClientId.get(d.opportunity_id)
      if (!clientId) continue
      dealsTotalByClient.set(clientId, (dealsTotalByClient.get(clientId) ?? 0) + 1)
      if (d.swift_verified) {
        dealsSwiftByClient.set(clientId, (dealsSwiftByClient.get(clientId) ?? 0) + 1)
      }
    }
  }

  // 5) Already-attached clients for THIS buyer — excluded from "eligible"
  //    (note: `opps` above is scoped to clientIds for transaction history,
  //    not to buyerId, so this needs its own buyer-scoped query).
  const { data: buyerOpps } = await admin
    .from("opportunities")
    .select("client_id")
    .eq("lead_id", buyerId)
  const attachedClientIds = new Set((buyerOpps ?? []).map((o) => o.client_id))

  // 6) Build trust inputs, one per client
  const trustByClientId = new Map<string, ClientTrustInput>()
  for (const p of rawProducts ?? []) {
    const profile = (p as any).profiles
    if (!profile || trustByClientId.has(p.client_id)) continue
    const hasCompanyProfile =
      !!profile.company_name?.trim() &&
      (!!profile.phone?.trim() || (profile.industries?.length ?? 0) > 0)
    trustByClientId.set(p.client_id, {
      client_id: p.client_id,
      company_name: profile.company_name,
      full_name: profile.full_name,
      is_verified: !!profile.is_verified,
      fda_registration_number: profile.fda_registration_number,
      fda_expires_at: profile.fda_expires_at,
      factoryScoreTotal: factoryScoreByClient.get(p.client_id) ?? null,
      dealsTotal: dealsTotalByClient.get(p.client_id) ?? 0,
      dealsSwiftVerified: dealsSwiftByClient.get(p.client_id) ?? 0,
      hasCompanyProfile,
    })
  }

  const results = rankClientsForBuyer(buyer, products, trustByClientId, attachedClientIds)

  return { ok: true, data: results }
}

// ---------------------------------------------------------------------------
// Delete buyer (a.k.a. `leads` row)
// ---------------------------------------------------------------------------
//
// Business rules:
//   - Must hold BUYER_WRITE capability.
//   - If the buyer has any opportunities, return an error (no orphaned
//     opportunities). User must manually clean up first.
//
export async function deleteBuyer(buyerId: string): Promise<ActionResult<void>> {
  const guard = await requireCap(CAPS.BUYER_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin } = guard

  // 1) Check if buyer exists
  const { data: buyer, error: buyerErr } = await admin
    .from("leads")
    .select("id")
    .eq("id", buyerId)
    .single()
  if (buyerErr || !buyer) {
    return { ok: false, error: "buyer_not_found" }
  }

  // 2) Check if buyer has any opportunities
  const { data: opps } = await admin
    .from("opportunities")
    .select("id")
    .eq("lead_id", buyerId)
    .limit(1)
  if (opps && opps.length > 0) {
    return { ok: false, error: "buyer_has_opportunities" }
  }

  // 3) Delete the buyer
  const { error: delErr } = await admin
    .from("leads")
    .delete()
    .eq("id", buyerId)
  if (delErr) {
    return { ok: false, error: delErr.message }
  }

  revalidatePath("/admin/buyers")
  return { ok: true, data: undefined }
}
