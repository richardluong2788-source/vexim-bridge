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

// ─────────────────────────────────────────────────────────────────────────────
// AI Gateway resilience: the model call above is the single point of failure
// for every "soạn email" action in the AE inbox. If the Gateway is down or
// slow, an AE must still be able to send an email within seconds — so every
// generateText() call in this file is (1) time-boxed with AI_GENERATION_TIMEOUT_MS
// and (2) backed by a static fallback template that still produces a usable,
// on-brand, review-ready draft instead of surfacing a dead end to the AE.
// ─────────────────────────────────────────────────────────────────────────────

const AI_GENERATION_TIMEOUT_MS = 20_000

class AIGenerationTimeoutError extends Error {
  constructor() {
    super("AI generation timed out")
    this.name = "AIGenerationTimeoutError"
  }
}

/** Races an AI call against a timeout so a stuck/slow Gateway never blocks the AE. */
async function withGenerationTimeout<T>(promise: Promise<T>, ms = AI_GENERATION_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AIGenerationTimeoutError()), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer!)
  }
}

type FallbackEmailContext = {
  senderName: string
  exporterCompany: string
  senderEmail: string
  buyerCompany?: string | null
  contactPerson?: string | null
  industryOrProduct?: string | null
  shortlistUrl?: string | null
}

/**
 * Static, hand-written email templates used ONLY when the AI Gateway call
 * fails or times out. Deliberately plain and generic (no fabricated facts)
 * so they are always safe to send as-is, though the AE still reviews before
 * sending like every other draft in this pipeline.
 */
function buildFallbackEmail(
  emailType: EngagementEmailType,
  ctx: FallbackEmailContext,
): { subject_en: string; content_en: string; content_vi: string } {
  const greetingName = ctx.contactPerson?.trim() || "there"
  const topic = ctx.industryOrProduct?.trim() || "your product category"
  const signature_en = [
    "",
    "Best regards,",
    ctx.senderName,
    ctx.exporterCompany,
    ctx.senderEmail,
  ].join("\n")
  const signature_vi = [
    "",
    "Trân trọng,",
    ctx.senderName,
    ctx.exporterCompany,
    ctx.senderEmail,
  ].join("\n")

  if (emailType === "requirement_followup") {
    return ctx.shortlistUrl
      ? {
          subject_en: `Following up — supplier shortlist for ${ctx.buyerCompany || "your company"}`,
          content_en: [
            `Hi ${greetingName},`,
            "",
            `I wanted to follow up on the supplier shortlist we shared earlier — I haven't heard back yet and wanted to check if you had a chance to review it: ${ctx.shortlistUrl}`,
            "",
            "Happy to answer any questions or provide more detail on any of the suppliers.",
            signature_en,
          ]
            .filter((l) => l !== undefined)
            .join("\n"),
          content_vi: [
            `Xin chào ${greetingName},`,
            "",
            `Tôi muốn theo dõi lại về shortlist nhà cung cấp đã gửi trước đó — tôi chưa nhận được phản hồi và muốn hỏi bạn đã có dịp xem qua chưa: ${ctx.shortlistUrl}`,
            "",
            "Rất vui được giải đáp thêm hoặc cung cấp thông tin chi tiết hơn về các nhà cung cấp.",
            signature_vi,
          ]
            .filter((l) => l !== undefined)
            .join("\n"),
        }
      : {
          subject_en: `Following up — sourcing from Vietnam for ${topic}`,
          content_en: [
            `Hi ${greetingName},`,
            "",
            `I reached out previously about evaluating additional sourcing for ${topic} from Vietnam, and wanted to follow up in case my earlier message didn't reach you.`,
            "",
            "Would you be open to a brief conversation on this? Happy to share more information if there's interest.",
            signature_en,
          ].join("\n"),
          content_vi: [
            `Xin chào ${greetingName},`,
            "",
            `Tôi đã liên hệ trước đó về việc đánh giá thêm nguồn cung ${topic} từ Việt Nam, và muốn theo dõi lại trong trường hợp email trước chưa đến được bạn.`,
            "",
            "Bạn có muốn trao đổi ngắn về việc này không? Rất vui được chia sẻ thêm thông tin nếu bạn quan tâm.",
            signature_vi,
          ].join("\n"),
        }
  }

  if (emailType === "shortlist_delivery") {
    return {
      subject_en: `Supplier shortlist prepared for ${ctx.buyerCompany || "your company"}`,
      content_en: [
        `Hi ${greetingName},`,
        "",
        "Thank you for sharing your sourcing requirements with us. We have reviewed them and prepared a shortlist of pre-vetted suppliers for your consideration.",
        "",
        `You can view each supplier's profile here: ${ctx.shortlistUrl || ""} — just let us know which one(s) you would like to move forward with.`,
        "",
        "We look forward to your feedback.",
        signature_en,
      ]
        .filter((l) => l !== undefined)
        .join("\n"),
      content_vi: [
        `Xin chào ${greetingName},`,
        "",
        "Cảm ơn bạn đã chia sẻ nhu cầu sourcing với chúng tôi. Chúng tôi đã xem xét và chuẩn bị một shortlist các nhà cung cấp đã được kiểm tra kỹ để bạn tham khảo.",
        "",
        `Bạn có thể xem hồ sơ từng nhà cung cấp tại đây: ${ctx.shortlistUrl || ""} — cho chúng tôi biết bạn quan tâm đến nhà cung c��p nào nhé.`,
        "",
        "Chúng tôi mong nhận được phản hồi từ bạn.",
        signature_vi,
      ]
        .filter((l) => l !== undefined)
        .join("\n"),
    }
  }

  return {
    subject_en: `Sourcing from Vietnam — ${topic}`,
    content_en: [
      `Hi ${greetingName},`,
      "",
      `My name is ${ctx.senderName} from ${ctx.exporterCompany} in Vietnam — I came across your company's profile and wanted to reach out directly.`,
      "",
      `We work with manufacturers across Vietnam, and I thought you might be open to evaluating additional sourcing options for ${topic} from here.`,
      "",
      "Would you be open to discussing this further? Happy to share more information if there's interest.",
      signature_en,
    ].join("\n"),
    content_vi: [
      `Xin chào ${greetingName},`,
      "",
      `Tôi là ${ctx.senderName} từ ${ctx.exporterCompany} tại Việt Nam — tôi biết đến hồ sơ công ty bạn và muốn liên hệ trực tiếp.`,
      "",
      `Chúng tôi làm việc với các nhà máy tại Việt Nam, và muốn hỏi liệu bạn có quan tâm đánh giá thêm nguồn cung ${topic} từ đây không.`,
      "",
      "Bạn có muốn trao đổi thêm về việc này không? Rất vui được chia sẻ thêm thông tin nếu bạn quan tâm.",
      signature_vi,
    ].join("\n"),
  }
}

