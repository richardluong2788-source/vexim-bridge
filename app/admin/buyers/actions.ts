"use server"

import { revalidatePath } from "next/cache"
import { requireCap } from "@/lib/auth/guard"
import { CAPS } from "@/lib/auth/permissions"
import { createAdminClient } from "@/lib/supabase/admin"
import { rankClientsForBuyer } from "@/lib/matching/client-scorer"
import type {
  BuyerMatchInput,
  ClientProductInput,
  ClientTrustInput,
  ClientMatchResult,
} from "@/lib/matching/client-types"
import { MAX_BULK_ASSIGN_CLIENTS, MAX_ACTIVE_BUYERS_PER_CLIENT } from "@/lib/buyers/constants"

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

export interface AssignBuyerToClientsInput {
  buyerId: string
  clientIds: string[]
  potentialValue: number | null
}

export interface AssignBuyerToClientsResultItem {
  clientId: string
  clientName: string | null
  ok: boolean
  opportunityId?: string
  alreadyExisted?: boolean
  error?: string
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

  const result = await assignOneClient(admin, userId, buyer, input.clientId, input.potentialValue)
  if (!result.ok) return { ok: false, error: result.error ?? "insert_failed" }

  revalidatePath("/admin/buyers")
  revalidatePath(`/admin/buyers/${input.buyerId}`)
  revalidatePath("/admin/pipeline")

  return {
    ok: true,
    data: { opportunityId: result.opportunityId!, alreadyExisted: !!result.alreadyExisted },
  }
}

// ---------------------------------------------------------------------------
// Shared single-client assignment logic (used by both the single and bulk
// assign actions). Does NOT revalidate paths or check the write capability —
// callers are responsible for both, so the bulk action only pays those
// costs once instead of once per client.
// ---------------------------------------------------------------------------
async function assignOneClient(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  buyer: { id: string; company_name: string | null },
  clientId: string,
  potentialValue: number | null,
): Promise<AssignBuyerToClientsResultItem> {
  // 1) Load client + FDA status
  const { data: client, error: clientErr } = await admin
    .from("profiles")
    .select("id, role, full_name, company_name, fda_registration_number, fda_expires_at")
    .eq("id", clientId)
    .single()
  if (clientErr || !client) {
    return { clientId, clientName: null, ok: false, error: "client_not_found" }
  }
  const clientLabel = client.company_name ?? client.full_name ?? null
  if (client.role !== "client") {
    return { clientId, clientName: clientLabel, ok: false, error: "not_a_client" }
  }
  if (!client.fda_registration_number || !client.fda_registration_number.trim()) {
    return { clientId, clientName: clientLabel, ok: false, error: "fda_missing" }
  }
  if (client.fda_expires_at) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (new Date(client.fda_expires_at) < today) {
      return { clientId, clientName: clientLabel, ok: false, error: "fda_expired" }
    }
  }

  // 2) Short-circuit if an opportunity already exists — avoids UNIQUE
  //    constraint violation and gives the UI a jump target.
  const { data: existing } = await admin
    .from("opportunities")
    .select("id")
    .eq("client_id", clientId)
    .eq("lead_id", buyer.id)
    .maybeSingle()
  if (existing?.id) {
    return {
      clientId,
      clientName: clientLabel,
      ok: true,
      opportunityId: existing.id,
      alreadyExisted: true,
    }
  }

  // 2b) Enforce the per-client active-buyer cap. "Active" = anything not
  // yet won/lost. Once a client has MAX_ACTIVE_BUYERS_PER_CLIENT open
  // opportunities, no new buyer can be assigned until one of them closes
  // out (won or lost) — this is what keeps a single client's column from
  // growing without bound as the buyer base scales into the hundreds.
  const { count: activeCount, error: activeCountErr } = await admin
    .from("opportunities")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .not("stage", "in", "(won,lost)")
  if (activeCountErr) {
    return { clientId, clientName: clientLabel, ok: false, error: activeCountErr.message }
  }
  if ((activeCount ?? 0) >= MAX_ACTIVE_BUYERS_PER_CLIENT) {
    return { clientId, clientName: clientLabel, ok: false, error: "client_at_capacity" }
  }

  // 3) Create the opportunity with account_manager_id for ownership tracking
  const { data: opp, error: oppErr } = await admin
    .from("opportunities")
    .insert({
      client_id: clientId,
      lead_id: buyer.id,
      stage: "new",
      potential_value: potentialValue,
      account_manager_id: userId,
    })
    .select("id")
    .single()
  if (oppErr || !opp) {
    return { clientId, clientName: clientLabel, ok: false, error: oppErr?.message ?? "insert_failed" }
  }

  // 4) Audit trail — best-effort
  await admin.from("activities").insert({
    opportunity_id: opp.id,
    action_type: "opportunity_created",
    description: `${buyer.company_name} → ${clientLabel ?? "client"}`,
    performed_by: userId,
  })

  return {
    clientId,
    clientName: clientLabel,
    ok: true,
    opportunityId: opp.id,
    alreadyExisted: false,
  }
}

// ---------------------------------------------------------------------------
// Assign an existing buyer to MULTIPLE Vietnamese clients at once
// ---------------------------------------------------------------------------
//
// Lets an AE select several AI-matched suppliers (up to MAX_BULK_ASSIGN_CLIENTS)
// for the same buyer in one action, since in practice a buyer often wants to
// evaluate a handful of suppliers before narrowing down to one. Each client
// is validated and inserted independently — one ineligible/failed client does
// not block the others, and the caller gets a per-client result so the UI can
// report a clear success/failure summary.
//
export async function assignBuyerToClients(
  input: AssignBuyerToClientsInput,
): Promise<ActionResult<{ items: AssignBuyerToClientsResultItem[] }>> {
  const guard = await requireCap(CAPS.BUYER_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin, userId } = guard

  const clientIds = Array.from(new Set(input.clientIds)).filter(Boolean)
  if (clientIds.length === 0) {
    return { ok: false, error: "no_clients_selected" }
  }
  if (clientIds.length > MAX_BULK_ASSIGN_CLIENTS) {
    return { ok: false, error: "too_many_clients" }
  }

  // Load buyer once
  const { data: buyer, error: buyerErr } = await admin
    .from("leads")
    .select("id, company_name")
    .eq("id", input.buyerId)
    .single()
  if (buyerErr || !buyer) {
    return { ok: false, error: "buyer_not_found" }
  }

  const items: AssignBuyerToClientsResultItem[] = []
  for (const clientId of clientIds) {
    const item = await assignOneClient(admin, userId, buyer, clientId, input.potentialValue)
    items.push(item)
  }

  revalidatePath("/admin/buyers")
  revalidatePath(`/admin/buyers/${input.buyerId}`)
  revalidatePath("/admin/pipeline")

  return { ok: true, data: { items } }
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
