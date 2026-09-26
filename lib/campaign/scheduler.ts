// Campaign scheduler — "WHEN" engine (spec §9). Chạy hourly qua
// /api/cron/campaign-scheduler (vercel.json). Idempotent ở mọi bước:
//
//   1. Reclaim firing treo (claimed > 30′ không ra draft) → failed, enrollment
//      được đặt lại mốc retry.
//   2. STOP/suppression check TRƯỚC mọi hành động → chuyển terminal nếu cần.
//   3. PAUSED hết hạn → resume WAITING_REPLY.
//   4. approval_overdue_check → nhắc AE (shadow mode không tự gửi).
//   5. enrolled/step_retry đến hạn → claim firing (INSERT ON CONFLICT —
//      exactly-once) → BuyerContext → AI generate → QA → email_drafts
//      'pending_approval' → nhắc AE.
//   6. contacted grace → waiting_reply.
//   7. followup_due → claim → sinh follow-up (step kế hoặc NURTURE nếu hết bảng).
//   8. Daily limits (per-campaign + global) kiểm TRƯỚC khi sinh.
//   9. Integrity check: enrollment active thiếu next_action_at → đặt lại + log.
//
// Mỗi tick xử lý tối đa MAX_PER_TICK enrollment/campaign để không vượt timeout.

import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  FIRING_RECLAIM_MINUTES,
  GLOBAL_DAILY_SEND_LIMIT,
  type EnrollmentState,
  isTerminalState,
} from "./constants"
import {
  onContactedGraceElapsed,
  onDraftGenerationFailed,
  onDraftQueuedForApproval,
  onNurtureDue,
  onStepDue,
  onSuppression,
  onInvalidContact,
  onResumeAfterPause,
} from "./state-machine"
import { applyTransition, countAllCampaignEmailsSentToday, countCampaignEmailsSentToday, getCampaign, getCampaignSteps } from "./enrollments"
import { buildBuyerContext } from "./context-builder"
import { assessFollowupJustification, applyFollowupGateDecision } from "./followup-gate"
import { generateCampaignEmail } from "./email-generator"
import { runEmailQA } from "./email-qa"
import { checkLeadStop } from "./suppression"
import { resolveEnrollmentTimezone, checkSendingWindow } from "./sending-window"
import { appendInteraction, logSystemEvent } from "./interactions"
import { dispatchNotification } from "@/lib/notifications/dispatcher"

const MAX_PER_TICK_PER_STATE = 25

export interface TickResult {
  reclaimed: number
  suppressed: number
  resumed: number
  draftsQueued: number
  draftFailures: number
  graceAdvanced: number
  followupsQueued: number
  gateSkipped: number
  gateHold: number
  rescheduledWindow: number
  yieldedToEngagement: number
  nurtured: number
  approvalReminders: number
  integrityFixes: number
  errors: string[]
}

// ---------------------------------------------------------------------------
// Claim (idempotency lock)
// ---------------------------------------------------------------------------

/**
 * Claim một step — idempotency lock exactly-once.
 *
 * 1. RE-CLAIM: hàng firing đang 'failed'/'skipped' (draft bị reject, AI lỗi)
 *    được claim lại bằng UPDATE có điều kiện status — atomic ở Postgres: 2
 *    scheduler chạy chồng thì chỉ 1 thấy status='failed' (kia block trên row
 *    lock rồi re-evaluate WHERE trên bản mới → 0 dòng).
 * 2. CLAIM MỚI: INSERT ... UNIQUE(firing_key); conflict (23505) = tick khác
 *    đang giữ lock → skip.
 */
async function claimStep(enrollmentId: string, stepNumber: number): Promise<boolean> {
  const admin = createAdminClient()

  const { data: reclaimed } = await (admin.from("campaign_step_firings") as any)
    .update({ status: "claimed", claimed_at: new Date().toISOString(), resolved_at: null, error: null })
    .eq("enrollment_id", enrollmentId)
    .eq("step_number", stepNumber)
    .in("status", ["failed", "skipped"])
    .select("id")

  if ((reclaimed ?? []).length > 0) return true

  const { error } = await (admin.from("campaign_step_firings") as any)
    .insert({
      enrollment_id: enrollmentId,
      step_number: stepNumber,
      firing_key: `${enrollmentId}:${stepNumber}`,
      status: "claimed",
    })
    .select("id")
    .single()

  if (error) {
    const code = (error as { code?: string }).code
    if (code === "23505") return false // đã claim (bởi tick khác hoặc đang sent/draft_created)
    console.error("[campaign] claimStep insert failed:", error)
    return false
  }
  return true
}

