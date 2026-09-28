export type BuyerActionValue =
  | "viewed_only"
  | "interested_no_details"
  | "requested_info"
  | "requested_sample"
  | "requested_meeting"
  | "requested_order_discussion"
  | "selected_primary"
  | "sent_price_volume"
  | "sent_po"
  // Pitch-first (migration 093): buyer chê supplier này — gate re-pitch ở
  // buildShortlist sẽ chặn AE đề xuất lại trong cùng engagement.
  | "declined"

/** 094 — lý do chê có cấu trúc (buyer quick-pick, optional). */
export type BuyerDeclineReason =
  | "products_mismatch"
  | "price_moq"
  | "missing_certs"
  | "existing_supplier"
  | "other"

// The only values a buyer can set from this public page. "selected_primary",
// "sent_price_volume" and "sent_po" are internal/AE-only classifications
// recorded elsewhere once a real commercial step has actually happened —
// they must never be one-click actions on the buyer-facing shortlist.
export const BUYER_SELECTABLE_ACTIONS = [
  "requested_info",
  "requested_sample",
  "requested_meeting",
  "interested_no_details",
  "requested_order_discussion",
  // Pitch-first (093): buyer được nói "không phù hợp" — quan trọng cho gate
  // re-pitch (AE không được đề xuất lại supplier đã chê).
  "declined",
] as const satisfies readonly BuyerActionValue[]
