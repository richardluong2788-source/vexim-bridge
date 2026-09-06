"use server"

/**
 * Opportunity Meetings — Cuộc gặp & Tham quan gắn với deal (migration 070).
 *
 * Server actions cho section "Cuộc gặp & Tham quan" trong sheet chi tiết
 * opportunity + badge 📅 trên thẻ Kanban + dải "sắp tới" trên trang Pipeline.
 *
 * Thiết kế: meeting là SỰ KIỆN có lịch, không phải giai đoạn pipeline —
 * một deal có thể có video call ở giai đoạn sample, buyer trip ở giai đoạn
 * negotiation. Vì vậy tách bảng riêng thay vì thêm stage.
 *
 * Cap: DEAL_VIEW cho cả đọc lẫn ghi — ai nhìn thấy deal thì được ghi
 * log cuộc gặp của deal đó (giống activity log; không phải dữ liệu tài chính).
 */

import { revalidatePath } from "next/cache"
import { requireCap } from "@/lib/auth/guard"
import { CAPS } from "@/lib/auth/permissions"
import type { MeetingKind, OpportunityMeeting } from "@/lib/supabase/types"

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export interface AddMeetingInput {
  opportunityId: string
  kind: MeetingKind
  title: string
  scheduledAt: string // ISO
  location?: string | null
  notes?: string | null
}

const KINDS: MeetingKind[] = ["video_call", "factory_tour", "buyer_trip", "meeting", "trade_fair"]

export async function listOpportunityMeetings(
  opportunityId: string
): Promise<ActionResult<OpportunityMeeting[]>> {
  const guard = await requireCap(CAPS.DEAL_VIEW)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin } = guard

  const { data, error } = await admin
    .from("opportunity_meetings")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .order("scheduled_at", { ascending: false })

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: (data ?? []) as OpportunityMeeting[] }
}

export async function addOpportunityMeeting(
  input: AddMeetingInput
): Promise<ActionResult<{ id: string }>> {
  const guard = await requireCap(CAPS.DEAL_VIEW)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin, userId } = guard

  const title = input.title?.trim()
  if (!input.opportunityId || !title) return { ok: false, error: "missing_fields" }
  if (!KINDS.includes(input.kind)) return { ok: false, error: "invalid_kind" }
  const scheduledAt = new Date(input.scheduledAt)
  if (Number.isNaN(scheduledAt.getTime())) return { ok: false, error: "invalid_date" }

  const { data, error } = await admin
    .from("opportunity_meetings")
    .insert({
      opportunity_id: input.opportunityId,
      kind: input.kind,
      title,
      scheduled_at: scheduledAt.toISOString(),
      location: input.location?.trim() || null,
      notes: input.notes?.trim() || null,
      created_by: userId,
    })
    .select("id")
    .single()

  if (error || !data) return { ok: false, error: error?.message ?? "insert_failed" }

  await admin.from("activities").insert({
    opportunity_id: input.opportunityId,
    action_type: "meeting_scheduled",
    description: `[Cuộc gặp] ${labelForKind(input.kind)}: ${title} — ${scheduledAt.toLocaleString("vi-VN")}`,
    performed_by: userId,
  })

  revalidatePath("/admin/pipeline")
  return { ok: true, data: { id: data.id } }
}

export async function updateMeetingOutcome(input: {
  meetingId: string
  outcome: string
}): Promise<ActionResult<unknown>> {
  const guard = await requireCap(CAPS.DEAL_VIEW)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin, userId } = guard

  if (!input.meetingId) return { ok: false, error: "missing_fields" }

  const { error } = await admin
    .from("opportunity_meetings")
    .update({ outcome: input.outcome?.trim() || null })
    .eq("id", input.meetingId)

  if (error) return { ok: false, error: error.message }

  await admin.from("activities").insert({
    action_type: "meeting_outcome_updated",
    description: `[Cuộc gặp] Cập nhật kết quả: ${input.outcome?.trim().slice(0, 160) ?? "—"}`,
    performed_by: userId,
  })

  revalidatePath("/admin/pipeline")
  return { ok: true, data: null }
}

export async function deleteOpportunityMeeting(
  meetingId: string
): Promise<ActionResult<unknown>> {
  const guard = await requireCap(CAPS.DEAL_VIEW)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin, userId } = guard

  if (!meetingId) return { ok: false, error: "missing_fields" }

  const { error } = await admin
    .from("opportunity_meetings")
    .delete()
    .eq("id", meetingId)

  if (error) return { ok: false, error: error.message }

  await admin.from("activities").insert({
    action_type: "meeting_deleted",
    description: "[Cuộc gặp] Đã xóa một mục lịch khỏi deal",
    performed_by: userId,
  })

  revalidatePath("/admin/pipeline")
  return { ok: true, data: null }
}

function labelForKind(kind: MeetingKind): string {
  switch (kind) {
    case "video_call": return "Video call"
    case "factory_tour": return "Tham quan nhà máy"
    case "buyer_trip": return "Buyer sang VN"
    case "trade_fair": return "Hội chợ"
    default: return "Họp"
  }
}
