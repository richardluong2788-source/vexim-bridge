import "server-only"

/**
 * Manual buyer → AE assignment (admin override of AI matching).
 *
 * The AI matching pipeline (orchestrator.ts) remains the default owner of
 * buyer→AE distribution. The functions here implement the *controlled
 * exception*: a super_admin/admin pins a buyer to a specific AE, an AE
 * hands a claimed buyer to a colleague (transfer), or a buyer is returned
 * to the shared inbox. Every path:
 *
 *   - validates the target is a real sales-role account,
 *   - enforces per-AE workload guardrails,
 *   - stamps ae_match_scores.assignment_source = 'manual' (the CHECK
 *     constraint in migration 035 already allows this value),
 *   - writes an audit activity, and
 *   - notifies the affected AE(s).
 *
 * Kept framework-agnostic (no "use server", receives the service-role
 * client) so both server-action files and the existing AE transfer action
 * share one implementation.
 */

import type { createAdminClient } from "@/lib/supabase/admin"
import { dispatchNotification } from "@/lib/notifications/dispatcher"
import {
  AE_WORKLOAD_HARD_CAP,
  MANUAL_ASSIGN_REASON_SCORE_GAP,
  MANUAL_INBOX_ITEM_TTL_DAYS,
} from "@/lib/buyers/constants"

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * The generated Database types predate several columns
 * (transfer_reason, stale_reminder_sent_at...) and the
 * `.not("stage", "in", ...)` + `.update(...)` overload chain degrades to
 * `never` — the same typing gap already seen across
 * app/admin/ae-inbox/engagement-actions.ts. Query chains in this module
 * therefore use a deliberately permissive table client; runtime safety
 * still comes from the service-role client and explicit column names.
 */
interface LooseDb {
  from: (table: string) => any
}

function loose(admin: AdminClient): LooseDb {
  return admin as unknown as LooseDb
}

/** Roles that may OWN buyer relationships (mirrors TRANSFERABLE_ROLES). */
export const ASSIGNABLE_AE_ROLES = ["account_executive", "admin", "super_admin"] as const

export type AssignableAeRole = (typeof ASSIGNABLE_AE_ROLES)[number]

export interface Workload {
  /** Active pre-opportunity engagements owned by the AE. */
  activeEngagements: number
  /** Open (not won/lost) opportunities owned by the AE. */
  openOpportunities: number
}

export interface AssignmentCandidate {
  id: string
  fullName: string | null
  email: string | null
  role: string | null
  industries: string[] | string | null
  activeEngagements: number
  openOpportunities: number
  /** AI match score for this buyer, null when the buyer was never scored for this AE. */
  matchScore: number | null
  /** This AE currently has a pending inbox item for the buyer. */
  hasPendingInbox: boolean
  /** This AE currently owns the buyer's active engagement (if any). */
  isCurrentOwner: boolean
}

export class ManualAssignmentError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = "ManualAssignmentError"
  }
}

// ---------------------------------------------------------------------------
// Workload
// ---------------------------------------------------------------------------

export async function getAeWorkload(
  admin: AdminClient,
  aeIds: string[],
): Promise<Map<string, Workload>> {
  const result = new Map<string, Workload>()
  if (aeIds.length === 0) return result
  const db = loose(admin)

  const [{ data: engagements }, { data: opportunities }] = await Promise.all([
    db
      .from("buyer_engagements")
      .select("account_manager_id")
      .in("account_manager_id", aeIds)
      .not("stage", "in", "(converted,dropped)"),
    db
      .from("opportunities")
      .select("account_manager_id")
      .in("account_manager_id", aeIds)
      .not("stage", "in", "(won,lost)"),
  ])

  for (const id of aeIds) {
    result.set(id, { activeEngagements: 0, openOpportunities: 0 })
  }
  for (const row of (engagements ?? []) as Array<{ account_manager_id: string | null }>) {
    const id = row.account_manager_id
    if (!id || !result.has(id)) continue
    result.get(id)!.activeEngagements += 1
  }
  for (const row of (opportunities ?? []) as Array<{ account_manager_id: string | null }>) {
    const id = row.account_manager_id
    if (!id || !result.has(id)) continue
    result.get(id)!.openOpportunities += 1
  }
  return result
}

// ---------------------------------------------------------------------------
// Candidate list (for the admin assign dialog)
// ---------------------------------------------------------------------------

