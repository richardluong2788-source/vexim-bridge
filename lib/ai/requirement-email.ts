/**
 * AI generator for the "requirement inquiry" email — sent to a buyer
 * BEFORE any client/supplier has been picked, to collect their sourcing
 * requirements (product spec, MOQ, target price range, payment terms,
 * packaging, and anything else).
 *
 * Deliberately kept separate from lib/ai/email-generator.ts (which is
 * opportunity-scoped and much more elaborate) because this email has no
 * opportunity yet — only a `lead` and a `buyer_engagement`.
 *
 * Same pipeline shape as the opportunity email generator: AI drafts ->
 * saved as a `pending_approval` email_drafts row -> AE reviews -> sent via
 * the existing lib/ai/email-sender.ts (which already tolerates a draft
 * with no opportunity_id).
 */

import { generateText, Output } from "ai"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

export class RequirementEmailAuthError extends Error {
  constructor(message = "Unauthorized") {
    super(message)
    this.name = "RequirementEmailAuthError"
  }
}

const ALLOWED_ROLES = new Set(["admin", "staff", "super_admin", "account_executive"])

const outputSchema = z.object({
  subject_en: z
    .string()
    .describe("Concise, specific US-English subject line (max 80 chars). No 'Re:' prefix — this is a first message on this topic."),
  content_en: z
    .string()
    .describe(
      "Full English email body. Politely asks the buyer to share: 1) exact product/spec needed, 2) target price range, 3) MOQ (minimum order quantity), 4) preferred payment terms, 5) packaging requirements, 6) any other requirements. Keep it short (120-180 words), warm, and easy to answer point-by-point. End with a complete signature using sender_name / exporter_company / sender_email / sender_phone from context — never use placeholders.",
    ),
  content_vi: z
    .string()
    .describe("Faithful Vietnamese translation of the English email so the Vietnamese AE can verify intent before sending."),
})

export type EngagementEmailType = "requirement_inquiry" | "shortlist_delivery"

export type GenerateRequirementEmailInput = {
  engagementId: string
  viPrompt: string
  emailType?: EngagementEmailType
  /** Required when emailType === "shortlist_delivery" — the public link the buyer opens. */
  shortlistUrl?: string
  isManual?: boolean
  manualSubject?: string
  manualContent?: string
}

export type GenerateRequirementEmailResult = {
  draftId: string
  subject_en: string
  content_en: string
  content_vi: string
  recipient_email: string | null
}

