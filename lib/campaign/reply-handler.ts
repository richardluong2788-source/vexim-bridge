// Nhánh reply cho campaign engine trong Resend inbound webhook.
//
// Được gọi TỪ webhook (app/api/webhooks/resend) TRƯỚC khối xử lý cũ:
//   - Không có enrollment active cho lead → { handled: false } → webhook chạy
//     flow cũ NGUYÊN VẸN (không đổi hành vi gì cho pipeline hiện có).
//   - Có enrollment → handler tự insert buyer_replies (kèm campaign_* + giữ
//     opportunity_id/engagement_id nếu luồng cũ đã match để UI cũ vẫn thấy),
//     classify 7-intent, chạy state machine, handoff/stop/pause, notify AE,
//     rồi { handled: true } → webhook return sớm (không double-insert).
//
// STOP guarantees (spec §13): OPT_OUT → stamp leads.email_unsubscribed +
// unsubscribe_token; mọi terminal đều ghi interaction + audit.

import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { dispatchNotification } from "@/lib/notifications/dispatcher"
import { nextStageOnBuyerReply } from "@/lib/buyers/engagement-stage-transitions"
import { classifyCampaignReply } from "./reply-intent"
import { onReplyClassified } from "./state-machine"
import { applyTransition, getEnrollment, getCampaign } from "./enrollments"
import { handoffToEngagement } from "./handoff"
import { appendInteraction } from "./interactions"

export interface CampaignReplyInput {
  fromEmail: string
  subject: string | null
  body: string
  messageId: string | null
  inReplyTo: string | null
  receivedAt: string
  /** Đã match ở luồng cũ (nếu có) — giữ liên kết cho UI hiện có. */
  matchedOpportunityId: string | null
  matchedLeadId: string | null
  matchedEngagementId: string | null
  matchedEngagementStage: string | null
}

export interface CampaignReplyHandled {
  handled: true
  intent: string
  requiresHuman: boolean
  handoffEngagementId: string | null
}

export type CampaignReplyResult = CampaignReplyHandled | { handled: false }

/** Tìm enrollment ACTIVE cho lead — undefined khi lead chưa trong campaign nào. */
async function findActiveEnrollmentForLead(leadId: string) {
  const admin = createAdminClient()
  const { data } = await (admin.from("campaign_enrollments") as any)
    .select("*")
    .eq("lead_id", leadId)
    .in("state", ["enrolled", "contacted", "contact_pending", "waiting_reply", "followup_1", "followup_2", "paused"])
    .order("created_at", { ascending: false })
    .limit(1)
  const rows = (data ?? []) as never[]
  return rows.length > 0 ? ((rows[0] as unknown) as Awaited<ReturnType<typeof getEnrollment>>) : null
}

/**
 * Fallback: buyer đã HẾT sequence (nurture) reply lại email cũ — ví dụ 2–3
 * tháng sau "now we have a need". Không hồi sinh enrollment (state machine
 * giữ nguyên nurture) nhưng reply PHẢI được classify + chạm AE (chốt "mọi
 * reply campaign phải chạm AE") thay vì rơi im lặng vào unmatched.
 */
async function findNurtureEnrollmentForLead(leadId: string) {
  const admin = createAdminClient()
  const { data } = await (admin.from("campaign_enrollments") as any)
    .select("*")
    .eq("lead_id", leadId)
    .eq("state", "nurture")
    .order("created_at", { ascending: false })
    .limit(1)
  const rows = (data ?? []) as never[]
  return rows.length > 0 ? ((rows[0] as unknown) as Awaited<ReturnType<typeof getEnrollment>>) : null
}

/** Resolve lead từ email người gửi (contact_email trước, buyer_contacts sau). */
async function findLeadIdByEmail(fromEmail: string): Promise<string | null> {
  const admin = createAdminClient()

  const { data: byContactEmail } = await admin
    .from("leads")
    .select("id")
    .ilike("contact_email", fromEmail)
    .limit(1)
  if (byContactEmail && byContactEmail.length > 0) {
    return (byContactEmail[0] as { id: string }).id
  }

  const { data: byBuyerContact } = await admin
    .from("buyer_contacts")
    .select("lead_id")
    .eq("status", "active")
    .ilike("email", fromEmail)
    .limit(1)
  if (byBuyerContact && byBuyerContact.length > 0) {
    return (byBuyerContact[0] as { lead_id: string }).lead_id
  }

  return null
}

/** In-Reply-To → email_drafts.campaign_enrollment_id (thread matching). */
async function findEnrollmentByThread(inReplyTo: string | null): Promise<string | null> {
  if (!inReplyTo) return null
  const admin = createAdminClient()
  const clean = inReplyTo.replace(/^<|>$/g, "")
  const { data } = await (admin.from("email_drafts") as any)
    .select("campaign_enrollment_id")
    .or(`smtp_message_id.eq.${clean},resend_message_id.eq.${clean}`)
    .not("campaign_enrollment_id", "is", null)
    .limit(1)
  const rows = (data ?? []) as Array<{ campaign_enrollment_id: string | null }>
  return rows[0]?.campaign_enrollment_id ?? null
}

