/**
 * AI generator for the "requirement inquiry" email — the FIRST, LIGHT-TOUCH
 * email an AE sends a buyer BEFORE any client/supplier has been picked and
 * before any sourcing requirements have been collected.
 *
 * This is deliberately NOT a discovery/requirements email. It does not ask
 * about product spec, MOQ, target price, payment terms, or packaging — it
 * only introduces Vexim briefly, shows a safe/generic understanding of the
 * buyer's industry, and asks ONE single question: whether the buyer is open
 * to evaluating additional sourcing from Vietnam. Collecting the detailed
 * requirements (spec, price, MOQ, payment, packaging, other) happens in a
 * SEPARATE follow-up step, once the buyer has replied positively — via
 * generateFollowUpReplyEmail() below, triggered from the AE's "Reply" flow
 * with a Vietnamese instruction (see the "Ask for detailed requirements"
 * quick-preset in ReplyFollowUpDialog).
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
      "Full English email body. Exact content requirements (what to ask, what NOT to ask, tone, structure, length) are fully specified in the system prompt for the given emailType — follow the system prompt precisely rather than any generic assumption. Always end with a complete signature using sender_name / exporter_company / sender_email / sender_phone from context — never use placeholders.",
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
    .select("role, full_name, email, work_email, company_name")
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
      // IMPORTANT: never sign with profile.email — that's the AE's login
      // address and is often a personal Gmail (leaks into the buyer-facing
      // signature). Sign with their provisioned work_email, falling back to
      // the shared trade@ address if they don't have one yet.
      sender_email: profile.work_email || "trade@veximtrade.com",
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
          "You write the FIRST, LIGHT-TOUCH opening email a Vietnamese export sales team (Vexim)",
          "sends to a new buyer lead. This is NOT a requirements-collection email.",
          "",
          "GOAL OF THIS EMAIL:",
          "Briefly introduce Vexim, show a safe, generic understanding of the buyer's industry/",
          "product context, and end with exactly ONE call-to-action: asking whether the buyer would",
          "be open to evaluating additional sourcing/supply from Vietnam for their",
          "product/industry. That is the only question in the email.",
          "",
          "MANDATORY RULES (do not violate any of these):",
          "1. Exactly ONE call-to-action: whether the buyer is open to evaluating Vietnam sourcing.",
          "2. Do NOT ask about product spec/details, target price, MOQ, payment terms, or packaging.",
          "   Those belong to a later, separate follow-up email — not this one.",
          "3. Do NOT name, list, or describe any specific supplier or factory. No supplier has been",
          "   chosen or vetted yet.",
          "4. Do NOT invent or assume any fact not present in the context JSON — no specific prices,",
          "   quantities, certifications, capacity figures, delivery times, or claimed history of",
          "   past purchases/communication with this buyer.",
          "5. Do NOT use any forbidden/absolute claims: no 'FDA approved', 'guaranteed', 'cheapest',",
          "   'best', 'top supplier', '#1', or similarly unverifiable superlative/regulatory claims.",
          "6. Do NOT reference or reveal any internal-only or unverified data fields, scoring, notes,",
          "   or anything that reads as internal system/CRM language.",
          "7. Do NOT mention attachments, catalogs, price lists, or files — none are attached.",
          "8. Do NOT claim the email has been or will be auto-sent — it is drafted for AE review.",
          "9. Vexim's self-introduction must be brief: roughly 10-20% of the email's total content,",
          "   not the centerpiece.",
          "10. Show buyer-context awareness only at a safe, generic level (their general industry or",
          "    main product category from context) — never fabricate specifics about their company.",
          "11. Keep a professional, warm, consultative B2B tone — never pushy or salesy.",
          "12. No emoji. No excessive punctuation (no multiple exclamation marks, no ALL CAPS).",
          "13. Total length: 120-180 words for the body (excluding signature).",
          "14. End with a complete, real signature built ONLY from sender_name / exporter_company /",
          "    sender_email / sender_phone in context — never a placeholder like '[Your Name]'.",
          "15. Do not use a 'Re:' subject prefix — this is a first contact on this topic.",
          "16. Do not add a P.S., forwarded-message framing, or any second CTA/question of any kind.",
          "17. Generalize to the buyer's ACTUAL product/industry taken from context (main_product /",
          "    industry) — never hardcode or default to any single specific product category.",
          "18. If a context field needed to sound specific is missing, stay generic rather than",
          "    guessing or fabricating a value.",
          "",
          "STRUCTURE (8 steps, in this order):",
          "1. Personal, professional greeting using the contact person's name if available.",
          "2. One sentence: brief reason for reaching out (e.g. came across their company profile/",
          "   sourcing interest in [industry/product]).",
          "3. Brief Vexim introduction (10-20% of content): who Vexim is — a Vietnam-based export/",
          "   sourcing partner connecting international buyers with vetted Vietnamese manufacturers.",
          "4. One sentence showing safe, generic understanding of the buyer's industry/product",
          "   context — no fabricated specifics.",
          "5. One sentence bridging to why Vietnam is a relevant sourcing option for that industry",
          "   in general terms (e.g. manufacturing capability, export experience) — no unverifiable",
          "   superlatives or claims.",
          "6. The single CTA: ask clearly whether the buyer would be open to evaluating additional",
          "   sourcing from Vietnam for their product/industry.",
          "7. A polite, low-pressure closing line (e.g. happy to share more if there's interest).",
          "8. Complete signature (sender_name, title if natural, exporter_company, sender_email,",
          "   sender_phone if present in context).",
          "",
          "WRITING STYLE:",
          "Concise, plain business English, active voice, short sentences and short paragraphs.",
          "Confident but not pushy. No jargon, no filler adjectives, no hype language.",
          "",
          "SELF-CHECK BEFORE RETURNING THE RESULT:",
          "Before producing content_en, verify silently: exactly one CTA present; no MOQ/price/",
          "payment/packaging/spec question anywhere; no supplier named; no fabricated fact; no",
          "forbidden claim; Vexim intro is brief, not the centerpiece; length is 120-180 words;",
          "signature uses only real context fields. If any check fails, rewrite before finalizing.",
        ].join("\n")

  const userPrompt = [
    "Buyer context (JSON):",
    contextBlock,
    "",
    "AE instruction (Vietnamese):",
    input.viPrompt ||
      (emailType === "shortlist_delivery"
        ? "Thông báo cho buyer là đã có shortlist supplier phù hợp, mời họ bấm link xem profile và chọn supplier quan tâm."
        : `Giới thiệu ngắn gọn về Vexim và hỏi buyer có muốn đánh giá thêm nguồn cung ${
            (lead["industry"] as string | null) || (lead["main_product"] as string | null) || "sản phẩm liên quan"
          } từ Việt Nam không. KHÔNG hỏi MOQ, giá, thanh toán hay bao bì ở email này — những điểm đó sẽ hỏi ở bước follow-up sau khi buyer phản hồi đồng ý.`),
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

// ─────────────────────────────────────────────────────────────────────────────
// Follow-up reply — AE answers a SPECIFIC buyer_replies message while still
// mid-negotiation (before requirements are fully captured / an opportunity
// exists). Separate from generateRequirementInquiryEmail above because this
// is a reply within an existing thread, not an opening message: it must be
// grounded in what the buyer actually asked, and it threads onto their
// original email (see replyToMessageId in lib/ai/email-sender.ts).
// ─────────────────────────────────────────────────────────────────────────────

const followUpOutputSchema = z.object({
  subject_en: z
    .string()
    .describe("Subject line for this reply. Should start with 'Re:' if the buyer's original subject already does; otherwise prefix one."),
  content_en: z
    .string()
    .describe(
      "Full English email body replying directly to the buyer's message. Address exactly what the buyer asked/raised — do not repeat the original requirement questions. Keep it concise (80-160 words), warm, and specific. End with a complete signature using sender_name / exporter_company / sender_email / sender_phone from context — never use placeholders.",
    ),
  content_vi: z
    .string()
    .describe("Faithful Vietnamese translation of the English reply so the Vietnamese AE can verify intent before sending."),
})

export type GenerateFollowUpReplyInput = {
  engagementId: string
  /** The buyer_replies.id being answered — the reply must belong to this engagement. */
  replyId: string
  /** AE instruction in Vietnamese: what to address, negotiate, or ask back. */
  viPrompt: string
  isManual?: boolean
  manualSubject?: string
  manualContent?: string
}

