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
import { NON_TERMINAL_ENROLLMENT_STATES } from "@/lib/campaign/constants"
import { approveAndSendCampaignDraft, rejectCampaignDraft } from "@/lib/campaign/approve"
import { runCampaignSchedulerTick } from "@/lib/campaign/scheduler"
import { buildBuyerContext } from "@/lib/campaign/context-builder"
import { generateCampaignEmail } from "@/lib/campaign/email-generator"
import { runEmailQA } from "@/lib/campaign/email-qa"
import { countriesMatch, getCampaignCountryMismatch } from "@/lib/campaign/country-validation"
import { COUNTRY_SUGGESTIONS } from "@/lib/constants/countries"
import { appendInteraction } from "@/lib/campaign/interactions"
import { onManualPause, onManualStop, onReviewResolved } from "@/lib/campaign/state-machine"
import { applyTransition, getCampaignSteps, getEnrollment } from "@/lib/campaign/enrollments"

export type ActionError = "unauthenticated" | "forbidden" | "serverError"

// ---------------------------------------------------------------------------
// Campaign CRUD (admin/super_admin)
// ---------------------------------------------------------------------------

export type CreateCampaignResult =
  | { ok: true; campaignId: string }
  | { ok: false; error: ActionError | "validation"; message?: string }

const DEFAULT_CAMPAIGN_STEPS = [
  {
    step_number: 1,
    step_type: "initial_outreach",
    delay_days: 0,
    objective: "Open with a modest, concrete filtering burden; explain Veximtrade's Vietnam-side groundwork and ask one natural question about current sourcing.",
    ai_prompt_guidance: "Email 1, conversational reference voice: 'If you are responsible for sourcing, you are probably used to hearing from new suppliers. The difficult part is deciding which ones are worth your team's time.' Explain naturally that each new source can involve company/product information, specifications, available export information, pricing, samples, and relevant import requirements. Much of the effort can be in screening rather than searching. Then explain Veximtrade's Vietnam-side groundwork, using 'review available information about capacity/export history' rather than claiming a guaranteed verification. Buyer makes the final decision. 120-160 prose words excluding opt-out/signature, one question about current sourcing, no meeting ask, no invented buyer facts, and preserve AE approval.",
  },
  {
    step_number: 2,
    step_type: "follow_up",
    delay_days: 4,
    objective: "Explain Veximtrade's Vietnam-side groundwork before introductions; distinguish the service from a directory or supplier list.",
    ai_prompt_guidance: "Email 2: use a natural transition from the prior note, such as 'Just wanted to clarify my last email a little.' A brief 'Hope you're having a good day' is optional, not mandatory. Explain that Veximtrade is not a directory for buyers to filter; we do the initial Vietnam-side groundwork, review available evidence about manufacturers, consider product fit and relevant requirements, and coordinate toward samples/quotations. A low-pressure 'If you have a specific product in mind, feel free to send the details and I'll take a look' is acceptable. Do not invent work/results or ask for a meeting.",
  },
  {
    step_number: 3,
    step_type: "follow_up",
    delay_days: 7,
    objective: "Explain how repeating sourcing groundwork can add sourcing cost or delay product development; the buyer retains the final decision.",
    ai_prompt_guidance: "Email 3: explain naturally that if every new product starts from the beginning, the repeated searching, screening, quotes, samples, and requirements review can become a significant burden in product development and add sourcing cost or delay a launch. Keep it conditional, not a claim about this buyer. Explain how Veximtrade can support initial groundwork; the buyer decides which supplier is suitable and whether to continue. Use a fresh opening and a gentle, natural product-specific invitation, with no meeting ask or pressure.",
  },
  {
    step_number: 4,
    step_type: "close_loop",
    delay_days: 30,
    objective: "Close the sequence without pressure; leave the door open if the target country becomes a relevant additional source later.",
    ai_prompt_guidance: "Email 4: use a warm, plain close. Say you will not keep following up if Vietnam sourcing is not in the buyer's plans now; leave the door open if they need an additional source later. Make clear no reply is needed. A brief goodwill line is optional. Do not request a meeting, ask a question, or add exaggerated praise.",
  },
] as const

