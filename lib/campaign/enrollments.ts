// Enrollment orchestration: tạo enrollment, áp state transition vào DB, queries.
//
// Quy ước BẮT BUỘC: cột state của campaign_enrollments chỉ được ghi qua
// applyTransition() (module này) — giá trị chuyển luôn lấy từ
// lib/campaign/state-machine.ts, kèm SYSTEM_EVENT vào buyer_interactions.

import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  type EnrollmentState,
  TERMINAL_STATES,
  pilotEnrollmentCap,
  reenrollCooldownDays,
  reenrollBlockedUntil,
} from "./constants"
import type { StateTransition } from "./state-machine"
import type { CampaignEnrollmentRow, CampaignRow, CampaignStepRow } from "./types"
import { logSystemEvent } from "./interactions"
import { checkLeadStop } from "./suppression"

export interface EnrollmentWithLead extends CampaignEnrollmentRow {
  lead: {
    id: string
    company_name: string | null
    contact_person: string | null
    contact_email: string | null
    country: string | null
    industry: string | null
  } | null
}

async function adminAny() {
  return createAdminClient()
}

/** Áp một transition (đã tính bằng state-machine) vào DB + audit. */
export async function applyTransition(
  enrollment: Pick<CampaignEnrollmentRow, "id" | "lead_id" | "campaign_id" | "state" | "current_step_number" | "followup_count">,
  t: StateTransition,
  opts?: { performedBy?: string | null },
): Promise<boolean> {
  if (t.to === null && !t.needsHumanReview && !t.clearHumanReview) return false

  const admin = await adminAny()
  const patch: Record<string, unknown> = {}

  if (t.to !== null) patch.state = t.to
  if (t.currentStepNumber !== undefined) patch.current_step_number = t.currentStepNumber
  if (t.followupCountDelta !== undefined) {
    patch.followup_count = enrollment.followup_count + t.followupCountDelta
  }
  if (t.nextActionAt !== undefined) patch.next_action_at = t.nextActionAt?.toISOString() ?? null
  if (t.nextActionType !== undefined) patch.next_action_type = t.nextActionType
  if (t.pausedUntil !== undefined) patch.paused_until = t.pausedUntil?.toISOString() ?? null
  if (t.stoppedReason !== undefined) patch.stopped_reason = t.stoppedReason
  if (t.needsHumanReview !== undefined) patch.needs_human_review = t.needsHumanReview
  if (t.humanReviewReason !== undefined) patch.human_review_reason = t.humanReviewReason
  if (t.clearHumanReview) {
    patch.needs_human_review = false
    patch.human_review_reason = null
  }
  if (t.lastContactNow) patch.last_contact_at = new Date().toISOString()

  if (Object.keys(patch).length === 0) return false

  const { error } = await (admin.from("campaign_enrollments") as any)
    .update(patch)
    .eq("id", enrollment.id)

  if (error) {
    console.error("[campaign] applyTransition failed:", enrollment.id, patch, error)
    return false
  }

  await logSystemEvent({
    buyerId: enrollment.lead_id,
    campaignId: enrollment.campaign_id,
    enrollmentId: enrollment.id,
    step: (t.currentStepNumber ?? enrollment.current_step_number) as number,
    event: t.note ?? "state_change",
    detail: {
      from: enrollment.state,
      to: t.to ?? enrollment.state,
      next_action_at: t.nextActionAt?.toISOString() ?? undefined,
      stopped_reason: t.stoppedReason ?? undefined,
    },
    description: `[Campaign] ${enrollment.lead_id}: ${enrollment.state} → ${t.to ?? enrollment.state} (${t.note ?? ""})`,
  })

  return true
}

// ---------------------------------------------------------------------------
// Enrollment tạo mới (UI pilot) — validate STOP trước khi cho vào campaign
// ---------------------------------------------------------------------------

