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
  subject_en: z.string().describe("Email subject in plain sentence case, 3-9 words and under 60 characters. A simple question mark is allowed when natural. Avoid dashes, colons, semicolons, quotes, parentheses, ALL CAPS, Re:/Fwd:, and promo words (option, offer, deal, exclusive)."),
  content_en: z.string().describe("Full email body in English, plain text: greeting + 2-3 uneven conversational paragraphs + exact opt-out line + sender signature. Email 1's prose is 120-160 words, excluding the opt-out and signature."),
  content_vi: z.string().describe("Vietnamese translation of the email body for internal AE review."),
})

export type GeneratedCampaignEmail = {
  subjectEn: string
  contentEn: string
  contentVi: string
  model: string
}

const STEP_TYPE_GUIDANCE: Record<string, string> = {
  initial_outreach: `EMAIL 1 — BODY: 120-160 prose words, excluding signature and required opt-out. Write like a thoughtful AE explaining a real work problem, not polished ad copy. Open with a hedged, conversational observation such as: "If you're responsible for sourcing, you're probably used to hearing from new suppliers. The difficult part is often deciding which ones are worth your team's time." Explain naturally that each new source can involve reviewing company and product information, specifications, available export information, pricing, samples and relevant import requirements; much of the effort can be in screening rather than searching. Then say how Veximtrade handles the initial Vietnam-side groundwork before introductions. Describe capacity/export-history work only as reviewing available evidence, never as a guarantee or a specific verified result. Make clear the buyer decides. End with EXACTLY ONE low-pressure question about the buyer's current sourcing or additional-supply situation. No call, meeting, chat, referral, or forward request.
PERSONALIZATION: Use contact/company/product/category only when present in Buyer Context. The personalization source is ctx.buyer.source_of_personalization. Use an "I came across [company] while..." line only when that field names a real source; otherwise use a neutral, supported statement. If product is UNKNOWN, use category. Never invent a product, title, name, buyer need, or source. Never say the buyer/team is in Vietnam.
COUNTRY: use the selected campaign target_country and buyer country already validated by backend. Refer generically to relevant import requirements; no unconfirmed U.S./FDA-specific claims. Vietnam is an additional source, never a replacement. Include the exact required opt-out line.`,
  follow_up: `FOLLOW-UP — use a conversational transition that fits the actual prior email, for example "Just wanted to clarify my last email a little" or "Hope you're having a good day" (optional, brief, and do not repeat as a template). Use a NEW angle; do not repeat the previous subject, opening, or main point. Email 2: explain in plain language that Veximtrade is not a directory buyers must filter themselves. Describe Vietnam-side groundwork: identify relevant manufacturers, review available evidence about capacity/export history, consider product fit and relevant importing-country requirements, and coordinate communication toward samples or quotations. Never promise a supplier or outcome. A natural invitation such as "If you currently have a specific product in mind, feel free to send the details and I'll take a look" is allowed when low-pressure; do not ask for a call or meeting unless explicitly required. Email 3: explain conversationally that when each new product starts from the beginning, that repeated work can become a significant burden in product development and add sourcing cost or delay a launch; keep it conditional, and the buyer retains the final decision. Include the exact opt-out line.
PERSONALIZATION: only use real Buyer Context values. "I came across..." requires a populated source_of_personalization. No placeholders, UNKNOWN, raw customs details, invented facts, or claims that the buyer/team is in Vietnam. Keep the wording plain and specific, not generic marketing copy.`,
  close_loop: `EMAIL 4 — No pressure; sound considerate and direct, as in "I won't keep following up if Vietnam sourcing isn't in your plans right now." Say this is the last note for now, leave the door open if Vietnam becomes a relevant additional source later, and make clear no reply is needed. A brief warm closing is okay; avoid exaggerated generic praise. Do not force a choice, ask a question, request a meeting, or suggest replacing current suppliers. Use only facts and personalization sources present in Buyer Context. Include the exact required opt-out line.`,
  nurture: `NURTURE — follow the campaign-specific guidance. Keep the check-in conversational, low-pressure and factual; personalize only from known Buyer Context and do not imply a prior conversation that is not in context. Include the exact opt-out line.`,
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
    "NORTH STAR: write like a thoughtful account executive speaking plainly to one person. Use the user's natural reference voice: familiar procurement language, concrete examples, varied sentence lengths, and simple transitions. Sound conversational rather than polished or template-driven, while keeping each buyer-specific statement grounded in BuyerContext or an approved fact.",
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
    "- Avoid promotional language such as free samples/offers, guarantees, discounts, act now, risk-free, or congratulations. A conversational 'feel free to...' is ordinary wording, not a promotion.",
    "- PUNCTUATION: no em dashes (—) or en dashes (–) anywhere in the email body. Use periods and commas. An em dash in prose is a strong AI-generated tell.",
    "- AVOID EMPTY OR OVERUSED OPENERS such as 'I hope this email finds you well' and exaggerated phrases such as 'I'd be delighted to'. Ordinary conversational wording such as 'just wanted to clarify' or 'feel free to send the details' is allowed when it fits the sentence; do not repeat stock phrases mechanically.",
    "- NATURAL PARAGRAPHING: write like a real AE typing a one-to-one email. Do NOT put every sentence on its own line; group related sentences into 2-3 uneven paragraphs (a paragraph can be 2-4 sentences, a few lines long; lengths need not match). Perfect symmetric structure (intro, company, why you, offer, CTA) reads as AI copywriting. Sentences may flow long with 'and / but / so / while'. Optimize for naturalness and relevance, not polished copy. A cold email only needs enough context to start the conversation.",
    "- SUBJECT: plain sentence case, 3-9 words and under 60 characters, naming the buyer's world or asking a simple relevant question (e.g. 'Sourcing from Vietnam', 'Where does Veximtrade fit in the sourcing process?'). A question mark is allowed when natural. Avoid em/en dashes, colons, semicolons, quotes, parentheses, Re:/Fwd:, ALL CAPS and promo words.",
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
