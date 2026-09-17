/**
 * AI generator for the "requirement inquiry" email — the FIRST, LIGHT-TOUCH
 * email an AE sends a buyer BEFORE any client/supplier has been picked and
 * before any sourcing requirements have been collected.
 *
 * V2 — High-Quality Mapping Edition:
 * - Buyer deep analysis: HS code, purchase_history (VN supplier names/year/volume),
 *   top_suppliers, main_import_countries, peak_months, total_shipments, origin_ports...
 * - Vexim positioning: curated network, factory audit, certifications (HACCP/ISO/BRC/FDA),
 *   fast response (24h), flexible payment (T/T, L/C), traceability, transparency
 * - Combined into personalized, consultative email that still passes Gmail filters
 *
 * Google Deliverability Notes:
 * - Keep plain text, no links/images in first email
 * - No spam triggers: "best price", "cheapest", "guaranteed", "free", "act now"
 * - Personalized with buyer-specific observation (HS, product, import countries)
 * - Human sender name, conversational tone, opt-out courtesy line
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

const SIGNATURE_COMPANY = "VEXIM GLOBAL CO., LTD"
const SIGNATURE_ADDRESS =
  "25/6, Lane 51, Ngoa Long Street, Tay Tuu Ward, Hanoi, Vietnam"

const OPT_OUT_EN =
  `If sourcing from Vietnam isn't on your radar right now, just reply "no" and I won't reach out again — no hard feelings at all.`
const OPT_OUT_VI =
  `Nếu nguồn cung từ Việt Nam hiện chưa nằm trong kế hoạch của bạn, chỉ cần trả lời "không", tôi sẽ không gửi email lại — hoàn toàn không có gì phiền cả.`

const AI_GENERATION_TIMEOUT_MS = 20_000

class AIGenerationTimeoutError extends Error {
  constructor() {
    super("AI generation timed out")
    this.name = "AIGenerationTimeoutError"
  }
}

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

function buildFallbackEmail(
  emailType: EngagementEmailType,
  ctx: FallbackEmailContext,
): { subject_en: string; content_en: string; content_vi: string } {
  const greetingName = ctx.contactPerson?.trim().split(/\\s+/)[0] || "there"
  const topic = ctx.industryOrProduct?.trim() || "your product category"
  const signature_en = [
    "",
    "Best regards,",
    ctx.senderName,
    SIGNATURE_COMPANY,
    ctx.senderEmail,
    SIGNATURE_ADDRESS,
  ].join("\n")
  const signature_vi = [
    "",
    "Trân trọng,",
    ctx.senderName,
    SIGNATURE_COMPANY,
    ctx.senderEmail,
    SIGNATURE_ADDRESS,
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
            "",
            OPT_OUT_EN,
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
            "",
            OPT_OUT_VI,
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
            "",
            OPT_OUT_EN,
            signature_en,
          ].join("\n"),
          content_vi: [
            `Xin chào ${greetingName},`,
            "",
            `Tôi đã liên hệ trước đó về việc đánh giá thêm nguồn cung ${topic} từ Việt Nam, và muốn theo dõi lại trong trường hợp email trước chưa đến được bạn.`,
            "",
            "Bạn có muốn trao đổi ngắn về việc này không? Rất vui được chia sẻ thêm thông tin nếu bạn quan tâm.",
            "",
            OPT_OUT_VI,
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
        `Bạn có thể xem hồ sơ từng nhà cung cấp tại đây: ${ctx.shortlistUrl || ""} — cho chúng tôi biết bạn quan tâm đến nhà cung cấp nào nhé.`,
        "",
        "Chúng tôi mong nhận được phản hồi từ bạn.",
        signature_vi,
      ]
        .filter((l) => l !== undefined)
        .join("\n"),
    }
  }

  const companyRef = ctx.buyerCompany?.trim()
  const seenLine = companyRef
    ? `I came across ${companyRef} while looking into ${topic} buyers, and wanted to introduce myself directly.`
    : `I came across your company while looking into ${topic} buyers, and wanted to introduce myself directly.`

  return {
    subject_en: `Sourcing ${topic} from Vietnam`,
    content_en: [
      `Hi ${greetingName},`,
      "",
      `I'm ${ctx.senderName} with ${ctx.exporterCompany} in Vietnam. ${seenLine}`,
      "",
      `We work with manufacturers here for ${topic}, so if you're ever evaluating additional suppliers from Vietnam, I'd be glad to put a few suitable options in front of you.`,
      "",
      "Would you be open to taking a quick look? If now isn't the right time, no worries at all.",
      "",
      OPT_OUT_EN,
      signature_en,
    ].join("\n"),
    content_vi: [
      `Xin chào ${greetingName},`,
      "",
      `Tôi là ${ctx.senderName} từ ${ctx.exporterCompany} tại Việt Nam. ${companyRef
        ? `Tôi biết đến ${companyRef} khi tìm hiểu các đơn vị mua hàng ngành ${topic} và muốn tự giới thiệu trực tiếp.`
        : `Tôi biết đến công ty của bạn khi tìm hiểu các đơn vị mua hàng ngành ${topic} và muốn tự giới thiệu trực tiếp.`}`,
      "",
      `Chúng tôi làm việc với các nhà máy tại Việt Nam cho ngành ${topic}, nên nếu bạn có lúc cần đánh giá thêm nhà cung cấp từ Việt Nam, tôi rất sẵn lòng gửi bạn một vài lựa chọn phù hợp.`,
      "",
      "Bạn có muốn xem qua không? Nếu hiện tại chưa phải thời điểm thích hợp thì cũng hoàn toàn không sao.",
      "",
      OPT_OUT_VI,
      signature_vi,
    ].join("\n"),
  }
}

function buildFallbackFollowUpReply(ctx: {
  senderName: string
  exporterCompany: string
  senderEmail: string
  defaultSubject: string
}): { subject_en: string; content_en: string; content_vi: string } {
  const signature_en = ["", "Best regards,", ctx.senderName, SIGNATURE_COMPANY, ctx.senderEmail, SIGNATURE_ADDRESS].join("\n")
  const signature_vi = ["", "Trân trọng,", ctx.senderName, SIGNATURE_COMPANY, ctx.senderEmail, SIGNATURE_ADDRESS].join("\n")
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
      "Full English email body. Exact content requirements are fully specified in the system prompt for the given emailType — follow the system prompt precisely. Always end with a complete signature using sender_name / signature_company / sender_email / signature_address from context.",
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
  const dbEmailType = emailType === "requirement_followup" ? "follow_up" : emailType

  if (emailType === "shortlist_delivery" && !input.shortlistUrl) {
    throw new Error("shortlistUrl is required for shortlist_delivery emails")
  }

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

  // ------------------------------------------------------------------
  // Deep buyer intel + Vexim vetting context
  // ------------------------------------------------------------------
  const buyerIntel = {
    buyer_company: lead["company_name"],
    contact_person: lead["contact_person"],
    contact_title: (lead as any)["contact_title"] ?? null,
    main_product: lead["main_product"],
    hs_code: lead["hs_code"],
    secondary_hs_codes: (lead as any)["secondary_hs_codes"] ?? null,
    industry: lead["industry"],
    country: lead["country"],
    website: (lead as any)["website"] ?? null,
    // Deep fields for quality mapping
    purchase_history: (lead as any)["purchase_history"] ?? null,
    top_suppliers: (lead as any)["top_suppliers"] ?? null,
    main_import_countries: (lead as any)["main_import_countries"] ?? null,
    top_peak_months: (lead as any)["top_peak_months"] ?? null,
    top_low_months: (lead as any)["top_low_months"] ?? null,
    total_shipments: (lead as any)["total_shipments"] ?? null,
    avg_teu_per_month: (lead as any)["avg_teu_per_month"] ?? null,
    origin_ports: (lead as any)["origin_ports"] ?? null,
    destination_ports: (lead as any)["destination_ports"] ?? null,
    container_types: (lead as any)["container_types"] ?? null,
    bol_description: (lead as any)["bol_description"] ?? null,
    has_active_inquiry: (lead as any)["has_active_inquiry"] ?? null,
    inquiry_products: (lead as any)["inquiry_products"] ?? null,
    inquiry_quantity: (lead as any)["inquiry_quantity"] ?? null,
    inquiry_timeline: (lead as any)["inquiry_timeline"] ?? null,
    sender_name: profile.full_name,
    exporter_company: "Vexim",
    signature_company: SIGNATURE_COMPANY,
    signature_address: SIGNATURE_ADDRESS,
    sender_email: profile.work_email || "trade@veximtrade.com",
    // Vexim positioning — curated network story
    vexim_vetting: {
      model: "We are not a marketplace. We only represent factories we've physically visited and audited ourselves — no trading companies.",
      pillars: [
        "Factory audit: direct factory, visited by Vexim team, 50-300 workers typical, export since 2015+",
        "Certifications: HACCP, ISO 22000, BRC, FDA for US-bound, HALAL/KOSHER if needed — checked and valid, not just claimed",
        "Quality: traceability from raw material to finished goods, lot tracking, QC engineers on site, equipment calibration, food safety training",
        "Response: 24h response, English-speaking export team, dedicated account handling, video call factory tour available",
        "Payment: flexible T/T, L/C at sight, transparent pricing, no hidden costs, clear MOQ/lead time/capacity",
        "Transparency: clear audit readiness, water testing, near pollution source check, production capacity confirmed",
      ],
      typical_factory: "50-300 workers, export since 2015+, 20-100 tons/month, HACCP/ISO, FDA if US-bound, English export dept, traceability system",
      differentiator: "We reject 80% of factories that apply — only those passing our audit join the network. That's why buyers get consistent quality, not random quotes.",
    },
    ...(emailType === "shortlist_delivery"
      ? {
          requested_products: (engagement as any).requested_products,
          target_price_range: (engagement as any).target_price_range,
          moq: (engagement as any).moq,
          shortlist_url: input.shortlistUrl,
        }
      : {}),
    ...(emailType === "requirement_followup" ? { shortlist_url: input.shortlistUrl ?? null } : {}),
  }

  const contextBlock = JSON.stringify(buyerIntel, null, 2)

  const system =
    emailType === "shortlist_delivery"
      ? [
          "You write short, professional B2B sourcing emails for a Vietnamese export sales team.",
          "Goal of THIS email: tell the buyer their sourcing requirements have been reviewed and a",
          "shortlist of pre-vetted suppliers has been prepared for them. Ask them to open the link",
          "(shortlist_url in context) to view each supplier's profile, and to mark which one(s) they",
          "are interested in. Do not list supplier names in the email body — only the link.",
          "Keep it short (80-140 words), confident, and action-oriented. End with a complete",
          "signature using sender_name / signature_company / sender_email / signature_address from",
          "context, in that order — never use placeholders and never include a phone number. This",
          "buyer already replied with requirements, so do NOT add an opt-out line. Never invent",
          "facts not present in context. No emoji.",
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
          "5. Subject should read as a gentle follow-up (e.g. start with 'Following up'). Never",
          "   use a 'Re:' prefix when the buyer has never replied — a fake reply prefix is a",
          "   deceptive-subject spam trigger.",
          "6. End with a complete signature using sender_name / signature_company / sender_email /",
          "   signature_address from context, in that order — never a placeholder and never a",
          "   phone number.",
          "7. The buyer has NOT replied, so include the CAN-SPAM opt-out as the final line BEFORE",
          "   the signature, worded like a peer courtesy: 'If sourcing from Vietnam isn't on your",
          "   radar right now, just reply \"no\" and I won't reach out again — no hard feelings at",
          "   all.' Never make it look like a legal footer.",
          "8. American business voice: greet by first name ('Hi {first name},'), use natural",
          "   contractions (I'm, you've), short sentences, and no stiff phrases ('I hope this",
          "   email finds you well', 'kindly', 'dear friend'). Sound like a real person following",
          "   up, not a marketing sequence.",
        ].join("\n")
      : [
          "You write the FIRST, HIGH-QUALITY opening email a Vietnamese export sales team (Vexim)",
          "sends to a new buyer lead. This is NOT a requirements-collection email — it's a",
          "consultative first touch that proves you understand this buyer and shows why Vexim is",
          "different from random trading companies.",
          "",
          "GOAL OF THIS EMAIL:",
          "1. Show you deeply understand THIS buyer: reference their main product, HS code,",
          "   import countries, purchase history (VN suppliers if any), peak months, shipment volume",
          "   — pick 2-3 most relevant data points from context, woven naturally into the opening.",
          "2. Briefly introduce Vexim's curated model (not a marketplace, only audited factories) —",
          "   mention 1-2 trust pillars relevant to this buyer (e.g., FDA for US buyer, traceability",
          "   for food, flexible payment for new supplier evaluation, 24h response). Keep it to ONE",
          "   sentence, not a brochure.",
          "3. End with exactly ONE CTA: whether the buyer would be open to evaluating additional",
          "   sourcing from Vietnam for their product/industry.",
          "",
          "MANDATORY RULES (do not violate any of these):",
          "1. Exactly ONE call-to-action: whether the buyer is open to evaluating Vietnam sourcing.",
          "2. Do NOT ask about product spec/details, target price, MOQ, payment terms, or packaging.",
          "   Those belong to a later, separate follow-up email — not this one.",
          "3. Do NOT name, list, or describe any specific supplier or factory. No supplier has been",
          "   chosen or vetted yet. You can reference Vexim's NETWORK in general terms only.",
          "4. Do NOT invent or assume any fact not present in the context JSON — no specific prices,",
          "   quantities, certifications, capacity figures, delivery times, or claimed history of",
          "   past purchases/communication with this buyer. Use ONLY what is in buyer context.",
          "5. Do NOT use any forbidden/absolute claims: no 'FDA approved' as guarantee, no",
          "   'guaranteed', 'cheapest', 'best', 'top supplier', '#1', or similarly unverifiable",
          "   superlative/regulatory claims. You CAN say 'FDA-registered factories' or 'factories",
          "   with valid HACCP/ISO' as general vetting criteria — that's factual about your process,",
          "   not a promise about a specific supplier.",
          "6. Do NOT reference or reveal any internal-only or unverified data fields, scoring, notes,",
          "   or anything that reads as internal system/CRM language.",
          "7. Do NOT mention attachments, catalogs, price lists, or files — none are attached.",
          "8. Do NOT claim the email has been or will be auto-sent — it is drafted for AE review.",
          "9. Vexim's self-introduction must be brief: roughly 15-25% of the email's total content,",
          "   not the centerpiece. Weave it into the same paragraph as buyer observation, not a",
          "   separate pitch paragraph.",
          "10. Show buyer-context awareness at a SPECIFIC level: use 2-3 real data points from context",
          "    (e.g., 'I saw you import cashew W320 from Vietnam and India, with peak shipments around",
          "    Oct-Dec' or 'noticed your HS 0801 volume and sourcing from multiple countries'). This is",
          "    what makes the email high-quality vs generic. If purchase_history exists, reference it",
          "    naturally (e.g., 'I noticed you've worked with [VN supplier] before').",
          "11. Keep a professional, warm, consultative B2B tone — never pushy or salesy. Sound like",
          "    a specific person who did homework on this buyer, not a mail-merge template.",
          "12. No emoji. No excessive punctuation (no multiple exclamation marks, no ALL CAPS).",
          "13. Total length: 130-200 words for the body (excluding signature). Slightly longer than",
          "    before because we now include buyer-specific insight + Vexim trust, but still concise.",
          "14. End with a complete, real signature in EXACTLY this shape, using context values:",
          "    a blank line, 'Best regards,', the sender_name, then signature_company",
          "    ('VEXIM GLOBAL CO., LTD'), then sender_email, then signature_address (the",
          "    registered postal address, copied verbatim on its own line). Never include a phone",
          "    number, title line, or placeholder like '[Your Name]'. The body may call the",
          "    company 'Vexim'; the legal signature line is always 'VEXIM GLOBAL CO., LTD'.",
          "15. Do not use a 'Re:' subject prefix — this is a first contact on this topic.",
          "16. Do not add a P.S., forwarded-message framing, or any second CTA/question of any kind.",
          "17. Generalize to the buyer's ACTUAL product/industry taken from context (main_product /",
          "    industry) — never hardcode or default to any single specific product category.",
          "18. If a context field needed to sound specific is missing, stay generic rather than",
          "    guessing or fabricating a value. Prefer fewer specifics over invented ones.",
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
          "    clause instead of a tagline. Use vexim_vetting from context for factual pillars.",
          "21. THIS FIRST EMAIL MUST CONTAIN NO URL, LINK, IMAGE, BUTTON OR ATTACHMENT. There is",
          "    nothing to click on a first touch — links only appear in later shortlist/follow-up",
          "    emails. Plain text only, no HTML, no social-media handles.",
          "22. ANTI-SPAM VOCABULARY: never use 'free', 'discount', 'cheap', 'guarantee/guaranteed',",
          "    '100%', 'act now', 'limited time', 'risk-free', 'no obligation', 'click here',",
          "    'unsubscribe', 'congratulations', 'dear friend', or savings/ROI percentage claims.",
          "    No ALL-CAPS words for emphasis, no exclamation marks, no emoji or unicode symbols",
          "    beyond standard punctuation.",
          "23. CAN-SPAM COMPLIANCE: as the final sentence of the BODY (on its own short paragraph",
          "    before the signature), give a simple, human opt-out: 'If sourcing from Vietnam",
          "    isn't on your radar right now, just reply \"no\" and I won't reach out again — no",
          "    hard feelings at all.' It must read as a courtesy, never as a legal footer or a",
          "    clickable unsubscribe link.",
          "24. QUALITY MAPPING: You MUST reference at least 2 buyer-specific data points from context",
          "    (choose from: main_product, hs_code, purchase_history, top_suppliers,",
          "    main_import_countries, top_peak_months, total_shipments, origin_ports). Example:",
          "    'I noticed you import [product] under HS [code] from [countries], with peak in [months]'",
          "    — this proves you did homework. Do NOT dump all fields, just 2-3 most relevant woven",
          "    naturally.",
          "25. VEXIM POSITIONING: You MUST weave in 1-2 trust pillars from vexim_vetting.pillars that",
          "    are RELEVANT to this buyer: e.g., for US buyer mention FDA registration check; for food",
          "    buyer mention HACCP/traceability; for buyer with many suppliers mention 24h response and",
          "    English team. Keep it to ONE short clause, not a list. Example: 'We only work with",
          "    factories we've visited ourselves — typical partners have valid HACCP/ISO and FDA",
          "    registration for US, with traceability from raw material.'",
          "",
          "AMERICAN BUSINESS VOICE (the reader is a busy US purchasing/import professional):",
          "- Greet by first name with a plain 'Hi {first name},' when the contact person is known;",
          "  use 'Hi there,' only when no name exists. Never 'Dear Sir/Madam', 'Dear Team', or an",
          "  overly formal 'Dear Mr./Ms.'.",
          "- Write the way Americans actually email at work: natural contractions (I'm, you're,",
          "  we've), plain everyday words, short paragraphs of 1-3 sentences, one idea each.",
          "- Avoid stiff, non-native or mail-merge phrases: 'I hope this email finds you well',",
          "  'I am writing to...', 'kindly', 'please revert', 'whilst/amongst', 'do the needful',",
          "  'esteemed company', or any flattery. Never mention databases, customs records,",
          "  scraping, AI, scores, CRM fields, or HOW the buyer was found beyond a light, human",
          "  'I came across {company} while looking into {category} buyers'.",
          "- Make the ask feel like a low-friction favor between peers, and give an easy, face-",
          "  saving out (e.g. 'Would you be open to taking a quick look? If now isn't the right",
          "  time, no worries at all.'). Never imply urgency or obligation.",
          "- Subject: short, human, sentence case, specific to their category or company",
          "  (e.g. 'Sourcing {category} from Vietnam' or '{Company} — {product} from Vietnam'),",
          "  under ~50 characters. No Title Case, no marketing hook, no Fwd:/Re:.",
          "",
          "STRUCTURE (write as connected prose, not visibly separate template blocks):",
          "1. Personal, professional greeting using the contact person's name if available.",
          "2. Open with SPECIFIC buyer observation (2-3 data points from context: product, HS, import",
          "   countries, purchase history, peak months, volume) — fold in who you are/Vexim in the same",
          "   sentence or the very next one, briefly (15-25% of content) — not as a separate pitch paragraph.",
          "   Example: 'Hi John, I noticed {Company} imports {product} under HS {code} from {countries},",
          "   with peak around {months} — I'm {Name} with Vexim in Vietnam, we only work with factories",
          "   we've audited ourselves.'",
          "3. One sentence, plainly worded, weaving in 1-2 relevant Vexim trust pillars (from vexim_vetting)",
          "   — e.g., FDA/traceability/response/payment flexibility — tailored to this buyer's context.",
          "   Must sound factual about your vetting process, not salesy.",
          "4. The single CTA, phrased as a direct question to this person: ask clearly whether the",
          "   buyer would be open to evaluating additional sourcing from Vietnam for their",
          "   product/industry.",
          "5. A short, low-pressure closing line with an easy out (e.g. 'If now isn't the right",
          "   time, no worries at all.').",
          "6. The opt-out sentence from rule 23, on its own line.",
          "7. Complete signature, exactly: 'Best regards,' / sender_name / 'VEXIM GLOBAL CO., LTD'",
          "   / sender_email / signature_address. No title line, no phone number.",
          "",
          "WRITING STYLE:",
          "Concise, plain American business English, active voice, short sentences and short",
          "paragraphs. Confident but not pushy. No jargon, no filler adjectives, no hype language.",
          "Write like a specific person emailing one specific contact — not like a template merged",
          "with lead data. Read it aloud: if a 30-year-old US buyer would find any sentence stiff,",
          "salesy or robotic, rewrite it. The email should feel like you spent 2 minutes researching",
          "THIS buyer, not 2 seconds merging a list.",
          "",
          "SELF-CHECK BEFORE RETURNING THE RESULT:",
          "Before producing content_en, verify silently: exactly one CTA present; no MOQ/price/",
          "payment/packaging/spec question anywhere; no supplier named; no fabricated fact; no",
          "forbidden claim; no URL or attachment; no spam vocabulary, caps, exclamation marks or",
          "emoji; greeting uses the contact's first name; the human opt-out sentence is present",
          "right before the signature; Vexim intro is brief (15-25%) and woven into buyer observation,",
          "not a standalone pitch paragraph; at least 2 buyer-specific data points are referenced",
          "naturally; at least 1 Vexim trust pillar is mentioned relevantly; no marketing-tagline",
          "phrasing; length is 130-200 words; signature is exactly name / VEXIM GLOBAL CO., LTD /",
          "email / postal address with no phone. If any check fails, rewrite before finalizing.",
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
          } từ Việt Nam không. Nhấn mạnh Vexim chỉ làm việc với factory đã audit, có chứng chỉ đầy đủ, phản hồi nhanh, thanh toán linh hoạt, minh bạch. Dùng dữ liệu buyer chi tiết (HS code, lịch sử mua, quốc gia nhập, mùa cao điểm) để chứng minh hiểu buyer. KHÔNG hỏi MOQ, giá, thanh toán hay bao bì ở email này.`),
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
      exporterCompany: "Vexim",
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

// ------------------------------------------------------------------
// Follow-up reply
// ------------------------------------------------------------------

const followUpOutputSchema = z.object({
  subject_en: z
    .string()
    .describe("Subject line for this reply. Should start with 'Re:' if the buyer's original subject already does; otherwise prefix one."),
  content_en: z
    .string()
    .describe(
      "Full English email body replying directly to the buyer's message. Address exactly what the buyer asked/raised — do not repeat the original requirement questions. Keep it concise (80-160 words), warm, specific, and in natural American business English. End with a complete signature using sender_name / signature_company / sender_email / signature_address from context.",
    ),
  content_vi: z
    .string()
    .describe("Faithful Vietnamese translation of the English reply so the Vietnamese AE can verify intent before sending."),
})

export type GenerateFollowUpReplyInput = {
  engagementId: string
  replyId: string
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
  inReplyToMessageId: string | null
  replyId: string
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

  const { data: reply, error: replyErr } = await supabase
    .from("buyer_replies")
    .select("id, from_email, subject, raw_content, translated_vi, ai_summary, ai_suggested_next_step, message_id, engagement_id")
    .eq("id", input.replyId)
    .eq("engagement_id", input.engagementId)
    .single()
  if (replyErr || !reply) {
    throw new Error("Buyer reply not found for this engagement")
  }

  const recipient = reply.from_email || (lead["contact_email"] as string | null) || null

  const originalSubject = reply.subject?.trim() || ""
  const defaultSubject = originalSubject
    ? /^re:/i.test(originalSubject)
      ? originalSubject
      : `Re: ${originalSubject}`
    : "Re: Your inquiry"

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
      hs_code: lead["hs_code"],
      purchase_history: (lead as any)["purchase_history"] ?? null,
      main_import_countries: (lead as any)["main_import_countries"] ?? null,
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
      exporter_company: "Vexim",
      signature_company: SIGNATURE_COMPANY,
      signature_address: SIGNATURE_ADDRESS,
      sender_email: profile.work_email || "trade@veximtrade.com",
      vexim_vetting: {
        pillars: [
          "Audited factories only, direct factory, no trading company",
          "Valid certs: HACCP, ISO, BRC, FDA for US, traceability",
          "24h response, English export team",
          "Flexible payment T/T, L/C at sight",
        ],
      },
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
    "Write in natural American business English: greet by first name, use contractions, keep",
    "paragraphs to 1-3 sentences, and avoid stiff phrases ('I hope this email finds you well',",
    "'kindly'). Close with exactly this signature: 'Best regards,' / sender_name /",
    "'VEXIM GLOBAL CO., LTD' / sender_email / signature_address. Never add a phone number or a",
    "job title line, and never add an opt-out line to an active conversation.",
    "If relevant, you can mention Vexim's vetted network (audited factories, valid certs, traceability, flexible payment) as factual context, but keep it brief and relevant to buyer's question.",
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
      exporterCompany: "Vexim",
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
