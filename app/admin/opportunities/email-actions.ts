"use server"

import { generateEmailDraft, type GenerateEmailInput, type GenerateEmailResult, EmailGeneratorAuthError } from "@/lib/ai/email-generator"
import { sendEmailDraft, rejectEmailDraft, type SendDraftResult, EmailSenderAuthError } from "@/lib/ai/email-sender"
import { createClient } from "@/lib/supabase/server"
import type { EmailType } from "@/lib/supabase/types"
import type { UploadedAttachment } from "@/app/api/attachments/upload/route"

// ─────────────────────────────────────────────────────────────────────────────
// Generate Email Draft Action
// ─────────────────────────────────────────────────────────────────────────────

export type GenerateEmailActionInput = {
  opportunityId: string
  emailType: EmailType
  viPrompt: string
  /** Manual mode - skip AI generation */
  isManual?: boolean
  manualSubject?: string
  manualContent?: string
  /** Liên hệ AE đã tích chọn làm "email chính" (người nhận thật) */
  recipientContactName?: string | null
  recipientContactEmail?: string | null
}

export type GenerateEmailActionResult =
  | { ok: true; data: GenerateEmailResult }
  | { ok: false; error: "unauthorized" | "noLead" | "serverError"; message?: string }

export async function generateEmailDraftAction(
  input: GenerateEmailActionInput
): Promise<GenerateEmailActionResult> {
  try {
    const result = await generateEmailDraft({
      opportunityId: input.opportunityId,
      emailType: input.emailType,
      viPrompt: input.viPrompt,
      isManual: input.isManual,
      manualSubject: input.manualSubject,
      manualContent: input.manualContent,
      recipientContactName: input.recipientContactName,
      recipientContactEmail: input.recipientContactEmail,
    })
    return { ok: true, data: result }
  } catch (err) {
    if (err instanceof EmailGeneratorAuthError) {
      return { ok: false, error: "unauthorized" }
    }
    const message = err instanceof Error ? err.message : "Unknown error"
    if (message.includes("no associated lead")) {
      return { ok: false, error: "noLead", message }
    }
    console.error("[v0] generateEmailDraftAction error:", err)
    return { ok: false, error: "serverError", message }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Send Email Draft Action
// ─────────────────────────────────────────────────────────────────────────────

export type SendEmailActionInput = {
  draftId: string
  overrideSubject?: string
  overrideContent?: string
  overrideRecipient?: string
  overrideCc?: string[]
  attachments?: UploadedAttachment[]
  /** Threads this send as a reply to a buyer's inbound message (see lib/ai/email-sender.ts). */
  replyToMessageId?: string | null
  /** Marks a specific buyer_replies row as answered once this send succeeds. */
  markReplyId?: string | null
}

export type SendEmailActionResult =
  | { ok: true; data: SendDraftResult }
  | { ok: false; error: "unauthorized" | "alreadySent" | "noRecipient" | "serverError"; message?: string }

export async function sendEmailDraftAction(
  input: SendEmailActionInput
): Promise<SendEmailActionResult> {
  try {
    const result = await sendEmailDraft(input.draftId, {
      overrideSubject: input.overrideSubject,
      overrideContent: input.overrideContent,
      overrideRecipient: input.overrideRecipient,
      overrideCc: input.overrideCc,
      attachments: input.attachments,
      replyToMessageId: input.replyToMessageId,
      markReplyId: input.markReplyId,
    })
    return { ok: true, data: result }
  } catch (err) {
    if (err instanceof EmailSenderAuthError) {
      return { ok: false, error: "unauthorized" }
    }
    const message = err instanceof Error ? err.message : "Unknown error"
    if (message.includes("already been sent")) {
      return { ok: false, error: "alreadySent", message }
    }
    if (message.includes("No recipient")) {
      return { ok: false, error: "noRecipient", message }
    }
    console.error("[v0] sendEmailDraftAction error:", err)
    return { ok: false, error: "serverError", message }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reject Email Draft Action
// ─────────────────────────────────────────────────────────────────────────────

export type RejectEmailActionResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "serverError"; message?: string }

export async function rejectEmailDraftAction(
  draftId: string
): Promise<RejectEmailActionResult> {
  try {
    await rejectEmailDraft(draftId)
    return { ok: true }
  } catch (err) {
    if (err instanceof EmailSenderAuthError) {
      return { ok: false, error: "unauthorized" }
    }
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[v0] rejectEmailDraftAction error:", err)
    return { ok: false, error: "serverError", message }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch Email Drafts for an Opportunity
// ─────────────────────────────────────────────────────────────────────────────

export type EmailDraftRow = {
  id: string
  email_type: EmailType
  ai_prompt: string | null
  generated_subject: string | null
  generated_content_en: string | null
  translated_content_vi: string | null
  recipient_email: string | null
  cc_emails: string[] | null
  status: "draft" | "pending_approval" | "sent" | "rejected" | "failed"
  sent_at: string | null
  created_at: string
}

export type FetchDraftsResult =
  | { ok: true; drafts: EmailDraftRow[] }
  | { ok: false; error: "unauthorized" | "serverError" }

export async function fetchEmailDraftsAction(
  opportunityId: string
): Promise<FetchDraftsResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "unauthorized" }

    const { data, error } = await supabase
      .from("email_drafts")
      .select("id, email_type, ai_prompt, generated_subject, generated_content_en, translated_content_vi, recipient_email, cc_emails, status, sent_at, created_at")
      .eq("opportunity_id", opportunityId)
      .order("created_at", { ascending: false })
      .limit(20)

    if (error) {
      console.error("[v0] fetchEmailDraftsAction error:", error)
      return { ok: false, error: "serverError" }
    }

    return { ok: true, drafts: (data ?? []) as EmailDraftRow[] }
  } catch (err) {
    console.error("[v0] fetchEmailDraftsAction error:", err)
    return { ok: false, error: "serverError" }
  }
}
