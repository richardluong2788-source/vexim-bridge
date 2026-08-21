"use server"

import {
  generateRequirementInquiryEmail,
  generateFollowUpReplyEmail,
  RequirementEmailAuthError,
  type GenerateRequirementEmailInput,
  type GenerateRequirementEmailResult,
  type GenerateFollowUpReplyInput,
  type GenerateFollowUpReplyResult,
} from "@/lib/ai/requirement-email"
import { createClient } from "@/lib/supabase/server"
import { markRequirementEmailSent } from "@/app/admin/ae-inbox/engagement-actions"

export type GenerateRequirementEmailActionResult =
  | { ok: true; data: GenerateRequirementEmailResult }
  | { ok: false; error: "unauthorized" | "serverError"; message?: string }

export async function generateRequirementInquiryEmailAction(
  input: GenerateRequirementEmailInput,
): Promise<GenerateRequirementEmailActionResult> {
  try {
    const result = await generateRequirementInquiryEmail(input)
    return { ok: true, data: result }
  } catch (err) {
    if (err instanceof RequirementEmailAuthError) {
      return { ok: false, error: "unauthorized" }
    }
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[v0] generateRequirementInquiryEmailAction error:", err)
    return { ok: false, error: "serverError", message }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reply to a SPECIFIC buyer message while still mid-negotiation (before
// requirements are fully captured / an opportunity exists). Lets the AE keep
// answering follow-up questions from the buyer without leaving the
// "Đang xử lý" workspace or losing thread continuity.
// ─────────────────────────────────────────────────────────────────────────────

export type GenerateFollowUpReplyActionResult =
  | { ok: true; data: GenerateFollowUpReplyResult }
  | { ok: false; error: "unauthorized" | "serverError"; message?: string }

export async function generateFollowUpReplyEmailAction(
  input: GenerateFollowUpReplyInput,
): Promise<GenerateFollowUpReplyActionResult> {
  try {
    const result = await generateFollowUpReplyEmail(input)
    return { ok: true, data: result }
  } catch (err) {
    if (err instanceof RequirementEmailAuthError) {
      return { ok: false, error: "unauthorized" }
    }
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[v0] generateFollowUpReplyEmailAction error:", err)
    return { ok: false, error: "serverError", message }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Called right after sendEmailDraftAction succeeds for a requirement_inquiry
// draft, to advance the engagement's stage.
// ─────────────────────────────────────────────────────────────────────────────

export async function markEngagementEmailSentAction(engagementId: string) {
  return markRequirementEmailSent(engagementId)
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch email drafts tied to an engagement (pre-opportunity stage).
// ─────────────────────────────────────────────────────────────────────────────

export type EngagementEmailDraftRow = {
  id: string
  email_type: string
  generated_subject: string | null
  generated_content_en: string | null
  translated_content_vi: string | null
  recipient_email: string | null
  status: "draft" | "pending_approval" | "sent" | "rejected" | "failed"
  sent_at: string | null
  created_at: string
}

export type FetchEngagementDraftsResult =
  | { ok: true; drafts: EngagementEmailDraftRow[] }
  | { ok: false; error: "unauthorized" | "serverError" }

export async function fetchEngagementEmailDraftsAction(
  engagementId: string,
): Promise<FetchEngagementDraftsResult> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "unauthorized" }

    const { data, error } = await supabase
      .from("email_drafts")
      .select(
        "id, email_type, generated_subject, generated_content_en, translated_content_vi, recipient_email, status, sent_at, created_at",
      )
      .eq("engagement_id", engagementId)
      .order("created_at", { ascending: false })
      .limit(10)

    if (error) {
      console.error("[v0] fetchEngagementEmailDraftsAction error:", error)
      return { ok: false, error: "serverError" }
    }

    return { ok: true, drafts: (data ?? []) as EngagementEmailDraftRow[] }
  } catch (err) {
    console.error("[v0] fetchEngagementEmailDraftsAction error:", err)
    return { ok: false, error: "serverError" }
  }
}