export type EnrollResult =
  | { ok: true; enrolled: number; skipped: Array<{ leadId: string; reason: string }> }
  | { ok: false; error: "campaign_not_found" | "campaign_not_draft_or_active" | "pilot_cap_reached" | "serverError"; message?: string }

/**
 * Enroll danh sách lead vào campaign. Bỏ qua idempotent những lead đã enroll.
 * Chỉ nhận lead đạt stop-check (contact hợp lệ, chưa unsubscribed/bounce).
 */
export async function enrollLeads(
  campaignId: string,
  leadIds: string[],
  ownerId: string | null,
  enrolledBy: string | null,
): Promise<EnrollResult> {
  const admin = await adminAny()

  const { data: campaign, error: campErr } = await admin
    .from("campaigns" as never)
    .select("id, status")
    .eq("id", campaignId)
    .single()

  if (campErr || !campaign) {
    return { ok: false, error: "campaign_not_found" }
  }
  const status = (campaign as { status: string }).status
  if (status !== "draft" && status !== "active") {
    return { ok: false, error: "campaign_not_draft_or_active" }
  }

  // Pilot theo cấp bậc (10 → 30 → 50–100): cap TỔNG enrollment/campaign,
  // override bằng env CAMPAIGN_PILOT_MAX_ENROLLMENTS.
  const cap = pilotEnrollmentCap()
  const { count: existingCount, error: cntErr } = await (admin.from("campaign_enrollments") as any)
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
  if (cntErr) {
    return { ok: false, error: "serverError", message: cntErr.message }
  }
  const existing = existingCount ?? 0
  if (existing >= cap) {
    return {
      ok: false,
      error: "pilot_cap_reached",
      message: `Campaign đã đủ ${existing}/${cap} enrollment (pilot cap — tăng CAMPAIGN_PILOT_MAX_ENROLLMENTS khi muốn mở rộng).`,
    }
  }

  const skipped: Array<{ leadId: string; reason: string }> = []
  let enrolled = 0
  let slots = cap - existing

  // Cooldown re-enroll (26/09/2026): enrollment trước vừa vào terminal → nghỉ
  // đủ CAMPAIGN_REENROLL_COOLDOWN_DAYS (default 60) mới cho campaign mới.
  // Không có auto-chase — guard này chỉ chặn người tạo chase loop vô ý.
  const cooldown = reenrollCooldownDays()
  const lastTerminal = new Map<string, string>()
  if (cooldown > 0 && leadIds.length > 0) {
    const { data: termRows } = await (admin.from("campaign_enrollments") as any)
      .select("lead_id, updated_at")
      .in("lead_id", leadIds)
      .in("state", TERMINAL_STATES as readonly string[])
      .order("updated_at", { ascending: false })
    for (const r of (termRows ?? []) as Array<{ lead_id: string; updated_at: string }>) {
      if (!lastTerminal.has(r.lead_id)) lastTerminal.set(r.lead_id, r.updated_at)
    }
  }

  for (const leadId of leadIds) {
    if (slots <= 0) {
      skipped.push({ leadId, reason: "pilot_cap_reached" })
      continue
    }
    // Cooldown giữa 2 sequence (nurture/stopped/... quá_recent → skip).
    if (cooldown > 0) {
      const opensAt = reenrollBlockedUntil(lastTerminal.get(leadId) ?? null, cooldown)
      if (opensAt) {
        skipped.push({ leadId, reason: `reenroll_cooldown_until:${opensAt.toISOString().slice(0, 10)}` })
        continue
      }
    }

    // STOP check (spec §13): contact hợp lệ + chưa suppress.
    const stop = await checkLeadStop(leadId)
    if (!stop.ok) {
      skipped.push({ leadId, reason: stop.reason })
      continue
    }

    const { error: insErr } = await (admin.from("campaign_enrollments") as any).insert({
      campaign_id: campaignId,
      lead_id: leadId,
      state: "enrolled",
      current_step_number: 1,
      next_action_at: new Date().toISOString(),
      next_action_type: "step1_due",
      owner_id: ownerId,
      enrolled_by: enrolledBy,
    })

    if (insErr) {
      const code = (insErr as { code?: string }).code
      if (code === "23505") {
        // Đã enroll (campaign này hoặc một campaign active khác) — idempotent skip.
        skipped.push({ leadId, reason: "already_enrolled" })
        continue
      }
      console.error("[campaign] enroll insert failed:", leadId, insErr)
      skipped.push({ leadId, reason: `insert_failed: ${insErr.message}` })
      continue
    }

    enrolled += 1
    slots -= 1
    await logSystemEvent({
      buyerId: leadId,
      campaignId,
      event: "enrolled",
      step: 1,
      description: `[Campaign] Lead ${leadId} enrolled (owner ${ownerId ?? "unassigned"})`,
    })
  }

  return { ok: true, enrolled, skipped }
}

