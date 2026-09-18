// Per-engagement figures the inbox needs on every row, computed once.
//
// These used to be inline inside the engagement card (and would have been
// copied a second time into the master–detail row list, which is exactly how
// two screens end up disagreeing about "how long has this buyer been sitting").
// One pure function, two callers: the worklist row (which is compact and needs
// only the headline facts) and the detail pane (which shows the same headline
// facts next to everything else).
//
// Plain module: no JSX, no client hooks, so a server component can use it too.

import { STAGE_LABELS } from "@/lib/buyers/engagement-stages"
import type { Engagement, EngagementReplyRow } from "@/lib/buyers/engagement-types"

/** The 14-day threshold the daily cron uses (app/api/cron/engagement-stale-check). */
export const SILENT_DAYS_THRESHOLD = 14

export interface EngagementSummary {
  /** Buyer company, already falling back for rows whose lead is missing. */
  companyName: string
  stage: string
  stageInfo: { vi: string; en: string; tone: string }
  /** Whole days since the last change — same number the card prints. */
  daysInStage: number
  /** Replies, newest first. */
  replies: EngagementReplyRow[]
  unreadReplies: EngagementReplyRow[]
  latestReplyAt: string | null
  /**
   * Days the buyer has been silent while the ball is in their court. Only set
   * while waiting on the buyer AND if they have not written since this stage
   * started — the same condition the cron uses, so the card and the reminder
   * email never contradict each other.
   */
  silentDays: number
  isSilentTooLong: boolean
  productLabel: string | null
  hsCodes: string[]
  /** True when the AE owes this buyer a read — drives the worklist ordering. */
  needsAttention: boolean
}

export function summarizeEngagement(
  engagement: Engagement,
  now: number = Date.now(),
): EngagementSummary {
  const lead = engagement.leads
  const stageInfo = STAGE_LABELS[engagement.stage] ?? STAGE_LABELS.claimed
  const updatedAt = new Date(engagement.updated_at).getTime()

  const replies = [...(engagement.buyer_replies ?? [])].sort(
    (a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime(),
  )
  const unreadReplies = replies.filter((r) => !r.read_at)

  const waitingOnBuyer =
    engagement.stage === "requirement_email_sent" || engagement.stage === "shortlist_sent"
  const buyerRepliedSinceStageStarted = replies.some(
    (r) => new Date(r.received_at).getTime() > updatedAt,
  )
  const silentDays =
    waitingOnBuyer && !buyerRepliedSinceStageStarted
      ? Math.floor((now - updatedAt) / (24 * 60 * 60 * 1000))
      : 0

  const hsCodes = Array.from(
    new Set(
      [lead?.hs_code, ...(lead?.hs_codes || [])].filter((code): code is string => Boolean(code)),
    ),
  )

  return {
    companyName: lead?.company_name || "—",
    stage: engagement.stage,
    stageInfo,
    daysInStage: Math.floor((now - updatedAt) / (24 * 60 * 60 * 1000)),
    replies,
    unreadReplies,
    latestReplyAt: replies[0]?.received_at ?? null,
    silentDays,
    isSilentTooLong: silentDays >= SILENT_DAYS_THRESHOLD,
    productLabel:
      lead?.main_product || lead?.product_keywords?.filter(Boolean).join(", ") || null,
    hsCodes,
    needsAttention: unreadReplies.length > 0,
  }
}

/**
 * Worklist order, most urgent first.
 *
 * The user-facing rule: a buyer who has written to us and not been read is the
 * top of the queue, then everything else by recency. A buyer replying is the
 * one event an AE must not have to go looking for — before this, a reply from
 * an hours-old engagement sat below every engagement that had merely been
 * touched more recently.
 */
export function sortEngagementsForWorklist(
  engagements: Engagement[],
  now: number = Date.now(),
): Engagement[] {
  return engagements
    .map((engagement) => ({ engagement, summary: summarizeEngagement(engagement, now) }))
    .sort((a, b) => {
      if (a.summary.needsAttention !== b.summary.needsAttention) {
        return a.summary.needsAttention ? -1 : 1
      }
      if (a.summary.needsAttention && b.summary.needsAttention) {
        // Both unread: the one waiting longest on a read goes first.
        const aAt = a.summary.latestReplyAt ? new Date(a.summary.latestReplyAt).getTime() : 0
        const bAt = b.summary.latestReplyAt ? new Date(b.summary.latestReplyAt).getTime() : 0
        if (aAt !== bAt) return aAt - bAt
      }
      return (
        new Date(b.engagement.updated_at).getTime() -
        new Date(a.engagement.updated_at).getTime()
      )
    })
    .map(({ engagement }) => engagement)
}
