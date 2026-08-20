"use server"

/**
 * Buyer Engagement Pipeline — Server Actions
 *
 * Implements the pre-opportunity workflow requested by the business:
 *   AE claims buyer -> AE asks buyer for requirements -> AE records what
 *   the buyer said -> AI shortlists 3-5 suppliers -> AE shares the
 *   shortlist with the buyer (tokenized public link) -> buyer opens the
 *   link and reacts -> AE picks the final client(s) and converts the
 *   engagement into a real opportunity (Kanban pipeline).
 *
 * See scripts/051_buyer_engagement_pipeline.sql for the schema.
 */

import { revalidatePath } from "next/cache"
import { requireCap } from "@/lib/auth/guard"
import { CAPS } from "@/lib/auth/permissions"
import { assignBuyerToClients } from "@/app/admin/buyers/actions"
import { getAIMatchedClients } from "@/app/admin/buyers/actions"

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string }

// ---------------------------------------------------------------------------
// Claim a buyer from the AI inbox — creates the pre-opportunity workspace
// WITHOUT requiring a client to be picked yet.
// ---------------------------------------------------------------------------

export async function claimBuyer(
  inboxItemId: string,
): Promise<ActionResult<{ engagementId: string }>> {
  const guard = await requireCap(CAPS.BUYER_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin, userId, role } = guard

  const { data: inbox, error: inboxErr } = await admin
    .from("ae_match_inbox")
    .select("id, lead_id, account_manager_id, status")
    .eq("id", inboxItemId)
    .single()
  if (inboxErr || !inbox) return { ok: false, error: "inbox_item_not_found" }

  if (role === "account_executive" && inbox.account_manager_id !== userId) {
    return { ok: false, error: "not_your_inbox_item" }
  }
  if (inbox.status !== "pending") {
    return { ok: false, error: "inbox_item_already_processed" }
  }

  // Reject if another engagement is already active for this buyer.
  const { data: existing } = await admin
    .from("buyer_engagements")
    .select("id")
    .eq("lead_id", inbox.lead_id)
    .not("stage", "in", "(converted,dropped)")
    .maybeSingle()
  if (existing?.id) {
    return { ok: true, data: { engagementId: existing.id } }
  }

  const { data: engagement, error: insertErr } = await admin
    .from("buyer_engagements")
    .insert({
      lead_id: inbox.lead_id,
      account_manager_id: inbox.account_manager_id,
      inbox_item_id: inbox.id,
      stage: "claimed",
      created_by: userId,
    })
    .select("id")
    .single()
  if (insertErr || !engagement) {
    return { ok: false, error: insertErr?.message ?? "claim_failed" }
  }

  revalidatePath("/admin/ae-inbox")
  return { ok: true, data: { engagementId: engagement.id } }
}

// ---------------------------------------------------------------------------
// Save the buyer's stated requirements (recorded by the AE)
// ---------------------------------------------------------------------------

export interface SaveRequirementsInput {
  engagementId: string
  requestedProducts?: string
  targetPriceRange?: string
  moq?: string
  paymentTerms?: string
  packagingRequirements?: string
  otherRequirements?: string
}

export async function saveBuyerRequirements(
  input: SaveRequirementsInput,
): Promise<ActionResult<{ success: true }>> {
  const guard = await requireCap(CAPS.BUYER_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin } = guard

  const { error } = await admin
    .from("buyer_engagements")
    .update({
      requested_products: input.requestedProducts?.trim() || null,
      target_price_range: input.targetPriceRange?.trim() || null,
      moq: input.moq?.trim() || null,
      payment_terms: input.paymentTerms?.trim() || null,
      packaging_requirements: input.packagingRequirements?.trim() || null,
      other_requirements: input.otherRequirements?.trim() || null,
      stage: "requirements_received",
    })
    .eq("id", input.engagementId)

  if (error) return { ok: false, error: error.message }

  revalidatePath("/admin/ae-inbox")
  return { ok: true, data: { success: true } }
}