/** Fallback for a mid-thread reply — deliberately generic since we cannot safely paraphrase the buyer's specific ask without AI. */
function buildFallbackFollowUpReply(ctx: {
  senderName: string
  exporterCompany: string
  senderEmail: string
  defaultSubject: string
}): { subject_en: string; content_en: string; content_vi: string } {
  const signature_en = ["", "Best regards,", ctx.senderName, ctx.exporterCompany, ctx.senderEmail].join("\n")
  const signature_vi = ["", "Trân trọng,", ctx.senderName, ctx.exporterCompany, ctx.senderEmail].join("\n")
  return {
    subject_en: ctx.defaultSubject,
    content_en: [
      "Hi,",
      "",
      "Thank you for your message. We are reviewing it and will follow up shortly with a full response.",
      "",
      "In the meantime, please let us know if you have any additional details to share.",
      signature_en,
    ].join("\n"),
    content_vi: [
      "Xin chào,",
      "",
      "Cảm ơn bạn đã phản hồi. Chúng tôi đang xem xét và sẽ trả lời đầy đủ trong thời gian sớm nhất.",
      "",
      "Trong lúc đó, nếu có thêm thông tin nào bạn muốn chia sẻ, xin vui lòng cho chúng tôi biết.",
      signature_vi,
    ].join("\n"),
  }
}

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

export type EngagementEmailType = "requirement_inquiry" | "shortlist_delivery" | "requirement_followup"

