"use server"

// Server actions cho /admin/campaigns (B1).
//
// RBAC:
//   - CAMPAIGN_VIEW  : xem trang/campaign.
//   - CAMPAIGN_MANAGE: duyệt/từ chối draft, pause/resume/stop enrollment,
//     resolve review, enroll lead.
//   - Tạo/activate campaign: chỉ admin/super_admin (check role trực tiếp).

import { requireCap } from "@/lib/auth/guard"
import { CAPS } from "@/lib/auth/permissions"
import { enrollLeads } from "@/lib/campaign/enrollments"
import { approveAndSendCampaignDraft, rejectCampaignDraft } from "@/lib/campaign/approve"
import { runCampaignSchedulerTick } from "@/lib/campaign/scheduler"
import { onManualPause, onManualStop, onReviewResolved } from "@/lib/campaign/state-machine"
import { applyTransition, getEnrollment } from "@/lib/campaign/enrollments"

export type ActionError = "unauthenticated" | "forbidden" | "serverError"

// ---------------------------------------------------------------------------
// Campaign CRUD (admin/super_admin)
// ---------------------------------------------------------------------------

export type CreateCampaignResult =
  | { ok: true; campaignId: string }
  | { ok: false; error: ActionError | "validation"; message?: string }

export async function createCampaignAction(input: {
  name: string
  description?: string
  targetSegment?: string
  productCategory?: string
  dailySendLimit?: number
}): Promise<CreateCampaignResult> {
  const guard = await requireCap(CAPS.CAMPAIGN_MANAGE)
  if (!guard.ok) return { ok: false, error: guard.error }
  if (guard.role !== "admin" && guard.role !== "super_admin") {
    return { ok: false, error: "forbidden", message: "Chỉ admin/super_admin được tạo campaign." }
  }
  if (!input.name?.trim()) return { ok: false, error: "validation", message: "Thiếu tên campaign." }

  try {
    const { data, error } = await (guard.admin.from("campaigns") as any)
      .insert({
        name: input.name.trim(),
        description: input.description?.trim() || null,
        target_segment: input.targetSegment?.trim() || null,
        product_category: input.productCategory?.trim() || null,
        status: "draft",
        daily_send_limit: Math.max(1, Math.min(input.dailySendLimit ?? 20, 200)),
        created_by: guard.userId,
      })
      .select("id")
      .single()
    if (error) return { ok: false, error: "serverError", message: error.message }
    return { ok: true, campaignId: (data as { id: string }).id }
  } catch (err) {
    console.error("[campaign] createCampaignAction:", err)
    return { ok: false, error: "serverError" }
  }
}

export type SetCampaignStatusResult =
  | { ok: true }
  | { ok: false; error: ActionError | "invalid_status" | "serverError"; message?: string }

export async function setCampaignStatusAction(campaignId: string, status: "active" | "paused" | "completed" | "archived"): Promise<SetCampaignStatusResult> {
  const guard = await requireCap(CAPS.CAMPAIGN_MANAGE)
  if (!guard.ok) return { ok: false, error: guard.error }
  if (guard.role !== "admin" && guard.role !== "super_admin") {
    return { ok: false, error: "forbidden", message: "Chỉ admin/super_admin đổi trạng thái campaign." }
  }
  try {
    // 'active' chỉ hợp lệ khi campaign đã có steps (cron bỏ qua campaign trống).
    const { count } = await (guard.admin.from("campaign_steps") as any)
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
    if (status === "active" && !count) {
      return { ok: false, error: "invalid_status", message: "Campaign chưa có bước sequence." }
    }
    const { error } = await (guard.admin.from("campaigns") as any)
      .update({ status })
      .eq("id", campaignId)
    if (error) return { ok: false, error: "serverError", message: error.message }
    return { ok: true }
  } catch (err) {
    console.error("[campaign] setCampaignStatusAction:", err)
    return { ok: false, error: "serverError" }
  }
}

