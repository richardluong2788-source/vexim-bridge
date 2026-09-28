// Handoff (spec §27, quyết định 25/09/2026): buyer INTERESTED → campaign dừng,
// pipeline hiện có tiếp quản.
//
// 1. Tạo buyer_engagements(stage 'claimed', account_manager = enrollment owner
//    hoặc fallback = người tạo campaign) — NẾU lead chưa có engagement active
//    (unique index 051 chặn 2 engagement active/lead).
// 2. dispatchNotification (new_assignment) cho AE, deep-link về inbox.
// 3. SYSTEM_EVENT audit. Campaign engine KHÔNG làm gì thêm sau điểm này.

import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { dispatchNotification } from "@/lib/notifications/dispatcher"
import { engagementFocusPath } from "@/lib/notifications/paths"
import { logSystemEvent } from "./interactions"
import type { CampaignEnrollmentRow, CampaignRow } from "./types"

export interface HandoffResult {
  engagementId: string | null
  /** engagement đã tồn tại từ trước — chỉ notify, không tạo mới. */
  reusedExisting: boolean
  notifiedUserId: string | null
}

/**
 * Tạo engagement tiếp quản cho lead của enrollment INTERESTED.
 * Idempotent: nếu enrollment đã có handoff_engagement_id → trả về luôn.
 */
export async function handoffToEngagement(
  enrollment: CampaignEnrollmentRow,
  campaign: Pick<CampaignRow, "id" | "name" | "created_by">,
  replyContext: { fromEmail: string; replySummary: string },
): Promise<HandoffResult> {
  const admin = createAdminClient()

  if (enrollment.handoff_engagement_id) {
    return {
      engagementId: enrollment.handoff_engagement_id,
      reusedExisting: true,
      notifiedUserId: enrollment.owner_id,
    }
  }

  const ownerId = enrollment.owner_id ?? campaign.created_by ?? null
  if (!ownerId) {
    // Không có ai tiếp quản — vẫn dừng sequence (an toàn), log để admin xử lý.
    await logSystemEvent({
      buyerId: enrollment.lead_id,
      campaignId: enrollment.campaign_id,
      enrollmentId: enrollment.id,
      event: "handoff_no_owner",
      description: `[Campaign] Buyer ${enrollment.lead_id} INTERESTED nhưng enrollment không có owner và campaign không có created_by — cần gán AE thủ công.`,
    })
    return { engagementId: null, reusedExisting: false, notifiedUserId: null }
  }

  // Lead đã có engagement active? (hiếm — buyer trong campaign thường chưa
  // được claim — nhưng có thể AE đã claim song song)
  const { data: existing } = await (admin.from("buyer_engagements") as any)
    .select("id, account_manager_id")
    .eq("lead_id", enrollment.lead_id)
    .not("stage", "in", '("converted","dropped")')
    .limit(1)

  let engagementId: string | null = null
  let reusedExisting = false
  let notifyUserId = ownerId

  if (existing && (existing as Array<{ id: string; account_manager_id: string }>).length > 0) {
    const row = (existing as Array<{ id: string; account_manager_id: string }>)[0]
    engagementId = row.id
    reusedExisting = true
    notifyUserId = row.account_manager_id
  } else {
    const { data: created, error } = await (admin.from("buyer_engagements") as any)
      .insert({
        lead_id: enrollment.lead_id,
        account_manager_id: ownerId,
        stage: "claimed",
        created_by: ownerId,
        // Ghi nguồn để AE hiểu tại sao có engagement này (không phải claim inbox).
        other_requirements: `[Campaign handoff] Buyer replied INTERESTED to campaign "${campaign.name}". Reply from ${replyContext.fromEmail}: ${replyContext.replySummary.slice(0, 500)}`,
      })
      .select("id")
      .single()

    if (error || !created) {
      console.error("[campaign] handoff engagement insert failed:", error)
      return { engagementId: null, reusedExisting: false, notifiedUserId: null }
    }
    engagementId = (created as { id: string }).id

    // Ghi ngược engagement id vào enrollment (audit + idempotency).
    await (admin.from("campaign_enrollments") as any)
      .update({ handoff_engagement_id: engagementId })
      .eq("id", enrollment.id)
  }

  await logSystemEvent({
    buyerId: enrollment.lead_id,
    campaignId: enrollment.campaign_id,
    enrollmentId: enrollment.id,
    event: "handoff_created",
    detail: { engagement_id: engagementId, reused_existing: reusedExisting },
    description: `[Campaign] Buyer ${enrollment.lead_id} INTERESTED → buyer_engagements ${engagementId} (stage claimed, AE ${notifyUserId}). Campaign sequence dừng.`,
  })

  await dispatchNotification({
    userId: notifyUserId,
    category: "new_assignment",
    opportunityId: null,
    linkPath: engagementFocusPath(engagementId),
    dedupKey: `campaign_handoff:${enrollment.id}`,
    title: {
      vi: "Buyer từ campaign đã phản hồi quan tâm",
      en: "Campaign buyer replied — interested",
    },
    body: {
      vi: `${replyContext.fromEmail} trả lời email campaign và được phân loại INTERESTED. Enrollment đã dừng — xử lý buyer trong engagement workspace.`,
      en: `${replyContext.fromEmail} replied to a campaign email and was classified INTERESTED. The sequence stopped — continue in the engagement workspace.`,
    },
    ctaLabel: { vi: "Mở engagement", en: "Open engagement" },
  })

  return { engagementId, reusedExisting, notifiedUserId: notifyUserId }
}