export async function listAssignmentCandidates(
  admin: AdminClient,
  leadId: string,
): Promise<AssignmentCandidate[]> {
  const db = loose(admin)
  const [{ data: aes }, { data: scores }, { data: pendingInbox }, { data: activeEng }] =
    await Promise.all([
      db
        .from("profiles")
        .select("id, full_name, email, role, industries")
        .in("role", ASSIGNABLE_AE_ROLES as unknown as string[])
        .order("full_name", { ascending: true }),
      db.from("ae_match_scores").select("account_manager_id, total_score").eq("lead_id", leadId),
      db
        .from("ae_match_inbox")
        .select("account_manager_id")
        .eq("lead_id", leadId)
        .eq("status", "pending"),
      db
        .from("buyer_engagements")
        .select("id, account_manager_id")
        .eq("lead_id", leadId)
        .not("stage", "in", "(converted,dropped)")
        .maybeSingle(),
    ])

  const aeList: Array<{
    id: string
    full_name: string | null
    email: string | null
    role: string | null
    industries: string[] | string | null
  }> = aes ?? []
  const workload = await getAeWorkload(
    admin,
    aeList.map((a) => a.id),
  )

  const scoreByAe = new Map<string, number>()
  for (const s of (scores ?? []) as Array<{ account_manager_id: string; total_score: number }>) {
    scoreByAe.set(s.account_manager_id, Number(s.total_score))
  }
  const pendingSet = new Set(
    ((pendingInbox ?? []) as Array<{ account_manager_id: string }>).map((i) => i.account_manager_id),
  )
  const currentOwnerId = (activeEng as { account_manager_id?: string } | null)?.account_manager_id ?? null

  return aeList.map((ae) => {
    const wl = workload.get(ae.id) ?? { activeEngagements: 0, openOpportunities: 0 }
    return {
      id: ae.id,
      fullName: ae.full_name,
      email: ae.email,
      role: ae.role,
      industries: ae.industries,
      activeEngagements: wl.activeEngagements,
      openOpportunities: wl.openOpportunities,
      matchScore: scoreByAe.has(ae.id) ? (scoreByAe.get(ae.id) as number) : null,
      hasPendingInbox: pendingSet.has(ae.id),
      isCurrentOwner: currentOwnerId === ae.id,
    }
  })
}

// ---------------------------------------------------------------------------
// Shared internals
// ---------------------------------------------------------------------------

async function getLead(db: LooseDb, leadId: string) {
  const { data, error } = await db
    .from("leads")
    .select("id, company_name, contact_person")
    .eq("id", leadId)
    .single()
  if (error || !data) {
    throw new ManualAssignmentError("buyer_not_found", "Không tìm thấy buyer")
  }
  return data as { id: string; company_name: string | null; contact_person: string | null }
}

async function assertTargetAe(db: LooseDb, aeId: string) {
  const { data, error } = await db
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", aeId)
    .single()
  if (error || !data) {
    throw new ManualAssignmentError("target_ae_not_found", "Không tìm thấy AE được gán")
  }
  const profile = data as { id: string; role: string | null; full_name: string | null }
  if (!ASSIGNABLE_AE_ROLES.includes(profile.role as AssignableAeRole)) {
    throw new ManualAssignmentError(
      "target_not_ae",
      "Người được gán phải có vai trò Account Executive (hoặc Admin)",
    )
  }
  return profile
}

async function findActiveEngagement(db: LooseDb, leadId: string) {
  const { data } = await db
    .from("buyer_engagements")
    .select("id, account_manager_id, stage")
    .eq("lead_id", leadId)
    .not("stage", "in", "(converted,dropped)")
    .maybeSingle()
  return (data as { id: string; account_manager_id: string; stage: string } | null) ?? null
}

/** Mark the chosen AE's score row as a manual assignment; clear any previous one. */
async function stampManualScore(
  db: LooseDb,
  leadId: string,
  targetAeId: string,
  performedBy: string,
) {
  // A buyer only ever has one "assigned" score row — release the previous mark.
  await db
    .from("ae_match_scores")
    .update({ assignment_source: null, assigned_at: null, assigned_by: null })
    .eq("lead_id", leadId)
    .not("assignment_source", "is", null)

  const now = new Date().toISOString()
  const { data: existing } = await db
    .from("ae_match_scores")
    .select("id")
    .eq("lead_id", leadId)
    .eq("account_manager_id", targetAeId)
    .maybeSingle()

  if (existing) {
    await db
      .from("ae_match_scores")
      .update({ assignment_source: "manual", assigned_at: now, assigned_by: performedBy })
      .eq("id", (existing as { id: string }).id)
  } else {
    // Buyer was never AI-scored for this AE (e.g. assigned straight from
    // the pool). Record a zero-score row so the assignment is visible in
    // the buyers list and audit trail; factors explain why it is zero.
    await db.from("ae_match_scores").insert({
      lead_id: leadId,
      account_manager_id: targetAeId,
      total_score: 0,
      factors: { manual: true, note: "Assigned manually, no AI score computed" },
      assignment_source: "manual",
      assigned_at: now,
      assigned_by: performedBy,
    })
  }
}

