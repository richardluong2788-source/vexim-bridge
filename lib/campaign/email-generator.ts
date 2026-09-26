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
import { SIGNATURE_ADDRESS, SIGNATURE_COMPANY, SIGNATURE_WEBSITE } from "./constants"
import type { BuyerContext } from "./types"
const outputSchema = z.object({
  subject_en: z.string().describe("Email subject, plain sentence case, under 50 characters, no Re:/Fwd:, no ALL CAPS."),
  content_en: z.string().describe("Full email body in English, plain text, greeting + 2-4 short paragraphs + signature block."),
  content_vi: z.string().describe("Vietnamese translation of the email body for internal AE review."),
})

export type GeneratedCampaignEmail = {
  subjectEn: string
  contentEn: string
  contentVi: string
  model: string
}

const STEP_TYPE_GUIDANCE: Record<string, string> = {
  initial_outreach: `EMAIL 1 — Introduction + relevance. DO NOT pitch any supplier yet.
Structure: 1-2 sentences acknowledging their world (product/category for the US market, softly, no surveillance data) → 1-2 sentences who Vexim is (compliance consulting partner for Vietnamese factories exporting to the US: FDA, HACCP, traceability; factories audited before joining; direct factory, not a marketplace or trading company) → 1 soft CTA (open to connect / worth a short conversation).
Purpose: earn a reply, nothing more.`,
  follow_up: `FOLLOW-UP — continue the conversation, never pressure.
Step 2 goal (reinforce relevance): many buyers in their category are expanding their Vietnam supplier base; Vexim can help add US-compliant Vietnamese manufacturers alongside existing sources.
Step 3 goal (reduce friction): do NOT ask "Do you want suppliers?". Instead: "If you're currently reviewing any products or specifications, feel free to send them over and I can check whether we have a suitable manufacturer."
MUST be noticeably SHORTER than the previous email and MUST NOT repeat its content, subject, or opening line.`,
  close_loop: `CLOSE-LOOP — final email of the sequence. Give the buyer an easy, dignified way to say no.
Example spirit: "I don't want to keep landing in your inbox — if Vietnam sourcing isn't a priority right now, a simple 'no thanks' is completely fine and I'll close the file."
Keep it warm, 3-5 sentences total.`,
  nurture: `NURTURE — long-interval check-in. Same rules as close_loop minus the explicit ask to say no.`,
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
    senderName?.trim() || "Vexim",
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
    "You are Vexim's B2B sales assistant writing cold outreach emails to US food import buyers on behalf of Vexim Global (Vietnam).",
    "Vexim is a compliance consulting partner for Vietnamese factories exporting to the US — not a marketplace, not a trading company.",
    "",
    "ABSOLUTE PROHIBITIONS (spec §20) — you must NOT invent:",
    "- product requirements, certifications, FDA status, prices, MOQs, supplier capabilities, buyer intentions, shipment data, relationships, or previous conversations",
    "- If a context field is \"UNKNOWN\" it stays unknown: write around it or omit it entirely. NEVER fill in a plausible-sounding value.",
    "- NEVER expose raw import data: no HS codes, no shipment counts, no supplier names from customs records, no exact peak months. Use soft category-level language only.",
    "- The research section (buyer_analysis/buyer_strategy) is INTERNAL REASONING ONLY — use it to pick an angle, never to state facts in the email.",
    "- Tailor the angle to THIS campaign: respect its target_segment, product_category and positioning (campaign block in context). Do not drift into a generic pitch.",
    "",
    "DELIVERABILITY RULES (spec §22):",
    "- Plain text only. No links, no images, no attachments, no HTML, no emoji.",
    "- No spam trigger words (free, guarantee, discount, act now, risk-free, congratulations).",
    "- IDENTITY: the From header is a real person (the account executive who owns this buyer). End the email EXACTLY with this signature block, verbatim:\n" +
    "Best regards,\n" +
    (senderName?.trim() || "Vexim") + "\n" +
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
