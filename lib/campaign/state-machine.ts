// Campaign state machine — pure functions. KHÔNG AI, KHÔNG DB, KHÔNG side effect.
//
// Đây là phần "WHEN" của kiến trúc (spec §2.1, §8): toàn bộ phép chuyển state
// nằm ở một file duy nhất, dễ review, dễ test. Mọi code path khác (scheduler,
// webhook, server action) ĐỀU phải đi qua các hàm ở đây — không update cột
// state của campaign_enrollments trực tiếp ở chỗ khác.
//
// Shadow-mode timing (quyết định 25/09/2026):
//   - State CHỈ chuyển khi email THỰC SỰ được gửi (AE duyệt), không phải khi
//     draft được sinh. Giữa hai thời điểm đó enrollment ở nguyên state cũ với
//     next_action_type = 'approval_overdue_check' (nhắc AE, không tự gửi).
//   - CONTACTED là grace window 24h sau email 1 (đợi mail server, tránh xử lý
//     reply cùng ngày) → WAITING_REPLY mở follow-up countdown.

import {
  type EnrollmentState,
  CONTACTED_GRACE_HOURS,
  NOT_NOW_PAUSE_DAYS,
  OOO_PAUSE_DAYS,
  isTerminalState,
} from "./constants"

/** Kết quả một phép chuyển state — caller áp dụng qua enrollments.applyTransition. */
export interface StateTransition {
  /** null = giữ nguyên state (transition bị từ chối / không hợp lệ). */
  to: EnrollmentState | null
  currentStepNumber?: number
  followupCountDelta?: number
  nextActionAt?: Date | null
  nextActionType?: string | null
  /** Clear cờ review khi AE đã xử lý. */
  clearHumanReview?: boolean
  needsHumanReview?: boolean
  humanReviewReason?: string | null
  pausedUntil?: Date | null
  stoppedReason?: string | null
  /** Stamp last_contact_at = now (khi email thực sự được gửi). */
  lastContactNow?: boolean
  /** Ghi lại vì sao chuyển (audit + debug). */
  note?: string
}

function hoursFromNow(h: number, now: Date): Date {
  return new Date(now.getTime() + h * 60 * 60 * 1000)
}

function daysFromNow(d: number, now: Date): Date {
  return new Date(now.getTime() + d * 24 * 60 * 60 * 1000)
}

// ---------------------------------------------------------------------------
// Sự kiện thời gian (cron)
// ---------------------------------------------------------------------------

/**
 * Draft bước 1 đã vào approval queue → CONTACT_PENDING (đúng máy trạng thái
 * đã duyệt: ENROLLED → CONTACT_PENDING → CONTACTED). State chỉ rời
 * contact_pending khi email THỰC SỰ được gửi (onFirstEmailSent) hoặc draft bị
 * reject (scheduler retry, giữ contact_pending).
 */
export function onStepDue(state: EnrollmentState, now: Date = new Date()): StateTransition {
  if (state !== "enrolled" && state !== "contact_pending") return { to: null, note: "unexpected_state_for_step1" }
  return {
    to: "contact_pending",
    nextActionAt: daysFromNow(2, now),
    nextActionType: "approval_overdue_check",
    note: "step1_draft_queued",
  }
}

/** EMAIL 1 được gửi (AE duyệt) → CONTACTED với grace window 24h. */
export function onFirstEmailSent(state: EnrollmentState, now: Date = new Date()): StateTransition {
  if (state !== "enrolled" && state !== "contact_pending") {
    return { to: null, note: "unexpected_state_for_first_send" }
  }
  return {
    to: "contacted",
    lastContactNow: true,
    nextActionAt: hoursFromNow(CONTACTED_GRACE_HOURS, now),
    nextActionType: "contacted_grace",
    note: "email_1_sent",
  }
}

/** CONTACTED hết grace → WAITING_REPLY, mở countdown follow-up step 2. */
export function onContactedGraceElapsed(
  state: EnrollmentState,
  followupDelayDays: number,
  now: Date = new Date(),
): StateTransition {
  if (state !== "contacted") return { to: null, note: "not_contacted" }
  return {
    to: "waiting_reply",
    nextActionAt: daysFromNow(Math.max(followupDelayDays, 1), now),
    nextActionType: "followup_due",
    note: "grace_elapsed",
  }
}

/**
 * FOLLOWUP N được gửi (AE duyệt) → followup_1 / followup_2.
 * @param sentStepNumber bước vừa gửi (≥2)
 * @param nextStepDelayDays delay của bước KẾ TIẾP; null nếu hết bảng step
 *   (khi đó next_action là nurture_due).
 */
