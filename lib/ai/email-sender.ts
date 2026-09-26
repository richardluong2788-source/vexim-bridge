/**
 * Approves + sends an AI-generated email draft via Resend.
 *
 * DELIVERABILITY OPTIMIZATIONS:
 *   - Uses AE's real name as sender (e.g., "Hoc Luong <trade@...>") instead of "Vexim Trade"
 *   - Clean Reply-To address (no plus-addressing visible to buyer)
 *   - Ref code stored in X-Ref-Code header for internal tracking
 *   - Subject line kept clean (no [REF-XXX] prefix)
 *
 * Flow:
 *  1. Verify caller is authenticated + allowed role.
 *  2. Load the draft; ensure it is still `pending_approval`.
 *  3. Send via Resend (rejects if draft lacks recipient).
 *  4. Flip draft -> 'sent', stamp `sent_at` + `approved_by`.
 *  5. Log an `email_sent` activity on the opportunity.
 */

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { 
  sendMail, 
  buildPersonalizedSender, 
  getSenderEmail 
} from "@/lib/email/mailer"
import {
  buildRefCode,
} from "@/lib/email/ref-code"

export class EmailSenderAuthError extends Error {
  constructor(message = "Unauthorized") {
    super(message)
    this.name = "EmailSenderAuthError"
  }
}

const ALLOWED_ROLES = new Set([
  "admin",
  "staff",
  "super_admin",
  "account_executive",
])

export type SendDraftResult = {
  status: "sent"
  /** Provider message id (e.g. SMTP Message-ID). Kept as `resendId` for backwards compatibility. */
  resendId: string | null
}