/** Expire every pending inbox copy of a buyer (optionally except one AE). */
async function expirePendingInboxItems(
  db: LooseDb,
  leadId: string,
  exceptAeId: string | null,
  performedBy: string,
) {
  let query = db
    .from("ae_match_inbox")
    .update({
      status: "expired",
      reviewed_at: new Date().toISOString(),
      reviewed_by: performedBy,
    })
    .eq("lead_id", leadId)
    .eq("status", "pending")
  if (exceptAeId) query = query.neq("account_manager_id", exceptAeId)
  await query
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function buyerDisplayName(lead: { company_name: string | null; contact_person: string | null }) {
  return lead.company_name || lead.contact_person || "Unknown Buyer"
}

// ---------------------------------------------------------------------------
// Transfer core — shared by admin assignment and the AE transfer action.
// `overrideCapacity` (super_admin only — enforced by the caller) bypasses
// the hard workload cap.
// ---------------------------------------------------------------------------

export interface TransferInput {
  admin: AdminClient
  /** Either engagementId (AE transfer) or leadId (admin assign) must be set. */
  engagementId?: string
  leadId?: string
  targetAeId: string
  reason: string
  performedBy: string
  /** Display name of the person performing the action, for audit text. */
  performedByName?: string | null
  overrideCapacity?: boolean
}

export interface TransferResult {
  engagementId: string
  leadId: string
  previousAeId: string | null
  wasNewClaim: boolean
}

export async function executeBuyerAssignment(input: TransferInput): Promise<TransferResult> {
  const db = loose(input.admin)

  type ActiveEngagement = {
    id: string
    lead_id: string
    account_manager_id: string
    stage: string
  } | null

  let leadId = input.leadId
  let engagement: ActiveEngagement = null
  if (input.engagementId) {
    const { data, error } = await db
      .from("buyer_engagements")
      .select("id, lead_id, account_manager_id, stage")
      .eq("id", input.engagementId)
      .single()
    if (error || !data) {
      throw new ManualAssignmentError("engagement_not_found", "Không tìm thấy phiên xử lý buyer")
    }
    const loaded = data as NonNullable<ActiveEngagement>
    if (["converted", "dropped"].includes(loaded.stage)) {
      throw new ManualAssignmentError(
        "engagement_already_closed",
        "Buyer đã đóng (chuyển thành cơ hội hoặc đã hủy), không thể gán lại ở đây",
      )
    }
    leadId = loaded.lead_id
    engagement = loaded
  }
  if (!leadId) {
    throw new ManualAssignmentError("missing_lead", "Thiếu thông tin buyer")
  }

  const [lead, target] = await Promise.all([
    getLead(db, leadId),
    assertTargetAe(db, input.targetAeId),
  ])

  const active = engagement ?? (await findActiveEngagement(db, leadId))
  const previousAeId = active?.account_manager_id ?? null
  if (previousAeId === target.id) {
    throw new ManualAssignmentError(
      "already_owned_by_target",
      "Buyer này đã thuộc về AE được chọn",
    )
  }

  // Reason policy: always required for an AE handover; for a brand-new
  // admin claim it's required when the chosen AE wasn't the AI's top
  // recommendation (score gap or no score).
  const reason = input.reason?.trim() || ""
  if (active) {
    if (!reason) {
      throw new ManualAssignmentError("reason_required", "Vui lòng nhập lý do chuyển buyer")
    }
  } else if (!reason) {
    const { data: scores } = await db
      .from("ae_match_scores")
      .select("total_score, account_manager_id")
      .eq("lead_id", leadId)
      .order("total_score", { ascending: false })
    const scoreRows = (scores ?? []) as Array<{
      total_score: number
      account_manager_id: string
    }>
    const chosen = scoreRows.find((s) => s.account_manager_id === target.id)
    const top = scoreRows[0]
    const chosenScore = chosen ? Number(chosen.total_score) : null
    const topScore = top ? Number(top.total_score) : null
    const contradictsAi =
      chosenScore === null ||
      (topScore !== null && topScore - chosenScore >= MANUAL_ASSIGN_REASON_SCORE_GAP)
    if (contradictsAi) {
      throw new ManualAssignmentError(
        "reason_required",
        "AE này khác với đề xuất hàng đầu của AI — vui lòng nhập lý do gán",
      )
    }
  }

  // Workload guardrail (the target never owns this buyer on this path, so
  // their current count is the post-assignment count).
  const workload = await getAeWorkload(input.admin, [target.id])
  const targetLoad = workload.get(target.id)
  if (
    targetLoad &&
    targetLoad.activeEngagements >= AE_WORKLOAD_HARD_CAP &&
    !input.overrideCapacity
  ) {
    throw new ManualAssignmentError(
      "ae_at_capacity",
      `AE này đang xử lý ${targetLoad.activeEngagements} buyer (tối đa ${AE_WORKLOAD_HARD_CAP}). Hãy chọn AE khác hoặc nhờ Super Admin gán đè.`,
    )
  }

  const now = new Date().toISOString()
  let engagementId = active?.id ?? ""
  let wasNewClaim = false

  if (active) {
    // ── Transfer of an in-progress engagement ──────────────────────────
    const { error: engErr } = await db
      .from("buyer_engagements")
      .update({
        account_manager_id: target.id,
        transferred_from_ae_id: previousAeId,
        transfer_reason: reason,
        transferred_at: now,
        // The waiting-on-buyer SLA clock restarts under the new AE.
        stale_reminder_sent_at: null,
      })
      .eq("id", active.id)
    if (engErr) {
      throw new ManualAssignmentError("transfer_failed", (engErr as Error).message)
    }
    engagementId = active.id

    // Keep open opportunities (if this buyer already produced any) aligned
    // with the new owner. Won/lost snapshots stay frozen for commission.
    await db
      .from("opportunities")
      .update({ account_manager_id: target.id })
      .eq("lead_id", leadId)
      .not("stage", "in", "(won,lost)")
  } else {
    // ── Direct claim on behalf of the chosen AE ────────────────────────
    const { data: targetInbox } = await db
      .from("ae_match_inbox")
      .select("id")
      .eq("lead_id", leadId)
      .eq("account_manager_id", target.id)
      .eq("status", "pending")
      .maybeSingle()

    await expirePendingInboxItems(db, leadId, target.id, input.performedBy)

    if (targetInbox) {
      await db
        .from("ae_match_inbox")
        .update({ status: "accepted", reviewed_at: now, reviewed_by: input.performedBy })
        .eq("id", (targetInbox as { id: string }).id)
    }

    const { data: newEngagement, error: insertErr } = await db
      .from("buyer_engagements")
      .insert({
        lead_id: leadId,
        account_manager_id: target.id,
        inbox_item_id: targetInbox ? (targetInbox as { id: string }).id : null,
        stage: "claimed",
        created_by: input.performedBy,
        transfer_reason: reason || null,
      })
      .select("id")
      .single()
    if (insertErr || !newEngagement) {
      throw new ManualAssignmentError(
        "claim_failed",
        (insertErr as Error)?.message ?? "Không tạo được phiên xử lý",
      )
    }
    engagementId = (newEngagement as { id: string }).id
    wasNewClaim = true
  }

  await stampManualScore(db, leadId, target.id, input.performedBy)

  // ── Audit activity (lead-level; no opportunity exists yet) ─────────────
  const buyerName = buyerDisplayName(lead)
  const reasonSuffix = reason ? ` · Lý do: ${reason}` : ""
  const actor = input.performedByName ? ` (bởi ${input.performedByName})` : ""
  await db.from("activities").insert({
    action_type: active ? "buyer_transferred" : "ai_matching_manual_assigned",
    description: active
      ? `Buyer "${buyerName}" được chuyển thủ công${actor} cho AE ${target.full_name ?? target.id}${reasonSuffix}`
      : `Buyer "${buyerName}" được gán thủ công${actor} cho AE ${target.full_name ?? target.id}${reasonSuffix}`,
    performed_by: input.performedBy,
  })

  // ── Notifications ─────────────────────────────────────────────────────
  const dayKey = todayKey()
  dispatchNotification({
    userId: target.id,
    category: "new_assignment",
    linkPath: "/admin/ae-inbox",
    dedupKey: `manual_assign:${leadId}:${target.id}:${dayKey}`,
    title: {
      vi: active ? "Buyer được chuyển cho bạn" : "Buyer mới được quản trị viên gán cho bạn",
      en: active ? "A buyer was transferred to you" : "A buyer was assigned to you by an admin",
    },
    body: {
      vi: `${buyerName}${reason ? ` — lý do: ${reason}` : ""}. Vào AE Inbox để tiếp tục.`,
      en: `${buyerName}${reason ? ` — reason: ${reason}` : ""}. Open the AE Inbox to continue.`,
    },
    ctaLabel: { vi: "Mở AE Inbox", en: "Open AE Inbox" },
  }).catch((err) => console.error("[manual-assignment] notify target failed", err))

  if (previousAeId && previousAeId !== target.id) {
    dispatchNotification({
      userId: previousAeId,
      category: "status_update",
      linkPath: "/admin/ae-inbox",
      dedupKey: `manual_transfer_out:${leadId}:${previousAeId}:${dayKey}`,
      title: {
        vi: "Buyer đã được chuyển cho AE khác",
        en: "A buyer was transferred to another AE",
      },
      body: {
        vi: `${buyerName} đã được chuyển sang ${target.full_name ?? "AE khác"}${reasonSuffix}.`,
        en: `${buyerName} was moved to ${target.full_name ?? "another AE"}${reasonSuffix}.`,
      },
      ctaLabel: { vi: "Xem", en: "View" },
    }).catch((err) => console.error("[manual-assignment] notify previous owner failed", err))
  }

  return { engagementId, leadId, previousAeId, wasNewClaim }
}

// ---------------------------------------------------------------------------
// Return a buyer to the shared inbox (AE gives the buyer up so another AE —
// or AI — can pick it up).
// ---------------------------------------------------------------------------

export interface ReturnToInboxInput {
  admin: AdminClient
  engagementId: string
  reason: string
  performedBy: string
}

export async function returnBuyerToSharedInbox(
  input: ReturnToInboxInput,
): Promise<{ leadId: string }> {
  const db = loose(input.admin)
  const reason = input.reason.trim()
  if (!reason) {
    throw new ManualAssignmentError("reason_required", "Vui lòng nhập lý do trả buyer về hộp thư chung")
  }

  const { data: engagementData, error: engLoadErr } = await db
    .from("buyer_engagements")
    .select("id, lead_id, account_manager_id, stage")
    .eq("id", input.engagementId)
    .single()
  if (engLoadErr || !engagementData) {
    throw new ManualAssignmentError("engagement_not_found", "Không tìm thấy phiên xử lý buyer")
  }
  const engagement = engagementData as {
    id: string
    lead_id: string
    account_manager_id: string
    stage: string
  }
  if (["converted", "dropped"].includes(engagement.stage)) {
    throw new ManualAssignmentError(
      "engagement_already_closed",
      "Buyer đã đóng, không thể trả về hộp thư",
    )
  }

  const lead = await getLead(db, engagement.lead_id)

  // Drop the current engagement, preserving the reason for the audit trail.
  const { error: dropErr } = await db
    .from("buyer_engagements")
    .update({
      stage: "dropped",
      dropped_reason: `[Trả về hộp thư chung] ${reason}`,
    })
    .eq("id", engagement.id)
  if (dropErr) {
    throw new ManualAssignmentError("return_failed", (dropErr as Error).message)
  }

  // Release the manual/auto assignment mark so the buyer reads as unassigned.
  await db
    .from("ae_match_scores")
    .update({ assignment_source: null, assigned_at: null, assigned_by: null })
    .eq("lead_id", engagement.lead_id)
    .not("assignment_source", "is", null)

  // Rebuild a clean shared inbox: one pending item per sales-role AE.
  // Mirrors routeToSharedInbox() in orchestrator.ts (delete → insert),
  // which also avoids the UNIQUE(lead_id, account_manager_id) collision on
  // previously-expired rows.
  await db.from("ae_match_inbox").delete().eq("lead_id", engagement.lead_id)

  const { data: aes } = await db
    .from("profiles")
    .select("id")
    .in("role", ASSIGNABLE_AE_ROLES as unknown as string[])
  const aeRows = (aes ?? []) as Array<{ id: string }>

  const expiresAt = new Date(
    Date.now() + MANUAL_INBOX_ITEM_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()

  const rows = aeRows.map((ae) => ({
    lead_id: engagement.lead_id,
    account_manager_id: ae.id,
    match_score_id: null,
    priority: "medium",
    status: "pending",
    expires_at: expiresAt,
  }))
  if (rows.length > 0) {
    const { error: insertErr } = await db.from("ae_match_inbox").insert(rows)
    if (insertErr) {
      throw new ManualAssignmentError("return_failed", (insertErr as Error).message)
    }
  }

  const buyerName = buyerDisplayName(lead)
  await db.from("activities").insert({
    action_type: "buyer_returned_to_inbox",
    description: `Buyer "${buyerName}" được trả về hộp thư chung (từ AE đang phụ trách) · Lý do: ${reason}`,
    performed_by: input.performedBy,
  })

  return { leadId: engagement.lead_id }
}