export async function createCampaignAction(input: {
  name: string
  description?: string
  targetSegment?: string
  targetCountry: string
  productCategory?: string
  dailySendLimit?: number
}): Promise<CreateCampaignResult> {
  const guard = await requireCap(CAPS.CAMPAIGN_MANAGE)
  if (!guard.ok) return { ok: false, error: guard.error }
  if (guard.role !== "admin" && guard.role !== "super_admin") {
    return { ok: false, error: "forbidden", message: "Chỉ admin/super_admin được tạo campaign." }
  }
  if (!input.name?.trim()) return { ok: false, error: "validation", message: "Thiếu tên campaign." }
  if (!COUNTRY_SUGGESTIONS.some((country) => countriesMatch(country, input.targetCountry))) {
    return { ok: false, error: "validation", message: "Chọn quốc gia mục tiêu hợp lệ cho campaign." }
  }

  try {
    const { data, error } = await (guard.admin.from("campaigns") as any)
      .insert({
        name: input.name.trim(),
        description: input.description?.trim() || null,
        target_segment: input.targetSegment?.trim() || null,
        target_country: input.targetCountry.trim(),
        product_category: input.productCategory?.trim() || null,
        status: "draft",
        daily_send_limit: Math.max(1, Math.min(input.dailySendLimit ?? 20, 200)),
        created_by: guard.userId,
      })
      .select("id")
      .single()
    if (error) return { ok: false, error: "serverError", message: error.message }
    const campaignId = (data as { id: string }).id
    const { error: stepsError } = await (guard.admin.from("campaign_steps") as any).insert(
      DEFAULT_CAMPAIGN_STEPS.map((step) => ({
        campaign_id: campaignId,
        ...step,
        max_attempts: 1,
        stop_conditions: { stop: ["any_reply", "opt_out", "hard_bounce", "invalid_contact"] },
      })),
    )
    if (stepsError) {
      await (guard.admin.from("campaigns") as any).delete().eq("id", campaignId)
      return { ok: false, error: "serverError", message: `Tạo campaign steps thất bại: ${stepsError.message}` }
    }
    return { ok: true, campaignId }
  } catch (err) {
    console.error("[campaign] createCampaignAction:", err)
    return { ok: false, error: "serverError" }
  }
}

export type SetCampaignStatusResult =
  | { ok: true }
  | { ok: false; error: ActionError | "invalid_status" | "serverError"; message?: string }

