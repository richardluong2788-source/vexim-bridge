/**
 * AI generator for the "requirement inquiry" email — the FIRST, LIGHT-TOUCH
 * email an AE sends a buyer BEFORE any client/supplier has been picked.
 *
 * V3 — Soft Approach + Compliance Consulting Positioning
 *
 * Triết lý mới theo feedback:
 * - Dữ liệu buyer (HS code, purchase_history, top_suppliers, peak_months, volume...)
 *   và supplier (certs, FDA, capacity, payment...) CHỈ dùng để tư duy nội bộ,
 *   đối chiếu và chọn góc tiếp cận phù hợp. TUYỆT ĐỐI KHÔNG được đưa raw data
 *   lên email — buyer sẽ cảm thấy bị soi thông tin.
 * - Sử dụng ngôn từ mềm mại, tiếp cận theo category/insight chung, không nêu
 *   cụ thể "tôi thấy bạn nhập HS 0801.32 từ Visimex 16,800kg peak Oct-Dec".
 * - Vexim định vị là đơn vị tư vấn tuân thủ cho doanh nghiệp Việt xuất khẩu
 *   vào Mỹ, đối tác được tuyển chọn là những đối tác chất lượng, đạt yêu cầu
 *   về tuân thủ Hoa Kỳ (FDA, HACCP, ISO, traceability...).
 *
 * Google Deliverability:
 * - Plain text, no links/images, no spam triggers, human sender, opt-out human
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

  // V3 fallback — soft compliance consulting positioning, no raw data exposure
  return {
    subject_en: `Vietnam sourcing — ${topic} with US compliance support`,
    content_en: [
      `Hi ${greetingName},`,
      "",
      `I'm ${ctx.senderName} with Vexim in Vietnam. We work as a compliance consulting partner for Vietnamese factories exporting to the US — helping them meet FDA, HACCP, and traceability requirements that US buyers expect.`,
      "",
      `For ${topic}, we only work with factories that have been through our compliance program and audit — direct factory, not trading companies.`,
      "",
      `Would you be open to exploring additional Vietnam sourcing with compliance support included? If now isn't the right time, no worries at all.`,
      "",
      OPT_OUT_EN,
      signature_en,
    ].join("\n"),
    content_vi: [
      `Xin chào ${greetingName},`,
      "",
      `Tôi là ${ctx.senderName} từ Vexim tại Việt Nam. Chúng tôi là đơn vị tư vấn tuân thủ cho các nhà máy Việt Nam xuất khẩu vào Mỹ — hỗ trợ họ đáp ứng các yêu cầu FDA, HACCP và truy xuất nguồn gốc mà buyer Mỹ yêu cầu.`,
      "",
      `Với ngành ${topic}, chúng tôi chỉ làm việc với các nhà máy đã qua chương trình tuân thủ và audit của Vexim — làm việc trực tiếp với nhà máy, không qua trading.`,
      "",
      `Bạn có muốn tìm hiểu thêm về nguồn cung từ Việt Nam với hỗ trợ tuân thủ không? Nếu hiện tại chưa phải thời điểm thích hợp thì cũng hoàn toàn không sao.`,
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
  // Internal reasoning context — for AI to THINK, NOT to expose
  // ------------------------------------------------------------------
  const buyerIntelInternal = {
    buyer_company: lead["company_name"],
    contact_person: lead["contact_person"],
    contact_title: (lead as any)["contact_title"] ?? null,
    main_product: lead["main_product"],
    hs_code: lead["hs_code"],
    secondary_hs_codes: (lead as any)["secondary_hs_codes"] ?? null,
    industry: lead["industry"],
    country: lead["country"],
    website: (lead as any)["website"] ?? null,
    // Deep fields — INTERNAL ONLY, never expose verbatim in email
    _internal_purchase_history: (lead as any)["purchase_history"] ?? null,
    _internal_top_suppliers: (lead as any)["top_suppliers"] ?? null,
    _internal_main_import_countries: (lead as any)["main_import_countries"] ?? null,
    _internal_top_peak_months: (lead as any)["top_peak_months"] ?? null,
    _internal_top_low_months: (lead as any)["top_low_months"] ?? null,
    _internal_total_shipments: (lead as any)["total_shipments"] ?? null,
    _internal_avg_teu_per_month: (lead as any)["avg_teu_per_month"] ?? null,
    _internal_origin_ports: (lead as any)["origin_ports"] ?? null,
    _internal_destination_ports: (lead as any)["destination_ports"] ?? null,
    _internal_bol_description: (lead as any)["bol_description"] ?? null,
    _internal_has_active_inquiry: (lead as any)["has_active_inquiry"] ?? null,
    _internal_inquiry_products: (lead as any)["inquiry_products"] ?? null,
    sender_name: profile.full_name,
    exporter_company: "Vexim",
    signature_company: SIGNATURE_COMPANY,
    signature_address: SIGNATURE_ADDRESS,
    sender_email: profile.work_email || "trade@veximtrade.com",
    // Vexim compliance consulting positioning — the CORE story
    vexim_positioning: {
      who_we_are: "Vexim is a compliance consulting partner for Vietnamese factories exporting to the US market — not a marketplace, not a trading company.",
      what_we_do: "We help Vietnamese manufacturers meet US compliance requirements: FDA registration, HACCP, ISO 22000, BRC, traceability from raw material to finished goods, lot tracking, food safety training, equipment calibration, water testing, audit readiness.",
      how_we_select: "We only work with factories we've physically visited and audited. We reject 80% of factories that apply. Only those meeting US compliance standards join our network. Direct factory, transparent pricing, no trading companies.",
      trust_pillars_soft: [
        "Compliance program for US market: FDA, HACCP, ISO, BRC, traceability",
        "Factory audit by Vexim team: direct factory, 50-300 workers typical, export since 2015+",
        "Quality system: traceability, QC engineers, food safety training, English export team",
        "Support: 24h response, video factory tour, flexible payment T/T and L/C at sight, transparent MOQ/lead time",
      ],
      differentiator: "Buyers don't just get a supplier — they get a supplier that has already been through US compliance consulting and audit. That's why our network is trusted for consistent quality.",
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

  const contextBlock = JSON.stringify(buyerIntelInternal, null, 2)

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
          "9. SOFT APPROACH: Do NOT expose internal buyer data (HS codes, supplier names, shipment counts, peak months) verbatim. Use soft language.",
        ].join("\n")
      : [
          "You write the FIRST, SOFT opening email a Vietnamese compliance consulting team (Vexim)",
          "sends to a new buyer lead. Vexim is NOT a marketplace or trading company — it is a compliance",
          "consulting partner for Vietnamese factories exporting to the US market.",
          "",
          "CORE POSITIONING (must be reflected naturally):",
          "Vexim = đơn vị tư vấn tuân thủ cho doanh nghiệp Việt xuất khẩu vào Mỹ. Đối tác Vexim tuyển chọn",
          "là những đối tác chất lượng, đạt yêu cầu về tuân thủ Hoa Kỳ: FDA registration, HACCP, ISO 22000,",
          "BRC, traceability từ nguyên liệu đến thành phẩm, lot tracking, food safety training, audit readiness.",
          "We only work with factories we've visited and audited. We reject 80% that apply. Direct factory,",
          "no trading companies. Buyers get US-compliant suppliers, not random quotes.",
          "",
          "GOAL OF THIS EMAIL:",
          "Briefly introduce Vexim as a compliance consulting partner, show you understand the buyer's",
          "category at a SOFT level (e.g., 'buyers in the cashew category', 'many buyers in your space')",
          "without exposing surveillance data, and end with exactly ONE CTA: whether the buyer would be open",
          "to evaluating additional Vietnam sourcing with compliance support.",
          "",
          "CRITICAL — SOFT APPROACH & DATA PRIVACY (do not violate):",
          "1. INTERNAL REASONING ONLY: You have internal buyer intelligence fields prefixed with _internal_",
          "   (purchase_history, top_suppliers, main_import_countries, peak_months, total_shipments,",
          "   hs_code, origin_ports...). These are FOR YOUR REASONING ONLY to choose the right angle.",
          "   NEVER mention them verbatim in the email. NEVER write 'I saw you import HS 0801.32 from",
          "   Visimex 16,800kg peak Oct-Dec' or 'I noticed you source from Vietnam and Chile' or 'your",
          "   120 shipments' or 'your HS code'. That makes buyer feel surveilled.",
          "2. SOFT LANGUAGE INSTEAD: Use category-level, peer insight language:",
          "   - BAD (surveillance): 'I noticed you import cashew W320 under HS 0801.32 from Vietnam and Chile, peak Oct-Dec, 120 shipments'",
          "   - GOOD (soft): 'We work with a number of buyers in the cashew category who are looking to strengthen their Vietnam supply with US-compliant factories'",
          "   - GOOD: 'Many buyers in your space tell us they want a Vietnam option that already meets FDA and traceability requirements'",
          "   - GOOD: 'For cashew W320, Vietnam offers strong options, but US compliance is where many factories fall short — that's where we help'",
          "3. NO RAW DATA EXPOSURE: Never expose: HS codes, specific supplier names, shipment counts, TEU, peak months, origin/destination ports, BOL descriptions, exact volumes, years. These are internal only.",
          "4. NO SUPPLIER SPECIFICS: No supplier has been chosen yet. Do NOT name, list, or describe any specific factory. Only reference Vexim's NETWORK and COMPLIANCE PROGRAM in general terms.",
          "5. VEXIM POSITIONING: Must convey compliance consulting, not marketplace. Use vexim_positioning from context. Example soft phrasing: 'We work as a compliance consulting partner for Vietnamese factories exporting to the US — helping them meet FDA, HACCP, and traceability requirements' or 'Our factories go through our US compliance program and audit before joining our network'.",
          "6. TRUST PILLARS — SOFT, NOT BROCHURE: Mention 1 compliance pillar naturally, not a list. E.g., 'FDA registration and traceability from raw material' or 'HACCP and audit readiness for US market'. Keep to ONE short clause.",
          "",
          "MANDATORY RULES:",
          "1. Exactly ONE CTA: whether the buyer is open to evaluating Vietnam sourcing with compliance support.",
          "2. Do NOT ask about product spec, target price, MOQ, payment terms, packaging.",
          "3. Do NOT invent facts not in context — no prices, quantities, certifications for specific supplier, capacity, delivery times, or claimed history with this buyer.",
          "4. Do NOT use forbidden claims: no 'FDA approved' as guarantee, no 'guaranteed', 'cheapest', 'best', 'top supplier', '#1'. You CAN say 'factories that have been through our FDA registration and HACCP compliance program' — factual about process.",
          "5. Do NOT mention attachments, catalogs, price lists, files.",
          "6. Vexim intro brief: 20-30% of content, woven naturally, not separate pitch paragraph. Compliance consulting angle, not trading.",
          "7. Professional, warm, consultative B2B tone — like a compliance advisor, not a sales rep. Sound like a specific person who understands US compliance challenges, not a mail-merge.",
          "8. No emoji. No excessive punctuation, no ALL CAPS.",
          "9. Total length: 120-170 words body (excluding signature). Concise, soft.",
          "10. Signature exact shape: blank line, 'Best regards,', sender_name, signature_company ('VEXIM GLOBAL CO., LTD'), sender_email, signature_address verbatim. No phone, no title, no placeholder.",
          "11. No 'Re:' subject prefix.",
          "12. No P.S., no forwarded framing, no second CTA.",
          "13. Use buyer's ACTUAL product/industry from context (main_product/industry) for soft category reference — e.g., 'buyers in the cashew category' — never hardcode unrelated product.",
          "14. If context missing, stay generic rather than fabricate.",
          "15. AVOID COLD SALES TEMPLATE SHAPE: Do not write greeting → company pitch paragraph → value prop → CTA → sign-off. That's Promotions classifier pattern. Write as one-off note: weave reason + Vexim context into same 1-2 sentences.",
          "16. No generic value-prop taglines like 'trusted sourcing partner', 'end-to-end solution'. Describe role plainly: 'We help Vietnamese factories meet US compliance requirements'.",
          "17. NO URL, LINK, IMAGE, BUTTON, ATTACHMENT in first email. Plain text only.",
          "18. ANTI-SPAM: never use 'free', 'discount', 'cheap', 'guarantee/guaranteed', '100%', 'act now', 'limited time', 'risk-free', 'no obligation', 'click here', 'unsubscribe', 'congratulations', 'dear friend', savings/ROI %. No ALL-CAPS, no exclamation, no emoji.",
          "19. CAN-SPAM: final sentence body before signature, human opt-out: 'If sourcing from Vietnam isn't on your radar right now, just reply \"no\" and I won't reach out again — no hard feelings at all.'",
          "20. DATA PRIVACY SELF-CHECK: Before finalizing, verify you did NOT include: HS codes, specific supplier names, shipment counts, TEU, peak months, origin/destination ports, BOL descriptions, exact volumes/years, purchase_history details. If any such raw data appears, rewrite to soft category language.",
          "",
          "AMERICAN BUSINESS VOICE:",
          "- Greet by first name 'Hi {first name},' if known, else 'Hi there,'. Never 'Dear Sir/Madam'.",
          "- Natural contractions (I'm, you're, we've), plain words, short paragraphs 1-3 sentences.",
          "- Avoid stiff phrases: 'I hope this email finds you well', 'I am writing to...', 'kindly', 'please revert', 'whilst', 'do the needful', 'esteemed company'.",
          "- Never mention databases, customs records, scraping, AI, scores, CRM fields, or HOW buyer was found beyond light 'I came across {company} while looking into {category} buyers' or 'We work with buyers in the {category} space'.",
          "- Low-friction ask with easy out: 'Would you be open to exploring...? If now isn't the right time, no worries at all.'",
          "- Subject: short, human, sentence case, specific to category with compliance angle, under 50 chars, e.g., 'Vietnam {category} — US compliance support' or 'Sourcing {category} from Vietnam'. No Title Case, no Re:/Fwd.",
          "",
          "STRUCTURE (connected prose, not template blocks):",
          "1. Greeting by first name.",
          "2. Open with soft category insight + who you are/Vexim compliance consulting in same sentence or next, briefly (20-30%). E.g., 'Hi John, I'm Hoc with Vexim in Vietnam — we work as a compliance consulting partner for Vietnamese factories exporting to the US, and we work with a number of buyers in the cashew category who want a Vietnam option that already meets FDA and traceability requirements.'",
          "3. One sentence plainly worded on Vexim compliance program relevant to this buyer's category — e.g., 'Our factories go through our US compliance program (FDA registration, HACCP, traceability from raw material) and audit before joining our network — direct factory, not trading companies.'",
          "4. Single CTA: ask clearly whether buyer would be open to evaluating additional Vietnam sourcing with compliance support for their product/industry.",
          "5. Low-pressure closing with easy out.",
          "6. Opt-out sentence.",
          "7. Complete signature.",
          "",
          "WRITING STYLE:",
          "Concise, plain American business English, active voice, short sentences/paragraphs. Confident but soft, compliance advisor tone, not pushy sales. No jargon, no filler adjectives, no hype. Write like a specific person emailing one specific contact who cares about US compliance, not like template.",
          "",
          "SELF-CHECK BEFORE RETURNING:",
          "Verify: one CTA only; no MOQ/price/payment/packaging/spec question; no supplier named; no raw buyer data exposed (HS, supplier names, shipment counts, peak months, ports, volumes, years); no fabricated fact; no forbidden claim; no URL/attachment; no spam vocab/caps/exclamation/emoji; greeting first name; opt-out present before signature; Vexim intro brief (20-30%) and compliance consulting angle, woven naturally, not standalone pitch; soft category language, not surveillance; length 120-170 words; signature exact name / VEXIM GLOBAL CO., LTD / email / address no phone. If fail, rewrite.",
        ].join("\n")

  const userPrompt = [
    "Buyer context (JSON) — INTERNAL REASONING ONLY, do NOT expose _internal_ fields verbatim in email:",
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
        : `Giới thiệu ngắn gọn về Vexim — đơn vị tư vấn tuân thủ cho doanh nghiệp Việt xuất khẩu vào Mỹ, đối tác được tuyển chọn chất lượng đạt yêu cầu tuân thủ Hoa Kỳ. Hỏi buyer có muốn đánh giá thêm nguồn cung ${
            (lead["industry"] as string | null) || (lead["main_product"] as string | null) || "sản phẩm liên quan"
          } từ Việt Nam với hỗ trợ tuân thủ không. Dùng dữ liệu buyer nội bộ để chọn góc tiếp cận mềm mại, TUYỆT ĐỐI KHÔNG đưa raw data (HS code, tên supplier, số lượng, peak months) lên email. KHÔNG hỏi MOQ, giá, thanh toán, bao bì.`),
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
      // Internal only — never expose verbatim
      _internal_hs_code: lead["hs_code"],
      _internal_purchase_history: (lead as any)["purchase_history"] ?? null,
      _internal_main_import_countries: (lead as any)["main_import_countries"] ?? null,
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
      vexim_positioning: {
        who_we_are: "Compliance consulting partner for Vietnamese factories exporting to US — not marketplace",
        compliance_program: "FDA registration, HACCP, ISO 22000, BRC, traceability, lot tracking, audit readiness",
        selection: "Only audited factories meeting US compliance join network, direct factory, no trading",
      },
    },
    null,
    2,
  )

  const system = [
    "You write short, professional B2B sourcing emails for a Vietnamese compliance consulting team (Vexim).",
    "This is a REPLY within an existing email thread with a buyer — the buyer's most recent",
    "message is given as buyer_message_en in the JSON below. Answer exactly what the buyer asked or raised.",
    "Do not re-ask the original requirement questions unless AE instruction explicitly says information is still missing.",
    "Follow the AE's Vietnamese instruction for what points to address.",
    "Never invent facts (prices, certifications, capacity) not present in context — if unsure, phrase as 'we will confirm'.",
    "No emoji. No excessive punctuation. Soft approach — do NOT expose internal buyer data (HS codes, supplier names, shipment counts) verbatim.",
    "Write in natural American business English: greet by first name, use contractions, keep paragraphs to 1-3 sentences.",
    "Close with exactly this signature: 'Best regards,' / sender_name / 'VEXIM GLOBAL CO., LTD' / sender_email / signature_address.",
    "Never add phone number or job title line, and never add opt-out line to an active conversation.",
    "Vexim positioning: compliance consulting for Vietnamese factories exporting to US, partners meet US compliance (FDA, HACCP, traceability). Mention briefly if relevant to buyer's question, but keep soft and factual.",
  ].join("\n")

  const userPrompt = [
    "Conversation + buyer context (JSON) — _internal_ fields are for reasoning only, do NOT expose verbatim:",
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