export function onFollowupEmailSent(
  state: EnrollmentState,
  sentStepNumber: number,
  nextStepDelayDays: number | null,
  now: Date = new Date(),
): StateTransition {
  if (state !== "waiting_reply" && state !== "followup_1" && state !== "followup_2") {
    return { to: null, note: "unexpected_state_for_followup_send" }
  }
  const target: EnrollmentState = sentStepNumber <= 2 ? "followup_1" : "followup_2"
  return {
    to: target,
    currentStepNumber: sentStepNumber,
    followupCountDelta: 1,
    lastContactNow: true,
    nextActionAt:
      nextStepDelayDays !== null
        ? daysFromNow(Math.max(nextStepDelayDays, 1), now)
        : daysFromNow(14, now),
    nextActionType: nextStepDelayDays !== null ? "followup_due" : "nurture_due",
    note: `followup_${sentStepNumber}_sent`,
  }
}

/** Enrollment đang chờ AE duyệt draft (không đổi state, đặt mốc nhắc). */
export function onDraftQueuedForApproval(state: EnrollmentState, now: Date = new Date()): StateTransition {
  return {
    to: null,
    nextActionAt: daysFromNow(2, now),
    nextActionType: "approval_overdue_check",
    note: "draft_queued",
  }
}

/** Draft sinh lỗi → đặt mốc retry 1 giờ sau (firing failed sẽ được claim lại). */
export function onDraftGenerationFailed(state: EnrollmentState, now: Date = new Date()): StateTransition {
  return {
    to: null,
    nextActionAt: hoursFromNow(1, now),
    nextActionType: "step_retry",
    note: "draft_failed_retry",
  }
}

/** PAUSED hết hạn (OUT_OF_OFFICE / NOT_NOW) → quay lại luồng follow-up. */
export function onResumeAfterPause(state: EnrollmentState): StateTransition {
  if (state !== "paused") return { to: null, note: "not_paused" }
  return {
    to: "waiting_reply",
    pausedUntil: null,
    nextActionAt: null, // caller tính follow-up due ngay sau khi áp dụng
    nextActionType: "followup_due",
    note: "pause_expired",
  }
}

/** Hết sequence (hết bảng step) mà buyer vẫn im lặng → NURTURE (spec §8). */
export function onNurtureDue(state: EnrollmentState): StateTransition {
  if (state !== "waiting_reply" && state !== "followup_1" && state !== "followup_2") {
    return { to: null, note: "not_nurtureable" }
  }
  return {
    to: "nurture",
    nextActionAt: null,
    nextActionType: null,
    stoppedReason: "sequence_exhausted_no_reply",
    note: "nurture",
  }
}

/**
 * Reply của buyer → chuyển state. Trả về to=null khi:
 *  - state hiện tại không nhận reply (đã terminal),
 *  - hoặc classification cần human review (giữ state, chỉ đặt cờ HOLD).
 * OUT_OF_OFFICE KHÔNG được coi là reply (quyết định đã chốt) — nó là PAUSE.
 */
