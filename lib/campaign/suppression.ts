// STOP / suppression checks (spec §13, §22) — lớp phòng thủ trước khi sinh
// hoặc gửi bất kỳ email nào của campaign.
//
// Thứ tự nguồn dữ liệu:
//   1. leads: email_unsubscribed / email_hard_bounced_at / email_complained_at
//      (đã có sẵn từ migration 025/077 — delivery-events stamp, chỉ admin gỡ).
//   2. contact hợp lệ: leads.contact_email (bắt buộc để gửi).
//
// Hàm thuần getStopReason() để test được; wrapper loadLeadStopCheck() query DB.

import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import type { EnrollmentState } from "./constants"

export interface LeadStopFields {
  contact_email: string | null
  email_unsubscribed: boolean | null
  email_hard_bounced_at: string | null
  email_complained_at: string | null
}

export type StopCheckResult =
  | { ok: true }
  | { ok: false; state: "suppressed" | "invalid_contact"; reason: string }

/** Thuần: quyết định dừng/pause từ các cột suppression của lead. */
export function getStopReason(lead: LeadStopFields): StopCheckResult {
  if (lead.email_unsubscribed === true) {
    return { ok: false, state: "suppressed", reason: "lead_unsubscribed" }
  }
  if (lead.email_hard_bounced_at) {
    return { ok: false, state: "suppressed", reason: "lead_hard_bounced" }
  }
  if (lead.email_complained_at) {
    return { ok: false, state: "suppressed", reason: "lead_spam_complained" }
  }
  if (!lead.contact_email || !lead.contact_email.includes("@")) {
    return { ok: false, state: "invalid_contact", reason: "missing_contact_email" }
  }
  return { ok: true }
}

/** DB wrapper — dùng ở scheduler trước khi claim bất kỳ bước nào. */
export async function checkLeadStop(leadId: string): Promise<StopCheckResult & { lead?: LeadStopFields }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("leads")
    .select("contact_email, email_unsubscribed, email_hard_bounced_at, email_complained_at")
    .eq("id", leadId)
    .single()

  if (error || !data) {
    // Không đọc được lead = không gửi. An toàn là trên hết.
    return {
      ok: false,
      state: "invalid_contact",
      reason: `lead_lookup_failed${error ? `: ${error.message}` : ""}`,
    }
  }
  const lead = data as LeadStopFields
  const result = getStopReason(lead)
  return result.ok ? { ok: true, lead } : result
}

/** Map kết quả stop-check sang state terminal tương ứng. */
export function stopStateToEnrollmentState(state: "suppressed" | "invalid_contact"): EnrollmentState {
  return state === "suppressed" ? "suppressed" : "invalid_contact"
}