/**
 * Entry point của webhook. KHÔNG BAO GIỜ ném — lỗi chỉ log, webhook flow cũ
 * tiếp tục (an toàn: worst case reply được xử lý như trước khi có campaign).
 */
export async function maybeHandleCampaignReply(input: CampaignReplyInput): Promise<CampaignReplyResult> {
  try {
    const admin = createAdminClient()

    // 1. Tìm enrollment: thread matching (mạnh nhất) → lead match cũ → email.
    let enrollmentId = await findEnrollmentByThread(input.inReplyTo)
    let enrollment = enrollmentId ? await getEnrollment(enrollmentId) : null

    const leadId =
      input.matchedLeadId ?? (await findLeadIdByEmail(input.fromEmail))

    if ((!enrollment || enrollment.state === undefined) && leadId) {
      enrollment = await findActiveEnrollmentForLead(leadId)
      // Buyer hết sequence (nurture) quay lại → vẫn classify + notify AE
      // (state machine tự giữ nurture, không hồi sinh).
      if (!enrollment) enrollment = await findNurtureEnrollmentForLead(leadId)
      enrollmentId = enrollment?.id ?? null
    }
    if (!enrollment || !enrollmentId) return { handled: false }

    // 2. Classify 7-intent (rules + AI).
    const classification = await classifyCampaignReply({
      replyText: input.body,
      buyerCompany: null,
    })

    // 3. buyer_replies — giữ opportunity_id/engagement_id nếu luồng cũ đã match
    //    (UI hiện tại vẫn hiển thị), thêm các cột campaign_*.
    const { data: replyRow, error: replyErr } = await (admin.from("buyer_replies") as any)
      .insert({
        opportunity_id: input.matchedOpportunityId,
        lead_id: enrollment.lead_id,
        engagement_id: input.matchedEngagementId,
        from_email: input.fromEmail,
        subject: input.subject,
        message_id: input.messageId,
        in_reply_to: input.inReplyTo,
        raw_content: input.body,
        raw_language: "en",
        // Cột legacy (5-intent) để null — campaign dùng cột riêng bên dưới.
        campaign_intent: classification.intent,
        campaign_confidence: classification.confidence,
        campaign_intent_source: classification.source,
        campaign_needs_human: classification.requiresHuman,
        campaign_enrollment_id: enrollment.id,
        match_source: "campaign",
        received_at: input.receivedAt,
        created_by: null,
      })
      .select("id")
      .single()

    if (replyErr) {
      console.error("[campaign] reply insert failed:", replyErr)
      return { handled: false } // để flow cũ lưu reply (không mất dữ liệu)
    }

    // 4. Interaction REPLY (append-only).
    await appendInteraction({
      buyer_id: enrollment.lead_id,
      campaign_id: enrollment.campaign_id,
      enrollment_id: enrollment.id,
      interaction_type: "REPLY",
      direction: "INBOUND",
      subject: input.subject,
      content: input.body,
      sender: input.fromEmail,
      recipient: "vexim",
      occurred_at: input.receivedAt,
      ai_generated: false,
      reply_classification: {
        intent: classification.intent,
        confidence: classification.confidence,
        source: classification.source,
        requires_human: classification.requiresHuman,
        reason: classification.reason,
      },
      intent: classification.intent,
      draft_id: null,
      metadata: { buyer_reply_id: (replyRow as { id: string }).id },
    })

    // 4b. Luồng cũ có match engagement → giữ nguyên stage transition cũ.
    if (input.matchedEngagementId && input.matchedEngagementStage) {
      const nextStage = nextStageOnBuyerReply(input.matchedEngagementStage)
      if (nextStage) {
        await (admin.from("buyer_engagements") as any)
          .update({ stage: nextStage, stale_reminder_sent_at: null })
          .eq("id", input.matchedEngagementId)
      }
    }

    // 5. State machine + hành động theo intent.
    const transition = onReplyClassified(enrollment.state, classification)
    if (transition.to !== null || transition.needsHumanReview) {
      await applyTransition(enrollment, transition)
    }

    // Cập nhật last_reply_at — KHÔNG đếm với OUT_OF_OFFICE (pause-only).
    if (!classification.isPauseOnly) {
      await (admin.from("campaign_enrollments") as any)
        .update({ last_reply_at: input.receivedAt })
        .eq("id", enrollment.id)
    }

    // 6. OPT_OUT → stamp suppression vĩnh viễn (chỉ admin gỡ được, như hiện nay).
    if (classification.intent === "OPT_OUT" && !classification.requiresHuman) {
      await (admin.from("leads") as any)
        .update({
          email_unsubscribed: true,
          email_unsubscribed_at: new Date().toISOString(),
          email_suppression_note: `campaign_opt_out:${enrollment.id}`,
        })
        .eq("id", enrollment.lead_id)
    }

    // 7. Handoff khi INTERESTED tự tin.
    let handoffEngagementId: string | null = null
    if (classification.intent === "INTERESTED" && !classification.requiresHuman) {
      const campaign = await getCampaign(enrollment.campaign_id)
      if (campaign) {
        const handoff = await handoffToEngagement(
          enrollment,
          { id: campaign.id, name: campaign.name, created_by: campaign.created_by },
          {
            fromEmail: input.fromEmail,
            replySummary: input.body.slice(0, 300),
          },
        )
        handoffEngagementId = handoff.engagementId
      }
    }

    // 8. Notify AE — MỌI reply của campaign đều chạm owner, chia 2 mức:
    //    • action_required  → cần tay người (review HOLD, NOT_NOW): chuông + email
    //    • status_update    → chỉ để biết (INTERESTED qua handoff, STOPPED,
    //      SUPPRESSED, INVALID, OOO pause): chuông + email theo preferences
    // Chuông luôn tạo; email đi tới profiles.email (tài khoản AE) trừ khi AE
    // tắt category đó trong notification_preferences (mặc định bật).
    const replyId = (replyRow as { id: string }).id
    const replySnippet = input.body.replace(/\s+/g, " ").trim().slice(0, 140)
    const buyerLink = `/admin/buyers/${enrollment.lead_id}` // reply hiển thị ở buyer page

    if ((classification.requiresHuman || classification.intent === "NOT_NOW") && enrollment.owner_id) {
      await dispatchNotification({
        userId: enrollment.owner_id,
        category: "action_required",
        opportunityId: null,
        linkPath: `/admin/campaigns/${enrollment.campaign_id}`,
        dedupKey: `campaign_reply_review:${replyId}`,
        title: {
          vi: "Campaign: reply cần AE xem",
          en: "Campaign: reply needs review",
        },
        body: {
          vi: `${input.fromEmail} → ${classification.intent} (conf ${classification.confidence.toFixed(2)}). ${classification.requiresHuman ? "Confidence thấp/ambiguous — sequence đang HOLD." : "Chưa phải lúc — tạm dừng 30 ngày."} "${replySnippet}"`,
          en: `${input.fromEmail} → ${classification.intent} (conf ${classification.confidence.toFixed(2)}). ${classification.requiresHuman ? "Low confidence/ambiguous — sequence on hold." : "Not now — paused 30 days."} "${replySnippet}"`,
        },
        ctaLabel: { vi: "Xử lý", en: "Review" },
      })
    } else if (enrollment.owner_id) {
      interface IntentNotice {
        title: { vi: string; en: string }
        body: { vi: string; en: string }
      }
      const NOTIFY_BY_INTENT: Record<string, IntentNotice> = {
        NOT_INTERESTED: {
          title: { vi: "Campaign: buyer từ chối — sequence đã dừng", en: "Campaign: buyer declined — sequence stopped" },
          body: { vi: `${input.fromEmail} trả lời NOT_INTERESTED. Enrollment chuyển STOPPED, không email tiếp.`, en: `${input.fromEmail} replied NOT_INTERESTED. Enrollment stopped — no further emails.` },
        },
        OPT_OUT: {
          title: { vi: "Campaign: buyer opt-out — chặn vĩnh viễn", en: "Campaign: opt-out — permanently suppressed" },
          body: { vi: `${input.fromEmail} yêu cầu ngừng email. Đã stamp suppression trên lead (chỉ admin gỡ được).`, en: `${input.fromEmail} asked to stop. Suppression stamped on the lead (admin-only lift).` },
        },
        WRONG_CONTACT: {
          title: { vi: "Campaign: sai người tiếp nhận", en: "Campaign: wrong contact" },
          body: { vi: `${input.fromEmail} không phải người phụ trách. Enrollment chuyển INVALID_CONTACT — cân nhắc tìm đúng contact.`, en: `${input.fromEmail} is not the right person. Marked INVALID_CONTACT — consider finding the right contact.` },
        },
        OUT_OF_OFFICE: {
          title: { vi: "Campaign: buyer out-of-office — tạm dừng 7 ngày", en: "Campaign: out-of-office — paused 7 days" },
          body: { vi: `${input.fromEmail} đang vắng mặt (auto-reply). KHÔNG tính là reply — sequence tự quay lại sau 7 ngày.`, en: `${input.fromEmail} is away (auto-reply). NOT counted as a reply — sequence resumes in 7 days.` },
        },
      }
      const n = NOTIFY_BY_INTENT[classification.intent]
      if (n) {
        await dispatchNotification({
          userId: enrollment.owner_id,
          category: "status_update",
          opportunityId: null,
          linkPath: buyerLink,
          dedupKey: `campaign_reply:${replyId}`,
          title: n.title,
          body: {
            vi: `${n.body.vi} "${replySnippet}"`,
            en: `${n.body.en} "${replySnippet}"`,
          },
          ctaLabel: { vi: "Xem reply", en: "View reply" },
        })
      }
    }

    return {
      handled: true,
      intent: classification.intent,
      requiresHuman: classification.requiresHuman,
      handoffEngagementId,
    }
  } catch (err) {
    console.error("[campaign] maybeHandleCampaignReply failed (falling back to legacy flow):", err)
    return { handled: false }
  }
}