export async function generateRequirementInquiryEmail(
  input: GenerateRequirementEmailInput,
): Promise<GenerateRequirementEmailResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new RequirementEmailAuthError()

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, email, company_name")
    .eq("id", user.id)
    .single()
  if (!profile || !ALLOWED_ROLES.has(profile.role)) {
    throw new RequirementEmailAuthError("Role not permitted")
  }

  const { data: engagement, error: engErr } = await supabase
    .from("buyer_engagements")
    .select(
      "id, lead_id, requested_products, target_price_range, moq, payment_terms, packaging_requirements, other_requirements, leads (*)",
    )
    .eq("id", input.engagementId)
    .single()
  if (engErr || !engagement) {
    throw new Error("Engagement not found")
  }
  const lead = (Array.isArray((engagement as any).leads)
    ? (engagement as any).leads[0]
    : (engagement as any).leads) as Record<string, unknown> | null
  if (!lead) throw new Error("Engagement has no associated lead")

  const recipient = (lead["contact_email"] as string | null) ?? null
  const emailType: EngagementEmailType = input.emailType ?? "requirement_inquiry"

  if (emailType === "shortlist_delivery" && !input.shortlistUrl) {
    throw new Error("shortlistUrl is required for shortlist_delivery emails")
  }

  // ------------------------------------------------------------
  // Manual mode — skip AI generation entirely.
  // ------------------------------------------------------------
  if (input.isManual && input.manualSubject && input.manualContent) {
    const { data: draft, error: draftError } = await supabase
      .from("email_drafts")
      .insert({
        lead_id: engagement.lead_id,
        engagement_id: input.engagementId,
        email_type: emailType,
        ai_prompt: "[MANUAL]",
        generated_subject: input.manualSubject,
        generated_content_en: input.manualContent,
        translated_content_vi: input.manualContent,
        recipient_email: recipient,
        status: "pending_approval",
        created_by: user.id,
      })
      .select("id")
      .single()
    if (draftError || !draft) throw new Error(draftError?.message ?? "Failed to save draft")

    return {
      draftId: draft.id,
      subject_en: input.manualSubject,
      content_en: input.manualContent,
      content_vi: input.manualContent,
      recipient_email: recipient,
    }
  }

  const contextBlock = JSON.stringify(
    {
      buyer_company: lead["company_name"],
      contact_person: lead["contact_person"],
      main_product: lead["main_product"],
      hs_code: lead["hs_code"],
      industry: lead["industry"],
      country: lead["country"],
      sender_name: profile.full_name,
      exporter_company: profile.company_name ?? "Vexim Trade",
      sender_email: profile.email,
      ...(emailType === "shortlist_delivery"
        ? {
            requested_products: (engagement as any).requested_products,
            target_price_range: (engagement as any).target_price_range,
            moq: (engagement as any).moq,
            shortlist_url: input.shortlistUrl,
          }
        : {}),
    },
    null,
    2,
  )

  const system =
    emailType === "shortlist_delivery"
      ? [
          "You write short, professional B2B sourcing emails for a Vietnamese export sales team.",
          "Goal of THIS email: tell the buyer their sourcing requirements have been reviewed and a",
          "shortlist of pre-vetted suppliers has been prepared for them. Ask them to open the link",
          "(shortlist_url in context) to view each supplier's profile, and to mark which one(s) they",
          "are interested in. Do not list supplier names in the email body — only the link.",
          "Keep it short (80-140 words), confident, and action-oriented. End with a complete",
          "signature using sender_name / exporter_company / sender_email from context — never use",
          "placeholders. Never invent facts not present in context. No emoji.",
        ].join("\n")
      : [
          "You write short, professional B2B sourcing emails for a Vietnamese export sales team.",
          "Goal of THIS email: ask the buyer to share their sourcing requirements so the team can",
          "shortlist the right manufacturers for them. Do NOT pitch any specific supplier yet — no",
          "supplier has been chosen. Ask specifically about: 1) product/spec, 2) target price range,",
          "3) MOQ, 4) payment terms, 5) packaging requirements, 6) anything else important to them.",
          "Frame it as helping them get matched with the RIGHT supplier faster, not a sales pitch.",
          "Never invent facts not present in context. No emoji. No excessive punctuation.",
        ].join("\n")

  const userPrompt = [
    "Buyer context (JSON):",
    contextBlock,
    "",
    "AE instruction (Vietnamese):",
    input.viPrompt ||
      (emailType === "shortlist_delivery"
        ? "Thông báo cho buyer là đã có shortlist supplier phù hợp, mời họ bấm link xem profile và chọn supplier quan tâm."
        : "Hỏi buyer về nhu cầu sản phẩm, MOQ, khoảng giá mục tiêu, điều kiện thanh toán và bao bì."),
  ].join("\n")

  const { experimental_output: generated } = await generateText({
    model: "openai/gpt-4o-mini",
    system,
    prompt: userPrompt,
    experimental_output: Output.object({ schema: outputSchema }),
  })

  const { data: draft, error: draftError } = await supabase
    .from("email_drafts")
    .insert({
      lead_id: engagement.lead_id,
      engagement_id: input.engagementId,
      email_type: emailType,
      ai_prompt: input.viPrompt,
      generated_subject: generated.subject_en,
      generated_content_en: generated.content_en,
      translated_content_vi: generated.content_vi,
      recipient_email: recipient,
      status: "pending_approval",
      created_by: user.id,
    })
    .select("id")
    .single()
  if (draftError || !draft) throw new Error(draftError?.message ?? "Failed to save draft")

  return {
    draftId: draft.id,
    subject_en: generated.subject_en,
    content_en: generated.content_en,
    content_vi: generated.content_vi,
    recipient_email: recipient,
  }
}
