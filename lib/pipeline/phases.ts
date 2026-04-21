import type { Stage } from "@/lib/supabase/types"

/**
 * Client-facing 5-phase pipeline (simplified from the 10-stage admin pipeline).
 * This abstracts operational details from the client's view so they see a cleaner
 * deal lifecycle without leaking every internal state change.
 */
export type ClientPhase =
  | "prospecting"
  | "sampling"
  | "negotiation"
  | "fulfillment"
  | "closed_won"
  | "closed_lost"

export const CLIENT_PHASE_ORDER: ClientPhase[] = [
  "prospecting",
  "sampling",
  "negotiation",
  "fulfillment",
  "closed_won",
]

export function stageToClientPhase(stage: Stage): ClientPhase {
  switch (stage) {
    case "new":
    case "contacted":
      return "prospecting"
    case "sample_requested":
    case "sample_sent":
      return "sampling"
    case "negotiation":
    case "price_agreed":
      return "negotiation"
    case "production":
    case "shipped":
      return "fulfillment"
    case "won":
      return "closed_won"
    case "lost":
      return "closed_lost"
    default:
      return "prospecting"
  }
}

export function phaseIndex(phase: ClientPhase): number {
  // closed_lost is represented as a terminal state, not a progression step
  if (phase === "closed_lost") return -1
  return CLIENT_PHASE_ORDER.indexOf(phase)
}

/**
 * Progress ratio 0..1 for rendering the client progress bar.
 * closed_lost returns 0 because the deal did not advance.
 */
export function phaseProgress(stage: Stage): number {
  const phase = stageToClientPhase(stage)
  if (phase === "closed_lost") return 0
  const idx = phaseIndex(phase)
  if (idx < 0) return 0
  return (idx + 1) / CLIENT_PHASE_ORDER.length
}
