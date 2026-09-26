// Approval flow (shadow mode — quyết định 25/09/2026).
//
// AE xem draft trong approval queue → edit (tuỳ chọn) → Approve & Send, hoặc
// Reject. Gửi tái dùng 100% lib/ai/email-sender.ts (suppression guard + Resend
// + delivery tracking + email_drafts lifecycle). Bookkeeping sau khi gửi:
//   - firing → 'sent'
//   - state transition theo bước vừa gửi (onFirstEmailSent/onFollowupEmailSent)
//   - interaction EMAIL mới (human_approved, metadata.final_content) — hàng cũ
//     (AI draft) giữ nguyên: append-only, phục vụ learning loop §24.
//
// Idempotency: sendEmailDraft chỉ chấp nhận draft 'pending_approval' — bấm
// approve 2 lần → lần 2 fail "draft not pending".

import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCurrentRole } from "@/lib/auth/guard"
import { sendEmailDraft } from "@/lib/ai/email-sender"
import { getCampaignSteps, getEnrollment, applyTransition } from "./enrollments"
import { onDraftRejected, onFirstEmailSent, onFollowupEmailSent } from "./state-machine"
import { appendInteraction } from "./interactions"
import { resolveEnrollmentTimezone, checkSendingWindow, checkAutoSendWindow } from "./sending-window"
import { isAutoSendEnabled } from "./constants"
import { siteConfig } from "@/lib/site-config"

export type ApproveResult =
  | { ok: true; state: "sent" }
  | { ok: false; error: "unauthorized" | "forbidden" | "not_found" | "not_pending" | "qa_blocked" | "send_failed" | "outside_sending_window" | "serverError"; message?: string }

async function assertStaff(): Promise<{ ok: true; userId: string; role: string } | { ok: false; error: "unauthorized" | "forbidden" }> {
  const current = await getCurrentRole()
  if (!current) return { ok: false, error: "unauthorized" }
  const allowed = ["admin", "super_admin", "account_executive"]
  if (!allowed.includes(current.role)) return { ok: false, error: "forbidden" }
  return { ok: true, userId: current.userId, role: current.role }
}

export async function approveAndSendCampaignDraft(
  draftId: string,
  edit?: { subject?: string; content?: string },
): Promise<ApproveResult> {
  const auth = await assertStaff()
  if (!auth.ok) return { ok: false, error: auth.error }

  const supabase = await createAdminClient() // chỉ đọc draft metadata qua admin cho chắc RLS
  const { data: draft } = await (supabase.from("email_drafts") as any)
    .select("*")
    .eq("id", draftId)
    .single()

  const d = draft as {
    id: string
    status: string
    campaign_enrollment_id: string | null
    campaign_step_number: number | null
    recipient_email: string | null
    generated_subject: string | null
    generated_content_en: string | null
  } | null

  if (!d) return { ok: false, error: "not_found" }
  if (!d.campaign_enrollment_id) return { ok: false, error: "not_found", message: "not a campaign draft" }
  if (d.status !== "pending_approval") return { ok: false, error: "not_pending" }

  const enrollment = await getEnrollment(d.campaign_enrollment_id)
  if (!enrollment) return { ok: false, error: "not_found", message: "enrollment missing" }
  const steps = await getCampaignSteps(enrollment.campaign_id)
  const sentStepNumber = d.campaign_step_number ?? enrollment.current_step_number
  const sentStep = steps.find((s) => s.step_number === sentStepNumber)
  const nextStep = steps.find((s) => s.step_number === sentStepNumber + 1)

  // ── SENDING WINDOW (backend policy — AI không quyết định giờ gửi) ──
  // CAMPAIGN_AUTO_SEND=true → chặn CỨNG nếu ngoài window hoặc timezone không
  // đủ tin cậy. Shadow mode → không chặn (AE là người quyết) nhưng ghi flag
  // vào metadata để đo và để AE thấy buyer đang ở mú giờ nào.
  const tzInfo = await resolveEnrollmentTimezone(enrollment.lead_id)
  if (isAutoSendEnabled()) {
    const w = checkAutoSendWindow(new Date(), tzInfo)
    if (!w.ok) {
      const detail = w.reason === "no_timezone"
        ? `Timezone buyer chưa đủ tin cậy (${tzInfo.source}) — auto-send yêu cầu timezone xác định (admin có thể đặt leads.buyer_timezone).`
        : `Ngoài khung gửi Mon–Fri 08:00–11:30 / 13:00–16:30 (${tzInfo.tz} local). Window kế: ${w.nextAt?.toISOString() ?? "?"}`
      return { ok: false, error: "outside_sending_window", message: detail }
    }
  }

  // List-Unsubscribe header (RFC 2369) — VÔ HÌNH với buyer: Gmail/Outlook
  // hiển thị nút unsubscribe gốc thay vì nút "Report spam". Dùng token sẵn có
  // của lead (page /unsubscribe/[token] đã tồn tại).
  const extraHeaders: Record<string, string> = {}
  const { data: leadForUnsub } = await supabase
    .from("leads")
    .select("unsubscribe_token, email_unsubscribed")
    .eq("id", enrollment.lead_id)
    .single()
  const leadUnsub = leadForUnsub as { unsubscribe_token?: string | null; email_unsubscribed?: boolean | null } | null
  if (leadUnsub?.unsubscribe_token && !leadUnsub.email_unsubscribed) {
    // Một domain duy nhất veximtrade.com (26/09/2026): dùng siteConfig.domain
    // thay vì siteConfig.url (theo env) để link unsub không bao giờ lệch domain.
    extraHeaders["List-Unsubscribe"] = `<https://${siteConfig.domain}/unsubscribe/${leadUnsub.unsubscribe_token}>`
  }

  // Gửi qua đường ống hiện có (đã chặn suppression + tracking).
  let sendResult
  try {
    sendResult = await sendEmailDraft(draftId, {
      overrideSubject: edit?.subject,
      overrideContent: edit?.content,
      extraHeaders,
      // recipient đã set lúc tạo draft; không override.
    })
  } catch (err) {
    if (err instanceof Error && /not pending/i.test(err.message)) {
      return { ok: false, error: "not_pending" }
    }
    return { ok: false, error: "send_failed", message: err instanceof Error ? err.message : "unknown" }
  }

  const sentAt = new Date()
  const finalSubject = edit?.subject?.trim() || d.generated_subject || ""
  const finalContent = edit?.content?.trim() || d.generated_content_en || ""
  // Human-edit-rate metric (yêu cầu 25/09/2026): so bản gửi với bản AI gốc.
  const wasEdited =
    (edit?.subject?.trim() ?? "") !== (d.generated_subject ?? "").trim() ||
    (edit?.content?.trim() ?? "") !== (d.generated_content_en ?? "").trim()

  // Firing → sent.
  await (supabase.from("campaign_step_firings") as any)
    .update({ status: "sent", resolved_at: sentAt.toISOString() })
    .eq("enrollment_id", enrollment.id)
    .eq("step_number", sentStepNumber)
    .in("status", ["claimed", "draft_created"])

  // State machine — bước 1 → contacted; follow-up → followup_1/2.
  const transition = sentStepNumber <= 1
    ? onFirstEmailSent(enrollment.state, sentAt)
    : onFollowupEmailSent(
        enrollment.state,
        sentStepNumber,
        nextStep ? nextStep.delay_days : null,
        sentAt,
      )
  if (transition.to !== null) {
    await applyTransition(enrollment, transition, { performedBy: auth.userId })
  }

  // Interaction EMAIL (final version) — append-only.
  await appendInteraction(
    {
      buyer_id: enrollment.lead_id,
      campaign_id: enrollment.campaign_id,
      enrollment_id: enrollment.id,
      interaction_type: "EMAIL",
      direction: "OUTBOUND",
      subject: finalSubject,
      content: finalContent,
      sender: auth.userId,
      recipient: d.recipient_email,
      occurred_at: sentAt.toISOString(),
      sequence_step: sentStepNumber,
      ai_generated: true,
      human_approved: true,
      metadata: {
        draft_id: draftId,
        final_content: finalContent,
        edited: wasEdited,
        edited_by: auth.userId,
        ai_subject: d.generated_subject,
        ai_content: d.generated_content_en,
        step_type: sentStep?.step_type ?? "unknown",
        // Sending-window audit (25/09/2026)
        buyer_tz: tzInfo.tz,
        buyer_tz_source: tzInfo.source,
        window_ok: tzInfo.tz ? checkSendingWindow(new Date(), tzInfo).ok : null,
      },
      draft_id: draftId,
      created_by: auth.userId,
    },
    {
      actionType: "campaign_email_sent",
      description: `[Campaign] Email step ${sentStepNumber} đã gửi cho ${d.recipient_email} (lead ${enrollment.lead_id}) — AE ${auth.userId}`,
      performedBy: auth.userId,
    },
  )

  return { ok: true, state: "sent" }
}

