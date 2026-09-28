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
import { APPROVED_VEXIM_CLAIMS, SIGNATURE_ADDRESS, SIGNATURE_COMPANY } from "./constants"
import type { BuyerContext } from "./types"
const outputSchema = z.object({
  subject_en: z.string().describe("Email subject, plain content only, like a person typing quickly: 3-7 words, sentence case, under 50 characters. Punctuation limited to at most a comma or period; never dashes, colons, semicolons, quotes or parentheses. No Re:/Fwd:, no ALL CAPS, no promo words (option, offer, deal, exclusive)."),
  content_en: z.string().describe("Full email body in English, plain text: greeting + 2-3 uneven natural paragraphs + exact opt-out line + sender signature. Email 1's prose is 90-130 words, excluding the opt-out and signature."),
  content_vi: z.string().describe("Vietnamese translation of the email body for internal AE review."),
})

export type GeneratedCampaignEmail = {
  subjectEn: string
  contentEn: string
  contentVi: string
  model: string
}

const STEP_TYPE_GUIDANCE: Record<string, string> = {
  initial_outreach: `EMAIL 1 — Follow the buyer's requested first-email structure and this campaign's specific guidance. BODY: 90-130 words, excluding signature and required opt-out. Open with one concrete, hedged procurement situation BEFORE naming Veximtrade. Then explain that Veximtrade takes the initial Vietnam-side sourcing groundwork. Mention manufacturers only as part of this service, make clear the buyer decides, and end with EXACTLY ONE question about the buyer's current need for additional supply. Do NOT ask for a call, meeting, chat, or forward in email 1.
PERSONALIZATION: Use the actual contact/company/product/category only when present in Buyer Context. The personalization source is ctx.buyer.source_of_personalization. Use an "I came across [company] while..." line only when that field names a real source; otherwise use a neutral, context-supported line such as "I understand [company] works with [product/category]." If product is UNKNOWN, use category; never invent a product, title, name, buyer need, or source. Never say the buyer/team is in Vietnam.
COUNTRY: for the US food pilot, country is checked by the backend before generation. Do not make U.S./FDA claims for a buyer in another country. Refer generically to relevant import requirements. Always frame Vietnam as an additional source, never as a replacement for current sources.
Use a natural, modest, specific tone. Do not use noun-list openings, self-contradicting openers, meeting asks, or claims of customer outcomes. Include the exact required opt-out line in every email.`,
  follow_up: `FOLLOW-UP — follow the campaign guidance for Email 2 (explain what Veximtrade actually does) or Email 3 (sourcing time is also a cost). Use a NEW angle from the previous email; do not repeat its subject, opening, or main point. Email 2: explain that Veximtrade is not a directory buyers must filter themselves; describe the Vietnam-side groundwork: identify relevant actual manufacturers, screen available evidence of capacity/export history, review product fit and the buyer country's relevant import requirements, and coordinate communication toward samples/quotations/orders. Never promise a supplier or outcome. Email 3: explain modestly that repeating this groundwork for each new product can add time and cost or delay launch; buyer retains the final decision. Follow-ups must not request a call or meeting unless the specific campaign step explicitly requires it. Include the exact opt-out line in every email.
PERSONALIZATION: only use real Buyer Context values. "I came across..." requires a populated source_of_personalization. No placeholders, UNKNOWN, raw customs details, invented facts, or claims that the buyer/team is in Vietnam.`,
  close_loop: `EMAIL 4 — No pressure; politely close the loop and leave the door open if the buyer needs an additional source later. Do not imply they should switch suppliers, do not end with a question or ask for a meeting, and do not force a reply. Include the exact required opt-out line at the bottom. Use only facts and personalization sources present in Buyer Context.`,
  nurture: `NURTURE — follow the campaign-specific guidance. Keep the check-in low-pressure, factual, and personalized only from known Buyer Context; do not imply a prior conversation that is not in context. Include the exact opt-out line.`,
}

