// Cold-outreach EmailAgent (spec §11, §12) cho campaign engine.
//
// Điểm khác với email-generator.ts hiện có (pipeline opportunity):
//   - Input là BuyerContext chuẩn (context-builder) + objective của step.
//   - Prompt chống bịa TUYỆT ĐỐI (spec §20): UNKNOWN không được điền.
//   - KHÔNG lặp nội dung email trước (anti-repeat từ previous_emails).
//   - Follow-up theo chiến lược §12: reinforce → reduce friction → close-loop.
//
// Shadow mode: output của hàm này KHÔNG BAO GIỜ tự gửi — caller (scheduler)
// chỉ tạo email_drafts 'pending_approval'. Việc gửi chỉ qua AE duyệt
// (lib/campaign/approve.ts → sendEmailDraft hiện có).

import { generateText, Output } from "ai"
import { z } from "zod"
import { APPROVED_VEXIM_CLAIMS, SIGNATURE_ADDRESS, SIGNATURE_COMPANY, SIGNATURE_WEBSITE } from "./constants"
import type { BuyerContext } from "./types"
const outputSchema = z.object({
  subject_en: z.string().describe("Email subject, plain content only, like a person typing quickly: 3-7 words, sentence case, under 50 characters. Punctuation limited to at most a comma or period; never dashes, colons, semicolons, quotes or parentheses. No Re:/Fwd:, no ALL CAPS, no promo words (option, offer, deal, exclusive)."),
  content_en: z.string().describe("Full email body in English, plain text: greeting + 2-3 uneven natural paragraphs (related sentences grouped, paragraphs may run a few lines, lengths need not match) + opt-out line where required + signature block. Not one idea per paragraph."),
  content_vi: z.string().describe("Vietnamese translation of the email body for internal AE review."),
})

export type GeneratedCampaignEmail = {
  subjectEn: string
  contentEn: string
  contentVi: string
  model: string
}

const STEP_TYPE_GUIDANCE: Record<string, string> = {
  initial_outreach: `INITIAL OUTREACH — follow this campaign step's objective and its campaign-specific additional guidance; those define the campaign's message and positioning. Personalize only with real values from Buyer Context (contact, company, category/product) when present; never print placeholders or UNKNOWN, expose raw import data, invent buyer intent, or claim unsupported Vexim/supplier facts. Keep the CTA low-pressure and appropriate to the campaign.`,
  follow_up: `FOLLOW-UP — follow this campaign step's objective and campaign-specific additional guidance; they define this step's angle. Use crm.previous_emails to avoid repeating a subject, opening, or main point, and refer back only where natural. Keep it shorter than the initial email, low-pressure, and include the required soft opt-out line. Personalize only with real Buyer Context values; never print placeholders/UNKNOWN or raw customs data.`,
  close_loop: `CLOSE-LOOP — follow this campaign's step guidance, close the sequence politely, and give the buyer an easy way to decline. State that no reply is needed when required by the campaign guidance; do not end with a question or force a choice. Use only verified Buyer Context and approved Vexim facts.`,
  nurture: `NURTURE — follow the campaign-specific guidance. Keep the check-in low-pressure, factual and personalized only from known Buyer Context; do not imply a prior conversation that is not in context.`,
}

function formatContextBlock(ctx: BuyerContext): string {
  return JSON.stringify(ctx, null, 2)
}

/**
 * Signature chuẩn Gmail/CAN-SPAM: tên người thật (khớp From header — AE owner
 * qua buildPersonalizedSender) + công ty + ĐỊA CHỈ THẬT (bắt buộc CAN-SPAM).
 */
function buildSignature(senderName?: string | null): string {
  return [
    "",
    "Best regards,",
    senderName?.trim() || "Veximtrade",
    SIGNATURE_COMPANY,
    SIGNATURE_ADDRESS,
    SIGNATURE_WEBSITE,
  ].join("\n")
}

/**
 * Sinh email cho một bước của enrollment. Ném Error khi AI fail — caller
 * (scheduler) đánh dấu firing 'failed' để retry.
 */