export async function rejectCampaignDraft(
  draftId: string,
  reason: string,
): Promise<ApproveResult> {
  const auth = await assertStaff()
  if (!auth.ok) return { ok: false, error: auth.error }

  const supabase = await createAdminClient()
  const { data: draft } = await (supabase.from("email_drafts") as any)
    .select("id, status, campaign_enrollment_id, campaign_step_number")
    .eq("id", draftId)
    .single()

  const d = draft as {
    id: string
    status: string
    campaign_enrollment_id: string | null
    campaign_step_number: number | null
  } | null

  if (!d || !d.campaign_enrollment_id) return { ok: false, error: "not_found" }
  if (d.status !== "pending_approval") return { ok: false, error: "not_pending" }

  // Draft → rejected (lifecycle hiện có của email_drafts).
  const { error } = await (supabase.from("email_drafts") as any)
    .update({ status: "rejected", error_message: `rejected_by:${auth.userId}:${reason.slice(0, 200)}` })
    .eq("id", draftId)
  if (error) return { ok: false, error: "serverError", message: error.message }

  const enrollment = await getEnrollment(d.campaign_enrollment_id)
  if (enrollment) {
    // Firing → failed để scheduler sinh lại draft khác (retry 1 giờ).
    await (supabase.from("campaign_step_firings") as any)
      .update({ status: "failed", resolved_at: new Date().toISOString(), error: `rejected: ${reason.slice(0, 200)}` })
      .eq("enrollment_id", enrollment.id)
      .eq("step_number", d.campaign_step_number ?? enrollment.current_step_number)
      .in("status", ["claimed", "draft_created"])

    await applyTransition(enrollment, onDraftRejected(enrollment.state), { performedBy: auth.userId })

    await appendInteraction(
      {
        buyer_id: enrollment.lead_id,
        campaign_id: enrollment.campaign_id,
        enrollment_id: enrollment.id,
        interaction_type: "SYSTEM_EVENT",
        direction: "INTERNAL",
        subject: "draft_rejected",
        sequence_step: d.campaign_step_number,
        metadata: { draft_id: draftId, reason, rejected_by: auth.userId },
      },
      {
        actionType: "campaign_draft_rejected",
        description: `[Campaign] AE ${auth.userId} từ chối draft step ${d.campaign_step_number}: ${reason}`,
        performedBy: auth.userId,
      },
    )
  }

  return { ok: true, state: "sent" }
}