export async function setCampaignStatusAction(campaignId: string, status: "draft" | "active" | "paused" | "completed" | "archived"): Promise<SetCampaignStatusResult> {
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
// Sequence steps: clone từ campaign có sẵn (campaign mới tạo ra không có steps
// — scheduler bỏ qua + không activate được cho tới khi có steps)
// ---------------------------------------------------------------------------

export type CloneStepsResult =
  | { ok: true; copied: number }
  | { ok: false; error: ActionError | "source_empty" | "target_not_empty" | "serverError"; message?: string }

export async function cloneStepsAction(sourceCampaignId: string, targetCampaignId: string): Promise<CloneStepsResult> {
  const guard = await requireCap(CAPS.CAMPAIGN_MANAGE)
  if (!guard.ok) return { ok: false, error: guard.error }
  if (guard.role !== "admin" && guard.role !== "super_admin") {
    return { ok: false, error: "forbidden", message: "Chỉ admin/super_admin được sao chép sequence." }
  }
  if (sourceCampaignId === targetCampaignId) {
    return { ok: false, error: "target_not_empty", message: "Không thể tự clone chính nó." }
  }
  try {
    const { count: targetCount } = await (guard.admin.from("campaign_steps") as any)
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", targetCampaignId)
    if ((targetCount ?? 0) > 0) {
      return { ok: false, error: "target_not_empty", message: "Campaign đích đã có steps." }
    }

    const { data: sourceSteps, error: srcErr } = await (guard.admin.from("campaign_steps") as any)
      .select("step_number, step_type, delay_days, objective, ai_prompt_guidance, max_attempts, stop_conditions")
      .eq("campaign_id", sourceCampaignId)
      .order("step_number", { ascending: true })
    if (srcErr) return { ok: false, error: "serverError", message: srcErr.message }
    if (!sourceSteps || (sourceSteps as never[]).length === 0) {
      return { ok: false, error: "source_empty", message: "Campaign nguồn chưa có steps." }
    }

    const rows = (sourceSteps as Array<Record<string, unknown>>).map((s) => ({
      campaign_id: targetCampaignId,
      step_number: s.step_number,
      step_type: s.step_type,
      delay_days: s.delay_days,
      objective: s.objective,
      ai_prompt_guidance: s.ai_prompt_guidance,
      max_attempts: s.max_attempts,
      stop_conditions: s.stop_conditions,
    }))
    const { error: insErr } = await (guard.admin.from("campaign_steps") as any).insert(rows)
    if (insErr) return { ok: false, error: "serverError", message: insErr.message }

    await (guard.admin.from("activities") as any).insert({
      opportunity_id: null,
      action_type: "campaign_steps_cloned",
      description: `[Campaign] Clone ${rows.length} steps từ ${sourceCampaignId} sang ${targetCampaignId} (bởi ${guard.userId})`,
      performed_by: guard.userId,
    })
    return { ok: true, copied: rows.length }
  } catch (err) {
    console.error("[campaign] cloneStepsAction:", err)
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
  | { ok: false; error: ActionError | "campaign_not_found" | "serverError"; message?: string }

/**
 * Preview danh sách lead đạt tiêu chí pilot (không enroll):
 *   - country khớp campaign.target_country
 *   - contact_email hợp lệ, chưa unsubscribe/bounce/complain
 *   - industry food-related (food|beverage|agriculture|seafood|snack|grocery...)
 *   - có tín hiệu VN: purchase_history hoặc top_suppliers nhắc "viet"
 * Shipment count chỉ là biến sắp xếp ưu tiên (desc), KHÔNG phải điều kiện.
 */
export async function previewPilotCandidatesAction(campaignId: string): Promise<PilotPreviewResult> {
  const guard = await requireCap(CAPS.CAMPAIGN_MANAGE)
  if (!guard.ok) return { ok: false, error: guard.error }

  try {
    const { data: campaign, error: campaignError } = await (guard.admin.from("campaigns") as any)
      .select("id, target_country")
      .eq("id", campaignId)
      .single()
    if (campaignError || !campaign) return { ok: false, error: "campaign_not_found" }
    if (!campaign.target_country) {
      return { ok: false, error: "serverError", message: "Campaign chưa có quốc gia mục tiêu; hãy tạo lại campaign và chọn quốc gia." }
    }

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
      .limit(3000)

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
      if (!countriesMatch(l.country, campaign.target_country)) continue
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

    // Loại lead đang có engagement MỞ (AE đã claim) — tránh enroll người đang
    // ở lane con người; chống double-email từ đầu thay vì vá sau.
    if (candidates.length > 0) {
      const { data: busyEng } = await (guard.admin.from("buyer_engagements") as any)
        .select("lead_id")
        .in("lead_id", candidates.map((c) => c.leadId))
        .not("stage", "in", '("converted","dropped")')
      const busyLeadIds = new Set(((busyEng ?? []) as Array<{ lead_id: string }>).map((r) => r.lead_id))

      // Buyers already in any non-terminal campaign enrollment are omitted too.
      // The database's unique active-enrollment index remains the final guard,
      // but the preview should not invite an AE to select buyers that will skip.
      const { data: enrolledRows, error: enrolledError } = await (guard.admin.from("campaign_enrollments") as any)
        .select("lead_id")
        .in("lead_id", candidates.map((c) => c.leadId))
        .in("state", NON_TERMINAL_ENROLLMENT_STATES as readonly string[])
      if (enrolledError) {
        return { ok: false, error: "serverError", message: "Không kiểm tra được enrollment campaign hiện tại; vui lòng thử lại." }
      }
      const enrolledLeadIds = new Set(((enrolledRows ?? []) as Array<{ lead_id: string }>).map((r) => r.lead_id))

      const filtered = candidates.filter((c) => !busyLeadIds.has(c.leadId) && !enrolledLeadIds.has(c.leadId))
      return { ok: true, candidates: filtered }
    }

    return { ok: true, candidates }
  } catch (err) {
    console.error("[campaign] previewPilotCandidatesAction:", err)
    return { ok: false, error: "serverError" }
  }
}

export type EnrollLeadsResult =
  | { ok: true; enrolled: number; skipped: Array<{ leadId: string; reason: string }> }
  | { ok: false; error: ActionError | "validation" | "campaign_not_found" | "campaign_not_draft_or_active" | "pilot_cap_reached" | "serverError"; message?: string }

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
    const { data: campaign, error: campaignError } = await (guard.admin.from("campaigns") as any)
      .select("id, target_country")
      .eq("id", input.campaignId)
      .single()
    if (campaignError || !campaign) return { ok: false, error: "campaign_not_found" }
    if (!campaign.target_country) {
      return { ok: false, error: "validation", message: "Campaign chưa có quốc gia mục tiêu." }
    }

    const { data: leads, error: leadsError } = await (guard.admin.from("leads") as any)
      .select("id, country")
      .in("id", input.leadIds)
    if (leadsError) return { ok: false, error: "serverError", message: leadsError.message }
    const leadRows = (leads ?? []) as Array<{ id: string; country: string | null }>
    const byId = new Map(leadRows.map((lead) => [lead.id, lead]))
    const eligibleIds = input.leadIds.filter((id) => countriesMatch(byId.get(id)?.country, campaign.target_country))
    const skippedCountry = input.leadIds
      .filter((id) => !eligibleIds.includes(id))
      .map((leadId) => ({ leadId, reason: `country_mismatch:${byId.get(leadId)?.country ?? "missing"}` }))

    const result = eligibleIds.length
      ? await enrollLeads(input.campaignId, eligibleIds, input.ownerId, guard.userId)
      : { ok: true as const, enrolled: 0, skipped: [] as Array<{ leadId: string; reason: string }> }
    if (!result.ok) {
      return { ok: false, error: result.error, message: result.message }
    }
    return { ...result, skipped: [...result.skipped, ...skippedCountry] }
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
  | { ok: false; error: ActionError | "not_found" | "not_pending" | "not_eligible" | "qa_blocked" | "send_failed"; message?: string }

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

export type RegenerateCampaignDraftResult =
  | { ok: true; qaBlocked: boolean; riskLevel: "LOW" | "MEDIUM" | "HIGH"; qaMessage?: string }
  | { ok: false; error: ActionError | "not_found" | "not_pending" | "not_eligible" | "serverError"; message?: string }

/**
 * Regenerate a pending campaign draft in place. This deliberately does NOT
 * reject it or create another draft row, so prompt refreshes don't inflate the
 * pilot's AI-rejection metric. No email is sent by this action.
 */
export async function regenerateCampaignDraftAction(draftId: string): Promise<RegenerateCampaignDraftResult> {
  const guard = await requireCap(CAPS.CAMPAIGN_MANAGE)
  if (!guard.ok) return { ok: false, error: guard.error as ActionError }

  try {
    const { data: draft, error: draftError } = await (guard.admin.from("email_drafts") as any)
      .select("id, lead_id, campaign_enrollment_id, campaign_step_number, recipient_email, status")
      .eq("id", draftId)
      .single()

    if (draftError || !draft?.campaign_enrollment_id || !draft.campaign_step_number) {
      return { ok: false, error: "not_found", message: "Không tìm thấy campaign draft." }
    }
    if (!["pending_approval", "draft"].includes(draft.status)) {
      return { ok: false, error: "not_pending", message: "Draft đã được duyệt, gửi hoặc xử lý; không thể tạo lại." }
    }

    const enrollment = await getEnrollment(draft.campaign_enrollment_id)
    if (!enrollment || enrollment.lead_id !== draft.lead_id) {
      return { ok: false, error: "not_found", message: "Không tìm thấy enrollment của draft." }
    }
    if (guard.role === "account_executive" && enrollment.owner_id !== guard.userId) {
      return { ok: false, error: "forbidden", message: "Bạn không sở hữu enrollment này." }
    }

    const steps = await getCampaignSteps(enrollment.campaign_id)
    const step = steps.find((item) => item.step_number === draft.campaign_step_number)
    if (!step) return { ok: false, error: "not_found", message: "Không tìm thấy cấu hình campaign step." }

    const ctx = await buildBuyerContext(enrollment, step)
    const countryMismatch = getCampaignCountryMismatch(ctx)
    if (countryMismatch) {
      const { error: blockError } = await (guard.admin.from("email_drafts") as any)
        .update({ status: "draft", error_message: `not_eligible_country: ${countryMismatch}` })
        .eq("id", draftId)
        .in("status", ["pending_approval", "draft"])
      if (blockError) throw new Error(blockError.message)
      await applyTransition(enrollment, onManualStop(enrollment.state, `campaign_country_mismatch:${countryMismatch}`))
      return { ok: false, error: "not_eligible", message: countryMismatch }
    }

    const signatureUserId = enrollment.owner_id ?? guard.userId
    const { data: owner } = await (guard.admin.from("profiles") as any)
      .select("full_name")
      .eq("id", signatureUserId)
      .maybeSingle()
    const senderName = (owner as { full_name?: string | null } | null)?.full_name ?? null

    const generated = await generateCampaignEmail(ctx, step.step_type, step.ai_prompt_guidance, senderName)
    const qa = runEmailQA({
      email: { subjectEn: generated.subjectEn, contentEn: generated.contentEn },
      recipient: draft.recipient_email ?? ctx.buyer.contact_email,
      ctx,
      optOutRequired: true,
      stepType: step.step_type,
    })
    const qaBlocked = !qa.passed
    const status = qaBlocked ? "draft" : "pending_approval"
    const { data: updated, error: updateError } = await (guard.admin.from("email_drafts") as any)
      .update({
        generated_subject: generated.subjectEn,
        generated_content_en: generated.contentEn,
        translated_content_vi: generated.contentVi,
        ai_prompt: `campaign:${ctx.campaign.name} step ${step.step_number} (${step.step_type}). Objective: ${step.objective ?? ""}. Guidance: ${step.ai_prompt_guidance ?? ""}. Regenerated by ${guard.userId}. QA: ${qa.risk_level}.`,
        status,
        error_message: qaBlocked ? `QA blocked: ${qa.issues.filter((issue) => issue.severity === "HIGH" || issue.blocking).map((issue) => `${issue.severity}:${issue.check}`).join(", ")}` : null,
      })
      .eq("id", draftId)
      .in("status", ["pending_approval", "draft"])
      .select("id")
      .maybeSingle()

    if (updateError) throw new Error(updateError.message)
    if (!updated) return { ok: false, error: "not_pending", message: "Draft vừa được xử lý ở nơi khác; hãy tải lại trang." }

    await appendInteraction(
      {
        buyer_id: enrollment.lead_id,
        campaign_id: enrollment.campaign_id,
        enrollment_id: enrollment.id,
        interaction_type: "SYSTEM_EVENT",
        direction: "INTERNAL",
        subject: "draft_regenerated",
        sequence_step: step.step_number,
        metadata: {
          draft_id: draftId,
          regenerated_by: guard.userId,
          qa_result: qa,
          replaced_in_place: true,
        },
        created_by: guard.userId,
      },
      {
        actionType: "campaign_draft_regenerated",
        description: `[Campaign] Draft step ${step.step_number} được tạo lại theo prompt hiện tại cho enrollment ${enrollment.id}; QA ${qa.risk_level}${qaBlocked ? " (blocked)" : ""}.`,
        performedBy: guard.userId,
      },
    )

    return {
      ok: true,
      qaBlocked,
      riskLevel: qa.risk_level,
      ...(qaBlocked ? { qaMessage: qa.issues.filter((issue) => issue.severity === "HIGH" || issue.blocking === true).map((issue) => issue.message).join(" ") } : {}),
    }
  } catch (err) {
    console.error("[campaign] regenerateCampaignDraftAction:", err)
    return { ok: false, error: "serverError", message: err instanceof Error ? err.message : "Không thể tạo lại draft." }
  }
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
  const decision = "resume" as const
  // Bugfix 27/09/2026: resume phải biết enrollment đã từng được liên hệ chưa
  // (pause từ 'enrolled' → resume phải về 'enrolled'/step1_due, không phải
  // waiting_reply/followup_due — xem onReviewResolved).
  const neverContacted = !enrollment.last_contact_at && enrollment.followup_count === 0 && enrollment.current_step_number <= 1
  const ok = await applyTransition(enrollment, onReviewResolved(enrollment.state, decision, new Date(), { neverContacted }), { performedBy: guard.userId })
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
  const neverContacted = !enrollment.last_contact_at && enrollment.followup_count === 0 && enrollment.current_step_number <= 1
  const ok = await applyTransition(enrollment, onReviewResolved(enrollment.state, decision, new Date(), { neverContacted }), { performedBy: guard.userId })
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