export type GenerateFollowUpReplyResult = {
  draftId: string
  subject_en: string
  content_en: string
  content_vi: string
  recipient_email: string | null
  /** Pass to sendEmailDraft's replyToMessageId so the send threads correctly. */
  inReplyToMessageId: string | null
  replyId: string
}

export async function generateFollowUpReplyEmail(
  input: GenerateFollowUpReplyInput,
): Promise<GenerateFollowUpReplyResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new RequirementEmailAuthError()

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, email, work_email, company_name")
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

  // The reply MUST belong to this engagement — prevents an AE from
  // grounding a reply in another buyer's message via a guessed replyId.
  const { data: reply, error: replyErr } = await supabase
    .from("buyer_replies")
    .select("id, from_email, subject, raw_content, translated_vi, ai_summary, ai_suggested_next_step, message_id, engagement_id")
    .eq("id", input.replyId)
    .eq("engagement_id", input.engagementId)
    .single()
  if (replyErr || !reply) {
    throw new Error("Buyer reply not found for this engagement")
  }

  // Reply to the address the buyer actually wrote from — NOT the lead's
  // on-file contact email, which can legitimately differ (e.g. a colleague
  // answering on the original contact's behalf).
  const recipient = reply.from_email || (lead["contact_email"] as string | null) || null

  const originalSubject = reply.subject?.trim() || ""
  const defaultSubject = originalSubject
    ? /^re:/i.test(originalSubject)
      ? originalSubject
      : `Re: ${originalSubject}`
    : "Re: Your inquiry"

  // ------------------------------------------------------------
  // Manual mode — skip AI generation entirely.
  // ------------------------------------------------------------
  if (input.isManual && input.manualSubject && input.manualContent) {
    const { data: draft, error: draftError } = await supabase
      .from("email_drafts")
      .insert({
        lead_id: engagement.lead_id,
        engagement_id: input.engagementId,
        email_type: "follow_up",
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
      inReplyToMessageId: reply.message_id ?? null,
      replyId: reply.id,
    }
  }

  const contextBlock = JSON.stringify(
    {
      buyer_company: lead["company_name"],
      contact_person: lead["contact_person"],
      main_product: lead["main_product"],
      country: lead["country"],
      requested_products: (engagement as any).requested_products,
      target_price_range: (engagement as any).target_price_range,
      moq: (engagement as any).moq,
      payment_terms: (engagement as any).payment_terms,
      packaging_requirements: (engagement as any).packaging_requirements,
      buyer_message_subject: reply.subject,
      buyer_message_en: reply.raw_content,
      buyer_message_vi_translation: reply.translated_vi,
      buyer_message_ai_summary: reply.ai_summary,
      ai_suggested_next_step: reply.ai_suggested_next_step,
      sender_name: profile.full_name,
      exporter_company: profile.company_name ?? "Vexim Trade",
      sender_email: profile.work_email || "trade@veximtrade.com",
    },
    null,
    2,
  )

  const system = [
    "You write short, professional B2B sourcing emails for a Vietnamese export sales team.",
    "This is a REPLY within an existing email thread with a buyer — the buyer's most recent",
    "message is given as buyer_message_en (with a Vietnamese translation for context) in the",
    "JSON below. Answer exactly what the buyer asked or raised. Do not re-ask the original",
    "requirement questions (product/MOQ/price/payment/packaging) unless the AE instruction",
    "explicitly says information is still missing. Follow the AE's Vietnamese instruction for",
    "what points to address, negotiate, or push back on. Never invent facts (prices, certifications,",
    "capacity) not present in context — if unsure, phrase it as 'we will confirm' rather than",
    "fabricating a number. No emoji. No excessive punctuation.",
  ].join("\n")

  const userPrompt = [
    "Conversation + buyer context (JSON):",
    contextBlock,
    "",
    "AE instruction (Vietnamese) on what to address in this reply:",
    input.viPrompt || "Trả lời đúng trọng tâm câu hỏi/yêu cầu của buyer ở trên.",
  ].join("\n")

  const { experimental_output: generated } = await generateText({
    model: "openai/gpt-4o-mini",
    system,
    prompt: userPrompt,
    experimental_output: Output.object({ schema: followUpOutputSchema }),
  })

  const { data: draft, error: draftError } = await supabase
    .from("email_drafts")
    .insert({
      lead_id: engagement.lead_id,
      engagement_id: input.engagementId,
      email_type: "follow_up",
      ai_prompt: input.viPrompt,
      generated_subject: generated.subject_en || defaultSubject,
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
    subject_en: generated.subject_en || defaultSubject,
    content_en: generated.content_en,
    content_vi: generated.content_vi,
    recipient_email: recipient,
    inReplyToMessageId: reply.message_id ?? null,
    replyId: reply.id,
  }
}
