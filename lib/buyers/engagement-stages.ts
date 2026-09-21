// Single source of truth for the pre-opportunity engagement pipeline: what
// each stage is called, and which actions that stage offers.
//
// Why this file exists
// --------------------
// The stage → button mapping used to live inline in the AE inbox card
// (app/admin/ae-inbox/engagement-list.tsx — 2.7k lines, 10 dialogs). The buyer
// profile's "Phân tích" tab needs to answer the same question — "what is the
// next step for this buyer?" — so the mapping moved here and BOTH surfaces read
// it. Adding a stage, renaming a button, or changing which stage offers which
// action is now a one-line edit that cannot drift between the two screens.
//
// This module is deliberately plain data + pure functions: no JSX, no icons, no
// "use client", so a server component (or a cron/email job) can import it too.
// The icon lookup lives with the UI in components/admin/engagement-action-bar.tsx.
//
// Stages are free-form strings in the DB (buyer_engagements.stage has no enum),
// so every lookup here is total: an unknown stage returns no actions rather
// than throwing.

/**
 * Human labels for each stage of the pre-opportunity pipeline.
 * `tone` is the badge styling shared by the inbox card and the buyer profile.
 */
export const STAGE_LABELS: Record<string, { vi: string; en: string; tone: string }> = {
  claimed: { vi: "Đã nhận — chưa hỏi nhu cầu", en: "Claimed — not contacted yet", tone: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
  requirement_email_sent: { vi: "Đã gửi email hỏi nhu cầu", en: "Requirement email sent", tone: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  requirements_received: { vi: "Đã có nhu cầu buyer", en: "Requirements received", tone: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" },
  shortlist_ready: { vi: "Shortlist đã sẵn sàng", en: "Shortlist ready", tone: "bg-violet-500/10 text-violet-600 border-violet-500/20" },
  shortlist_sent: { vi: "Đã gửi shortlist cho buyer", en: "Shortlist sent to buyer", tone: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  buyer_viewed: { vi: "Buyer đã xem shortlist", en: "Buyer viewed shortlist", tone: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  buyer_responded: { vi: "Buyer đã phản hồi", en: "Buyer responded", tone: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  qualified_interest: { vi: "Buyer quan tâm — cần quyết định", en: "Qualified interest — needs decision", tone: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
}

/**
 * Stages that mean "an opportunity was created" or "the buyer was dropped".
 * Rows in these stages are hidden from the inbox (see getMyEngagements) and
 * carry none of the actions below.
 */
export const CLOSED_ENGAGEMENT_STAGES = ["converted", "dropped"] as const

export function isEngagementClosed(stage: string | null | undefined): boolean {
  return !!stage && (CLOSED_ENGAGEMENT_STAGES as readonly string[]).includes(stage)
}

/**
 * Every action the pipeline can offer, across all stages. The inbox maps a key
 * to the dialog it opens; the buyer profile maps it to the deep link that
 * lands on the same dialog in the inbox.
 */
export type StageActionKey =
  | "draft_opening_email"
  | "record_decline"
  | "record_requirements_offline"
  | "record_requirements"
  | "resend_email"
  | "pick_suppliers"
  | "approve_shortlist"
  | "send_documents"
  | "new_shortlist_version"
  | "convert_to_opportunity"

export interface StageAction {
  key: StageActionKey
  labelVi: string
  labelEn: string
  variant: "default" | "outline" | "secondary"
  /** The action that actually moves THIS stage forward — at most one per
   *  stage, and absent while the pipeline is waiting on the buyer. The buyer
   *  profile uses it to label its "next step" call to action. */
  primary?: boolean
}

export interface StageActionContext {
  /** A shortlist version in status "draft" exists. */
  hasDraftShortlist?: boolean
  /**
   * The buyer's requirements have been recorded (products or notes on file).
   * Only the `buyer_responded` stage branches on this — see the case below.
   */
  hasRequirements?: boolean
  /**
   * The buyer's LATEST reply reads as a refusal ("we're not interested", "we
   * already have a supplier", "stop emailing"). The classifier's `objection`
   * intent covers exactly this.
   *
   * When true, the only action offered is closing the engagement — offering
   * "Soạn email mở đầu" to someone who has just said no is the specific thing
   * this flag exists to prevent.
   */
  buyerDeclined?: boolean
  /** Items in the version the buyer is currently looking at. */
  shortlistItemCount?: number
  /** Of those items, how many are flagged buyer_interested = true. */
  interestedCount?: number
}

/** Button that opens the shortlist builder (AI-assisted supplier pick). */
function pickSuppliersAction(hasDraftShortlist: boolean, primary: boolean): StageAction {
  return {
    key: "pick_suppliers",
    // Same dialog either way — only the framing changes: with a draft in hand
    // the AE is editing it, otherwise they are picking suppliers from scratch.
    labelVi: hasDraftShortlist ? "Chỉnh sửa shortlist (nháp)" : "Chọn supplier (AI gợi ý)",
    labelEn: hasDraftShortlist ? "Edit shortlist (draft)" : "Pick suppliers (AI-assisted)",
    variant: "secondary",
    ...(primary ? { primary: true } : {}),
  }
}

/** Share supplier compliance documents only after the engagement has a shortlist. */
function sendDocumentsAction(): StageAction {
  return {
    key: "send_documents",
    labelVi: "Gửi hồ sơ/video",
    labelEn: "Send documents/video",
    variant: "outline",
  }
}

/**
 * Did the buyer's most recent reply say no?
 *
 * Only the newest reply counts: a buyer who objected to the price and then
 * asked for samples has moved on, and the bar must not keep offering to close
 * them. `objection` is the reply classifier's intent for concerns, doubts and
 * outright refusals (lib/ai/reply-classifier.ts).
 */
function latestReplyIsRefusal(
  replies: Array<{ ai_intent?: string | null; received_at?: string | null }> | null | undefined,
): boolean {
  if (!replies || replies.length === 0) return false
  const newest = [...replies].sort(
    (a, b) =>
      new Date(b.received_at ?? 0).getTime() - new Date(a.received_at ?? 0).getTime(),
  )[0]
  return newest?.ai_intent === "objection"
}

/**
 * The buttons this stage offers, in display order.
 *
 * Mirrors the inbox card exactly — the whole point of this module is that the
 * inbox renders from here instead of holding its own copy of the conditions.
 */
export function getStageActions(stage: string, ctx: StageActionContext = {}): StageAction[] {
  const {
    hasDraftShortlist = false,
    hasRequirements = false,
    buyerDeclined = false,
    shortlistItemCount = 0,
    interestedCount = 0,
  } = ctx

  // A refusal outranks the stage: whatever we were about to do next, the buyer
  // has taken themselves out. Close the file (the AE still writes the reason,
  // which is what makes this auditable rather than a silent delete).
  if (buyerDeclined && !isEngagementClosed(stage)) {
    return [
      {
        key: "record_decline",
        labelVi: "Buyer từ chối — ghi nhận & đóng",
        labelEn: "Buyer declined — record & close",
        variant: "default",
        primary: true,
      },
    ]
  }

  switch (stage) {
    case "claimed":
      return [
        {
          key: "draft_opening_email",
          labelVi: "Soạn email mở đầu",
          labelEn: "Draft opening email",
          variant: "default",
          primary: true,
        },
        {
          key: "record_requirements_offline",
          labelVi: "Đã liên hệ ngoài hệ thống — ghi nhận nhu cầu",
          labelEn: "Contacted outside the system — record requirements",
          variant: "outline",
        },
      ]

    case "requirement_email_sent":
      return [
        {
          key: "record_requirements",
          labelVi: "Ghi nhận nhu cầu buyer",
          labelEn: "Record buyer requirements",
          variant: "default",
          primary: true,
        },
        {
          key: "resend_email",
          labelVi: "Gửi lại email",
          labelEn: "Resend email",
          variant: "outline",
        },
      ]

    case "requirements_received":
      // No draft yet by definition — the AE has just recorded the ask. (The
      // label still follows the draft flag, exactly as the inbox did, so this
      // stays honest if a draft somehow exists.)
      return [pickSuppliersAction(hasDraftShortlist, true)]

    case "shortlist_ready": {
      // Nothing to show without a draft: "ready" is the draft's own state.
      if (!hasDraftShortlist) return []
      const canApprove = shortlistItemCount > 0
      const actions: StageAction[] = [pickSuppliersAction(true, !canApprove)]
      if (canApprove) {
        actions.push({
          key: "approve_shortlist",
          labelVi: "Duyệt & gửi shortlist",
          labelEn: "Approve & send shortlist",
          variant: "default",
          primary: true,
        })
        actions.push(sendDocumentsAction())
      }
      return actions
    }

    // The buyer answered an email. The stage is written by the inbound webhook
    // (lib/buyers/engagement-stage-transitions.ts) in addition to the AE's own
    // actions, so what the AE should do next depends on WHICH email they are
    // replying to — decided by whether requirements are on file yet.
    case "buyer_responded": {
      if (!hasRequirements) {
        // Requirement-gathering reply: the message IS the requirements, and
        // recording them is the only move that gives everything downstream
        // something to work with. Offering "create opportunity" here would
        // point the AE at a buyer nobody has scoped.
        return [
          {
            key: "record_requirements",
            labelVi: "Ghi nhận nhu cầu buyer",
            labelEn: "Record buyer requirements",
            variant: "default",
            primary: true,
          },
        ]
      }

      // Requirements are known: the reply is a reaction to the shortlist (or
      // to our last email), so the AE either reworks the shortlist or converts.
      return [
        ...(shortlistItemCount > 0 ? [sendDocumentsAction()] : []),
        {
          key: "new_shortlist_version",
          labelVi: "Tạo phiên bản shortlist mới",
          labelEn: "Create new shortlist version",
          variant: "outline",
        },
        {
          key: "convert_to_opportunity",
          labelVi: `Gán client & tạo Opportunity${interestedCount ? ` (${interestedCount} quan tâm)` : ""}`,
          labelEn: `Assign client & create Opportunity${interestedCount ? ` (${interestedCount} interested)` : ""}`,
          variant: "default",
          primary: true,
        },
      ]
    }

    case "shortlist_sent":
    case "buyer_viewed":
    case "qualified_interest": {
      const actions: StageAction[] = []

      if (shortlistItemCount > 0) actions.push(sendDocumentsAction())

      // Only worth resending after the buyer has actually received something
      // (still "sent"/"viewed"); once they reply, a resend is noise.
      if (stage === "shortlist_sent" || stage === "buyer_viewed") {
        actions.push({
          key: "resend_email",
          labelVi: "Gửi lại email",
          labelEn: "Resend email",
          variant: "outline",
        })
      }

      actions.push({
        key: "new_shortlist_version",
        labelVi: "Tạo phiên bản shortlist mới",
        labelEn: "Create new shortlist version",
        variant: "outline",
      })

      actions.push({
        key: "convert_to_opportunity",
        labelVi: `Gán client & tạo Opportunity${interestedCount ? ` (${interestedCount} quan tâm)` : ""}`,
        labelEn: `Assign client & create Opportunity${interestedCount ? ` (${interestedCount} interested)` : ""}`,
        variant: stage === "qualified_interest" ? "default" : "outline",
        // "qualified_interest" is the explicit decision point — the buyer
        // already marked interest on the public shortlist.
        ...(stage === "qualified_interest" ? { primary: true } : {}),
      })

      return actions
    }

    default:
      return []
  }
}

// Note: there is deliberately no getPrimaryStageAction() helper. The `primary`
// flag on the action is the single encoding of "this is the next step", and the
// one place that needs it — the profile's action bar, which leads with it —
// derives it from the list it already has (see EngagementStageActions).

// ShortlistVersionLike is defined in lib/buyers/engagement-types.ts (the module
// every row shape lives in) and re-exported here, so callers that already import
// this file for the stage map do not need a second import for the type.
export type { ShortlistVersionLike } from "@/lib/buyers/engagement-types"
import type { ShortlistVersionLike } from "@/lib/buyers/engagement-types"

/**
 * Derive the action context from the engagement row itself, so callers never
 * have to re-implement "is there a draft?" / "how many are interested?".
 *
 * Version selection mirrors the inbox card: the sent version is what the buyer
 * actually saw and wins over a newer draft; before anything is sent, the newest
 * draft is what the AE is working on.
 */
export function stageActionContextFromEngagement(engagement: {
  buyer_engagement_shortlist_versions?: ShortlistVersionLike[] | null
  /** Recorded requirements — what "record_requirements" writes. */
  requested_products?: string | null
  other_requirements?: string | null
  /** Replies on file; the newest one decides whether the buyer has refused. */
  buyer_replies?: Array<{ ai_intent?: string | null; received_at?: string | null }> | null
}): StageActionContext {
  const versions = [...(engagement.buyer_engagement_shortlist_versions ?? [])].sort(
    (a, b) => (b.version_number ?? 0) - (a.version_number ?? 0),
  )
  const draftVersion = versions.find((v) => v.status === "draft") ?? null
  const sentVersion = versions.find((v) => v.status === "sent") ?? null
  const displayVersion = sentVersion ?? draftVersion ?? versions[0] ?? null
  const items = displayVersion?.buyer_engagement_shortlist_items ?? []

  return {
    hasDraftShortlist: !!draftVersion,
    shortlistItemCount: items.length,
    interestedCount: items.filter((item) => item.buyer_interested === true).length,
    // Products or free-text notes count; both blank means the AE never recorded
    // what this buyer actually wants.
    hasRequirements: !!(
      engagement.requested_products?.trim() || engagement.other_requirements?.trim()
    ),
    buyerDeclined: latestReplyIsRefusal(engagement.buyer_replies),
  }
}
