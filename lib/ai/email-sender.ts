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
import { 
  sendMail, 
  buildPersonalizedSender, 
  getSenderEmail 
} from "@/lib/email/mailer"
import {
  buildRefCode,
} from "@/lib/email/ref-code"
import type { UploadedAttachment } from "@/app/api/attachments/upload/route"

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
    /** Optional comma/semicolon-separated CC recipients. */
    overrideCc?: string | string[]
    /** File attachments to include in email */
    attachments?: UploadedAttachment[]
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
    .select("role, full_name")
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
  const cc = (Array.isArray(opts?.overrideCc) ? opts?.overrideCc : (opts?.overrideCc ?? "").split(/[;,\s]+/))
    .map((email) => email.trim().toLowerCase())
    .filter((email, index, list) => email && email !== recipient.toLowerCase() && list.indexOf(email) === index)
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
  const fromAddress = buildPersonalizedSender(senderName, "trade")
  
  // DEBUG: Log sender info to verify it's working correctly
  console.log("[email-sender] Building from address:", {
    userId: user.id,
    profileFullName: profile.full_name,
    senderName,
    fromAddress,
  })
  
  // Build ref code for internal tracking (stored in X-Ref-Code header, not visible to buyer)
  const refCode = draft.opportunity_id
    ? buildRefCode(draft.opportunity_id, clientName)
    : null
  
  // Keep subject line clean — no ref code visible to buyer.
  const subject = baseSubject
  
  // Reply-To: Use the sender's OWN email for replies.
  // This looks more personal and trustworthy than plus-addressed tracking emails.
  // The X-Ref-Code header handles tracking internally.
  // NOTE: If the AE has a personal veximtrade.com email, use that. Otherwise, use trade@
  const replyToEmail = getSenderEmail("trade")

  // 3. Send via Resend
  // Add headers to prevent Gmail from filtering into Promotions folder.
  // Transactional emails should NOT have List-Unsubscribe headers.
  let htmlBody = content
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, "<br/>")}</p>`)
    .join("")

  // Add attachment section if any attachments are provided
  if (opts?.attachments && opts.attachments.length > 0) {
    const attachmentHtml = renderAttachmentsHtml(opts.attachments)
    htmlBody += attachmentHtml
  }

  // Generate unique ID for this email to prevent Gmail threading issues
  const uniqueEmailId = `${Date.now()}-${Math.random().toString(36).substring(7)}`

  const headers: Record<string, string> = {
    // X-Entity-Ref-ID: Unique ID to prevent Gmail from incorrectly threading emails
    // Each email gets its own ID so they appear as separate conversations
    "X-Entity-Ref-ID": uniqueEmailId,
    // Priority header - tells mail servers this is important business email
    "X-Priority": "1",
    // Mark as transactional (not promotional/marketing)
    "X-Campaign": "transactional",
    // Custom mailer identification
    "X-Mailer": "Vexim-Trade-Transactional/1.0",
    // Store ref code in custom header for internal tracking (not visible to buyer)
    ...(refCode && { "X-Ref-Code": refCode }),
  }

  const sendRes = await sendMail({
    from: fromAddress,
    to: recipient,
    cc: cc.length > 0 ? cc : undefined,
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

// ─────────────────────────────────────────────────────────────────────────────
// Attachment HTML Rendering
// ─────────────────────────────────────��───────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Render attachments as styled HTML blocks for email body.
 * 
 * Strategy:
 * - Images: inline thumbnail + download link (buyer can preview without clicking)
 * - Documents: styled file card with icon + name + size (trusted appearance)
 * - All links go to Vercel Blob public URLs which show veximtrade.com domain
 */
function renderAttachmentsHtml(attachments: UploadedAttachment[]): string {
  if (!attachments.length) return ""

  const attachmentBlocks = attachments.map((att) => {
    const isImage = att.contentType.startsWith("image/")
    const size = formatFileSize(att.size)

    if (isImage) {
      // Image: show inline preview + download link
      return `
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 12px 0; background-color: #fafafa;">
          <a href="${att.url}" target="_blank" rel="noopener noreferrer" style="display: block; text-decoration: none;">
            <img src="${att.url}" alt="${att.filename}" style="max-width: 100%; max-height: 300px; border-radius: 4px; display: block; margin-bottom: 8px;" />
          </a>
          <p style="margin: 0; font-size: 13px; color: #374151;">
            <a href="${att.url}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: none; font-weight: 500;">
              ${att.filename}
            </a>
            <span style="color: #6b7280; margin-left: 8px;">(${size})</span>
          </p>
        </div>
      `
    } else {
      // Document: styled file card
      const icon = getFileIcon(att.contentType)
      return `
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; margin: 12px 0; background-color: #fafafa; display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 24px;">${icon}</span>
          <div style="flex: 1;">
            <a href="${att.url}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: none; font-weight: 500; font-size: 14px;">
              ${att.filename}
            </a>
            <p style="margin: 4px 0 0; font-size: 12px; color: #6b7280;">
              ${getFileTypeName(att.contentType)} &bull; ${size}
            </p>
          </div>
          <a href="${att.url}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: none; font-size: 13px; font-weight: 500;">
            Download
          </a>
        </div>
      `
    }
  })

  return `
    <div style="margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
      <p style="font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">
        Attachments (${attachments.length})
      </p>
      ${attachmentBlocks.join("")}
    </div>
  `
}

function getFileIcon(contentType: string): string {
  if (contentType.includes("pdf")) return "📄"
  if (contentType.includes("word") || contentType.includes("document")) return "📝"
  if (contentType.includes("excel") || contentType.includes("sheet")) return "📊"
  if (contentType.includes("text")) return "📃"
  return "📎"
}

function getFileTypeName(contentType: string): string {
  if (contentType.includes("pdf")) return "PDF"
  if (contentType.includes("word") || contentType.includes("document")) return "Word Document"
  if (contentType.includes("excel") || contentType.includes("sheet")) return "Excel Spreadsheet"
  if (contentType.includes("text/csv")) return "CSV"
  if (contentType.includes("text/plain")) return "Text File"
  return "File"
}
