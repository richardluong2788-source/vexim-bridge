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

  // Mark this inbox item accepted so it drops out of "Buyer của tôi"
  // (which only lists status = "pending") the moment the AE claims it —
  // previously this never ran, so claimed cards kept showing "Nhận buyer"
  // indefinitely (until the 7-day expiry) even though the engagement had
  // already moved on.
  await admin
    .from("ae_match_inbox")
    .update({
      status: "accepted",
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId,
    })
    .eq("id", inbox.id)

  // Close out sibling inbox copies for the same buyer (other AEs who also
  // had this lead pending — normal multi-candidate range, or the shared
  // inbox when no AE matched the buyer's industry). Once one AE claims
  // the buyer it must disappear from everyone else's inbox too, so two
  // AEs can't claim the same buyer at once. Mirrors acceptInboxItem's
  // sibling-closing logic in lib/matching/orchestrator.ts.
  await admin
    .from("ae_match_inbox")
    .update({
      status: "expired",
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId,
    })
    .eq("lead_id", inbox.lead_id)
    .eq("status", "pending")
    .neq("id", inbox.id)

  revalidatePath("/admin/ae-inbox")
  return { ok: true, data: { engagementId: engagement.id } }
}

// ---------------------------------------------------------------------------
// Save the buyer's stated requirements (recorded by the AE)
// ---------------------------------------------------------------------------

export type ContactChannel = "system_email" | "linkedin" | "whatsapp" | "phone" | "other"

export interface SaveRequirementsInput {
  engagementId: string
  requestedProducts?: string
  targetPriceRange?: string
  moq?: string
  paymentTerms?: string
  packagingRequirements?: string
  otherRequirements?: string
  // How the AE actually reached the buyer to gather these requirements.
  // Required when the engagement is still at "claimed" — i.e. the AE
  // never sent the in-system requirement-inquiry email and instead
  // reached out via LinkedIn/WhatsApp/phone/etc. Optional otherwise,
  // since it's implicitly "system_email" once that email was sent.
  contactChannel?: ContactChannel
  contactChannelNote?: string
}