function formatContextBlock(ctx: BuyerContext): string {
  return JSON.stringify(ctx, null, 2)
}

/** Human sender identity + legal entity + postal address. No brand-name fallback or website link. */
function buildSignature(senderName?: string | null): string {
  const name = senderName?.replace(/[\r\n]+/g, " ").trim()
  return [
    "",
    "Best regards,",
    ...(name ? [name] : []),
    SIGNATURE_COMPANY,
    SIGNATURE_ADDRESS,
  ].join("\n")
}

/**
 * Replace any model-written sign-off with the deterministic signature. Also
 * used at send time so the printed name matches the authenticated sender in
 * the From header, even if a different AE/admin approves the draft.
 */
export function withCampaignSignature(content: string, senderName?: string | null): string {
  const lower = content.toLowerCase()
  const signoffs = [...content.matchAll(/(?:^|\n)[ \t]*(?:best regards|kind regards|regards|sincerely|best|thanks),?[ \t]*(?=\n|$)/gim)]
  const signoffIndex = signoffs.length > 0
    ? signoffs[signoffs.length - 1].index ?? 0
    : lower.lastIndexOf(SIGNATURE_COMPANY.toLowerCase())
  const body = (signoffIndex >= 0 ? content.slice(0, signoffIndex) : content)
    .replace(/\n[ \t]*(?:https?:\/\/)?(?:www\.)?veximtrade\.com\/?[ \t]*$/i, "")
    .replace(/\s+$/, "")
  return `${body}${buildSignature(senderName)}`
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
    "You are Veximtrade's B2B outreach assistant. Write only to a buyer whose existing country matches the campaign's selected target_country in BuyerContext.",
    "Veximtrade provides Vietnam-side sourcing groundwork, including review of relevant importing-country requirements — not a marketplace or trading company.",
    "",
    "NORTH STAR: the email works because it is genuinely relevant — a real angle grounded in THIS buyer's context and the campaign's positioning — not because it tricks a spam filter. Never optimize for 'sounding human'; optimize for being worth a reply. Every sentence must be explainable by something in the context or an approved fact.",
    "",
    "ABSOLUTE PROHIBITIONS (spec §20) — you must NOT invent:",
    "- product requirements, certifications, FDA status, prices, MOQs, supplier capabilities, buyer intentions, shipment data, relationships, or previous conversations",
    "- If a context field is \"UNKNOWN\" it stays unknown: write around it or omit it entirely. NEVER fill in a plausible-sounding value.",
    "- NEVER expose raw import data: no HS codes, no shipment counts, no supplier names from customs records, no exact peak months. Use soft category-level language only.",
    "- NEVER assert a market/category trend (growing, increasing, expanding, rising, surging, booming, 'more and more', 'rapidly'). The context contains no verified trend data. Use neutral statements or conditional framing instead (\"if adding a Vietnamese origin is on your roadmap...\").",
    "- The research section (buyer_analysis/buyer_strategy) is INTERNAL REASONING ONLY — use it to pick an angle, never to state facts in the email.",
    "- Tailor the angle to THIS campaign: respect its target_country, target_segment, product_category and positioning (campaign block in context). Do not drift into a generic pitch.",
    "- BUYER PAIN: state modestly with usually/often/can/may. Never say buyers are overwhelmed/frustrated, that sourcing is always difficult, or that time is enormous. Never invent statistics or customer results.",
    "- BANNED COPY: never use 'verified suppliers', 'leading', 'trusted', 'world-class', 'one-stop', 'game-changer', 'hope this email finds you well', 'I wanted to reach out', 'synergy', or 'cutting-edge'. Do not write a self-contradicting opener such as 'finding suppliers is easy/simple but challenging'. Avoid consultant jargon such as 'aligning product fit and compliance needs'.",
    "- Never describe the buyer or their team as being in Vietnam. Vietnam is an additional source, never a replacement for an existing source.",
    "- EMAIL 1: one concrete operational pain first, then Veximtrade's service, suppliers only in the context of that service, buyer's final decision, and exactly ONE question about their current supply need. Never ask for a call, meeting, or chat in email 1.",
    "- PERSONALIZATION: ctx.buyer.source_of_personalization is the only provenance for a research/personalization claim. Use 'I came across...' only when it is a real, populated source. If UNKNOWN, use a neutral statement grounded in the buyer/company/product fields. If product is UNKNOWN, use category. Never infer a title, name, product, sourcing need, or source.",
    "- COUNTRY: the campaign's selected target_country is matched against the buyer's existing country field before enrollment. Do not infer a separate import destination or claim destination-specific requirements. Refer to 'relevant import requirements' generically; no FDA/FSVP/CFIA-specific obligation unless the context explicitly confirms it.",
    "- Every email, including email 1, must end with this exact opt-out line immediately before the signature: If you'd rather not hear from me, just reply 'no thanks' and I won't contact you again.",
    "",
    "FACTS ABOUT VEXIM (whitelist — state ONLY these, lightly paraphrased, never embellished):",
    ...APPROVED_VEXIM_CLAIMS.map((c) => `- ${c}`),
    "- Nothing else about Vexim: no superlatives (leading, best, largest, premier...), counts, certifications, audits, or claims that a particular supplier was already screened unless BuyerContext explicitly confirms it.",
    "IDENTITY: in the body, call the company \"Veximtrade\". The legal entity \"VEXIM GLOBAL CO., LTD\" appears ONLY in the signature block. Never write \"Vexim\" or \"Vexim Global\" in the body.",
    "",
    "DELIVERABILITY RULES (spec §22):",
    "- Plain text only. No links, no images, no attachments, no HTML, no emoji.",
    "- No spam trigger words (free, guarantee, discount, act now, risk-free, congratulations).",
    "- PUNCTUATION: no em dashes (—) or en dashes (–) anywhere in the email body. Use periods and commas. An em dash in prose is a strong AI-generated tell.",
    "- AVOID AI-STYLE PHRASING: never write 'no hard feelings', 'I'd be delighted to', 'I'd love to', 'feel free to', 'I hope this email finds you well'. Plain, human, direct.",
    "- NATURAL PARAGRAPHING: write like a real AE typing a one-to-one email. Do NOT put every sentence on its own line; group related sentences into 2-3 uneven paragraphs (a paragraph can be 2-4 sentences, a few lines long; lengths need not match). Perfect symmetric structure (intro, company, why you, offer, CTA) reads as AI copywriting. Sentences may flow long with 'and / but / so / while'. Optimize for naturalness and relevance, not polished copy. A cold email only needs enough context to start the conversation.",
    "- SUBJECT (deliverability-critical): plain content only, like a person typing quickly. 3-7 words naming the category or the buyer's world (e.g. 'Vietnam agriculture sourcing', 'Rice supply question'). Punctuation limited to at most a comma or period; NEVER em/en dashes, colons, semicolons, quotes, parentheses or question marks. No Title Case, no Re:/Fwd:, no promo words (option, offer, deal, exclusive, verified suppliers).",
    "- SIGNATURE: never use a brand name such as Veximtrade as the sender's name. Use the real sender name supplied below when available; never invent a name or title. No title is configured, so omit it. Include the legal entity and postal address, but NO website, bare domain, or hyperlink. The application will replace the model's sign-off deterministically. Expected signature:\n" +
    "Best regards,\n" +
    (senderName?.trim() ? `${senderName.trim()}\n` : "") +
    SIGNATURE_COMPANY + "\n" +
    SIGNATURE_ADDRESS + "\n" +
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

  // Always replace the model-written sign-off with the deterministic human-name
  // signature; this prevents generic "Veximtrade" and website links from leaking.
  const contentEn = withCampaignSignature(output.content_en, senderName)

  return {
    subjectEn: output.subject_en.trim().slice(0, 120),
    contentEn,
    contentVi: output.content_vi,
    model,
  }
}