// ---------------------------------------------------------------------------
// Pilot enrollment (spec §3: 50–100 buyer có tín hiệu rõ)
// ---------------------------------------------------------------------------

export type ListAeResult =
  | { ok: true; aes: Array<{ id: string; name: string }> }
  | { ok: false; error: ActionError }

/** Danh sách account_executive (chọn owner khi enroll). */
export async function listAeAction(): Promise<ListAeResult> {
  const guard = await requireCap(CAPS.CAMPAIGN_VIEW)
  if (!guard.ok) return { ok: false, error: guard.error }
  try {
    const { data, error } = await (guard.admin.from("profiles") as any)
      .select("id, full_name")
      .in("role", ["account_executive", "staff", "admin", "super_admin"])
      .order("full_name", { ascending: true })
    if (error) return { ok: false, error: "serverError" }
    return {
      ok: true,
      aes: ((data ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => ({
        id: p.id,
        name: p.full_name ?? p.id.slice(0, 8),
      })),
    }
  } catch (err) {
    console.error("[campaign] listAeAction:", err)
    return { ok: false, error: "serverError" }
  }
}

export interface PilotCandidate {
  leadId: string
  companyName: string | null
  country: string | null
  industry: string | null
  contactEmail: string | null
  contactName: string | null
  shipmentCount: number | null
  vietnamSignal: string | null
  hsCodes: string[] | null
}

export type PilotPreviewResult =
  | { ok: true; candidates: PilotCandidate[] }
  | { ok: false; error: ActionError | "serverError"; message?: string }

/**
 * Preview danh sách lead đạt tiêu chí pilot (không enroll):
 *   - contact_email hợp lệ, chưa unsubscribe/bounce/complain
 *   - industry food-related (food|beverage|agriculture|seafood|snack|grocery...)
 *   - có tín hiệu VN: purchase_history hoặc top_suppliers nhắc "viet"
 * Shipment count chỉ là biến sắp xếp ưu tiên (desc), KHÔNG phải điều kiện.
 */
export async function previewPilotCandidatesAction(): Promise<PilotPreviewResult> {
  const guard = await requireCap(CAPS.CAMPAIGN_MANAGE)
  if (!guard.ok) return { ok: false, error: guard.error }

  try {
    const { data, error } = await (guard.admin.from("leads") as any)
      .select(
        `id, company_name, country, industry, contact_email, contact_person,
         customs_shipment_count, purchase_history, top_suppliers, hs_codes,
         email_unsubscribed, email_hard_bounced_at, email_complained_at`,
      )
      .not("contact_email", "is", null)
      .eq("email_unsubscribed", false)
      .is("email_hard_bounced_at", null)
      .is("email_complained_at", null)
      .order("customs_shipment_count", { ascending: false, nullsFirst: false })
      .limit(300)

    if (error) return { ok: false, error: "serverError", message: error.message }

    const FOOD_RE = /food|beverage|agricultur|seafood|snack|grocer|organic|natural|coffee|rice|spice|fruit|nut/i
    const VN_RE = /viet|vn\b/i

    const candidates: PilotCandidate[] = []
    for (const raw of (data ?? []) as never[]) {
      const l = raw as {
        id: string
        company_name: string | null
        country: string | null
        industry: string | null
        contact_email: string | null
        contact_person: string | null
        customs_shipment_count: number | null
        purchase_history: string | null
        top_suppliers: Array<{ supplier_name?: string; name?: string; country?: string }> | null
        hs_codes: string[] | null
      }
      const industry = l.industry ?? ""
      if (!FOOD_RE.test(industry)) continue
      const historyHasVN = l.purchase_history ? VN_RE.test(l.purchase_history) : false
      const supplierHasVN = (l.top_suppliers ?? []).some(
        (s) => (s.country ? VN_RE.test(s.country) : false) || (s.supplier_name ? VN_RE.test(s.supplier_name) : false) || (s.name ? VN_RE.test(s.name) : false),
      )
      if (!historyHasVN && !supplierHasVN) continue
      candidates.push({
        leadId: l.id,
        companyName: l.company_name,
        country: l.country,
        industry: l.industry,
        contactEmail: l.contact_email,
        contactName: l.contact_person,
        shipmentCount: l.customs_shipment_count,
        vietnamSignal: historyHasVN ? "purchase_history" : "top_suppliers",
        hsCodes: l.hs_codes,
      })
      if (candidates.length >= 200) break
    }

    return { ok: true, candidates }
  } catch (err) {
    console.error("[campaign] previewPilotCandidatesAction:", err)
    return { ok: false, error: "serverError" }
  }
}

export type EnrollLeadsResult =
  | { ok: true; enrolled: number; skipped: Array<{ leadId: string; reason: string }> }
  | { ok: false; error: ActionError | "validation" | "campaign_not_found" | "campaign_not_draft_or_active" | "serverError"; message?: string }

export async function enrollLeadsAction(input: {
  campaignId: string
  leadIds: string[]
  ownerId: string | null
}): Promise<EnrollLeadsResult> {
  const guard = await requireCap(CAPS.CAMPAIGN_MANAGE)
  if (!guard.ok) return { ok: false, error: guard.error }
  if (!input.leadIds?.length) return { ok: true, enrolled: 0, skipped: [] }
  if (input.leadIds.length > 100) {
    return { ok: false, error: "validation", message: "Tối đa 100 lead mỗi lần enroll (pilot)." }
  }
  try {
    const result = await enrollLeads(input.campaignId, input.leadIds, input.ownerId, guard.userId)
    if (!result.ok) {
      return { ok: false, error: result.error, message: result.message }
    }
    return result
  } catch (err) {
    console.error("[campaign] enrollLeadsAction:", err)
    return { ok: false, error: "serverError" }
  }
}

// ---------------------------------------------------------------------------
// Approval queue
// ---------------------------------------------------------------------------

export type ApproveDraftResult =
  | { ok: true }
  | { ok: false; error: ActionError | "not_found" | "not_pending" | "qa_blocked" | "send_failed"; message?: string }

export async function approveCampaignDraftAction(
  draftId: string,
  edit?: { subject?: string; content?: string },
): Promise<ApproveDraftResult> {
  const guard = await requireCap(CAPS.CAMPAIGN_MANAGE)
  if (!guard.ok) return { ok: false, error: guard.error as ActionError }
  const result = await approveAndSendCampaignDraft(draftId, edit)
  if (result.ok) return { ok: true }
  return { ok: false, error: result.error as ApproveDraftResult extends { ok: false; error: infer E } ? E : never, message: result.message }
}

export async function rejectCampaignDraftAction(draftId: string, reason: string): Promise<ApproveDraftResult> {
  const guard = await requireCap(CAPS.CAMPAIGN_MANAGE)
  if (!guard.ok) return { ok: false, error: guard.error as ActionError }
  if (!reason?.trim()) return { ok: false, error: "send_failed", message: "Cần lý do từ chối." }
  const result = await rejectCampaignDraft(draftId, reason.trim())
  if (result.ok) return { ok: true }
  return { ok: false, error: result.error as ApproveDraftResult extends { ok: false; error: infer E } ? E : never, message: result.message }
}

// ---------------------------------------------------------------------------
// Enrollment actions
// ---------------------------------------------------------------------------

export type EnrollmentActionResult =
  | { ok: true }
  | { ok: false; error: ActionError | "not_found" | "serverError"; message?: string }

async function loadOwnedEnrollment(enrollmentId: string) {
  const enrollment = await getEnrollment(enrollmentId)
  if (!enrollment) return null
  return enrollment
}

export async function pauseEnrollmentAction(enrollmentId: string, days: number): Promise<EnrollmentActionResult> {
  const guard = await requireCap(CAPS.CAMPAIGN_MANAGE)
  if (!guard.ok) return { ok: false, error: guard.error as ActionError }
  const enrollment = await loadOwnedEnrollment(enrollmentId)
  if (!enrollment) return { ok: false, error: "not_found" }
  if (guard.role === "account_executive" && enrollment.owner_id !== guard.userId) {
    return { ok: false, error: "forbidden" }
  }
  const until = days > 0 ? new Date(Date.now() + days * 86400000) : null
  const ok = await applyTransition(enrollment, onManualPause(enrollment.state, until), { performedBy: guard.userId })
  return ok ? { ok: true } : { ok: false, error: "serverError", message: "Transition bị từ chối." }
}

export async function stopEnrollmentAction(enrollmentId: string, reason: string): Promise<EnrollmentActionResult> {
  const guard = await requireCap(CAPS.CAMPAIGN_MANAGE)
  if (!guard.ok) return { ok: false, error: guard.error as ActionError }
  const enrollment = await loadOwnedEnrollment(enrollmentId)
  if (!enrollment) return { ok: false, error: "not_found" }
  if (guard.role === "account_executive" && enrollment.owner_id !== guard.userId) {
    return { ok: false, error: "forbidden" }
  }
  const ok = await applyTransition(enrollment, onManualStop(enrollment.state, reason || "manual_stop"), { performedBy: guard.userId })
  return ok ? { ok: true } : { ok: false, error: "serverError", message: "Transition bị từ chối." }
}

export async function resumeEnrollmentAction(enrollmentId: string): Promise<EnrollmentActionResult> {
  const guard = await requireCap(CAPS.CAMPAIGN_MANAGE)
  if (!guard.ok) return { ok: false, error: guard.error as ActionError }
  const enrollment = await loadOwnedEnrollment(enrollmentId)
  if (!enrollment) return { ok: false, error: "not_found" }
  if (guard.role === "account_executive" && enrollment.owner_id !== guard.userId) {
    return { ok: false, error: "forbidden" }
  }
  const decision = enrollment.needs_human_review ? "resume" : "resume"
  const ok = await applyTransition(enrollment, onReviewResolved(enrollment.state, decision), { performedBy: guard.userId })
  return ok ? { ok: true } : { ok: false, error: "serverError", message: "Transition bị từ chối." }
}

export async function resolveReviewAction(enrollmentId: string, decision: "resume" | "stop"): Promise<EnrollmentActionResult> {
  const guard = await requireCap(CAPS.CAMPAIGN_MANAGE)
  if (!guard.ok) return { ok: false, error: guard.error as ActionError }
  const enrollment = await loadOwnedEnrollment(enrollmentId)
  if (!enrollment) return { ok: false, error: "not_found" }
  if (guard.role === "account_executive" && enrollment.owner_id !== guard.userId) {
    return { ok: false, error: "forbidden" }
  }
  const ok = await applyTransition(enrollment, onReviewResolved(enrollment.state, decision), { performedBy: guard.userId })
  return ok ? { ok: true } : { ok: false, error: "serverError", message: "Transition bị từ chối." }
}

// ---------------------------------------------------------------------------
// Manual scheduler tick (admin) — test/đào tạo không cần chờ cron
// ---------------------------------------------------------------------------

export type RunSchedulerResult =
  | { ok: true; result: Awaited<ReturnType<typeof runCampaignSchedulerTick>> }
  | { ok: false; error: ActionError; message?: string }

export async function runSchedulerNowAction(): Promise<RunSchedulerResult> {
  const guard = await requireCap(CAPS.CAMPAIGN_MANAGE)
  if (!guard.ok) return { ok: false, error: guard.error }
  if (guard.role !== "admin" && guard.role !== "super_admin") {
    return { ok: false, error: "forbidden" }
  }
  try {
    const result = await runCampaignSchedulerTick()
    return { ok: true, result }
  } catch (err) {
    console.error("[campaign] runSchedulerNowAction:", err)
    return { ok: false, error: "serverError", message: err instanceof Error ? err.message : "unknown" }
  }
}