export async function saveBuyerRequirements(
  input: SaveRequirementsInput,
): Promise<ActionResult<{ success: true }>> {
  const guard = await requireCap(CAPS.BUYER_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin } = guard

  // Buyers can be reached outside the in-system email flow (LinkedIn,
  // WhatsApp, phone) before their requirements are known. Look up the
  // current stage so we know whether a contact channel must be recorded
  // now, and don't silently overwrite one already set by the email flow.
  const { data: existing, error: fetchErr } = await admin
    .from("buyer_engagements")
    .select("stage, contact_channel")
    .eq("id", input.engagementId)
    .single()
  if (fetchErr || !existing) return { ok: false, error: fetchErr?.message ?? "engagement_not_found" }

  if (existing.stage === "claimed" && !existing.contact_channel && !input.contactChannel) {
    return { ok: false, error: "contact_channel_required" }
  }

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
      ...(existing.contact_channel
        ? {}
        : {
            contact_channel: input.contactChannel ?? "system_email",
            contact_channel_note: input.contactChannelNote?.trim() || null,
          }),
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
    // Reset stale_reminder_sent_at: the AE is waiting on the buyer again
    // from this point, so the 14-day no-reply clock (see
    // app/api/cron/engagement-stale-check/route.ts) restarts fresh.
    .update({ stage: "requirement_email_sent", stale_reminder_sent_at: null })
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

// Buyer-friendly, non-numeric rendering of why a supplier was included.
// Deliberately excludes raw scores/weights and internal-only factors
// ("Priority Bonus", "VN Supplier Bonus") — those stay in match_reasoning
// for AE eyes only. Returns at most 2 short, plain-language bullets.
const BUYER_FACING_FACTOR_COPY: Record<string, string> = {
  "HS Code Match": "Product classification matches the HS code of what you're sourcing",
  "Product Match": "Specializes in the product category you requested",
  "Country Match": "Established export experience to your destination market",
  "Logistics Match": "Familiar with your preferred shipping ports and container types",
}

function buildBuyerFacingHighlights(match: any): string[] {
  if (!match?.matchBreakdown?.length) {
    return ["Reviewed and pre-qualified by our sourcing team for your requirements"]
  }
  return match.matchBreakdown
    .filter((f: any) => BUYER_FACING_FACTOR_COPY[f.factor] && f.rawScore >= 60)
    .sort((a: any, b: any) => b.rawScore - a.rawScore)
    .slice(0, 2)
    .map((f: any) => BUYER_FACING_FACTOR_COPY[f.factor])
}

export async function buildShortlist(
  engagementId: string,
  clientIds: string[],
): Promise<ActionResult<{ versionId: string; versionNumber: number }>> {
  const guard = await requireCap(CAPS.BUYER_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin, userId } = guard

  if (clientIds.length < 1 || clientIds.length > 3) {
    return { ok: false, error: "shortlist_must_have_1_to_3_clients" }
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
        highlights: buildBuyerFacingHighlights(match),
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
    // Reset stale_reminder_sent_at — waiting on the buyer starts fresh
    // from this send (see markRequirementEmailSent above for the same
    // pattern and app/api/cron/engagement-stale-check/route.ts).
    .update({ stage: "shortlist_sent", stale_reminder_sent_at: null })
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
    .select(
      "id, lead_id, requested_products, target_price_range, moq, payment_terms, packaging_requirements, other_requirements",
    )
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

  // Build a human-readable snapshot of what the buyer told the AE before
  // any opportunity existed. This is written into `opportunities.notes` so
  // it survives the transition to the Kanban — an AE opening the card
  // never has to go dig through the (now-hidden, "converted") engagement
  // to see what the buyer originally asked for.
  const requirementLines = [
    ["Sản phẩm yêu cầu", engagement.requested_products],
    ["Khoảng giá mục tiêu", engagement.target_price_range],
    ["MOQ", engagement.moq],
    ["Điều khoản thanh toán", engagement.payment_terms],
    ["Yêu cầu đóng gói", engagement.packaging_requirements],
    ["Yêu cầu khác", engagement.other_requirements],
  ].filter(([, value]) => value && String(value).trim().length > 0)

  const requirementsBlock =
    requirementLines.length > 0
      ? [
          "[Yêu cầu ban đầu của buyer — ghi nhận trước khi tạo cơ hội]",
          ...requirementLines.map(([label, value]) => `- ${label}: ${value}`),
        ].join("\n")
      : null

  const opportunityIds: string[] = []
  const roleByOpportunityId = new Map<string, string>()
  for (const item of result.data.items) {
    if (!item.ok || !item.opportunityId) continue
    const role = assignments.find((a) => a.clientId === item.clientId)?.role ?? "alternative"
    await admin
      .from("opportunities")
      .update({ source_engagement_id: engagementId, source_role: role })
      .eq("id", item.opportunityId)
    opportunityIds.push(item.opportunityId)
    roleByOpportunityId.set(item.opportunityId, role)
  }

  if (opportunityIds.length === 0) {
    return { ok: false, error: "no_opportunity_created" }
  }

  const primaryOpportunityId =
    opportunityIds.find((id) => roleByOpportunityId.get(id) === "primary") ?? opportunityIds[0]

  // Carry the buyer's stated requirements onto every opportunity created
  // from this engagement (they apply to whichever supplier ends up
  // fulfilling the order, not just the primary one). Notes is empty at
  // creation time (see assignBuyerToClient), so this never clobbers an
  // AE's own text.
  if (requirementsBlock) {
    await Promise.all(
      opportunityIds.map((id) => admin.from("opportunities").update({ notes: requirementsBlock }).eq("id", id)),
    )
  }

  // Re-point the buyer's pre-opportunity email thread onto the PRIMARY
  // opportunity so it shows up immediately in that card's conversation
  // tab (opportunity_id is a single FK — a reply can only "live" on one
  // opportunity at a time). engagement_id is left untouched for the full
  // audit trail. Backup/alternative opportunities get a note pointing to
  // where the real thread lives instead of a duplicated copy.
  const { data: repointedReplies } = await admin
    .from("buyer_replies")
    .update({ opportunity_id: primaryOpportunityId })
    .eq("engagement_id", engagementId)
    .is("opportunity_id", null)
    .select("id")

  const secondaryOpportunityIds = opportunityIds.filter((id) => id !== primaryOpportunityId)
  if (secondaryOpportunityIds.length > 0 && (repointedReplies?.length ?? 0) > 0) {
    const pointerNote = `\n\n[Lịch sử email trước khi tạo cơ hội nằm ở cơ hội chính (primary), opportunity_id: ${primaryOpportunityId}]`
    await Promise.all(
      secondaryOpportunityIds.map(async (id) => {
        const { data: opp } = await admin.from("opportunities").select("notes").eq("id", id).single()
        await admin
          .from("opportunities")
          .update({ notes: `${opp?.notes ?? ""}${pointerNote}` })
          .eq("id", id)
      }),
    )
  }

  // Best-effort activity log so the conversion itself is visible in each
  // opportunity's timeline.
  await admin.from("activities").insert(
    opportunityIds.map((id) => ({
      opportunity_id: id,
      action_type: "engagement_converted",
      description:
        id === primaryOpportunityId
          ? "Chuyển từ AE Inbox: đã mang theo yêu cầu ban đầu và lịch sử email của buyer."
          : "Chuyển từ AE Inbox: đã mang theo yêu cầu ban đầu của buyer (lịch sử email nằm ở cơ hội chính).",
    })),
  )

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
// Transfer a claimed buyer to another AE — covers the case where LR routed
// the buyer by industry match, but once the AE actually asks for
// requirements the buyer turns out to want a product/category none of this
// AE's clients cover. Reassigns account_manager_id and records where it
// came from + why, so the receiving AE has context and there's an audit
// trail (see scripts/056_engagement_transfer.sql).
// ---------------------------------------------------------------------------

export interface TransferCandidateAE {
  id: string
  fullName: string | null
  companyName: string | null
  activeEngagementCount: number
}

// Staff roles allowed to receive a transferred buyer. Kept separate from
// account-manager-actions.ts's STAFF_ROLES because that list also includes
// non-AE roles (finance, lead_researcher) that shouldn't show up here.
const TRANSFERABLE_ROLES = ["account_executive", "admin", "super_admin"] as const

export async function listTransferCandidateAEs(
  excludeAeId?: string,
): Promise<ActionResult<TransferCandidateAE[]>> {
  const guard = await requireCap(CAPS.MATCH_INBOX_VIEW)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin } = guard

  const { data: aes, error: aesErr } = await admin
    .from("profiles")
    .select("id, full_name, company_name")
    .in("role", TRANSFERABLE_ROLES as unknown as string[])
  if (aesErr) return { ok: false, error: aesErr.message }

  const { data: active, error: activeErr } = await admin
    .from("buyer_engagements")
    .select("account_manager_id")
    .not("stage", "in", "(converted,dropped)")
  if (activeErr) return { ok: false, error: activeErr.message }

  const countByAe = new Map<string, number>()
  for (const row of active ?? []) {
    const id = row.account_manager_id as string | null
    if (!id) continue
    countByAe.set(id, (countByAe.get(id) ?? 0) + 1)
  }

  const candidates = (aes ?? [])
    .filter((ae) => ae.id !== excludeAeId)
    .map((ae) => ({
      id: ae.id as string,
      fullName: ae.full_name as string | null,
      companyName: ae.company_name as string | null,
      activeEngagementCount: countByAe.get(ae.id as string) ?? 0,
    }))
    .sort((a, b) => (a.fullName ?? "").localeCompare(b.fullName ?? ""))

  return { ok: true, data: candidates }
}

export async function transferEngagement(
  engagementId: string,
  newAccountManagerId: string,
  reason: string,
): Promise<ActionResult<{ success: true }>> {
  const guard = await requireCap(CAPS.BUYER_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin, userId, role } = guard

  if (!reason?.trim()) return { ok: false, error: "reason_required" }
  if (!newAccountManagerId) return { ok: false, error: "target_ae_required" }

  const { data: engagement, error: engErr } = await admin
    .from("buyer_engagements")
    .select("id, account_manager_id, stage")
    .eq("id", engagementId)
    .single()
  if (engErr || !engagement) return { ok: false, error: "engagement_not_found" }

  if (role === "account_executive" && engagement.account_manager_id !== userId) {
    return { ok: false, error: "not_your_engagement" }
  }
  if (engagement.account_manager_id === newAccountManagerId) {
    return { ok: false, error: "already_owned_by_target" }
  }
  if (["converted", "dropped"].includes(engagement.stage as string)) {
    return { ok: false, error: "engagement_already_closed" }
  }

  const { data: target, error: targetErr } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", newAccountManagerId)
    .single<{ id: string; role: string | null }>()
  if (targetErr || !target) return { ok: false, error: "target_ae_not_found" }
  if (!TRANSFERABLE_ROLES.includes(target.role as (typeof TRANSFERABLE_ROLES)[number])) {
    return { ok: false, error: "target_not_ae" }
  }

  const { error } = await admin
    .from("buyer_engagements")
    .update({
      account_manager_id: newAccountManagerId,
      transferred_from_ae_id: engagement.account_manager_id,
      transfer_reason: reason.trim(),
      transferred_at: new Date().toISOString(),
      // Waiting-on-buyer clock restarts under the new AE, same as
      // markRequirementEmailSent / approveAndSendShortlist above.
      stale_reminder_sent_at: null,
    })
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
      contact_channel, contact_channel_note,
      created_at, updated_at,
      leads ( id, company_name, contact_person, contact_email, country, industry, main_product, hs_code, hs_codes, product_keywords ),
      buyer_engagement_shortlist_versions (
        id, version_number, status, scoring_engine_version, created_at, sent_at, superseded_at,
        buyer_engagement_shortlist_items ( id, client_id, position, match_score, buyer_interested, buyer_action, buyer_responded_at,
          total_dwell_ms, first_viewed_at, last_dwell_at,
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
