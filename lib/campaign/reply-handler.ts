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

    // 8. Notify owner khi cần con người xử lý.
    if ((classification.requiresHuman || classification.intent === "NOT_NOW") && enrollment.owner_id) {
      await dispatchNotification({
        userId: enrollment.owner_id,
        category: "action_required",
        opportunityId: null,
        linkPath: `/admin/campaigns/${enrollment.campaign_id}`,
        dedupKey: `campaign_reply_review:${(replyRow as { id: string }).id}`,
        title: {
          vi: "Campaign: reply cần AE xem",
          en: "Campaign: reply needs review",
        },
        body: {
          vi: `${input.fromEmail} → ${classification.intent} (conf ${classification.confidence.toFixed(2)}). ${classification.requiresHuman ? "Confidence thấp/ambiguous — sequence đang HOLD." : ""}`,
          en: `${input.fromEmail} → ${classification.intent} (conf ${classification.confidence.toFixed(2)}). ${classification.requiresHuman ? "Low confidence/ambiguous — sequence on hold." : ""}`,
        },
        ctaLabel: { vi: "Xem reply", en: "Review reply" },
      })
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
