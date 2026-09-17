/**
 * Outbound delivery-event handling for Resend webhooks.
 *
 * Resend emits these events for every email WE send:
 *   email.sent              accepted by Resend (already implicit at send)
 *   email.delivered         accepted by the recipient's mail server
 *   email.delivery_delayed  temporary failure (soft bounce / queue retry)
 *   email.opened            a tracking pixel loaded — WEAK signal: Apple
 *                           Mail Privacy Protection and many corporate
 *                           proxies fire synthetic opens, so this is stored
 *                           for reference only and never drives a stage.
 *   email.clicked           a link in the email was clicked — strong signal.
 *   email.bounced           permanent (hard) or temporary (soft) rejection.
 *   email.complained        recipient marked the message as spam.
 *
 * Hard bounces and complaints are RELIABLE and legally meaningful
 * (CAN-SPAM): they stamp suppression columns on `leads`, after which
 * lib/ai/email-sender.ts refuses to send to that address again.
 */
import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { dispatchNotification } from "@/lib/notifications/dispatcher"
import { engagementFocusPath, pipelineOppPath } from "@/lib/notifications/paths"
import type { Database } from "@/lib/supabase/types"

type DraftUpdate = Database["public"]["Tables"]["email_drafts"]["Update"]
type LeadUpdate = Database["public"]["Tables"]["leads"]["Update"]

export type OutboundEventType =
  | "email.sent"
  | "email.delivered"
  | "email.delivery_delayed"
  | "email.opened"
  | "email.clicked"
  | "email.bounced"
  | "email.complained"

/** Loose shape — Resend payloads vary slightly per event type. */
export interface OutboundEventPayload {
  type: string
  created_at?: string
  data?: {
    email_id?: string
    message_id?: string
    from?: string
    to?: string[] | string
    subject?: string
    /** clicked events */
    url?: string
    /** bounced/complained events */
    bounce_type?: string // "hard" | "soft" | ...
    reason?: string
  }
}

const OUTBOUND_TYPES = new Set<OutboundEventType>([
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.opened",
  "email.clicked",
  "email.bounced",
  "email.complained",
])

export function isOutboundEmailEvent(type: string): type is OutboundEventType {
  return OUTBOUND_TYPES.has(type as OutboundEventType)
}

/** Status ordering — a bad terminal state must never be overwritten. */
const STATUS_RANK: Record<string, number> = {
  sent: 1,
  delayed: 2,
  delivered: 3,
  bounced: 4,
  complained: 5,
}

interface MatchedDraft {
  id: string
  lead_id: string | null
  opportunity_id: string | null
  engagement_id: string | null
  created_by: string | null
  generated_subject: string | null
  delivery_status: string | null
}

const DRAFT_SELECT =
  "id, lead_id, opportunity_id, engagement_id, created_by, generated_subject, delivery_status, resend_message_id"

async function findDraft(
  admin: ReturnType<typeof createAdminClient>,
  emailId: string | undefined,
  messageId: string | undefined,
): Promise<MatchedDraft | null> {
  // Primary match: the Resend email id, which is exactly what we store in
  // email_drafts.resend_message_id at send time.
  if (emailId) {
    const { data } = await admin
      .from("email_drafts")
      .select(DRAFT_SELECT)
      .eq("resend_message_id", emailId)
      .limit(1)
      .maybeSingle()
    if (data) return data as unknown as MatchedDraft
  }

  // Fallback: the SMTP Message-ID. NOTE: the smtp_message_id column is not
  // guaranteed to exist on every environment (no migration creates it), so
  // this runs as a separate best-effort query that must never break the
  // primary path — a missing-column PostgREST error just means no match.
  if (messageId) {
    const clean = messageId.replace(/^<|>$/g, "")
    try {
      const { data } = await admin
        .from("email_drafts")
        .select(DRAFT_SELECT)
        .eq("smtp_message_id", clean)
        .limit(1)
        .maybeSingle()
      if (data) return data as unknown as MatchedDraft
    } catch (err) {
      console.log("[delivery-events] smtp_message_id fallback unavailable:", (err as Error)?.message)
    }
  }

  return null
}

async function findLeadIdForDraft(
  admin: ReturnType<typeof createAdminClient>,
  draft: MatchedDraft,
): Promise<string | null> {
  if (draft.lead_id) return draft.lead_id
  if (!draft.opportunity_id) return null
  const { data } = await admin
    .from("opportunities")
    .select("lead_id")
    .eq("id", draft.opportunity_id)
    .maybeSingle()
  return (data as { lead_id: string | null } | null)?.lead_id ?? null
}

/**
 * Process one outbound webhook event. Never throws — webhooks must return
 * 200 so Resend doesn't retry forever.
 */
