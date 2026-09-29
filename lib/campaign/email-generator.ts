// Campaign EmailAgent. BuyerContext and campaign guidance inform the copy;
// the model chooses natural wording while deterministic code enforces only
// deliverability, privacy, factuality, legal footer, and human approval.

import { generateText, Output } from "ai"
import { z } from "zod"
import {
  SIGNATURE_ADDRESS,
  SIGNATURE_COMPANY,
  SIGNATURE_SENDER_TITLE,
} from "./constants"
import type { BuyerContext } from "./types"

const outputSchema = z.object({
  subject_en: z.string().describe("A truthful, relevant email subject. Use natural wording; avoid deceptive Re/Fwd or promotional claims."),
  content_en: z.string().describe("Natural English email copy based on BuyerContext and this campaign step. Include the required opt-out line and end with the provided signature template."),
  content_vi: z.string().describe("Vietnamese translation of the email body for internal AE review."),
})

export type GeneratedCampaignEmail = {
  subjectEn: string
  contentEn: string
  contentVi: string
  model: string
}

function knownContextValue(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized && normalized.toUpperCase() !== "UNKNOWN" ? normalized : null
}

function formatContextBlock(ctx: BuyerContext): string {
  const source = ctx.buyer.source_of_personalization
  const safeSource = source && /\b(?:import|customs|shipment|trade)\s+(?:records?|data|database)\b/i.test(source)
    ? "Industry-level research (keep the underlying data source private)"
    : source
  const safeContext = {
    ...ctx,
    buyer: { ...ctx.buyer, source_of_personalization: safeSource },
    // Drop stale fields supplied by older callers without exposing a length rule.
    business_rules: Object.fromEntries(
      Object.entries(ctx.business_rules).filter(([key]) => key !== "max_words"),
    ),
  }
  return JSON.stringify(safeContext, null, 2)
}

export interface CampaignSignatureOptions {
  mode?: "draft" | "send"
  senderTitle?: string | null
}

function cleanSignatureValue(value?: string | null): string | null {
  const cleaned = value?.replace(/[\r\n]+/g, " ").trim()
  return cleaned && !/^\{\{sender_(?:name|title)\}\}$/i.test(cleaned) ? cleaned : null
}

function findSignatureStart(content: string): number {
  const markers = [
    ...[...content.matchAll(/(?:^|\n)[ \t]*(?:\{\{sender_name\}\}|best regards|kind regards|regards|sincerely|best|thanks),?[ \t]*(?=\n|$)/gim)]
      .map((match) => match.index ?? -1),
  ].filter((index) => index >= 0)
  if (markers.length > 0) return Math.max(...markers)

  const companyIndex = content.toLowerCase().lastIndexOf(SIGNATURE_COMPANY.toLowerCase())
  if (companyIndex < 0) return content.length
  const separator = content.lastIndexOf("\n\n", companyIndex)
  return separator >= 0 ? separator + 2 : Math.max(0, content.lastIndexOf("\n", companyIndex - 1) + 1)
}

function signatureTitleFromContent(content: string): string | null {
  const suffix = `, ${SIGNATURE_COMPANY}`.toLowerCase()
  const titleLine = content
    .split(/\r?\n/)
    .reverse()
    .find((line) => line.trim().toLowerCase().endsWith(suffix))
  return cleanSignatureValue(titleLine?.trim().slice(0, -suffix.length))
}

/** Normalize the model/reviewer copy to the real sender's legal signature. */
export function withCampaignSignature(
  content: string,
  senderName?: string | null,
  options: CampaignSignatureOptions = {},
): string {
  const mode = options.mode ?? "send"
  const signatureStart = findSignatureStart(content)
  const body = content.slice(0, signatureStart)
    .replace(/\n[ \t]*(?:https?:\/\/)?(?:www\.)?veximtrade\.com\/?[ \t]*$/i, "")
    .replace(/&amp;/gi, "&")
    .replace(/\s+$/, "")
  const name = cleanSignatureValue(senderName) ?? "{{sender_name}}"
  const title = cleanSignatureValue(options.senderTitle)
    ?? (mode === "draft" ? null : signatureTitleFromContent(content))
    ?? SIGNATURE_SENDER_TITLE
  const prefix = body ? `${body}\n\n` : ""
  return `${prefix}${name}\n${title}, ${SIGNATURE_COMPANY}\n${SIGNATURE_ADDRESS}`
}

/** Generate a draft only; the scheduler always routes it through AE approval. */
export async function generateCampaignEmail(
  ctx: BuyerContext,
  stepType: string,
  stepGuidance: string | null,
  senderName?: string | null,
): Promise<GeneratedCampaignEmail> {
  const knownCompany = knownContextValue(ctx.buyer.company_name)
  const knownProduct = knownContextValue(ctx.import_data.main_products)
  const knownIndustry = knownContextValue(ctx.buyer.industry)

  const system = [
    "You write one-to-one B2B email as a thoughtful account executive.",
    "Let BuyerContext, campaign positioning, prior messages, and this step's objective guide what is relevant. Choose natural wording, structure, length, and whether a question or invitation fits. Do not follow a fixed opener, paragraph pattern, word count, or CTA formula.",
    "Use known facts naturally when relevant. Never invent buyer intentions, previous conversations, supplier actions/results, credentials, capacity, prices, or regulations. Treat UNKNOWN as unknown. Describe Veximtrade's service accurately and modestly.",
    "Protect research privacy: never expose raw import/customs/shipment records, supplier names from records, or imply that a current supplier list was inspected. When useful, refer to broad industry-level research without naming the underlying data source.",
    "Deliverability and legal basics only: plain text; truthful, non-deceptive subject; no fake Re/Fwd, suspicious links/domains, or obvious promotional/urgency language. Ordinary conversational language is welcome.",
    "Include this exact opt-out sentence immediately before the signature: If you'd rather not hear from me, just reply 'no thanks' and I won't contact you again.",
    `End with this signature shape, using the real sender name supplied by the application or {{sender_name}} if unavailable:
{{sender_name}}
${SIGNATURE_SENDER_TITLE}, ${SIGNATURE_COMPANY}
${SIGNATURE_ADDRESS}
Never use the company name as the human sender name.`,
    `Context anchors (use only when relevant, not as mandatory wording): company=${JSON.stringify(knownCompany ?? "UNKNOWN")}; product=${JSON.stringify(knownProduct ?? "UNKNOWN")}; industry=${JSON.stringify(knownIndustry ?? "UNKNOWN")}.`,
  ].join("\n")

  const prompt = [
    `CAMPAIGN: ${JSON.stringify(ctx.campaign, null, 2)}`,
    `BUYER CONTEXT: ${formatContextBlock(ctx)}`,
    `STEP TYPE: ${stepType}`,
    ctx.crm.step_objective ? `STEP OBJECTIVE: ${ctx.crm.step_objective}` : "",
    stepGuidance ? `ADDITIONAL GUIDANCE: ${stepGuidance}` : "",
    "Write the email naturally for this context. Return subject_en, content_en, and content_vi.",
  ].filter(Boolean).join("\n\n")

  const model = "openai/gpt-4o-mini"
  const { experimental_output: output } = await generateText({
    model,
    system,
    prompt,
    experimental_output: Output.object({ schema: outputSchema }),
    maxRetries: 1,
  })

  if (!output) throw new Error("generateCampaignEmail: empty AI output")
  const contentEn = withCampaignSignature(output.content_en, senderName, { mode: "draft" })

  return {
    subjectEn: output.subject_en.trim().slice(0, 120),
    contentEn,
    contentVi: output.content_vi,
    model,
  }
}
