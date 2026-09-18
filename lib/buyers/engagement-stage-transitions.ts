// Automatic stage moves caused by the buyer, not by the AE.
//
// Until this module existed, `buyer_responded` was unreachable: nothing outside
// the AE's own buttons ever wrote `buyer_engagements.stage` (see the long note
// in components/admin/engagement-action-bar.tsx), so a buyer answering an email
// left the row looking exactly as it did before — same stage, same position in
// the queue. The AE only learned about it by opening the card.
//
// The rule here is deliberately narrow: move the stage only when the reply
// unambiguously means "the buyer answered something we sent". Everything else
// keeps its stage, because the stage decides which buttons the AE gets, and a
// wrong move hides the next step.
//
//   claimed                → keep. Nothing has been sent yet; the ball is with
//                            the AE ("Soạn email mở đầu" is the next step), and
//                            moving on would take that button away.
//   requirement_email_sent → buyer_responded. We asked about their needs; a
//                            reply is the answer, and the stage map then offers
//                            "Ghi nhận nhu cầu buyer" (the reply is prose until
//                            the AE records it).
//   requirements_received  → keep. The AE has just recorded the answer and owes
//                            the buyer a shortlist; the reply is raw material,
//                            not a response to anything shared yet.
//   shortlist_ready        → keep. The draft has not been shared.
//   shortlist_sent         → buyer_responded.
//   buyer_viewed           → buyer_responded.
//   buyer_responded        → keep (already there).
//   qualified_interest     → keep. The buyer marked interest on the public
//                            shortlist; that is FURTHER along than "replied",
//                            and going back would lose the decision context.
//   converted / dropped    → keep. Closed engagements are never reopened by an
//                            inbound email.
//
// Plain module (no "use server", no "use client"): the inbound webhook, which
// runs as a route handler with no user session, is the only caller today, but
// the rule belongs next to the stage map it protects.

import { isEngagementClosed } from "@/lib/buyers/engagement-stages"

/** Stages a buyer reply may move an engagement into. */
export const BUYER_REPLY_STAGES = ["requirement_email_sent", "shortlist_sent", "buyer_viewed"] as const

/**
 * The stage an engagement should move to now that the buyer has written in —
 * `null` when the reply should not change the stage.
 */
export function nextStageOnBuyerReply(stage: string | null | undefined): string | null {
  if (!stage || isEngagementClosed(stage)) return null
  return (BUYER_REPLY_STAGES as readonly string[]).includes(stage)
    ? "buyer_responded"
    : null
}
