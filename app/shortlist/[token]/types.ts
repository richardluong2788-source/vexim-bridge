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
] as const satisfies readonly BuyerActionValue[]
