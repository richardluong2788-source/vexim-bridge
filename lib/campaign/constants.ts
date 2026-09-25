// Campaign Engine B1 — single source of truth cho states, config và vocabulary.
//
// Module này là pure data: không import supabase, không import AI, không "use
// server" — cron route, server action, webhook và UI đều đọc được. State
// machine nằm ở state-machine.ts (cùng ràng buộc purity); mọi lời gọi AI chỉ
// xảy ra SAU khi state đã được quyết định bằng code thuần.

/** Các state của enrollment — phải khớp CHECK constraint migration 089. */
export const ENROLLMENT_STATES = [
  "enrolled",
  "contact_pending",
  "contacted",
  "waiting_reply",
  "followup_1",
  "followup_2",
  "paused",
  "nurture",
  "replied_handoff",
  "stopped",
  "suppressed",
  "invalid_contact",
] as const

export type EnrollmentState = (typeof ENROLLMENT_STATES)[number]

export const TERMINAL_STATES: readonly EnrollmentState[] = [
  "nurture",
  "replied_handoff",
  "stopped",
  "suppressed",
  "invalid_contact",
]

export function isTerminalState(state: string): boolean {
  return (TERMINAL_STATES as readonly string[]).includes(state)
}

/** Label song ngữ cho UI. */
export const STATE_LABELS: Record<EnrollmentState, { vi: string; en: string }> = {
  enrolled: { vi: "Đã enroll", en: "Enrolled" },
  contact_pending: { vi: "Chờ duyệt email", en: "Awaiting email approval" },
  contacted: { vi: "Đã gửi email", en: "Contacted" },
  waiting_reply: { vi: "Đang đợi reply", en: "Waiting for reply" },
  followup_1: { vi: "Đã gửi follow-up 1", en: "Follow-up 1 sent" },
  followup_2: { vi: "Đã gửi follow-up 2", en: "Follow-up 2 sent" },
  paused: { vi: "Tạm dừng", en: "Paused" },
  nurture: { vi: "Nurture dài hạn", en: "Nurture" },
  replied_handoff: { vi: "Buyer reply — đã bàn giao AE", en: "Replied — handed off" },
  stopped: { vi: "Dừng (không quan tâm)", en: "Stopped (not interested)" },
  suppressed: { vi: "Dừng vĩnh viễn (suppressed)", en: "Suppressed" },
  invalid_contact: { vi: "Contact không hợp lệ", en: "Invalid contact" },
}

// ---------------------------------------------------------------------------
// Reply intent (7 giá trị, spec §14 rút gọn cho B1 — quyết định 25/09/2026)
// ---------------------------------------------------------------------------

export const CAMPAIGN_INTENTS = [
  "INTERESTED",
  "NOT_INTERESTED",
  "NOT_NOW",
  "OPT_OUT",
  "OUT_OF_OFFICE",
  "WRONG_CONTACT",
  "UNKNOWN",
] as const

export type CampaignIntent = (typeof CAMPAIGN_INTENTS)[number]

export interface CampaignReplyClassification {
  intent: CampaignIntent
  confidence: number
  /** Rule/guardrail hoặc AI nào quyết định cuối. */
  source: "ai" | "rules" | "ai+rules"
  /** < 0.85 hoặc UNKNOWN → bắt buộc AE review trước khi hành động. */
  requiresHuman: boolean
  /** Flag PAUSE (không tính là reply — enrollment quay lại đúng luồng). */
  isPauseOnly: boolean
  /** Luẩn lý dừng sequence? */
  stopsSequence: boolean
  reason: string
}

/** Threshold phân loại tự động (quyết định đã chốt). Dưới ngưỡng → human review. */
export const CONFIDENCE_THRESHOLD = 0.85

/** Follow-up gate: AI tự đánh giá "có lý do liên hệ tiếp không". Dưới ngưỡng
 *  (AI không chắc) → HOLD human review thay vì gửi. */
export const GATE_CONFIDENCE_THRESHOLD = 0.7

/** Cap tổng enrollment/campaign cho pilot theo cấp bậc (10 → 30 → 50–100).
 *  Override bằng env; mặc định 100. */
export function pilotEnrollmentCap(): number {
  const n = Number(process.env.CAMPAIGN_PILOT_MAX_ENROLLMENTS ?? "100")
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 100
}

// ---------------------------------------------------------------------------
// Config scheduler / policy
// ---------------------------------------------------------------------------

/** Giữa CONTACTED → WAITING_REPLY (grace đợi mail server + tránh xử lý reply cùng ngày). */
export const CONTACTED_GRACE_HOURS = 24

/** Claim treo quá lâu (sinh draft không xong) → cron dọn lại. */
export const FIRING_RECLAIM_MINUTES = 30

/** Shadow mode: mọi email đều bắt buộc approval. Bật auto-send sau 2–4 tuần
 *  bằng env CAMPAIGN_AUTO_SEND=true (không bật trong code lần này). */
export function isAutoSendEnabled(): boolean {
  return process.env.CAMPAIGN_AUTO_SEND === "true"
}

/** Cap gửi toàn hệ thống mỗi ngày (phòng khi nhiều campaign chạy song song). */
export const GLOBAL_DAILY_SEND_LIMIT = Number(process.env.CAMPAIGN_GLOBAL_DAILY_LIMIT ?? "60")

/** OUT_OF_OFFICE → PAUSE bao lâu trước khi quay lại đúng bước đang dở. */
export const OOO_PAUSE_DAYS = 7

/** NOT_NOW → PAUSE bao lâu rồi chuyển NURTURE. */
export const NOT_NOW_PAUSE_DAYS = 30

/** Độ dài email tối đa (từ) — QA fail MEDIUM nếu vượt. */
export const MAX_EMAIL_WORDS = 200

/** Fallback owner khi enrollment không có owner_id: dùng người tạo campaign. */
export const NOTIFICATION_DEDUP_PREFIX = "campaign"