async function resolveFiring(
  enrollmentId: string,
  stepNumber: number,
  status: "draft_created" | "sent" | "failed" | "skipped",
  extras?: { draftId?: string | null; error?: string | null },
): Promise<void> {
  const admin = createAdminClient()
  await (admin.from("campaign_step_firings") as any)
    .update({
      status,
      resolved_at: new Date().toISOString(),
      ...(extras?.draftId ? { draft_id: extras.draftId } : {}),
      ...(extras?.error ? { error: extras.error } : {}),
    })
    .eq("enrollment_id", enrollmentId)
    .eq("step_number", stepNumber)
    .eq("status", "claimed")
}

// ---------------------------------------------------------------------------
// Draft creation (dùng chung cho step 1 và follow-up)
// ---------------------------------------------------------------------------

const DRAFT_TYPE_BY_STEP: Record<string, "introduction" | "follow_up" | "custom"> = {
  initial_outreach: "introduction",
  follow_up: "follow_up",
  close_loop: "custom",
  nurture: "custom",
}

async function queueDraftForEnrollment(
  enrollment: { id: string; lead_id: string; campaign_id: string; state: EnrollmentState; current_step_number: number; followup_count: number },
  step: { step_number: number; step_type: string; objective: string | null; ai_prompt_guidance: string | null },
  campaignName: string,
  ownerId: string | null,
  prebuiltCtx?: import("./types").BuyerContext,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient()

  // STOP check lần cuối trước khi tốn tiền AI.
  const stop = await checkLeadStop(enrollment.lead_id)
  if (!stop.ok) {
    const transition = stop.state === "suppressed" ? onSuppression(enrollment.state, stop.reason) : onInvalidContact(enrollment.state, stop.reason)
    await applyTransition(enrollment, transition)
    await resolveFiring(enrollment.id, step.step_number, "skipped", { error: stop.reason })
    return { ok: false, error: `stopped: ${stop.reason}` }
  }
  const contactEmail = stop.lead!.contact_email!

  // Lead data cho QA + draft + signature cá nhân (tên AE owner khớp From).
  const { data: leadRow } = await admin
    .from("leads")
    .select("company_name, contact_person")
    .eq("id", enrollment.lead_id)
    .single()
  let senderName: string | null = null
  if (ownerId) {
    const { data: ownerProfile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", ownerId)
      .single()
    senderName = (ownerProfile as { full_name?: string } | null)?.full_name ?? null
  }

  try {
    const ctx = prebuiltCtx ?? (await buildBuyerContext(enrollment as never, step as never))
    const generated = await generateCampaignEmail(ctx, step.step_type, step.ai_prompt_guidance, senderName)

    const qa = runEmailQA({
      email: { subjectEn: generated.subjectEn, contentEn: generated.contentEn },
      recipient: contactEmail,
      ctx,
      optOutRequired: step.step_number >= 2,
    })

    if (qa.risk_level === "HIGH") {
      // QA HIGH → không tạo draft gửi được. Vẫn tạo draft để AE xem lỗi
      // (status 'draft', KHÔNG 'pending_approval') + ghi issue.
      const { data: blockedDraft, error: dErr } = await (admin.from("email_drafts") as any)
        .insert({
          opportunity_id: null,
          lead_id: enrollment.lead_id,
          campaign_enrollment_id: enrollment.id,
          campaign_step_number: step.step_number,
          email_type: DRAFT_TYPE_BY_STEP[step.step_type] ?? "custom",
          ai_prompt: `campaign:${campaignName} step ${step.step_number} (${step.step_type}). QA FAILED: ${qa.issues.map((i) => `${i.severity}:${i.check}`).join(", ")}`,
          generated_subject: generated.subjectEn,
          generated_content_en: generated.contentEn,
          translated_content_vi: generated.contentVi,
          status: "draft",
          recipient_email: contactEmail,
        })
        .select("id")
        .single()

      if (dErr) console.error("[campaign] blocked draft insert failed:", dErr)

      await appendInteraction(
        {
          buyer_id: enrollment.lead_id,
          campaign_id: enrollment.campaign_id,
          enrollment_id: enrollment.id,
          interaction_type: "EMAIL",
          direction: "OUTBOUND",
          subject: generated.subjectEn,
          content: generated.contentEn,
          sender: "vexim-ai",
          recipient: contactEmail,
          sequence_step: step.step_number,
          ai_generated: true,
          human_approved: false,
          metadata: {
            qa_result: qa,
            blocked: true,
            draft_id: (blockedDraft as { id?: string } | null)?.id ?? null,
            model: generated.model,
          },
          draft_id: (blockedDraft as { id?: string } | null)?.id ?? null,
        },
        {
          actionType: "campaign_email_qa_blocked",
          description: `[Campaign] QA HIGH chặn draft step ${step.step_number} cho lead ${enrollment.lead_id}: ${qa.issues.map((i) => i.message).join(" | ")}`,
        },
      )

      await resolveFiring(enrollment.id, step.step_number, "failed", { error: "qa_high_risk" })
      await applyTransition(enrollment, onDraftGenerationFailed(enrollment.state))
      if (ownerId) {
        await dispatchNotification({
          userId: ownerId,
          category: "action_required",
          opportunityId: null,
          linkPath: `/admin/campaigns/${enrollment.campaign_id}`,
          dedupKey: `campaign_qa_blocked:${enrollment.id}:${step.step_number}`,
          title: { vi: "Campaign: draft bị QA chặn", en: "Campaign: draft blocked by QA" },
          body: {
            vi: `Draft step ${step.step_number} rủi ro HIGH — cần AE viết tay hoặc bỏ qua. Lý do: ${qa.issues.map((i) => i.message).join("; ")}`,
            en: `Step ${step.step_number} draft is HIGH risk — write manually or skip. Issues: ${qa.issues.map((i) => i.message).join("; ")}`,
          },
          ctaLabel: { vi: "Mở campaign", en: "Open campaign" },
        })
      }
      return { ok: false, error: "qa_high_risk" }
    }

    // QA pass (LOW/MEDIUM) → draft chờ duyệt.
    const { data: draft, error: draftErr } = await (admin.from("email_drafts") as any)
      .insert({
        opportunity_id: null,
        lead_id: enrollment.lead_id,
        campaign_enrollment_id: enrollment.id,
        campaign_step_number: step.step_number,
        email_type: DRAFT_TYPE_BY_STEP[step.step_type] ?? "custom",
        ai_prompt: `campaign:${campaignName} step ${step.step_number} (${step.step_type}). Objective: ${step.objective ?? ""}. Guidance: ${step.ai_prompt_guidance ?? ""}`,
        generated_subject: generated.subjectEn,
        generated_content_en: generated.contentEn,
        translated_content_vi: generated.contentVi,
        status: "pending_approval",
        recipient_email: contactEmail,
      })
      .select("id")
      .single()

    if (draftErr || !draft) {
      throw new Error(`draft insert failed: ${draftErr?.message ?? "no row"}`)
    }
    const draftId = (draft as { id: string }).id

    await appendInteraction(
      {
        buyer_id: enrollment.lead_id,
        campaign_id: enrollment.campaign_id,
        enrollment_id: enrollment.id,
        interaction_type: "EMAIL",
        direction: "OUTBOUND",
        subject: generated.subjectEn,
        content: generated.contentEn,
        sender: "vexim-ai",
        recipient: contactEmail,
        sequence_step: step.step_number,
        ai_generated: true,
        human_approved: false,
        metadata: {
          qa_result: qa,
          blocked: false,
          model: generated.model,
          ai_content_vi: generated.contentVi,
        },
        draft_id: draftId,
      },
      {
        actionType: "campaign_email_queued",
        description: `[Campaign] AI draft step ${step.step_number} (QA ${qa.risk_level}, ${qa.word_count} từ) chờ duyệt — lead ${enrollment.lead_id} (company: ${(leadRow as { company_name?: string } | null)?.company_name ?? "n/a"})`,
      },
    )

    await resolveFiring(enrollment.id, step.step_number, "draft_created", { draftId })
    await applyTransition(
      enrollment,
      step.step_number === 1 ? onStepDue(enrollment.state, new Date()) : onDraftQueuedForApproval(enrollment.state),
    )

    if (ownerId) {
      await dispatchNotification({
        userId: ownerId,
        category: "action_required",
        opportunityId: null,
        linkPath: `/admin/campaigns/${enrollment.campaign_id}`,
        dedupKey: `campaign_draft_queued:${enrollment.id}:${step.step_number}`,
        title: { vi: "Campaign: draft chờ duyệt", en: "Campaign: draft awaiting approval" },
        body: {
          vi: `Step ${step.step_number} cho buyer đã sinh xong (QA ${qa.risk_level}). Vào approval queue để xem/chỉnh/gửi.`,
          en: `Step ${step.step_number} draft ready (QA ${qa.risk_level}). Review, edit, and send from the approval queue.`,
        },
        ctaLabel: { vi: "Duyệt email", en: "Review draft" },
      })
    }

    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[campaign] queueDraftForEnrollment failed:", enrollment.id, message)
    await resolveFiring(enrollment.id, step.step_number, "failed", { error: message.slice(0, 500) })
    await applyTransition(enrollment, onDraftGenerationFailed(enrollment.state))
    return { ok: false, error: message }
  }
}

// ---------------------------------------------------------------------------
// Tick chính
// ---------------------------------------------------------------------------

export async function runCampaignSchedulerTick(): Promise<TickResult> {
  const admin = createAdminClient()
  const now = new Date()
  const result: TickResult = {
    reclaimed: 0,
    suppressed: 0,
    resumed: 0,
    draftsQueued: 0,
    draftFailures: 0,
    graceAdvanced: 0,
    followupsQueued: 0,
    gateSkipped: 0,
    gateHold: 0,
    rescheduledWindow: 0,
    yieldedToEngagement: 0,
    nurtured: 0,
    approvalReminders: 0,
    integrityFixes: 0,
    errors: [],
  }

  // ---- 1. Reclaim stuck firings -------------------------------------------
  const reclaimCutoff = new Date(now.getTime() - FIRING_RECLAIM_MINUTES * 60 * 1000).toISOString()
  const { data: stuck } = await (admin.from("campaign_step_firings") as any)
    .select("id, enrollment_id, step_number")
    .eq("status", "claimed")
    .lt("claimed_at", reclaimCutoff)

  for (const firing of (stuck ?? []) as Array<{ id: string; enrollment_id: string; step_number: number }>) {
    await (admin.from("campaign_step_firings") as any)
      .update({ status: "failed", resolved_at: now.toISOString(), error: "reclaimed_stuck_claim" })
      .eq("id", firing.id)
      .eq("status", "claimed")
    await (admin.from("campaign_enrollments") as any)
      .update({ next_action_at: now.toISOString(), next_action_type: "step_retry" })
      .eq("id", firing.enrollment_id)
    result.reclaimed += 1
  }

  // ---- 2. Active campaigns -------------------------------------------------
  const { data: campaigns, error: campErr } = await (admin.from("campaigns") as any)
    .select("*")
    .eq("status", "active")

  if (campErr) {
    result.errors.push(`campaigns query: ${campErr.message}`)
    return result
  }

  for (const campaign of (campaigns ?? []) as Array<{ id: string; name: string; daily_send_limit: number; end_date: string | null }>) {
    // end_date qua thì tự chuyển completed.
    if (campaign.end_date && new Date(campaign.end_date) < now) {
      await (admin.from("campaigns") as any).update({ status: "completed" }).eq("id", campaign.id)
      continue
    }

    const steps = await getCampaignSteps(campaign.id)
    if (steps.length === 0) continue
    const maxStep = steps[steps.length - 1].step_number

    const { data: due, error: dueErr } = await (admin.from("campaign_enrollments") as any)
      .select("*")
      .eq("campaign_id", campaign.id)
      .in("state", ["enrolled", "contacted", "waiting_reply", "followup_1", "followup_2", "paused"])
      .lte("next_action_at", now.toISOString())
      .order("next_action_at", { ascending: true })
      .limit(MAX_PER_TICK_PER_STATE * 4)

    if (dueErr) {
      result.errors.push(`enrollments due query: ${dueErr.message}`)
      continue
    }

    let sentToday = -1 // lazy count
    const getSentToday = async () => {
      if (sentToday < 0) sentToday = await countCampaignEmailsSentToday(campaign.id)
      return sentToday
    }

    for (const enrollment of (due ?? []) as never[]) {
      const e = enrollment as {
        id: string; lead_id: string; campaign_id: string; state: EnrollmentState
        current_step_number: number; followup_count: number; owner_id: string | null
        needs_human_review: boolean; next_action_type: string | null
        last_contact_at: string | null
      }

      try {
        // STOP check trước mọi thứ (spec §13).
        const stop = await checkLeadStop(e.lead_id)
        if (!stop.ok) {
          const transition = stop.state === "suppressed"
            ? onSuppression(e.state, stop.reason)
            : onInvalidContact(e.state, stop.reason)
          if (await applyTransition(e, transition)) result.suppressed += 1
          continue
        }

        // ── YIELD TO ENGAGEMENT (chống double-email 2 lane) ──
        // Lead đã có buyer_engagements ĐANG MỞ (AE đã claim → lane con người
        // phụ trách outreach) → campaign KHÔNG gửi nữa. HOLD + notify owner
        // quyết (resume nếu muốn campaign tiếp / stop để nhường hẳn).
        const { data: activeEng } = await (admin.from("buyer_engagements") as any)
          .select("id, stage, account_manager_id")
          .eq("lead_id", e.lead_id)
          .not("stage", "in", '("converted","dropped")')
          .limit(1)
        const engRow = ((activeEng ?? []) as Array<{ id: string; stage: string; account_manager_id: string }>)[0]
        if (engRow) {
          await applyTransition(e, {
            to: null,
            needsHumanReview: true,
            humanReviewReason: `active_engagement:${engRow.id}`,
            nextActionAt: null,
            nextActionType: "human_review",
            note: "yield_to_engagement",
          })
          result.yieldedToEngagement += 1
          if (e.owner_id) {
            await dispatchNotification({
              userId: e.owner_id,
              category: "action_required",
              opportunityId: null,
              linkPath: `/admin/campaigns/${campaign.id}`,
              dedupKey: `campaign_yield:${e.id}:${engRow.id}`,
              title: { vi: "Campaign: tạm HOLD — buyer đã có AE claim", en: "Campaign: on hold — buyer already claimed by an AE" },
              body: {
                vi: `Buyer đang có engagement mở (${engRow.stage}). Để tránh gửi trùng 2 lane, campaign HOLD. Resume nếu muốn campaign tiếp tục, hoặc Stop để nhường lane thường.`,
                en: `This buyer has an open engagement (${engRow.stage}). To avoid double-emailing, the campaign is on hold. Resume to continue, or stop to hand the lane over.`,
              },
              ctaLabel: { vi: "Xem enrollment", en: "Review enrollment" },
            })
          }
          continue
        }

        // HOLD khi human review — cron không tự động xử lý.
        if (e.needs_human_review) continue

        switch (e.state) {
          case "paused": {
            const t = onResumeAfterPause(e.state)
            if (t.to) {
              // Resume xong tính ngay follow-up due từ last_contact_at.
              if (await applyTransition(e, t)) {
                result.resumed += 1
                if (e.last_contact_at) {
                  const nextStep = steps.find((s) => s.step_number === e.current_step_number + 1)
                  const delayDays = nextStep?.delay_days ?? 14
                  const nextAt = new Date(new Date(e.last_contact_at).getTime() + Math.max(delayDays, 1) * 86400000)
                  await (admin.from("campaign_enrollments") as any)
                    .update({ next_action_at: nextAt.toISOString(), next_action_type: nextStep ? "followup_due" : "nurture_due" })
                    .eq("id", e.id)
                }
              }
            }
            break
          }

          case "enrolled": {
            if (e.next_action_type === "step_retry" || e.next_action_type === "step1_due") {
              // SENDING WINDOW (25/09/2026): ngoài khung local của buyer →
              // reschedule sang window kế tiếp, KHÔNG bỏ step (chưa claim).
              const win = await checkSendingWindow(now, await resolveEnrollmentTimezone(e.lead_id))
              if (!win.ok && win.reason === "outside_window") {
                await (admin.from("campaign_enrollments") as any)
                  .update({ next_action_at: win.nextAt!.toISOString() })
                  .eq("id", e.id)
                result.rescheduledWindow += 1
                break
              }

              const sent = await getSentToday()
              const globalSent = await countAllCampaignEmailsSentToday()
              if (sent >= campaign.daily_send_limit || globalSent >= GLOBAL_DAILY_SEND_LIMIT) {
                // Đổi mốc sang giờ sau (tick kế) — không claim khi vượt limit.
                await (admin.from("campaign_enrollments") as any)
                  .update({ next_action_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString() })
                  .eq("id", e.id)
                break
              }
              const step1 = steps[0]
              const claimed = await claimStep(e.id, step1.step_number)
              if (!claimed) break // tick khác đang xử lý
              const r = await queueDraftForEnrollment(e, step1, campaign.name, e.owner_id)
              if (r.ok) result.draftsQueued += 1
              else result.draftFailures += 1
            }
            break
          }

          case "contact_pending": {
            if (e.next_action_type === "approval_overdue_check") {
              if (e.owner_id) {
                await dispatchNotification({
                  userId: e.owner_id,
                  category: "action_required",
                  opportunityId: null,
                  linkPath: `/admin/campaigns/${campaign.id}`,
                  dedupKey: `campaign_approval_overdue:${e.id}:${now.toISOString().slice(0, 10)}`,
                  title: { vi: "Campaign: draft quá hạn duyệt", en: "Campaign: draft approval overdue" },
                  body: { vi: "Email bước 1 đang chờ bạn duyệt hơn 2 ngày.", en: "The step-1 email has been waiting for your approval for 2+ days." },
                  ctaLabel: { vi: "Duyệt ngay", en: "Review now" },
                })
              }
              await (admin.from("campaign_enrollments") as any)
                .update({ next_action_at: new Date(now.getTime() + 2 * 86400000).toISOString() })
                .eq("id", e.id)
              result.approvalReminders += 1
              break
            }
            if (e.next_action_type === "step_retry") {
              // Draft trước bị reject/AI lỗi — claim lại bước hiện tại.
              const stepRetry = steps.find((s) => s.step_number === e.current_step_number) ?? steps[0]
              const claimed = await claimStep(e.id, stepRetry.step_number)
              if (!claimed) break
              const r = await queueDraftForEnrollment(e, stepRetry, campaign.name, e.owner_id)
              if (r.ok) result.draftsQueued += 1
              else result.draftFailures += 1
            }
            break
          }

          case "contacted": {
            if (e.next_action_type === "contacted_grace") {
              const step2 = steps.find((s) => s.step_number === e.current_step_number + 1)
              const t = onContactedGraceElapsed(e.state, step2?.delay_days ?? 4, now)
              if (await applyTransition(e, t)) result.graceAdvanced += 1
            }
            break
          }

          case "waiting_reply":
          case "followup_1":
          case "followup_2": {
            if (e.next_action_type === "approval_overdue_check") {
              // Nhắc AE mỗi khi mốc 2 ngày quá — dedup key theo ngày.
              if (e.owner_id) {
                await dispatchNotification({
                  userId: e.owner_id,
                  category: "action_required",
                  opportunityId: null,
                  linkPath: `/admin/campaigns/${campaign.id}`,
                  dedupKey: `campaign_approval_overdue:${e.id}:${now.toISOString().slice(0, 10)}`,
                  title: { vi: "Campaign: draft quá hạn duyệt", en: "Campaign: draft approval overdue" },
                  body: { vi: "Enrollment đang chờ bạn duyệt email hơn 2 ngày.", en: "An enrollment has been waiting for your approval for 2+ days." },
                  ctaLabel: { vi: "Duyệt ngay", en: "Review now" },
                })
              }
              // Đặt lại mốc +2 ngày để không nhắc mỗi giờ.
              await (admin.from("campaign_enrollments") as any)
                .update({ next_action_at: new Date(now.getTime() + 2 * 86400000).toISOString() })
                .eq("id", e.id)
              result.approvalReminders += 1
              break
            }

            if (e.next_action_type === "nurture_due") {
              const t = onNurtureDue(e.state)
              if (t.to) {
                await applyTransition(e, t)
                result.nurtured += 1
                await logSystemEvent({
                  buyerId: e.lead_id,
                  campaignId: e.campaign_id,
                  enrollmentId: e.id,
                  event: "nurtured",
                  description: `[Campaign] Hết sequence không reply → NURTURE (lead ${e.lead_id})`,
                })
              }
              break
            }

            if (e.next_action_type === "followup_due" || e.next_action_type === "step_retry") {
              const nextStepNumber = e.current_step_number + 1
              const nextStep = steps.find((s) => s.step_number === nextStepNumber)

              if (!nextStep) {
                const t = onNurtureDue(e.state)
                if (t.to) {
                  await applyTransition(e, t)
                  result.nurtured += 1
                }
                break
              }

              // SENDING WINDOW: reschedule sang window kế tiếp, không bỏ step.
              const win = await checkSendingWindow(now, await resolveEnrollmentTimezone(e.lead_id))
              if (!win.ok && win.reason === "outside_window") {
                await (admin.from("campaign_enrollments") as any)
                  .update({ next_action_at: win.nextAt!.toISOString() })
                  .eq("id", e.id)
                result.rescheduledWindow += 1
                break
              }

              const sent = await getSentToday()
              if (sent >= campaign.daily_send_limit) {
                await (admin.from("campaign_enrollments") as any)
                  .update({ next_action_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString() })
                  .eq("id", e.id)
                break
              }

              const claimed = await claimStep(e.id, nextStep.step_number)
              if (!claimed) break

              // ── FOLLOW-UP GATE (yêu cầu 25/09/2026) ──
              // Trước MỌI follow-up: AI đọc lại buyer context + research +
              // import data + toàn bộ lịch sử email và tự đánh giá có lý do
              // hợp lý để liên hệ tiếp không. Không có lý do → KHÔNG gửi.
              if (nextStep.step_number >= 2) {
                const gateCtx = await buildBuyerContext(e as never, nextStep as never)
                const daysSinceLastContact = e.last_contact_at
                  ? Math.floor((now.getTime() - new Date(e.last_contact_at).getTime()) / 86400000)
                  : null
                const gate = await assessFollowupJustification({
                  ctx: gateCtx,
                  stepNumber: nextStep.step_number,
                  stepType: nextStep.step_type,
                  daysSinceLastContact,
                })
                const decision = applyFollowupGateDecision(gate)

                if (decision !== "generate") {
                  await resolveFiring(e.id, nextStep.step_number, "skipped", {
                    error: `gate_${decision}:${gate.reasonCategory}`,
                  })
                  await logSystemEvent({
                    buyerId: e.lead_id,
                    campaignId: e.campaign_id,
                    enrollmentId: e.id,
                    step: nextStep.step_number,
                    event: decision === "skip" ? "followup_gate_skip" : "followup_gate_hold",
                    detail: {
                      reason_category: gate.reasonCategory,
                      reason_summary: gate.reasonSummary,
                      confidence: gate.confidence,
                      source: gate.source,
                    },
                    description: `[Campaign] Follow-up gate step ${nextStep.step_number} → ${
                      decision === "skip" ? "SKIP (không có lý do hợp lý)" : "HOLD cho AE review"
                    }: ${gate.reasonCategory} — ${gate.reasonSummary} (conf ${gate.confidence.toFixed(2)}, lead ${e.lead_id})`,
                  })

                  if (decision === "human_review") {
                    // AI không chắc chắn → HOLD, AE quyết định (resume sẽ đưa
                    // enrollment về mốc followup_due).
                    await applyTransition(e, {
                      to: null,
                      needsHumanReview: true,
                      humanReviewReason: `followup_gate_conf_${gate.confidence.toFixed(2)}`,
                      nextActionAt: null,
                      nextActionType: "human_review",
                      note: "followup_gate_hold",
                    })
                    result.gateHold += 1
                  } else {
                    // Skip step này: đẩy con trỏ sequence tới step kế (không
                    // đếm followup_count vì chưa gửi gì). Hết bảng → NURTURE.
                    const after = steps.find((s) => s.step_number === nextStep.step_number + 1)
                    if (after) {
                      const nextAt = new Date(now.getTime() + Math.max(after.delay_days, 1) * 86400000)
                      await (admin.from("campaign_enrollments") as any)
                        .update({
                          current_step_number: nextStep.step_number,
                          next_action_at: nextAt.toISOString(),
                          next_action_type: "followup_due",
                        })
                        .eq("id", e.id)
                    } else {
                      const t = onNurtureDue(e.state)
                      if (t.to) await applyTransition(e, t)
                    }
                    result.gateSkipped += 1
                  }
                  break
                }
                // Gate pass → sinh draft, tái dùng context đã build.
                const r = await queueDraftForEnrollment(e, nextStep, campaign.name, e.owner_id, gateCtx)
                if (r.ok) {
                  result.followupsQueued += 1
                } else {
                  result.draftFailures += 1
                }
                break
              }

              const r = await queueDraftForEnrollment(e, nextStep, campaign.name, e.owner_id)
              if (r.ok) {
                result.followupsQueued += 1
              } else {
                result.draftFailures += 1
              }
            }
            break
          }

          default:
            break
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        result.errors.push(`enrollment ${e.id}: ${message}`)
        console.error("[campaign] tick enrollment failed:", e.id, err)
      }
    }
  }

  // ---- 3. Integrity check: enrollment active thiếu next_action_at ----------
  const { data: orphans } = await (admin.from("campaign_enrollments") as any)
    .select("id, lead_id, campaign_id, state, current_step_number, last_contact_at, needs_human_review")
    .in("state", ["enrolled", "contact_pending", "contacted", "waiting_reply", "followup_1", "followup_2"])
    .is("next_action_at", null)
    .eq("needs_human_review", false)
    .limit(50)

  for (const o of (orphans ?? []) as never[]) {
    const row = o as {
      id: string; lead_id: string; campaign_id: string; state: EnrollmentState
      current_step_number: number; last_contact_at: string | null
    }
    // Quy tắc: draft đang chờ duyệt thì next_action không được null → đặt lại mốc;
    // còn lại đưa về mốc processing gần nhất.
    const hasPendingFiring = await (admin.from("campaign_step_firings") as any)
      .select("id", { count: "exact", head: true })
      .eq("enrollment_id", row.id)
      .eq("status", "draft_created")

    const hasPending = !!(hasPendingFiring as unknown as { count?: number })?.count
    const nextAt = hasPending ? now.toISOString() : new Date(now.getTime() + 60 * 60 * 1000).toISOString()
    await (admin.from("campaign_enrollments") as any)
      .update({
        next_action_at: nextAt,
        next_action_type: hasPending
          ? row.state === "contact_pending"
            ? "approval_overdue_check"
            : "awaiting_approval"
          : row.state === "enrolled"
            ? "step1_due"
            : row.state === "contact_pending"
              ? "step_retry"
              : "followup_due",
      })
      .eq("id", row.id)
    await logSystemEvent({
      buyerId: row.lead_id,
      campaignId: row.campaign_id,
      enrollmentId: row.id,
      event: "integrity_fix",
      description: `[Campaign] Integrity: enrollment ${row.id} (${row.state}) thiếu next_action_at → đặt lại ${nextAt}`,
    })
    result.integrityFixes += 1
  }

  return result
}