export async function sendEmailDraft(
  draftId: string,
  opts?: {
    /** Allow admin edits before send (optional). */
    overrideSubject?: string
    overrideContent?: string
    /** Optional manual recipient (e.g. user typed one because lead lacked it). */
    overrideRecipient?: string
    /** Additional recipients CC'd (e.g. other contacts at the buyer company). */
    overrideCc?: string[]
    /**
     * RFC Message-ID of the buyer message this draft is replying to (e.g.
     * a `buyer_replies.message_id`). When set, threads the outgoing email
     * as a real reply (In-Reply-To / References headers) so it lands in
     * the same Gmail/Outlook thread as the buyer's message instead of
     * appearing as a new conversation.
     */
    replyToMessageId?: string | null
    /**
     * Additional RFC headers merged into the outbound payload (campaign
     * engine: List-Unsubscribe cho cold outreach). Omitted = unchanged.
     */
    extraHeaders?: Record<string, string>
    /**
     * A `buyer_replies.id` this draft directly answers. When set, that
     * reply row is stamped with `responded_email_draft_id` / `responded_at`
     * on successful send, so the UI can show "already answered" instead of
     * leaving the AE to guess.
     */
    markReplyId?: string | null
  },
): Promise<SendDraftResult> {
  const supabase = await createClient()

  // 1. Auth + role
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new EmailSenderAuthError()

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, work_email")
    .eq("id", user.id)
    .single()

  if (!profile || !ALLOWED_ROLES.has(profile.role)) {
    throw new EmailSenderAuthError("Role not permitted to send emails")
  }

  // 2. Load draft
  const { data: draft, error: draftError } = await supabase
    .from("email_drafts")
    .select("*")
    .eq("id", draftId)
    .single()

  if (draftError || !draft) {
    throw new Error(draftError?.message ?? "Draft not found")
  }
  if (draft.status === "sent") {
    throw new Error("This draft has already been sent")
  }

  const recipient =
    opts?.overrideRecipient?.trim() || draft.recipient_email?.trim() || ""
  if (!recipient) {
    throw new Error(
      "No recipient email available on lead — please add a contact email first",
    )
  }

  const baseSubject =
    opts?.overrideSubject?.trim() ||
    draft.generated_subject ||
    "Export opportunity"
  const content =
    opts?.overrideContent?.trim() || draft.generated_content_en || ""

  if (!content) {
    throw new Error("Generated email body is empty")
  }

  // 2a. Suppression guard (CAN-SPAM): refuse to send to a lead that hard-
  //     bounced or (especially) reported mail as spam. A spam complaint
  //     blocks the lead outright until an admin clears it; a hard bounce
  //     only blocks the SAME dead address, so correcting the address via
  //     an override still allows the resend.
  {
    let suppressionLeadId: string | null = draft.lead_id ?? null
    if (!suppressionLeadId && draft.opportunity_id) {
      const { data: oppLead } = await supabase
        .from("opportunities")
        .select("lead_id")
        .eq("id", draft.opportunity_id)
        .maybeSingle()
      suppressionLeadId = oppLead?.lead_id ?? null
    }

    if (suppressionLeadId) {
      const admin = createAdminClient()
      const { data: lead } = await admin
        .from("leads")
        .select("contact_email, email_hard_bounced_at, email_complained_at")
        .eq("id", suppressionLeadId)
        .maybeSingle()

      if (lead?.email_complained_at) {
        throw new Error(
          "Địa chỉ này đã đánh dấu email là spam — CAN-SPAM không cho phép gửi tiếp. Hãy nhờ quản lý gỡ chặn nếu đã xác minh đây là hiểu lầm.",
        )
      }
      if (
        lead?.email_hard_bounced_at &&
        lead.contact_email &&
        lead.contact_email.trim().toLowerCase() === recipient.trim().toLowerCase()
      ) {
        throw new Error(
          "Địa chỉ email này đã bị hoàn vĩnh viễn (hard bounce). Hãy kiểm tra/cập nhật địa chỉ đúng của buyer trước khi gửi lại.",
        )
      }
    }
  }

  // 2b. Look up the owning client (for ref-code initials) so admins can
  //     identify which client a buyer's reply belongs to just by scanning
  //     their Zoho inbox.
  let clientName: string | null = null
  if (draft.opportunity_id) {
    const { data: opp } = await supabase
      .from("opportunities")
      .select("client_id, profiles:client_id ( company_name )")
      .eq("id", draft.opportunity_id)
      .single()
    // Supabase returns the embedded relation as either an object or array
    // depending on the FK shape — handle both safely.
    const clientProfile = Array.isArray(opp?.profiles) ? opp?.profiles[0] : opp?.profiles
    clientName = clientProfile?.company_name ?? null
  }

  // 2c. Build personalized sender with AE's real name for better deliverability.
  // IMPORTANT: Using a human name instead of "Vexim Trade" significantly reduces
  // spam filtering. Gmail/Outlook trust emails from "Hoc Luong" more than
  // generic company names.
  // 
  // If full_name is not set in profile, we MUST still use a human-sounding name.
  // Fallback to "Vexim Trade Team" if no name available (better than just email address).
  const senderName = profile.full_name || "Vexim Trade Team"
  const workEmail = profile.work_email || null
  const fromAddress = buildPersonalizedSender(senderName, { workEmail })

  // DEBUG: Log sender info to verify it's working correctly
  console.log("[email-sender] Building from address:", {
    userId: user.id,
    profileFullName: profile.full_name,
    senderName,
    workEmail,
    fromAddress,
  })
  
  // Build ref code for internal tracking (stored in X-Ref-Code header, not visible to buyer)
  const refCode = draft.opportunity_id
    ? buildRefCode(draft.opportunity_id, clientName)
    : null
  
  // Keep subject line clean — no ref code visible to buyer.
  const subject = baseSubject
  
  // Reply-To: prefer the AE's own mailbox (workEmail) so replies land
  // directly with them and Gmail/Outlook keep trusting the name<->address
  // pairing. Falls back to the shared trade@ address when the AE has no
  // personal mailbox provisioned yet.
  const replyToEmail = workEmail || getSenderEmail("trade")

  // 3. Send via Resend
  // Add headers to prevent Gmail from filtering into Promotions folder.
  // Transactional emails should NOT have List-Unsubscribe headers.
  let htmlBody = content
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, "<br/>")}</p>`)
    .join("")

  // Generate unique ID for this email to prevent Gmail threading issues.
  // IMPORTANT: only apply this when we are NOT explicitly threading the
  // email as a reply (replyToMessageId unset). X-Entity-Ref-ID tells Gmail
  // "treat this as an unrelated, standalone message" — setting it on an
  // email that also carries In-Reply-To/References works against the
  // threading we want, and can make a genuine reply in an existing
  // (already-Primary) buyer conversation get re-evaluated as a new,
  // unrelated message — one of the reasons AI-drafted follow-ups were
  // landing in Promotions instead of staying in the buyer's existing thread.
  const uniqueEmailId = `${Date.now()}-${Math.random().toString(36).substring(7)}`

  const headers: Record<string, string> = {
    // X-Entity-Ref-ID: Unique ID to prevent Gmail from incorrectly threading
    // unrelated emails together. Omitted when replying into an existing
    // thread (see note above).
    ...(!opts?.replyToMessageId && { "X-Entity-Ref-ID": uniqueEmailId }),
    // NOTE: Deliberately NOT setting "X-Priority: 1" or "X-Campaign: transactional".
    // - X-Priority: 1 is a decades-old classic spam-filter trigger ("urgent" marketing
    //   emails abuse it); it does nothing for real deliverability and only adds risk.
    // - Mislabeling cold outreach as "X-Campaign: transactional" doesn't fool
    //   content-based spam filters (which read the actual sales-pitch content) and
    //   is an inconsistent signal.
    // Custom mailer identification (neutral, doesn't affect spam scoring either way)
    "X-Mailer": "Vexim-Trade/1.0",
    // Store ref code in custom header for internal tracking (not visible to buyer)
    ...(refCode && { "X-Ref-Code": refCode }),
    // Thread this as a reply to the buyer's message (see replyToMessageId
    // doc above) so Gmail/Outlook group it with the original thread.
    ...(opts?.replyToMessageId && {
      "In-Reply-To": opts.replyToMessageId,
      References: opts.replyToMessageId,
    }),
    // Campaign engine (B1): List-Unsubscribe (RFC 2369) — header VÔ HÌNH với
    // buyer, giúp Gmail/Outlook hiển thị nút unsubscribe gốc và giảm rủi ro
    // bị đánh dấu spam khi nhiều người bấm "spam" thay vì trả lời.
    ...(opts?.extraHeaders ?? {}),
  }

  const ccEmails = (opts?.overrideCc ?? []).filter((e) => e.trim().length > 0)

  const sendRes = await sendMail({
    from: fromAddress,
    to: recipient,
    cc: ccEmails.length > 0 ? ccEmails : undefined,
    replyTo: replyToEmail,
    subject,
    html: htmlBody,
    text: content,
    headers,
  })

  if (sendRes.error) {
    // Mark draft as failed for visibility
    await supabase
      .from("email_drafts")
      .update({ status: "failed" })
      .eq("id", draftId)
    throw new Error(sendRes.error.message ?? "Email send failed")
  }

  // 4. Flip draft status — also persist the Resend Message-ID so webhook
  //    can match buyer replies via the In-Reply-To header.
  await supabase
    .from("email_drafts")
    .update({
      status: "sent",
      approved_by: user.id,
      sent_at: new Date().toISOString(),
      generated_subject: subject,
      generated_content_en: content,
      resend_message_id: sendRes.data?.id ?? null,
      // Initial delivery state; the Resend webhook upgrades this to
      // delivered / opened / clicked / bounced / complained as events arrive.
      delivery_status: "sent",
      last_event_at: new Date().toISOString(),
      cc_emails: ccEmails.length > 0 ? ccEmails : null,
    })
    .eq("id", draftId)

  // 5. Activity log (best-effort) — include ref code so the timeline shows
  //    the exact tag buyers will see in their reply subject.
  if (draft.opportunity_id) {
    const refSuffix = refCode ? ` [ref: ${refCode}]` : ""
    await supabase.from("activities").insert({
      opportunity_id: draft.opportunity_id,
      action_type: "email_sent",
      description: `Email sent to ${recipient}: "${subject}"${refSuffix}`,
      performed_by: user.id,
    })
  }

  // 6. Stamp the buyer_replies row this draft was answering (best-effort —
  //    never fail the send over a bookkeeping update).
  if (opts?.markReplyId) {
    await supabase
      .from("buyer_replies")
      .update({ responded_email_draft_id: draftId, responded_at: new Date().toISOString() })
      .eq("id", opts.markReplyId)
  }

  return { status: "sent", resendId: sendRes.data?.id ?? null }
}

/** Reject an AI draft without sending. */
export async function rejectEmailDraft(draftId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new EmailSenderAuthError()

  await supabase
    .from("email_drafts")
    .update({ status: "rejected", approved_by: user.id })
    .eq("id", draftId)
}