// ---------------------------------------------------------------------------
// Mark that the requirement-inquiry email was sent (called after the AE
// sends the AI-drafted email via the shared email_drafts pipeline).
// ---------------------------------------------------------------------------

export async function markRequirementEmailSent(
  engagementId: string,
): Promise<ActionResult<{ success: true }>> {
  const guard = await requireCap(CAPS.BUYER_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin } = guard

  const { error } = await admin
    .from("buyer_engagements")
    .update({ stage: "requirement_email_sent" })
    .eq("id", engagementId)
    .eq("stage", "claimed")

  if (error) return { ok: false, error: error.message }
  revalidatePath("/admin/ae-inbox")
  return { ok: true, data: { success: true } }
}

// ---------------------------------------------------------------------------
// Build the AI shortlist (reuses the existing buyer<->client scoring
// engine) and persist the top N as buyer_engagement_shortlist rows.
// ---------------------------------------------------------------------------

export async function buildShortlist(
  engagementId: string,
  clientIds: string[],
): Promise<ActionResult<{ success: true }>> {
  const guard = await requireCap(CAPS.BUYER_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin } = guard

  if (clientIds.length < 1 || clientIds.length > 5) {
    return { ok: false, error: "shortlist_must_have_1_to_5_clients" }
  }

  const { data: engagement, error: engErr } = await admin
    .from("buyer_engagements")
    .select("id, lead_id")
    .eq("id", engagementId)
    .single()
  if (engErr || !engagement) return { ok: false, error: "engagement_not_found" }

  const matchResult = await getAIMatchedClients(engagement.lead_id)
  const scoreByClient = new Map<string, { score: number; reasoning: string }>()
  if (matchResult.ok) {
    for (const m of matchResult.data) {
      const reasoning = [
        ...m.matchBreakdown.map((f) => `${f.factor}${f.details ? `: ${f.details}` : ""}`),
        m.trustLabel === "verified" ? "Đã xác minh (verified supplier)" : null,
      ]
        .filter(Boolean)
        .join(" · ")
      scoreByClient.set(m.clientId, {
        score: m.finalScore ?? 0,
        reasoning,
      })
    }
  }

  // Clear any prior shortlist for this engagement, then insert fresh rows.
  await admin.from("buyer_engagement_shortlist").delete().eq("engagement_id", engagementId)

  const rows = clientIds.map((clientId, idx) => ({
    engagement_id: engagementId,
    client_id: clientId,
    position: idx,
    match_score: scoreByClient.get(clientId)?.score ?? null,
    ai_reasoning: scoreByClient.get(clientId)?.reasoning ?? null,
  }))

  const { error: insertErr } = await admin.from("buyer_engagement_shortlist").insert(rows)
  if (insertErr) return { ok: false, error: insertErr.message }

  await admin
    .from("buyer_engagements")
    .update({ stage: "shortlist_ready" })
    .eq("id", engagementId)

  revalidatePath("/admin/ae-inbox")
  return { ok: true, data: { success: true } }
}

// ---------------------------------------------------------------------------
// Mint (or reuse) the public tokenized link for a shortlist and mark the
// engagement as "shortlist_sent".
// ---------------------------------------------------------------------------

export async function createShortlistLink(
  engagementId: string,
): Promise<ActionResult<{ token: string; url: string }>> {
  const guard = await requireCap(CAPS.BUYER_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin, userId } = guard

  const { data: shortlistRows } = await admin
    .from("buyer_engagement_shortlist")
    .select("id")
    .eq("engagement_id", engagementId)
  if (!shortlistRows || shortlistRows.length === 0) {
    return { ok: false, error: "shortlist_empty" }
  }

  const { data: existing } = await admin
    .from("shortlist_share_links")
    .select("token, revoked_at")
    .eq("engagement_id", engagementId)
    .maybeSingle()

  let token = existing?.token as string | undefined
  if (!token || existing?.revoked_at) {
    if (existing?.token) {
      await admin
        .from("shortlist_share_links")
        .delete()
        .eq("engagement_id", engagementId)
    }
    const { data: link, error: linkErr } = await admin
      .from("shortlist_share_links")
      .insert({ engagement_id: engagementId, created_by: userId })
      .select("token")
      .single()
    if (linkErr || !link) return { ok: false, error: linkErr?.message ?? "link_failed" }
    token = link.token
  }

  await admin
    .from("buyer_engagements")
    .update({ stage: "shortlist_sent" })
    .eq("id", engagementId)

  const base = process.env.NEXT_PUBLIC_APP_URL ?? ""
  revalidatePath("/admin/ae-inbox")
  return { ok: true, data: { token: token!, url: `${base}/shortlist/${token}` } }
}

