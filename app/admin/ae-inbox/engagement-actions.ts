"use server"

/**
 * Buyer Engagement Pipeline — Server Actions
 *
 * Implements the pre-opportunity workflow requested by the business:
 *   AE claims buyer -> AE asks buyer for requirements -> AE records what
 *   the buyer said -> AI shortlists 3-5 suppliers (as an immutable,
 *   versioned snapshot) -> AE approves & shares the shortlist with the
 *   buyer (tokenized public link) -> buyer opens the link and reacts ->
 *   AE logs a qualifying buyer action -> AE converts to one opportunity
 *   PER chosen supplier, each tagged with its role (primary/backup/
 *   alternative) and traced back to this engagement.
 *
 * See scripts/051_buyer_engagement_pipeline.sql and
 * scripts/052_shortlist_snapshots_and_actions.sql for the schema.
 *
 * Immutability rule: once a `buyer_engagement_shortlist_versions` row is
 * `status = 'sent'`, neither it nor its `buyer_engagement_shortlist_items`
 * rows may be updated in place — a supplier profile edit or a scoring
 * engine upgrade must NEVER change what a buyer already received. Any
 * change after sending goes through `createNewShortlistVersion`, which
 * supersedes the old version and builds a brand new snapshot.
 */

import { revalidatePath } from "next/cache"
import { requireCap } from "@/lib/auth/guard"
import { CAPS } from "@/lib/auth/permissions"
import { assignBuyerToClients } from "@/app/admin/buyers/actions"
import { getAIMatchedClients } from "@/app/admin/buyers/actions"
import { SCORING_ENGINE_VERSION } from "@/lib/matching/client-types"

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
// Build a DRAFT shortlist version (reuses the existing buyer<->client
// scoring engine) and freeze everything needed to reproduce exactly what
// the AE is about to review: scores, factor breakdown, reasoning,
// remaining risks, which buyer fields were used, the scoring engine
// version, and each supplier's profile as it exists RIGHT NOW.
//
// This does NOT send anything to the buyer and does NOT touch any
// previously-sent version — it only ever creates a new row. Call
// `approveAndSendShortlist` to lock it in and mint the public link.
// ---------------------------------------------------------------------------