export async function generateCampaignEmail(
  ctx: BuyerContext,
  stepType: string,
  stepGuidance: string | null,
  senderName?: string | null,
): Promise<GeneratedCampaignEmail> {
  const system = [
    "You are Veximtrade's B2B sales assistant writing cold outreach emails to US import buyers for Veximtrade, the Vietnam-based regulatory & sourcing platform run by VEXIM GLOBAL CO., LTD.",
    "Veximtrade works with Vietnamese manufacturers on U.S. regulatory compliance and sourcing — not a marketplace, not a trading company.",
    "",
    "NORTH STAR: the email works because it is genuinely relevant — a real angle grounded in THIS buyer's context and the campaign's positioning — not because it tricks a spam filter. Never optimize for 'sounding human'; optimize for being worth a reply. Every sentence must be explainable by something in the context or an approved fact.",
    "",
    "ABSOLUTE PROHIBITIONS (spec §20) — you must NOT invent:",
    "- product requirements, certifications, FDA status, prices, MOQs, supplier capabilities, buyer intentions, shipment data, relationships, or previous conversations",
    "- If a context field is \"UNKNOWN\" it stays unknown: write around it or omit it entirely. NEVER fill in a plausible-sounding value.",
    "- NEVER expose raw import data: no HS codes, no shipment counts, no supplier names from customs records, no exact peak months. Use soft category-level language only.",
    "- NEVER assert a market/category trend (growing, increasing, expanding, rising, surging, booming, 'more and more', 'rapidly'). The context contains no verified trend data. Use neutral statements or conditional framing instead (\"if adding a Vietnamese origin is on your roadmap...\").",
    "- The research section (buyer_analysis/buyer_strategy) is INTERNAL REASONING ONLY — use it to pick an angle, never to state facts in the email.",
    "- Tailor the angle to THIS campaign: respect its target_segment, product_category and positioning (campaign block in context). Do not drift into a generic pitch.",
    "",
    "FACTS ABOUT VEXIM (whitelist — state ONLY these, lightly paraphrased, never embellished):",
    ...APPROVED_VEXIM_CLAIMS.map((c) => `- ${c}`),
    "- Nothing else about Vexim: no superlatives (leading, best, largest, premier...), no counts (X factories, X years, X buyers), no certifications beyond the services above (no ISO/BRC/SQF claims), no audit depth beyond 'audited before introduction'.",
    "IDENTITY: in the body, call the company \"Veximtrade\" (matches the veximtrade.com sender domain). The legal entity \"VEXIM GLOBAL CO., LTD\" appears ONLY in the signature block. Never write \"Vexim\" or \"Vexim Global\" in the body.",
    "",
    "DELIVERABILITY RULES (spec §22):",
    "- Plain text only. No links, no images, no attachments, no HTML, no emoji.",
    "- No spam trigger words (free, guarantee, discount, act now, risk-free, congratulations).",
    "- PUNCTUATION: no em dashes (—) or en dashes (–) anywhere in the email body. Use periods and commas. An em dash in prose is a strong AI-generated tell.",
    "- AVOID AI-STYLE PHRASING: never write 'no hard feelings', 'I'd be delighted to', 'I'd love to', 'feel free to', 'I hope this email finds you well'. Plain, human, direct.",
    "- NATURAL PARAGRAPHING: write like a real AE typing a one-to-one email. Do NOT put every sentence on its own line; group related sentences into 2-3 uneven paragraphs (a paragraph can be 2-4 sentences, a few lines long; lengths need not match). Perfect symmetric structure (intro, company, why you, offer, CTA) reads as AI copywriting. Sentences may flow long with 'and / but / so / while'. Optimize for naturalness and relevance, not polished copy. A cold email only needs enough context to start the conversation.",
    "- SUBJECT (deliverability-critical): plain content only, like a person typing quickly. 3-7 words naming the category or the buyer's world (e.g. 'Vietnam agriculture sourcing', 'Rice supply question'). Punctuation limited to at most a comma or period; NEVER em/en dashes, colons, semicolons, quotes, parentheses or question marks. No Title Case, no Re:/Fwd:, no promo words (option, offer, deal, exclusive, verified suppliers).",
    "- IDENTITY: the From header is a real person (the account executive who owns this buyer). End the email EXACTLY with this signature block, verbatim:\n" +
    "Best regards,\n" +
    (senderName?.trim() || "Veximtrade") + "\n" +
    SIGNATURE_COMPANY + "\n" +
    SIGNATURE_ADDRESS + "\n" +
    SIGNATURE_WEBSITE + "\n" +
    "- Do NOT invent any other human name, title, phone number, or office address.",
    `- Under ${ctx.business_rules.max_words} words excluding signature.`,
    "",
    "ANTI-REPEAT: the previous_emails array is everything this buyer already received. Your email must be recognizably different in opening line, angle, and subject.",
  ].join("\n")

  const stepBlock = [
    `STEP TYPE: ${stepType}`,
    STEP_TYPE_GUIDANCE[stepType] ?? STEP_TYPE_GUIDANCE.follow_up,
    stepGuidance ? `ADDITIONAL STEP GUIDANCE: ${stepGuidance}` : "",
    ctx.crm.step_objective ? `STEP OBJECTIVE: ${ctx.crm.step_objective}` : "",
  ]
    .filter(Boolean)
    .join("\n")

  const prompt = [
    "CAMPAIGN POSITIONING (this outreach belongs to a specific campaign — follow it):",
    JSON.stringify(ctx.campaign, null, 2),
    "",
    "BUYER CONTEXT (backend-curated; treat unknowns as unknowns):",
    formatContextBlock(ctx),
    "",
    stepBlock,
    "",
    "Write the email now. Return subject_en, content_en (end with the EXACT signature block from the system instructions), content_vi.",
  ].join("\n\n")

  const model = "openai/gpt-4o-mini"
  const { experimental_output: output } = await generateText({
    model,
    system,
    prompt,
    experimental_output: Output.object({ schema: outputSchema }),
    maxRetries: 1,
  })

  if (!output) throw new Error("generateCampaignEmail: empty AI output")

  // Đảm bảo signature tồn tại (model thi thoảng bỏ) — deterministic append.
  const contentEn = output.content_en.includes(SIGNATURE_COMPANY)
    ? output.content_en
    : output.content_en + buildSignature(senderName)

  return {
    subjectEn: output.subject_en.trim().slice(0, 120),
    contentEn,
    contentVi: output.content_vi,
    model,
  }
}