// ---------------------------------------------------------------------------
// Convert the engagement into real opportunity(ies) — the point at which
// the buyer finally lands on the client Kanban pipeline.
// ---------------------------------------------------------------------------

export async function convertEngagementToClients(
  engagementId: string,
  clientIds: string[],
  potentialValue: number | null = null,
): Promise<ActionResult<{ opportunityIds: string[] }>> {
  const guard = await requireCap(CAPS.BUYER_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin } = guard

  const { data: engagement, error: engErr } = await admin
    .from("buyer_engagements")
    .select("id, lead_id")
    .eq("id", engagementId)
    .single()
  if (engErr || !engagement) return { ok: false, error: "engagement_not_found" }

  const result = await assignBuyerToClients({
    buyerId: engagement.lead_id,
    clientIds,
    potentialValue,
  })
  if (!result.ok) return { ok: false, error: result.error }

  const opportunityIds = result.data.items
    .filter((i) => i.ok && i.opportunityId)
    .map((i) => i.opportunityId as string)

  if (opportunityIds.length === 0) {
    return { ok: false, error: "no_opportunity_created" }
  }

  await admin
    .from("buyer_engagements")
    .update({ stage: "converted", converted_at: new Date().toISOString() })
    .eq("id", engagementId)

  revalidatePath("/admin/ae-inbox")
  revalidatePath("/admin/pipeline")
  return { ok: true, data: { opportunityIds } }
}

// ---------------------------------------------------------------------------
// Drop an engagement (AE gives up on this buyer before conversion).
// ---------------------------------------------------------------------------

export async function dropEngagement(
  engagementId: string,
  reason?: string,
): Promise<ActionResult<{ success: true }>> {
  const guard = await requireCap(CAPS.BUYER_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin } = guard

  const { error } = await admin
    .from("buyer_engagements")
    .update({ stage: "dropped", dropped_reason: reason?.trim() || null })
    .eq("id", engagementId)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/admin/ae-inbox")
  return { ok: true, data: { success: true } }
}

// ---------------------------------------------------------------------------
// Fetch engagements owned by the current AE (or all, for admins) — used to
// render the "Đang xử lý" section on the AE Inbox page.
// ---------------------------------------------------------------------------

export async function getMyEngagements(): Promise<ActionResult<any[]>> {
  const guard = await requireCap(CAPS.MATCH_INBOX_VIEW)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin, userId, role } = guard

  let query = admin
    .from("buyer_engagements")
    .select(
      `
      id, lead_id, account_manager_id, stage,
      requested_products, target_price_range, moq, payment_terms,
      packaging_requirements, other_requirements,
      created_at, updated_at,
      leads ( id, company_name, contact_person, contact_email, country, industry, main_product ),
      buyer_engagement_shortlist ( id, client_id, position, match_score, buyer_interested, buyer_responded_at,
        profiles:client_id ( id, company_name, full_name ) ),
      shortlist_share_links ( token, view_count, last_viewed_at, revoked_at )
      `,
    )
    .not("stage", "in", "(converted,dropped)")
    .order("updated_at", { ascending: false })

  if (role === "account_executive") {
    query = query.eq("account_manager_id", userId)
  }

  const { data, error } = await query
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data ?? [] }
}
