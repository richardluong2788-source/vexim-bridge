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
 * - Brand trong thân bài: Veximtrade (khớp domain veximtrade.com); pháp nhân
 *   VEXIM GLOBAL CO., LTD chỉ ở signature. Veximtrade định vị là nền tảng tư vấn tuân thủ cho doanh nghiệp Việt xuất khẩu
 *   vào Mỹ, đối tác được tuyển chọn là những đối tác chất lượng, đạt yêu cầu
 *   về tuân thủ Hoa Kỳ (FDA, HACCP, ISO, traceability...).
 *
 * Google Deliverability:
 * - Plain text, no links/images, no spam triggers, human sender, opt-out human
 */

import { generateText, Output } from "ai"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getSoftProductDescription, getSoftSeasonalityHook, getSeasonalCapacityAngle } from "@/lib/ai/vexim-positioning"
import { buildPitchDeliveryLine } from "@/lib/buyers/pitch-helpers"

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
  `If sourcing from Vietnam isn't on your radar right now, just reply 'no' and I won't reach out again.`
const OPT_OUT_VI =
  `Nếu nguồn cung từ Việt Nam hiện chưa nằm trong kế hoạch của bạn, chỉ cần trả lời "không", tôi sẽ không gửi email lại.`

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
  /** 095: câu mở theo nhu cầu + matched product (buyer chủ động) — null với cold. */
  pitchLine?: string | null
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
    // 095 — Buyer chủ động + matched product: dẫn email bằng nhu cầu + sản phẩm
    // (cùng dữ liệu đã đóng băng trong pitch; không giá, không tên supplier).
    if (ctx.pitchLine) {
      return {
        subject_en: `${ctx.industryOrProduct?.trim() || "Sourcing"} — factory profile to review`,
        content_en: [
          `Hi ${greetingName},`,
          "",
          ctx.pitchLine,
          "",
          `I've put the factory's full profile together here: ${ctx.shortlistUrl || ""}. Take a look and let me know if the direction looks right.`,
          signature_en,
        ].join("\n"),
        content_vi: [
          `Xin chào ${greetingName},`,
          "",
          ctx.pitchLine,
          "",
          `Hồ sơ đầy đủ của nhà máy tại đây: ${ctx.shortlistUrl || ""} — anh/chị xem và cho em biết nếu hướng này phù hợp nhé.`,
          signature_vi,
        ].join("\n"),
      }
    }
    return {
      subject_en: `Supplier shortlist prepared for ${ctx.buyerCompany || "your company"}`,
      content_en: [
        `Hi ${greetingName},`,
        "",
        "Thank you for sharing your sourcing requirements with us. We have reviewed them and prepared a shortlist of pre-vetted suppliers for your consideration.",
        "",
        `You can view each supplier's profile here: ${ctx.shortlistUrl || ""}. Just let us know which one(s) you would like to move forward with.`,
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

  // V5 fallback — same DIRECT TEMPLATE the AI is asked to produce (095/V5)
  const foodWords = /(food|seafood|fruit|nut|cashew|coffee|pepper|rice|spice|durian|mango|banana|shrimp|fish|poultry|meat|dairy|beverage|tea|agri)/i
  const audienceEn = foodWords.test(topic) ? `U.S. ${topic.split(/\s+/)[0]} buyers` : `U.S. buyers in ${topic}`
  return {
    subject_en: `Vietnam ${topic} — supplier option`,
    content_en: [
      `Hi ${greetingName},`,
      "",
      `I'm ${ctx.senderName} with Veximtrade in Vietnam. We work with Vietnamese manufacturers on U.S. regulatory compliance and sourcing.`,
      "",
      `We're currently working with a small number of verified suppliers in Vietnam for ${audienceEn}. We check product fit and U.S. import requirements before introducing a supplier.`,
      "",
      `I came across ${ctx.buyerCompany || "your company"} while researching U.S. buyers in ${topic}.`,
      "",
      `If you're currently considering Vietnam as a source for ${topic}, I can send you a relevant supplier option for a quick look.`,
      "",
      "If purchasing isn't the right inbox on your side, I'd appreciate a quick forward, or just point me to the right contact.",
      "",
      OPT_OUT_EN,
      signature_en,
    ].join("\n"),
    content_vi: [
      `Xin chào ${greetingName},`,
      "",
      `Tôi là ${ctx.senderName} với Veximtrade tại Việt Nam. Chúng tôi làm việc với các nhà máy Việt Nam về tuân thủ quy định và sourcing cho thị trường Mỹ.`,
      "",
      `Hiện chúng tôi đang làm việc với một số ít supplier đã xác minh tại Việt Nam cho ${audienceEn.includes("buyers in") ? `các buyer Mỹ trong ngành ${topic}` : "các buyer Mỹ"}. Chúng tôi kiểm tra độ phù hợp sản phẩm và yêu cầu nhập khẩu Mỹ trước khi giới thiệu.`,
      "",
      `Tôi tình cờ thấy ${ctx.buyerCompany || "công ty anh/chị"} khi nghiên cứu các buyer Mỹ trong ngành ${topic}.`,
      "",
      `Nếu anh/chị đang cân nhắc Việt Nam là nguồn cung cho ngành hàng này, tôi có thể gửi một phương án nhà cung cấp phù hợp để anh/chị xem nhanh.`,
      "",
      `Nếu đây không phải hộp thư của bộ phận mua hàng, anh/chị chuyển tiếp giúp hoặc cho tôi biết email bộ phận phù hợp đều được, cảm ơn anh/chị.`,
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

  // 095 — Email pitch dẫn bằng sản phẩm: với shortlist_delivery, đọc matched_product
  // đã ĐÓNG BĂNG trong version pitch (status sent) của engagement — cùng nguồn dữ
  // liệu với share page nên email và trang luôn nhất quán. Chỉ áp dụng buyer chủ
  // động (has_active_inquiry); buyer cold/research giữ nguyên framing V4.
  let pitchLine: string | null = null
  if (emailType === "shortlist_delivery") {
    const { data: pitchItems } = await supabase
      .from("buyer_engagement_shortlist_items")
      .select(
        "supplier_profile_snapshot, buyer_engagement_shortlist_versions!inner ( engagement_id, status, created_at )",
      )
      .eq("buyer_engagement_shortlist_versions.engagement_id", input.engagementId)
      .eq("buyer_engagement_shortlist_versions.status", "sent")
      .eq("role", "primary")
      .order("buyer_engagement_shortlist_versions.created_at", { ascending: false })
      .limit(1)
    const snap = (pitchItems?.[0] as { supplier_profile_snapshot?: { matched_product?: unknown } } | undefined)
      ?.supplier_profile_snapshot
    const mp = (snap?.matched_product ?? null) as
      | { product_name: string; key_specifications?: string | null; moq?: string | null; lead_time?: string | null }
      | null
    const inquiry =
      lead["has_active_inquiry"] ? ((lead["inquiry_products"] as string | null) ?? null) : null
    pitchLine = buildPitchDeliveryLine({ inquiryProducts: inquiry, matchedProduct: mp })
  }

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
  // Internal reasoning + soft 60/40 context — V4
  // ------------------------------------------------------------------
  const now = new Date()
  const mainProductRaw = (lead["main_product"] as string | null) ?? null
  const peakMonthsRaw = (lead as any)["top_peak_months"] as string | null ?? null
  const productSoft = getSoftProductDescription(mainProductRaw)
  const seasonHook = getSoftSeasonalityHook(peakMonthsRaw, now)
  const buyerCategory =
    (lead["industry"] as string | null)?.trim() ||
    ((lead as any)["inquiry_products"] as string | null)?.trim() ||
    productSoft ||
    "your product category"
  const capacityAngle = getSeasonalCapacityAngle(seasonHook)

  const buyerIntelInternal = {
    buyer_company: lead["company_name"],
    contact_person: lead["contact_person"],
    contact_title: (lead as any)["contact_title"] ?? null,
    main_product: lead["main_product"],
    main_product_soft: productSoft,
    buyer_category: buyerCategory,
    industry: lead["industry"],
    country: lead["country"],
    website: (lead as any)["website"] ?? null,
    // Current date for seasonality reasoning
    current_date: now.toISOString().split("T")[0],
    current_month: now.getMonth() + 1,
    season_hook_soft: seasonHook,
    capacity_angle_soft: capacityAngle,
    // Example of desired 40% insight (soft, not surveillance) — AI should adapt, not copy verbatim
    example_40_percent: `I noticed ${lead["company_name"] || "your company"} has a strong presence in ${productSoft} for the US market. As we approach ${seasonHook}, ${capacityAngle}.`,
    // Deep fields — INTERNAL ONLY, never expose verbatim in email
    _internal_hs_code: lead["hs_code"] ?? null,
    _internal_secondary_hs_codes: (lead as any)["secondary_hs_codes"] ?? null,
    _internal_purchase_history: (lead as any)["purchase_history"] ?? null,
    _internal_top_suppliers: (lead as any)["top_suppliers"] ?? null,
    _internal_main_import_countries: (lead as any)["main_import_countries"] ?? null,
    _internal_top_peak_months: peakMonthsRaw,
    _internal_top_low_months: (lead as any)["top_low_months"] ?? null,
    _internal_total_shipments: (lead as any)["total_shipments"] ?? null,
    _internal_avg_teu_per_month: (lead as any)["avg_teu_per_month"] ?? null,
    _internal_origin_ports: (lead as any)["origin_ports"] ?? null,
    _internal_destination_ports: (lead as any)["destination_ports"] ?? null,
    _internal_bol_description: (lead as any)["bol_description"] ?? null,
    _internal_has_active_inquiry: (lead as any)["has_active_inquiry"] ?? null,
    _internal_inquiry_products: (lead as any)["inquiry_products"] ?? null,
    sender_name: profile.full_name,
    exporter_company: "Veximtrade",
    signature_company: SIGNATURE_COMPANY,
    signature_address: SIGNATURE_ADDRESS,
    sender_email: profile.work_email || "trade@veximtrade.com",
    // Veximtrade positioning context — AI dùng để tư duy/ngôn ngữ mềm, không raw data
    vexim_positioning: {
      who_we_are: "Veximtrade is a compliance consulting platform for Vietnamese factories exporting to the US market — not a marketplace, not a trading company.",
      what_we_do: "We help Vietnamese manufacturers meet US compliance requirements: FDA registration, HACCP, ISO 22000, BRC, traceability from raw material to finished goods, lot tracking, food safety training, audit readiness.",
      how_we_select: "We only work with factories we've physically visited and audited. We reject 80% of factories that apply. Only those meeting US compliance standards join our network. Direct factory, transparent pricing, no trading companies.",
      trust_pillars_soft: [
        "Compliance program for US market: FDA, HACCP, ISO, BRC, traceability",
        "Factory audit by the Veximtrade team: direct factory, 50-300 workers typical, export since 2015+",
        "Quality system: traceability, QC engineers, food safety training, English export team",
        "Support: 24h response, video factory tour, flexible payment T/T and L/C at sight, transparent MOQ/lead time",
      ],
      differentiator: "Buyers don't just get a supplier — they get a supplier that has already been through US compliance consulting and audit.",
      example_60_percent: "We work as a compliance consulting partner for Vietnamese factories exporting to the US — helping them meet FDA, HACCP, and traceability requirements. Our factories go through our US compliance program and audit before joining our network — direct factory, not trading companies, only those meeting US standards.",
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
    // 095: câu mở theo nhu cầu + matched product — chỉ có ở shortlist_delivery
    // khi buyer CHỦ ĐỘNG có active inquiry và pitch có matched_product đạt ngưỡng.
    ...(emailType === "shortlist_delivery" ? { pitch_product_line: pitchLine } : {}),
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
          "Keep it short (80-140 words), confident, and action-oriented.",
          "PUNCTUATION: no em dashes (—) or en dashes (–) in the email body; use periods and commas.",
          "AVOID AI-STYLE PHRASING: never write 'no hard feelings', 'I'd be delighted to', 'I'd love to', 'feel free to'. Plain, human, direct.",
          "End with a complete",
          "signature using sender_name / signature_company / sender_email / signature_address from",
          "context, in that order — never use placeholders and never include a phone number. This",
          "buyer already replied with requirements, so do NOT add an opt-out line. Never invent",
          "facts not present in context. No emoji.",
          "",
          "PITCH PRODUCT LINE (context pitch_product_line): If pitch_product_line is present (non-null), this buyer proactively asked about a product and we selected ONE factory that matches. OPEN the email by adapting that line naturally (it already contains the buyer's requirement, the matched product name and 1-2 key specs/MOQ/lead time — use only what it contains, do NOT invent extra specs). Use soft wording — 'matches your requirement' is right; NEVER claim 'exactly', never add prices, never name the supplier company (say 'the factory'). Then reference the profile link inline (see link rule below) and close with a short low-pressure ask ('let me know if the direction looks right'). Keep the total body within 80-140 words. If pitch_product_line is null or absent, do NOT mention any specific product — follow the generic framing (a shortlist has been prepared).",
          "",
          "PRESENT THE LINK LIKE A PERSON, NOT LIKE A MARKETING CTA BUTTON. Reference it inline as",
          "part of a normal sentence (e.g. 'I've put together a shortlist for you here: <url>' or",
          "'you can review it at <url>'), never as an isolated imperative line like 'View your",
          "shortlist now!' or 'Click here'. Do not put the link on its own line with no surrounding",
          "sentence, and do not use exclamation marks or urgency language around it.",
        ].join("\n")
      : emailType === "requirement_followup"
      ? [
          "You write short, polite follow-up B2B emails for the Veximtrade team (Vietnamese export / regulatory & sourcing platform). Body says Veximtrade — never 'Vexim' or 'Vexim Global'; the legal entity stays in the signature only.",
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
          "   radar right now, just reply 'no' and I won't reach out again.' Never make it look",
          "   like a legal footer.",
          "8. American business voice: greet by first name ('Hi {first name},'), use natural",
          "   contractions (I'm, you've), short sentences, and no stiff phrases ('I hope this",
          "   email finds you well', 'kindly', 'dear friend'). Sound like a real person following",
          "   up, not a marketing sequence.",
          "9. SOFT APPROACH: Do NOT expose internal buyer data (HS codes, supplier names, shipment counts, peak months) verbatim. Use soft language.",
          "10. PUNCTUATION: no em dashes (—) or en dashes (–) in the email body. Use periods and commas. Write like a real B2B person: short plain sentences, normal connectors.",
          "11. AVOID AI-STYLE PHRASING: never use polished marketing phrases such as 'no hard feelings', 'I'd be delighted to', 'I'd love to', 'feel free to', 'I hope this email finds you well'. Say things plainly or drop the line.",
        ].join("\n")
      : [
          "You write the FIRST, SHORT opening email for Veximtrade (the Vietnam regulatory & sourcing platform run by VEXIM GLOBAL CO., LTD) to a new U.S. buyer lead. V5.2 — DIRECT TEMPLATE, human tone: the buyer should feel a real AE reached out, not a marketing engine. Test signals: right buyer, right contact, real relevance.",
          "",
          "WRITE THE EMAIL IN EXACTLY THIS SHAPE — greeting + 5 short paragraphs + opt-out, adapting the bracketed fields from context, nothing more:",
          "",
          "G: Hi {contact_first_name},",
          "P1: I'm {sender_name} with Veximtrade in Vietnam. We work with Vietnamese manufacturers on U.S. regulatory compliance and sourcing.",
          "P2: We're currently working with a small number of verified suppliers in Vietnam for U.S. {category} buyers. We check product fit and U.S. import requirements before introducing a supplier.",
          "P3: I came across {buyer_company} while researching U.S. buyers in {buyer_category}.",
          "P4: If you're currently considering Vietnam as a source for {buyer_product}, I can send you a relevant supplier option for a quick look.",
          "P5: If purchasing isn't the right inbox on your side, I'd appreciate a quick forward, or just point me to the right contact.",
          "",
          "FIELD RULES:",
          "1. {contact_first_name} = first name of contact_person from context. If no contact name exists, write 'Hi there,' — never a placeholder like '[Name]'.",
          "2. {sender_name} = sender_name from context (first name is fine). Never a placeholder.",
          "3. {buyer_company} = the buyer's company name from context. If missing, write 'your company' — never invent a name.",
          "4. {buyer_category} = the buyer's product category in natural wording (use buyer_category / main_product_soft from context, e.g. 'premium cashew kernels', 'frozen seafood'). Lowercase, plain wording, no HS codes.",
          "5. {buyer_product} = the same category/product wording as P3 — keep it consistent, do not introduce a different product.",
          "6. {category} in P2 = a BROAD market noun derived from buyer_category, e.g. agriculture, seafood, coffee, food, nuts. If no natural broad noun exists, write 'U.S. buyers in {buyer_category}' instead of 'U.S. {category} buyers'.",
          "",
          "HARD RULES:",
          "1. P5 comes AFTER P4 and BEFORE the opt-out. The opt-out is its own short line, peer tone not a legal footer: 'If this isn't relevant right now, just reply no and I won't follow up.'",
          "2. ONE ask-set: P4's offer (review a supplier option) + P5's routing request. Never ask about MOQ/price/payment/packaging/spec.",
          "3. Do NOT invent facts: no supplier names, no specific factory certifications, no prices/volumes, no claim of prior contact. P3 is the ONLY reference to how the buyer was found — never mention customs records, databases, shipment counts, TEU, peak months, ports, or HS codes.",
          "4. 'verified Vietnam suppliers' is allowed because it refers to Veximtrade's audit-before-introduction process — never upgrade it into stronger claims ('FDA approved', 'guaranteed', 'best', '#1' are forbidden).",
          "5. BRAND NAMING: the body says 'Veximtrade' (matches the veximtrade.com sender domain). 'VEXIM GLOBAL CO., LTD' is the legal entity and appears ONLY in the signature line — never write 'Vexim' or 'Vexim Global' in the body.",
          "6. No URL, link, image, or attachment. Plain text only.",
          "7. No emoji, no ALL CAPS, no exclamation marks, no spam vocabulary ('free', 'discount', '100%', 'act now', 'limited time', ...).",
          "8. Total body 90-150 words INCLUDING the opt-out line. Short is the point, do not pad with extra sentences or adjectives.",
          "9. Signature exact shape after a blank line: 'Best regards,' / sender_name / 'VEXIM GLOBAL CO., LTD' / sender_email / signature_address — verbatim from context, no phone, no title, no placeholder.",
          "10. Subject: short, human, sentence case, under 50 chars, category-specific, e.g. 'Vietnam {category}: supplier option' or 'Verified {category} suppliers for U.S. buyers'. No Re:/Fwd:, no Title Case.",
          "11. Tone: plain, direct, calm American business English. The template above is ALREADY the correct voice — do not embellish it with marketing adjectives or additional paragraphs.",
          "12. PUNCTUATION: no em dashes (—) or en dashes (–) anywhere in the email body. Use periods and commas. An em dash in prose is a strong AI-generated tell; real B2B emails use plain sentence breaks.",
          "13. AVOID AI-STYLE PHRASING: never use polished marketing phrases such as 'no hard feelings', 'I'd be delighted to', 'I'd love to', 'feel free to', 'I hope this email finds you well', 'seamless', 'elevate', 'empower'. Say things plainly or drop the line.",
          "",
          "SELF-CHECK: greeting + exactly P1→P5 in order + opt-out line + signature; every field filled from context; food/non-food adaptation applied in P2; no invented facts; no forbidden claims; no URL; no em/en dash anywhere; no banned polished phrases; 100-160 words total. If any check fails, rewrite.",
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
        : `Viết email mở đầu theo đúng mẫu V5.1 (tham khảo buyer_category + contact_person trong context): mở đầu "Hi {tên contact}," (không có tên thì "Hi there,") → P1 giới thiệu bản thân + Veximtrade (nền tảng regulatory & sourcing của Vexim Global tại Việt Nam — thân bài chỉ viết Veximtrade, pháp nhân VEXIM GLOBAL CO., LTD chỉ ở signature) → P2 đang làm việc với một số ít supplier đã xác minh ở Việt Nam cho buyer Mỹ (danh từ ngành rộng: agriculture/seafood/coffee...; không có danh từ tự nhiên thì viết "U.S. buyers in {ngành}") → P3 'I came across {công ty} while researching U.S. buyers in {ngành}' → P4 'Nếu anh/chị đang cân nhắc Việt Nam làm nguồn cung cho {ngành}, tôi có thể gửi 1 phương án nhà cung cấp phù hợp để xem nhanh' → P5 "Nếu đây không phải hộp thư bộ phận mua hàng, nhờ chuyển tiếp giúp hoặc cho biết email bộ phận phù hợp". TUYỆT ĐỐI KHÔNG đưa raw data (HS code, tên supplier, số lượng, peak months) lên email. KHÔNG hỏi MOQ, giá, thanh toán, bao bì.`),
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
      senderName: profile.full_name || "Veximtrade Team",
      exporterCompany: "Veximtrade",
      senderEmail: profile.work_email || "trade@veximtrade.com",
      buyerCompany: lead["company_name"] as string | null,
      contactPerson: lead["contact_person"] as string | null,
      industryOrProduct: (lead["industry"] as string | null) || (lead["main_product"] as string | null),
      shortlistUrl: input.shortlistUrl,
      pitchLine,
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
      exporter_company: "Veximtrade",
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
    "You write short, professional B2B sourcing emails for the Veximtrade compliance consulting team (platform by VEXIM GLOBAL CO., LTD). Body says Veximtrade; the legal entity appears only in the signature.",
    "This is a REPLY within an existing email thread with a buyer — the buyer's most recent",
    "message is given as buyer_message_en in the JSON below. Answer exactly what the buyer asked or raised.",
    "Do not re-ask the original requirement questions unless AE instruction explicitly says information is still missing.",
    "Follow the AE's Vietnamese instruction for what points to address.",
    "Never invent facts (prices, certifications, capacity) not present in context — if unsure, phrase as 'we will confirm'.",
    "No emoji. No excessive punctuation. Soft approach — do NOT expose internal buyer data (HS codes, supplier names, shipment counts) verbatim.",
    "Write in natural American business English: greet by first name, use contractions, keep paragraphs to 1-3 sentences.",
    "Close with exactly this signature: 'Best regards,' / sender_name / 'VEXIM GLOBAL CO., LTD' / sender_email / signature_address.",
    "Never add phone number or job title line, and never add opt-out line to an active conversation.",
    "Veximtrade positioning: compliance consulting for Vietnamese factories exporting to US, partners meet US compliance (FDA, HACCP, traceability). Mention briefly if relevant to buyer's question, but keep soft and factual.",
    "PUNCTUATION: no em dashes (—) or en dashes (–) in the email body; use periods and commas. Write like a real person, not a polished AI draft.",
    "AVOID AI-STYLE PHRASING: never write 'no hard feelings', 'I'd be delighted to', 'I'd love to', 'feel free to'. Plain, human, direct.",
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
      senderName: profile.full_name || "Veximtrade Team",
      exporterCompany: "Veximtrade",
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