export async function buildShortlist(
  engagementId: string,
  clientIds: string[],
): Promise<ActionResult<{ versionId: string; versionNumber: number }>> {
  const guard = await requireCap(CAPS.BUYER_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin, userId } = guard

  if (clientIds.length < 1 || clientIds.length > 5) {
    return { ok: false, error: "shortlist_must_have_1_to_5_clients" }
  }

  const { data: engagement, error: engErr } = await admin
    .from("buyer_engagements")
    .select(
      "id, lead_id, requested_products, target_price_range, moq, payment_terms, packaging_requirements, other_requirements",
    )
    .eq("id", engagementId)
    .single()
  if (engErr || !engagement) return { ok: false, error: "engagement_not_found" }

  // 1) Score every candidate with the live engine — this run's output is
  //    about to be frozen into the snapshot, so from this point on nothing
  //    downstream re-reads scoring.ts for THIS version again.
  const matchResult = await getAIMatchedClients(engagement.lead_id)
  const matchByClient = new Map<string, any>()
  if (matchResult.ok) {
    for (const m of matchResult.data) matchByClient.set(m.clientId, m)
  }

  // 2) Freeze each chosen supplier's public profile as it exists right now
  //    (name/tagline/USPs/MOQ/lead time + updated_at as the profile
  //    version marker) so a later edit can't retroactively change what
  //    this version says the buyer saw.
  const [{ data: profileRows }, { data: clientProfileRows }] = await Promise.all([
    admin.from("profiles").select("id, company_name, full_name").in("id", clientIds),
    admin
      .from("client_profiles")
      .select(
        "client_id, slug, display_name, tagline, logo_url, cover_image_url, moq, lead_time_days, production_capacity, usp_points, updated_at",
      )
      .in("client_id", clientIds),
  ])
  const profileById = new Map((profileRows ?? []).map((p) => [p.id as string, p]))
  const clientProfileByClientId = new Map((clientProfileRows ?? []).map((cp) => [cp.client_id as string, cp]))

  // 3) Next version number for this engagement (1, 2, 3, ...).
  const { data: lastVersion } = await admin
    .from("buyer_engagement_shortlist_versions")
    .select("version_number")
    .eq("engagement_id", engagementId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle()
  const versionNumber = (lastVersion?.version_number ?? 0) + 1

  const requirementsSnapshot = {
    requested_products: engagement.requested_products,
    target_price_range: engagement.target_price_range,
    moq: engagement.moq,
    payment_terms: engagement.payment_terms,
    packaging_requirements: engagement.packaging_requirements,
    other_requirements: engagement.other_requirements,
  }

  const { data: version, error: versionErr } = await admin
    .from("buyer_engagement_shortlist_versions")
    .insert({
      engagement_id: engagementId,
      version_number: versionNumber,
      status: "draft",
      requirements_snapshot: requirementsSnapshot,
      scoring_engine_version: SCORING_ENGINE_VERSION,
      created_by: userId,
    })
    .select("id")
    .single()
  if (versionErr || !version) return { ok: false, error: versionErr?.message ?? "version_create_failed" }

  const items = clientIds.map((clientId, idx) => {
    const match = matchByClient.get(clientId)
    const cp = clientProfileByClientId.get(clientId) as any
    const p = profileById.get(clientId) as any

    const dataFieldsUsed = [
      "hs_code",
      "main_product",
      "secondary_hs_codes",
      "main_import_countries",
      "avg_teu_per_month",
      "country_of_origin",
      "compliance_badges",
      "trust_label",
      ...(engagement.requested_products ? ["requested_products"] : []),
      ...(engagement.target_price_range ? ["target_price_range"] : []),
      ...(engagement.moq ? ["moq"] : []),
    ]

    const remainingRisks = match
      ? [
          match.eligible ? null : `Không đủ ��iều kiện: ${match.ineligibleReason}`,
          match.trustLabel === "new_supplier" ? "Supplier chưa được xác minh hoặc đánh giá nhà máy" : null,
          ...match.commercialFlags
            .filter((f: any) => f.level === "unknown" || f.level === "red")
            .map((f: any) => f.note as string),
        ]
          .filter(Boolean)
          .join(" · ") || null
      : "Không có dữ liệu chấm điểm — chọn thủ công bởi AE"

    const reasoning = match
      ? [
          ...match.matchBreakdown.map((f: any) => `${f.factor}${f.details ? `: ${f.details}` : ""}`),
          match.trustLabel === "verified" ? "Đã xác minh (verified supplier)" : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : "Chọn thủ công, chưa qua chấm điểm AI"

    return {
      version_id: version.id,
      client_id: clientId,
      position: idx,
      match_score: match?.finalScore ?? 0,
      match_factors: match?.matchBreakdown ?? [],
      match_reasoning: reasoning,
      remaining_risks: remainingRisks,
      data_fields_used: dataFieldsUsed,
      supplier_profile_snapshot: {
        display_name: cp?.display_name ?? p?.company_name ?? p?.full_name ?? null,
        slug: cp?.slug ?? null,
        tagline: cp?.tagline ?? null,
        logo_url: cp?.logo_url ?? null,
        cover_image_url: cp?.cover_image_url ?? null,
        moq: cp?.moq ?? null,
        lead_time_days: cp?.lead_time_days ?? null,
        production_capacity: cp?.production_capacity ?? null,
        usp_points: cp?.usp_points ?? [],
        company_name: p?.company_name ?? null,
        full_name: p?.full_name ?? null,
      },
      supplier_profile_version: cp?.updated_at ?? null,
    }
  })

  const { error: itemsErr } = await admin.from("buyer_engagement_shortlist_items").insert(items)
  if (itemsErr) {
    await admin.from("buyer_engagement_shortlist_versions").delete().eq("id", version.id)
    return { ok: false, error: itemsErr.message }
  }

  await admin
    .from("buyer_engagements")
    .update({ stage: "shortlist_ready" })
    .eq("id", engagementId)

  revalidatePath("/admin/ae-inbox")
  return { ok: true, data: { versionId: version.id, versionNumber } }
}

// ---------------------------------------------------------------------------
// Approve a draft version and mint (or reuse) its public tokenized link.
// From this point on, the version and its items are IMMUTABLE — this
// function is the only writer that ever flips a version to 'sent', and
// nothing else may update its rows afterward.
// ---------------------------------------------------------------------------

export async function approveAndSendShortlist(
  versionId: string,
): Promise<ActionResult<{ token: string; url: string }>> {
  const guard = await requireCap(CAPS.BUYER_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin, userId } = guard

  const { data: version, error: versionErr } = await admin
    .from("buyer_engagement_shortlist_versions")
    .select("id, engagement_id, status")
    .eq("id", versionId)
    .single()
  if (versionErr || !version) return { ok: false, error: "version_not_found" }
  if (version.status !== "draft") return { ok: false, error: "version_not_a_draft" }

  const { count: itemCount } = await admin
    .from("buyer_engagement_shortlist_items")
    .select("id", { count: "exact", head: true })
    .eq("version_id", versionId)
  if (!itemCount) return { ok: false, error: "shortlist_empty" }

  const now = new Date().toISOString()

  // Supersede any previously-sent version for this engagement — audit
  // trail only, its rows are left untouched.
  await admin
    .from("buyer_engagement_shortlist_versions")
    .update({ status: "superseded", superseded_at: now })
    .eq("engagement_id", version.engagement_id)
    .eq("status", "sent")

  const { error: approveErr } = await admin
    .from("buyer_engagement_shortlist_versions")
    .update({ status: "sent", approved_by: userId, approved_at: now, sent_at: now })
    .eq("id", versionId)
  if (approveErr) return { ok: false, error: approveErr.message }

  const { data: link, error: linkErr } = await admin
    .from("shortlist_share_links")
    .insert({ engagement_id: version.engagement_id, version_id: versionId, created_by: userId })
    .select("token")
    .single()
  if (linkErr || !link) return { ok: false, error: linkErr?.message ?? "link_failed" }

  await admin
    .from("buyer_engagements")
    .update({ stage: "shortlist_sent" })
    .eq("id", version.engagement_id)

  const base = process.env.NEXT_PUBLIC_APP_URL ?? ""
  revalidatePath("/admin/ae-inbox")
  return { ok: true, data: { token: link.token, url: `${base}/shortlist/${link.token}` } }
}

// ---------------------------------------------------------------------------
// Create a brand-new shortlist version for an engagement that already has
// a SENT version. The old version and its items are left completely
// untouched (audit trail) — this always builds fresh from current data
// and returns a new draft, which still requires approveAndSendShortlist
// before it reaches the buyer.
// ---------------------------------------------------------------------------

export async function createNewShortlistVersion(
  engagementId: string,
  clientIds: string[],
): Promise<ActionResult<{ versionId: string; versionNumber: number }>> {
  return buildShortlist(engagementId, clientIds)
}

// ---------------------------------------------------------------------------
// Record the buyer's reaction to a specific supplier on a specific
// shortlist version. This is advisory only — it never converts anything
// by itself, it just gives the AE a qualifying signal to decide with. Also
// bumps the engagement to 'qualified_interest' so it surfaces as "buyer is
// engaged, needs an AE decision" in the inbox.
// ---------------------------------------------------------------------------

export type BuyerActionValue =
  | "viewed_only"
  | "interested_no_details"
  | "requested_info"
  | "requested_sample"
  | "requested_meeting"
  | "selected_primary"
  | "sent_price_volume"
  | "sent_po"

export async function markBuyerAction(
  itemId: string,
  action: BuyerActionValue,
): Promise<ActionResult<{ success: true }>> {
  const guard = await requireCap(CAPS.BUYER_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin } = guard

  const { data: item, error: itemErr } = await admin
    .from("buyer_engagement_shortlist_items")
    .select("id, version_id, buyer_engagement_shortlist_versions ( engagement_id )")
    .eq("id", itemId)
    .single()
  if (itemErr || !item) return { ok: false, error: "shortlist_item_not_found" }

  const engagementId = (item as any).buyer_engagement_shortlist_versions?.engagement_id as string | undefined
  if (!engagementId) return { ok: false, error: "engagement_not_found" }

  // buyer_interested/buyer_action/buyer_responded_at are the ONLY mutable
  // fields on an item — everything else (score, factors, snapshot) stays
  // frozen even after the parent version is sent.
  const { error } = await admin
    .from("buyer_engagement_shortlist_items")
    .update({
      buyer_action: action,
      buyer_interested: action !== "viewed_only",
      buyer_responded_at: new Date().toISOString(),
    })
    .eq("id", itemId)
  if (error) return { ok: false, error: error.message }

  await admin
    .from("buyer_engagements")
    .update({ stage: "qualified_interest" })
    .eq("id", engagementId)
    .not("stage", "in", "(converted,dropped)")

  revalidatePath("/admin/ae-inbox")
  return { ok: true, data: { success: true } }
}

// ---------------------------------------------------------------------------
// Convert the engagement into real opportunity(ies) — the point at which
// the buyer finally lands on the client Kanban pipeline. Supports MULTIPLE
// suppliers per buyer (e.g. buyer wants a primary + a backup): each client
// gets its own opportunity, tagged with its role and traced back to this
// engagement for commission accounting.
// ---------------------------------------------------------------------------

export interface ConvertRoleAssignment {
  clientId: string
  role: "primary" | "backup" | "alternative"
  potentialValue?: number | null
}

export async function convertEngagementToOpportunities(
  engagementId: string,
  assignments: ConvertRoleAssignment[],
): Promise<ActionResult<{ opportunityIds: string[] }>> {
  const guard = await requireCap(CAPS.BUYER_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin } = guard

  if (assignments.length === 0) return { ok: false, error: "no_clients_selected" }
  if (!assignments.some((a) => a.role === "primary")) {
    return { ok: false, error: "primary_supplier_required" }
  }

  const { data: engagement, error: engErr } = await admin
    .from("buyer_engagements")
    .select("id, lead_id")
    .eq("id", engagementId)
    .single()
  if (engErr || !engagement) return { ok: false, error: "engagement_not_found" }

  const result = await assignBuyerToClients({
    buyerId: engagement.lead_id,
    clientIds: assignments.map((a) => a.clientId),
    // assignBuyerToClient(s) only takes one potentialValue for the whole
    // call — use the primary supplier's value (if any) as the shared one.
    potentialValue: assignments.find((a) => a.role === "primary")?.potentialValue ?? null,
  })
  if (!result.ok) return { ok: false, error: result.error }

  const opportunityIds: string[] = []
  for (const item of result.data.items) {
    if (!item.ok || !item.opportunityId) continue
    const role = assignments.find((a) => a.clientId === item.clientId)?.role ?? "alternative"
    await admin
      .from("opportunities")
      .update({ source_engagement_id: engagementId, source_role: role })
      .eq("id", item.opportunityId)
    opportunityIds.push(item.opportunityId)
  }

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
      buyer_engagement_shortlist_versions (
        id, version_number, status, scoring_engine_version, created_at, sent_at, superseded_at,
        buyer_engagement_shortlist_items ( id, client_id, position, match_score, buyer_interested, buyer_action, buyer_responded_at,
          profiles:client_id ( id, company_name, full_name ) )
      ),
      shortlist_share_links ( token, version_id, view_count, last_viewed_at, revoked_at ),
      buyer_replies ( id, from_email, subject, raw_content, translated_vi, ai_intent, ai_summary, ai_suggested_next_step, received_at, read_at, message_id, responded_email_draft_id, responded_at )
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

// ---------------------------------------------------------------------------
// Buyer replies scoped to a pre-opportunity engagement — mirrors
// listBuyerRepliesAction / markBuyerRepliesReadAction in
// app/admin/opportunities/reply-actions.ts, but keyed by engagement_id
// since no opportunity exists yet at this stage.
// ---------------------------------------------------------------------------

export async function listEngagementRepliesAction(
  engagementId: string,
): Promise<ActionResult<any[]>> {
  const guard = await requireCap(CAPS.MATCH_INBOX_VIEW)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin } = guard

  const { data, error } = await admin
    .from("buyer_replies")
    .select("*")
    .eq("engagement_id", engagementId)
    .order("received_at", { ascending: false })
    .limit(50)

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data ?? [] }
}

/**
 * Mark all unread buyer replies for the given engagement as read. Called
 * when an AE opens a buyer's card in the "Đang xử lý" page.
 */
export async function markEngagementRepliesReadAction(
  engagementId: string,
): Promise<ActionResult<{ success: true }>> {
  const guard = await requireCap(CAPS.BUYER_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin } = guard

  const { error } = await admin
    .from("buyer_replies")
    .update({ read_at: new Date().toISOString() })
    .eq("engagement_id", engagementId)
    .is("read_at", null)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/admin/engagements")
  return { ok: true, data: { success: true } }
}