export type GenerateRequirementEmailInput = {
  engagementId: string
  viPrompt: string
  emailType?: EngagementEmailType
  /**
   * Required when emailType === "shortlist_delivery" — the public link the buyer opens.
   * Optional when emailType === "requirement_followup" — if the buyer was already sent a
   * shortlist link, pass it so the follow-up references it instead of the earlier opening email.
   */
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
  /** True when the AI Gateway failed/timed out and a static fallback template was used instead. */
  usedFallback?: boolean
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
  // The `email_drafts.email_type` column has a DB-level CHECK constraint that only
  // allows a fixed set of values ('introduction', 'follow_up', 'quotation',
  // 'sample_offer', 'negotiation', 'custom', 'requirement_inquiry',
  // 'shortlist_delivery') — it does NOT include "requirement_followup", which is
  // an internal-only variant of EngagementEmailType used to select the right AI
  // prompt/subject above. Map it to the closest allowed DB value before insert,
  // or every requirement_followup draft violates the constraint and the whole
  // send fails.
  const dbEmailType = emailType === "requirement_followup" ? "follow_up" : emailType

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
        email_type: dbEmailType,
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
      ...(emailType === "requirement_followup" ? { shortlist_url: input.shortlistUrl ?? null } : {}),
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
          "",
          "PRESENT THE LINK LIKE A PERSON, NOT LIKE A MARKETING CTA BUTTON. Reference it inline as",
          "part of a normal sentence (e.g. 'I've put together a shortlist for you here: <url>' or",
          "'you can review it at <url>'), never as an isolated imperative line like 'View your",
          "shortlist now!' or 'Click here'. Do not put the link on its own line with no surrounding",
          "sentence, and do not use exclamation marks or urgency language around it.",
        ].join("\n")
      : emailType === "requirement_followup"
      ? [
          "You write short, polite follow-up B2B emails for a Vietnamese export sales team (Vexim).",
          "The AE previously reached out to this buyer (either a light opening email, or a shortlist",
          "of suppliers — see shortlist_url in context) and has NOT received a reply yet.",
          "",
          "GOAL OF THIS EMAIL: gently check in, in case the earlier message did not reach the buyer",
          "or was missed. Keep exactly the same single ask as before:",
          "- If shortlist_url is present in context: ask them to open the link and review the",
          "  supplier shortlist, and mention the link again in the email body.",
          "- If shortlist_url is null: ask again whether they are open to evaluating additional",
          "  sourcing from Vietnam for their product/industry. Do not ask about MOQ/price/payment/",
          "  packaging in this email.",
          "",
          "RULES:",
          "1. Tone must be light and low-pressure — this is a gentle nudge, never pushy, never",
          "   implying the buyer ignored the AE on purpose.",
          "2. Do NOT repeat the full pitch from the first email — assume the buyer already read it;",
          "   briefly reference that a previous message was sent, nothing more.",
          "3. Do NOT invent facts, do not name specific suppliers in the body, no forbidden claims",
          "   (no 'guaranteed', 'best', 'cheapest', 'FDA approved', etc.), no emoji.",
          "4. Keep it short: 60-110 words for the body (excluding signature).",
          "5. Subject should read as a follow-up (e.g. prefix with 'Following up' or 'Re:') — not",
          "   a brand-new first contact.",
          "6. End with a complete signature using sender_name / exporter_company / sender_email /",
          "   sender_phone from context — never a placeholder.",
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
          "19. AVOID THE 'COLD SALES OUTREACH TEMPLATE' SHAPE. Do not write it as: greeting →",
          "    company pitch paragraph → value-proposition bridge sentence → CTA → sign-off. That",
          "    exact shape is what bulk-outreach tools (Salesloft, Outreach, Apollo) produce, and is",
          "    exactly what Gmail's Promotions classifier is trained to detect. Instead, write it the",
          "    way a person would write a short one-off note to someone specific: weave the reason",
          "    for reaching out and the Vexim context into the SAME sentence or two, rather than",
          "    giving the company introduction its own dedicated paragraph.",
          "20. Do not use generic value-proposition phrasing that reads as marketing copy (e.g.",
          "    'we connect international buyers with vetted manufacturers', 'trusted sourcing",
          "    partner', 'end-to-end solution'). Describe Vexim's role in one plain, specific",
          "    clause instead of a tagline.",
          "",
          "STRUCTURE (write as connected prose, not visibly separate template blocks):",
          "1. Personal, professional greeting using the contact person's name if available.",
          "2. Open with the specific, human reason for writing today (e.g. noticing their sourcing",
          "   interest in [industry/product]) — fold in who you are/Vexim in the same sentence or",
          "   the very next one, briefly (10-20% of content) — not as a separate pitch paragraph.",
          "3. One sentence, plainly worded, on why Vietnam sourcing is worth a look for that",
          "   industry — a fact-based clause, not a value-proposition tagline; no superlatives.",
          "4. The single CTA, phrased as a direct question to this person: ask clearly whether the",
          "   buyer would be open to evaluating additional sourcing from Vietnam for their",
          "   product/industry.",
          "5. A short, low-pressure closing line (e.g. happy to share more if there's interest).",
          "6. Complete signature (sender_name, title if natural, exporter_company, sender_email,",
          "   sender_phone if present in context).",
          "",
          "WRITING STYLE:",
          "Concise, plain business English, active voice, short sentences and short paragraphs.",
          "Confident but not pushy. No jargon, no filler adjectives, no hype language. Write like a",
          "specific person emailing one specific contact — not like a template merged with lead data.",
          "",
          "SELF-CHECK BEFORE RETURNING THE RESULT:",
          "Before producing content_en, verify silently: exactly one CTA present; no MOQ/price/",
          "payment/packaging/spec question anywhere; no supplier named; no fabricated fact; no",
          "forbidden claim; Vexim intro is brief and woven into the opening, not a standalone pitch",
          "paragraph; no marketing-tagline phrasing; length is 120-180 words; signature uses only",
          "real context fields. If any check fails, rewrite before finalizing.",
        ].join("\n")

  const userPrompt = [
    "Buyer context (JSON):",
    contextBlock,
    "",
    "AE instruction (Vietnamese):",
    input.viPrompt ||
      (emailType === "shortlist_delivery"
        ? "Thông báo cho buyer là đã có shortlist supplier phù hợp, mời họ bấm link xem profile và chọn supplier quan tâm."
        : emailType === "requirement_followup"
        ? input.shortlistUrl
          ? "Nhắc lại nhẹ nhàng về shortlist supplier đã gửi trước đó, hỏi buyer đã xem chưa và mời họ mở lại link."
          : "Nhắc lại nhẹ nhàng về email trước đó (trong trường hợp buyer chưa nhận được), hỏi lại buyer có muốn đánh giá thêm nguồn cung từ Việt Nam không."
        : `Giới thiệu ngắn gọn về Vexim và hỏi buyer có muốn đánh giá thêm nguồn cung ${
            (lead["industry"] as string | null) || (lead["main_product"] as string | null) || "sản phẩm liên quan"
          } từ Việt Nam không. KHÔNG hỏi MOQ, giá, thanh toán hay bao bì ở email này — những điểm đó sẽ hỏi ở bước follow-up sau khi buyer phản hồi đồng ý.`),
  ].join("\n")

  let generated: { subject_en: string; content_en: string; content_vi: string }
  let usedFallback = false
  try {
    const { experimental_output } = await withGenerationTimeout(
      generateText({
        model: "openai/gpt-4o-mini",
        system,
        prompt: userPrompt,
        experimental_output: Output.object({ schema: outputSchema }),
      }),
    )
    generated = experimental_output
  } catch (err) {
    console.error("[v0] generateRequirementInquiryEmail: AI generation failed, using fallback template:", err)
    usedFallback = true
    generated = buildFallbackEmail(emailType, {
      senderName: profile.full_name || "Vexim Trade",
      exporterCompany: profile.company_name ?? "Vexim Trade",
      senderEmail: profile.work_email || "trade@veximtrade.com",
      buyerCompany: lead["company_name"] as string | null,
      contactPerson: lead["contact_person"] as string | null,
      industryOrProduct: (lead["industry"] as string | null) || (lead["main_product"] as string | null),
      shortlistUrl: input.shortlistUrl,
    })
  }

  const { data: draft, error: draftError } = await supabase
    .from("email_drafts")
    .insert({
      lead_id: engagement.lead_id,
      engagement_id: input.engagementId,
      email_type: dbEmailType,
      ai_prompt: usedFallback ? `[FALLBACK TEMPLATE] ${input.viPrompt}` : input.viPrompt,
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
    usedFallback,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Follow-up reply — AE answers a SPECIFIC buyer_replies message while still
// mid-negotiation (before requirements are fully captured / an opportunity
// exists). Separate from generateRequirementInquiryEmail above because this
// is a reply within an existing thread, not an opening message: it must be
// grounded in what the buyer actually asked, and it threads onto their
// original email (see replyToMessageId in lib/ai/email-sender.ts).
// ──────────────��──────────────────────────────────────────────────────────────

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
  /** True when the AI Gateway failed/timed out and a static fallback template was used instead. */
  usedFallback?: boolean
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

  let generated: { subject_en: string; content_en: string; content_vi: string }
  let usedFallback = false
  try {
    const { experimental_output } = await withGenerationTimeout(
      generateText({
        model: "openai/gpt-4o-mini",
        system,
        prompt: userPrompt,
        experimental_output: Output.object({ schema: followUpOutputSchema }),
      }),
    )
    generated = experimental_output
  } catch (err) {
    console.error("[v0] generateFollowUpReplyEmail: AI generation failed, using fallback template:", err)
    usedFallback = true
    generated = buildFallbackFollowUpReply({
      senderName: profile.full_name || "Vexim Trade",
      exporterCompany: profile.company_name ?? "Vexim Trade",
      senderEmail: profile.work_email || "trade@veximtrade.com",
      defaultSubject,
    })
  }

  const { data: draft, error: draftError } = await supabase
    .from("email_drafts")
    .insert({
      lead_id: engagement.lead_id,
      engagement_id: input.engagementId,
      email_type: "follow_up",
      ai_prompt: usedFallback ? `[FALLBACK TEMPLATE] ${input.viPrompt}` : input.viPrompt,
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
    usedFallback,
  }
}
