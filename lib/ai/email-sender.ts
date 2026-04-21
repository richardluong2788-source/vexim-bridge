/**
 * Approves + sends an AI-generated email draft via Zoho SMTP.
 *
 * Flow:
 *  1. Verify caller is authenticated + allowed role.
 *  2. Load the draft; ensure it is still `pending_approval`.
 *  3. Send via Zoho SMTP (rejects if draft lacks recipient).
 *  4. Flip draft -> 'sent', stamp `sent_at` + `approved_by`.
 *  5. Log an `email_sent` activity on the opportunity.
 */

import { createClient } from "@/lib/supabase/server"
import { sendMail, getFromAddress } from "@/lib/email/mailer"

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
  if (!recipient) {
    throw new Error(
      "No recipient email available on lead — please add a contact email first",
    )
  }

  const subject =
    opts?.overrideSubject?.trim() ||
    draft.generated_subject_en ||
    "Export opportunity"
  const content =
    opts?.overrideContent?.trim() || draft.generated_content_en || ""

  if (!content) {
    throw new Error("Generated email body is empty")
  }

  // 3. Send via Zoho SMTP
  const htmlBody = content
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, "<br/>")}</p>`)
    .join("")

  const sendRes = await sendMail({
    from: getFromAddress(),
    to: recipient,
    subject,
    html: htmlBody,
    text: content,
  })

  if (sendRes.error) {
    // Mark draft as failed for visibility
    await supabase
      .from("email_drafts")
      .update({ status: "failed" })
      .eq("id", draftId)
    throw new Error(sendRes.error.message ?? "Email send failed")
  }

  // 4. Flip draft status
  await supabase
    .from("email_drafts")
    .update({
      status: "sent",
      approved_by: user.id,
      sent_at: new Date().toISOString(),
      generated_subject_en: subject,
      generated_content_en: content,
    })
    .eq("id", draftId)

  // 5. Activity log (best-effort)
  if (draft.opportunity_id) {
    await supabase.from("activities").insert({
      opportunity_id: draft.opportunity_id,
      action_type: "email_sent",
      description: `Email sent to ${recipient}: "${subject}"`,
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