export async function handleOutboundEmailEvent(
  payload: OutboundEventPayload,
): Promise<{ ok: boolean; matched: boolean; action?: string }> {
  const type = payload.type as OutboundEventType
  const data = payload.data ?? {}
  const nowIso = new Date().toISOString()
  const admin = createAdminClient()

  const draft = await findDraft(admin, data.email_id, data.message_id)
  if (!draft) {
    console.log("[delivery-events] no draft matched event", {
      type,
      email_id: data.email_id,
      message_id: data.message_id,
    })
    return { ok: true, matched: false }
  }

  // ── Build the column patch per event type ────────────────────────────────
  const patch: DraftUpdate = { last_event_at: nowIso }

  switch (type) {
    case "email.sent":
      if (!draft.delivery_status) patch.delivery_status = "sent"
      break
    case "email.delivered":
      patch.delivery_status = "delivered"
      patch.delivered_at = nowIso
      break
    case "email.delivery_delayed":
      patch.delivery_status = "delayed"
      patch.delayed_at = nowIso
      break
    case "email.opened":
      // Counter + first timestamp computed below after a fresh read.
      patch.last_opened_at = nowIso
      break
    case "email.clicked":
      // Counter + first timestamp computed below after a fresh read.
      patch.last_clicked_at = nowIso
      break
    case "email.bounced": {
      const hard = (data.bounce_type ?? "").toLowerCase() !== "soft"
      patch.delivery_status = hard ? "bounced" : "delayed"
      patch.bounced_at = nowIso
      patch.bounce_type = hard ? "hard" : "soft"
      patch.bounce_reason = data.reason?.slice(0, 500) ?? null
      break
    }
    case "email.complained":
      patch.delivery_status = "complained"
      patch.complained_at = nowIso
      break
  }

  // Counters need read-modify-write (no raw SQL RPC here); fetch current
  // values first for opened/clicked so retries/duplicate webhooks count up.
  if (type === "email.opened" || type === "email.clicked") {
    const { data: fresh } = await admin
      .from("email_drafts")
      .select("opened_count, first_opened_at, clicked_count, first_clicked_at, delivery_status")
      .eq("id", draft.id)
      .maybeSingle()
    const row = fresh as
      | {
          opened_count: number | null
          first_opened_at: string | null
          clicked_count: number | null
          first_clicked_at: string | null
          delivery_status: string | null
        }
      | null

    if (type === "email.opened") {
      delete patch.opened_count
      delete patch.first_opened_at
      patch.opened_count = (row?.opened_count ?? 0) + 1
      patch.first_opened_at = row?.first_opened_at ?? nowIso
      patch.last_opened_at = nowIso
    } else {
      delete patch.first_clicked_at
      patch.clicked_count = (row?.clicked_count ?? 0) + 1
      patch.first_clicked_at = row?.first_clicked_at ?? nowIso
      patch.last_clicked_at = nowIso
    }

    // A click/opening must not downgrade a bounced/complained state.
    const currentRank = STATUS_RANK[row?.delivery_status ?? "sent"] ?? 1
    const nextStatus = type === "email.clicked" ? "delivered" : undefined
    if (nextStatus && STATUS_RANK[nextStatus] > currentRank) {
      patch.delivery_status = nextStatus
    } else if (row?.delivery_status) {
      delete patch.delivery_status
    }
  } else {
    // Non-counter events: don't downgrade a worse terminal state.
    const currentRank = STATUS_RANK[draft.delivery_status ?? "sent"] ?? 1
    const proposed = patch.delivery_status as string | undefined
    if (proposed && STATUS_RANK[proposed] < currentRank) {
      delete patch.delivery_status
    }
  }

  const { error: updateErr } = await admin
    .from("email_drafts")
    .update(patch)
    .eq("id", draft.id)
  if (updateErr) {
    console.error("[delivery-events] draft update failed:", updateErr)
    return { ok: false, matched: true }
  }

  // ── Suppression + alerts for hard bounce / complaint ─────────────────────
  if (type === "email.bounced" || type === "email.complained") {
    const hardBounce = type === "email.bounced" && (data.bounce_type ?? "").toLowerCase() !== "soft"
    const complaint = type === "email.complained"

    if (hardBounce || complaint) {
      const leadId = await findLeadIdForDraft(admin, draft)
      if (leadId) {
        const leadPatch: LeadUpdate = {
          email_suppression_note:
            type === "email.complained"
              ? `Spam complaint on ${nowIso}${data.reason ? `: ${data.reason.slice(0, 200)}` : ""}`
              : `Hard bounce on ${nowIso}${data.reason ? `: ${data.reason.slice(0, 200)}` : ""}`,
        }
        if (hardBounce) leadPatch.email_hard_bounced_at = nowIso
        if (complaint) leadPatch.email_complained_at = nowIso

        const { error: leadErr } = await admin
          .from("leads")
          .update(leadPatch)
          .eq("id", leadId)
        if (leadErr) console.error("[delivery-events] lead suppression failed:", leadErr)
      }

      // Alert the AE who sent it (best effort).
      if (draft.created_by) {
        const subject = draft.generated_subject?.slice(0, 60) ?? "(no subject)"
        const isComplaint = type === "email.complained"
        try {
          await dispatchNotification({
            userId: draft.created_by,
            category: "action_required",
            opportunityId: draft.opportunity_id,
            linkPath: draft.engagement_id
              ? engagementFocusPath(draft.engagement_id)
              : draft.opportunity_id
                ? pipelineOppPath(draft.opportunity_id)
                : "/admin/engagements",
            dedupKey: `email_${type}:${draft.id}`,
            title: isComplaint
              ? {
                  vi: "Buyer đánh dấu email là spam",
                  en: "Buyer marked the email as spam",
                }
              : {
                  vi: "Email bị hoàn (hard bounce)",
                  en: "Email hard-bounced",
                },
            body: isComplaint
              ? {
                  vi: `Hệ thống đã dừng gửi tới địa chỉ này theo quy định CAN-SPAM. Tiêu đề: ${subject}`,
                  en: `Sending to this address is now blocked per CAN-SPAM. Subject: ${subject}`,
                }
              : {
                  vi: `Địa chỉ email không tồn tại/không nhận được thư. Đừng gửi lại cho tới khi kiểm tra được địa chỉ đúng. Tiêu đề: ${subject}`,
                  en: `The address does not exist or cannot receive mail. Do not resend until a valid address is confirmed. Subject: ${subject}`,
                },
            ctaLabel: { vi: "Xem chi tiết", en: "View details" },
          })
        } catch (notifyErr) {
          console.error("[delivery-events] notification failed:", notifyErr)
        }
      }
    }
  }

  return { ok: true, matched: true, action: type }
}