// ---------------------------------------------------------------------------
// Queries dùng chung
// ---------------------------------------------------------------------------

export async function getCampaign(campaignId: string): Promise<CampaignRow | null> {
  const admin = await adminAny()
  const { data, error } = await (admin.from("campaigns") as any)
    .select("*")
    .eq("id", campaignId)
    .single()
  if (error) return null
  return data as CampaignRow
}

export async function getCampaignSteps(campaignId: string): Promise<CampaignStepRow[]> {
  const admin = await adminAny()
  const { data, error } = await (admin.from("campaign_steps") as any)
    .select("*")
    .eq("campaign_id", campaignId)
    .order("step_number", { ascending: true })
  if (error) return []
  return (data ?? []) as CampaignStepRow[]
}

export async function getEnrollment(enrollmentId: string): Promise<CampaignEnrollmentRow | null> {
  const admin = await adminAny()
  const { data, error } = await (admin.from("campaign_enrollments") as any)
    .select("*")
    .eq("id", enrollmentId)
    .single()
  if (error) return null
  return data as CampaignEnrollmentRow
}

export async function getEnrollmentsForCampaign(campaignId: string): Promise<EnrollmentWithLead[]> {
  const admin = await adminAny()
  const { data, error } = await (admin.from("campaign_enrollments") as any)
    .select(
      "*, lead:leads(id, company_name, contact_person, contact_email, country, industry)",
    )
    .eq("campaign_id", campaignId)
    .order("updated_at", { ascending: false })
  if (error) return []
  return (data ?? []) as EnrollmentWithLead[]
}

/** Số email campaign đã gửi hôm nay (cho daily limit) — đếm từ email_drafts. */
export async function countCampaignEmailsSentToday(campaignId: string): Promise<number> {
  const admin = await adminAny()
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)
  // Lọc qua enrollment ids của campaign (PostgREST không cho lọc lồng trực tiếp).
  const { data: enrollmentIds, error: enrollErr } = await (admin
    .from("campaign_enrollments") as any)
    .select("id")
    .eq("campaign_id", campaignId)
  if (enrollErr) return 0
  const ids = ((enrollmentIds ?? []) as Array<{ id: string }>).map((r) => r.id)
  if (ids.length === 0) return 0

  const { count, error } = await (admin.from("email_drafts") as any)
    .select("id", { count: "exact", head: true })
    .in("campaign_enrollment_id", ids)
    .eq("status", "sent")
    .gte("sent_at", startOfDay.toISOString())
  if (error) return 0
  return count ?? 0
}

/** Đếm tổng email campaign hệ thống đã gửi hôm nay (global limit). */
export async function countAllCampaignEmailsSentToday(): Promise<number> {
  const admin = await adminAny()
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)
  const { count, error } = await (admin.from("email_drafts") as any)
    .select("id", { count: "exact", head: true })
    .not("campaign_enrollment_id", "is", null)
    .eq("status", "sent")
    .gte("sent_at", startOfDay.toISOString())
  if (error) return 0
  return count ?? 0
}

export function isActiveEnrollmentState(state: EnrollmentState): boolean {
  return !(TERMINAL_STATES as readonly string[]).includes(state)
}