export function onReplyClassified(
  state: EnrollmentState,
  classification: {
    intent: string
    confidence: number
    requiresHuman: boolean
  },
  now: Date = new Date(),
): StateTransition {
  // Terminal states không bao giờ hồi sinh bằng reply — ngoại lệ OPT_OUT trễ
  // vẫn giữ terminal (đã stop từ trước, chỉ stamp thêm suppression ở caller).
  if (isTerminalState(state)) return { to: null, note: `terminal_${state}` }

  // Human review: giữ state, HOLD follow-up (next_action_at null) đến khi AE xử lý.
  if (classification.requiresHuman) {
    return {
      to: null,
      needsHumanReview: true,
      humanReviewReason: `reply_${classification.intent.toLowerCase()}_conf_${classification.confidence.toFixed(2)}`,
      nextActionAt: null,
      nextActionType: "human_review",
      note: "human_review_hold",
    }
  }

  switch (classification.intent) {
    case "INTERESTED":
      // REPLIED_HANDOFF — campaign dừng, pipeline hiện có tiếp quản (caller
      // chịu trách nhiệm tạo buyer_engagements + notify).
      return {
        to: "replied_handoff",
        nextActionAt: null,
        nextActionType: null,
        stoppedReason: "buyer_interested_handoff",
        note: "handoff",
      }

    case "NOT_INTERESTED":
      return {
        to: "stopped",
        nextActionAt: null,
        nextActionType: null,
        stoppedReason: "buyer_not_interested",
        note: "stop",
      }

    case "OPT_OUT":
      return {
        to: "suppressed",
        nextActionAt: null,
        nextActionType: null,
        stoppedReason: "buyer_opted_out",
        note: "suppress",
      }

    case "WRONG_CONTACT":
      return {
        to: "invalid_contact",
        nextActionAt: null,
        nextActionType: null,
        stoppedReason: "wrong_contact",
        note: "invalid_contact",
      }

    case "NOT_NOW":
      return {
        to: "paused",
        pausedUntil: daysFromNow(NOT_NOW_PAUSE_DAYS, now),
        nextActionAt: daysFromNow(NOT_NOW_PAUSE_DAYS, now),
        nextActionType: "pause_expiry",
        stoppedReason: "buyer_not_now",
        note: "pause_not_now",
      }

    case "OUT_OF_OFFICE":
      // PAUSE — KHÔNG tính là reply: không đếm follow-up, không dừng sequence.
      return {
        to: "paused",
        pausedUntil: daysFromNow(OOO_PAUSE_DAYS, now),
        nextActionAt: daysFromNow(OOO_PAUSE_DAYS, now),
        nextActionType: "pause_expiry",
        stoppedReason: "out_of_office",
        note: "pause_ooo",
      }

    case "UNKNOWN":
    default:
      // Classifier không chắc → human review (phòng thủ thứ hai nếu caller quên set).
      return {
        to: null,
        needsHumanReview: true,
        humanReviewReason: "reply_unknown_intent",
        nextActionAt: null,
        nextActionType: "human_review",
        note: "human_review_hold",
      }
  }
}

// ---------------------------------------------------------------------------
// Sự kiện hệ thống / con người
// ---------------------------------------------------------------------------

/** AE từ chối draft → scheduler sinh lại sau 1 giờ (firing đã mark failed). */
export function onDraftRejected(state: EnrollmentState, now: Date = new Date()): StateTransition {
  return {
    to: null,
    nextActionAt: hoursFromNow(1, now),
    nextActionType: "step_retry",
    note: "draft_rejected_will_retry",
  }
}

/** AE resolve human review: resume hoặc stop. */
export function onReviewResolved(
  state: EnrollmentState,
  decision: "resume" | "stop",
  now: Date = new Date(),
): StateTransition {
  if (decision === "stop") {
    return {
      to: "stopped",
      nextActionAt: null,
      nextActionType: null,
      stoppedReason: "human_review_stopped",
      clearHumanReview: true,
      note: "review_stopped",
    }
  }
  return {
    to: state === "paused" ? "waiting_reply" : state, // giữ state, bỏ HOLD
    clearHumanReview: true,
    nextActionAt: now,
    nextActionType: "followup_due",
    note: "review_resumed",
  }
}

/** STOP thủ công / suppression từ delivery-event hoặc AE. */
export function onManualStop(state: EnrollmentState, reason: string): StateTransition {
  if (isTerminalState(state)) return { to: null, note: `terminal_${state}` }
  return {
    to: "stopped",
    nextActionAt: null,
    nextActionType: null,
    stoppedReason: reason,
    note: "manual_stop",
  }
}

/** Suppression cứng (bounce/complaint/unsubscribe phát hiện từ stop-check). */
export function onSuppression(state: EnrollmentState, reason: string): StateTransition {
  if (isTerminalState(state)) return { to: null, note: `terminal_${state}` }
  return {
    to: "suppressed",
    nextActionAt: null,
    nextActionType: null,
    stoppedReason: reason,
    note: "suppressed",
  }
}

/** Contact không hợp lệ (mất email / WRONG_CONTACT). */
export function onInvalidContact(state: EnrollmentState, reason: string): StateTransition {
  if (isTerminalState(state)) return { to: null, note: `terminal_${state}` }
  return {
    to: "invalid_contact",
    nextActionAt: null,
    nextActionType: null,
    stoppedReason: reason,
    note: "invalid_contact",
  }
}

/** AE pause thủ công. */
export function onManualPause(state: EnrollmentState, until: Date | null): StateTransition {
  if (isTerminalState(state)) return { to: null, note: `terminal_${state}` }
  return {
    to: "paused",
    pausedUntil: until,
    nextActionAt: until ?? null,
    nextActionType: until ? "pause_expiry" : null,
    note: "manual_pause",
  }
}
