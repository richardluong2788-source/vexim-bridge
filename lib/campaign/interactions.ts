// Ghi buyer_interactions — append-only (migration 089: RLS không có UPDATE/DELETE).
//
// Quy tắc: MỌI hành động của campaign engine (sinh draft, gửi, nhận reply,
// handoff, stop, pause…) đều phải append MỘT hàng interaction. Không bao giờ
// update/xoá hàng cũ — sửa nội dung = thêm hàng mới với metadata.
//
// Đồng thời ghi activities (bảng audit tổng của CRM) để mọi hành động nhìn
// được từ /admin/activities — Definition of Done §30.

import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import type { BuyerInteractionInsert } from "./types"

async function insertInteraction(row: BuyerInteractionInsert): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await (admin.from("buyer_interactions") as any)
    .insert({
      buyer_id: row.buyer_id,
      campaign_id: row.campaign_id ?? null,
      enrollment_id: row.enrollment_id ?? null,
      interaction_type: row.interaction_type,
      direction: row.direction,
      subject: row.subject ?? null,
      content: row.content ?? null,
      sender: row.sender ?? null,
      recipient: row.recipient ?? null,
      ...(row.occurred_at ? { occurred_at: row.occurred_at } : {}),
      sequence_step: row.sequence_step ?? null,
      ai_generated: row.ai_generated ?? false,
      human_approved: row.human_approved ?? false,
      reply_classification: row.reply_classification ?? null,
      sentiment: row.sentiment ?? null,
      intent: row.intent ?? null,
      metadata: row.metadata ?? null,
      draft_id: row.draft_id ?? null,
      created_by: row.created_by ?? null,
    })
    .select("id")
    .single()

  if (error) {
    // Interaction log lỗi KHÔNG được chặn luồng nghiệp vụ, nhưng phải nhìn thấy.
    console.error("[campaign] buyer_interactions insert failed:", error)
    return null
  }
  return (data as { id: string } | null)?.id ?? null
}

async function insertActivity(params: {
  actionType: string
  description: string
  performedBy?: string | null
}): Promise<void> {
  const admin = createAdminClient()
  // activities.opportunity_id nullable — campaign chạy trước khi có opportunity,
  // nên log gắn qua description + action_type (tiền tố "campaign_").
  const { error } = await admin.from("activities").insert({
    opportunity_id: null,
    action_type: params.actionType,
    description: params.description,
    performed_by: params.performedBy ?? null,
  })
  if (error) {
    console.error("[campaign] activities insert failed:", error)
  }
}

/**
 * Ghi interaction + audit activity. `actionType` tiền tố "campaign_" để lọc
 * được; description nên chứa buyer company + enrollment id để tra được.
 */
export async function appendInteraction(
  row: BuyerInteractionInsert,
  audit?: { actionType: string; description: string; performedBy?: string | null },
): Promise<string | null> {
  const id = await insertInteraction(row)
  if (audit) {
    await insertActivity({
      actionType: audit.actionType,
      description: audit.description,
      performedBy: audit.performedBy ?? null,
    })
  }
  return id
}

/** SYSTEM_EVENT gọn: chỉ cần buyer + enrollment + mô tả. */
export async function logSystemEvent(params: {
  buyerId: string
  campaignId?: string | null
  enrollmentId?: string | null
  step?: number | null
  event: string
  detail?: Record<string, unknown>
  description: string
}): Promise<string | null> {
  return appendInteraction(
    {
      buyer_id: params.buyerId,
      campaign_id: params.campaignId ?? null,
      enrollment_id: params.enrollmentId ?? null,
      interaction_type: "SYSTEM_EVENT",
      direction: "INTERNAL",
      subject: params.event,
      sequence_step: params.step ?? null,
      metadata: params.detail ?? null,
    },
    {
      actionType: `campaign_${params.event}`,
      description: params.description,
    },
  )
}

/** Load previous outbound emails cho một enrollment (context builder dùng). */
export async function loadOutboundEmails(enrollmentId: string): Promise<
  Array<{ step: number; sent_at: string; subject: string; content: string }>
> {
  const admin = createAdminClient()
  const { data, error } = await (admin.from("buyer_interactions") as any)
    .select("sequence_step, occurred_at, subject, content, metadata")
    .eq("enrollment_id", enrollmentId)
    .eq("interaction_type", "EMAIL")
    .order("occurred_at", { ascending: true })

  if (error) {
    console.error("[campaign] loadOutboundEmails failed:", error)
    return []
  }
  type Row = {
    sequence_step: number | null
    occurred_at: string
    subject: string | null
    content: string | null
    metadata: { final_content?: string } | null
  }
  return ((data ?? []) as Row[]).map((r) => ({
    step: r.sequence_step ?? 0,
    sent_at: r.occurred_at,
    subject: r.subject ?? "",
    // Bản final AE duyệt (metadata.final_content) ưu tiên hơn bản AI.
    content: r.metadata?.final_content ?? r.content ?? "",
  }))
}

/** Load inbound replies cho enrollment (context builder + anti-repeat dùng). */
export async function loadInboundReplies(enrollmentId: string): Promise<
  Array<{ received_at: string; content: string; intent: string | null }>
> {
  const admin = createAdminClient()
  const { data, error } = await (admin.from("buyer_interactions") as any)
    .select("occurred_at, content, reply_classification")
    .eq("enrollment_id", enrollmentId)
    .eq("interaction_type", "REPLY")
    .order("occurred_at", { ascending: true })

  if (error) {
    console.error("[campaign] loadInboundReplies failed:", error)
    return []
  }
  type Row = {
    occurred_at: string
    content: string | null
    reply_classification: { intent?: string } | null
  }
  return ((data ?? []) as Row[]).map((r) => ({
    received_at: r.occurred_at,
    content: r.content ?? "",
    intent: r.reply_classification?.intent ?? null,
  }))
}
