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
  content_en: z.string().describe("Natural English email copy guided by this step's writing reference and grounded in BuyerContext. Include the required opt-out line and end with the provided signature template."),
  content_vi: z.string().describe("Vietnamese translation of the email body for internal AE review."),
})

/**
 * Narrative references distilled from the four user-provided emails.
 * They teach the underlying reasoning and pacing; they are not templates,
 * required paragraph counts, fixed copy, or QA rules.
 */
const STEP_WRITING_REFERENCES: Record<number, string> = {
  1: `Email 1 — the buyer is doing too much filtering themselves.
Narrative: start from the familiar experience of receiving many supplier approaches; reframe the difficulty as deciding which ones deserve the team's time, rather than simply finding names. Develop why that effort accumulates with a naturally paced explanation of the work around a new source (company/product details, specifications, export information, quotations, samples, and import requirements). Then pivot to Veximtrade's initial Vietnam-side sourcing work, connect it to a supported reason for knowing this buyer, and end with a low-pressure possibility of reducing that workload if Vietnam is relevant.
Rhythm and depth: a conversational opening, a fuller explanatory middle, a brief transition into Vexim's role, then a personal, light close. Let paragraphs and sentence lengths vary naturally; don't reproduce the sample's wording or turn this into a fixed sequence.`,
  2: `Email 2 — explain what Veximtrade actually does.
Narrative: continue like a person following up, then clarify the service by contrasting hands-on sourcing groundwork with a directory that leaves all the filtering to the buyer. Walk through the work in plain language—finding relevant manufacturers, reviewing available information and fit, considering relevant requirements, and coordinating next conversations—then explain how this lets the buyer focus on a smaller set of worthwhile possibilities. Close with a practical, optional invitation to share a product need so its fit with Vietnam sourcing can be explored.
Rhythm and depth: warm and brief at the start, followed by the clearest operational explanation in the sequence, then a useful, low-pressure close. Keep the flow conversational rather than making a checklist or copying the reference's phrases.`,
  3: `Email 3 — sourcing effort is also a cost, beyond the supplier's quoted price.
Narrative: let the reader feel the chain of work involved in starting with a new product—searching, exchanges, checking information, quotations, samples, and requirements—then reason from repeated effort to the time and cost it can add to product development. Transition to how Veximtrade may take on some of the initial Vietnam-side groundwork. Keep the buyer in control of supplier decisions and finish with a gentle, concrete opening to explore a product need.
Rhythm and depth: the reference's reasoning builds from a compact cascade of tasks to a broader business implication, then returns to a concise explanation of Vexim's role and a human close. Preserve that explanatory arc, not its wording or exact sentence order.`,
  4: `Email 4 — close without pressure and leave a useful door open.
Narrative: acknowledge plainly that Vietnam sourcing may not be a current priority and reassure the buyer that follow-ups will stop. Briefly describe how Vexim could help if an additional source becomes relevant later, give the buyer an easy way to restart the conversation, and finish warmly.
Rhythm and depth: more compact and personal than the earlier explanatory notes; move from a considerate close to a future option and a warm sign-off without sounding like a sales ultimatum. The reference is inspiration, not fixed wording or a mandatory closing formula.`,
}

const NURTURE_WRITING_REFERENCE = `For a nurture message, borrow the considerate, future-facing sensibility of Email 4 while making a relevant check-in only when supported by the conversation. Keep the reference's human, low-pressure feel; do not turn it into a close-loop or a fixed template.`

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
    crm: { ...ctx.crm, step_objective: null },
    // Drop stale fields supplied by older callers without exposing a length rule.
    business_rules: Object.fromEntries(
      Object.entries(ctx.business_rules).filter(([key]) => key !== "max_words"),
    ),
  }
  return JSON.stringify(safeContext, null, 2)
}

function writingReferenceFor(ctx: BuyerContext, stepType: string): string {
  const stepNumber = ctx.crm.campaign_step
  if (stepNumber >= 1 && stepNumber <= 4) {
    return STEP_WRITING_REFERENCES[stepNumber]
  }
  if (stepType === "initial_outreach") return STEP_WRITING_REFERENCES[1]
  if (stepType === "close_loop") return STEP_WRITING_REFERENCES[4]
  if (stepType === "nurture") return NURTURE_WRITING_REFERENCE
  return STEP_WRITING_REFERENCES[2]
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

  // Keep this argument for existing scheduler/caller compatibility. Stored
  // campaign guidance may contain obsolete copy rules; the supplied writing
  // references, rather than that guidance, control narrative and pacing.
  void stepGuidance

  const campaignFacts = {
    target_country: ctx.campaign.target_country,
    product_category: ctx.campaign.product_category,
  }
  const selectedReference = writingReferenceFor(ctx, stepType)

  const system = [
    "You write one-to-one B2B emails as a thoughtful account executive.",
    "The selected step writing reference is the creative guide: follow its narrative logic, reasoning, explanatory depth, and paragraph rhythm. Use it as a writing reference, not as a fixed structure, checklist, or wording to copy. Write fresh sentences in your own natural language.",
    "Use BuyerContext only to choose or adjust factual substance and personalization (for example, a known buyer, product, market, or prior interaction). It must not change the reference's central narrative, reasoning, explanatory depth, or natural rhythm. Prior emails are context for continuity, not copy to reuse. Ignore stored step objectives or legacy copy guidance that could override the selected reference.",
    "Use known facts accurately. Never invent buyer intentions, previous conversations, supplier actions/results, credentials, capacity, prices, or regulations. Treat UNKNOWN as unknown. Describe Veximtrade's service accurately and modestly.",
    "Protect research privacy: never expose raw import/customs/shipment records, supplier names from records, or imply that a current supplier list was inspected. When useful, refer to broad industry-level research without naming the underlying data source.",
    "Keep standard deliverability and legal safeguards: plain text; truthful, non-deceptive subject; no fake Re/Fwd, suspicious links/domains, or obvious promotional/urgency language. Ordinary conversational language is welcome.",
    "Include this exact opt-out sentence immediately before the signature: If you'd rather not hear from me, just reply 'no thanks' and I won't contact you again.",
    `End with this signature shape, using the real sender name supplied by the application or {{sender_name}} if unavailable:
{{sender_name}}
${SIGNATURE_SENDER_TITLE}, ${SIGNATURE_COMPANY}
${SIGNATURE_ADDRESS}
Never use the company name as the human sender name.`,
    `Known context anchors (use only when relevant): company=${JSON.stringify(knownCompany ?? "UNKNOWN")}; product=${JSON.stringify(knownProduct ?? "UNKNOWN")}; industry=${JSON.stringify(knownIndustry ?? "UNKNOWN")}.`,
  ].join("\n")

  const prompt = [
    `CAMPAIGN FACTS (context only): ${JSON.stringify(campaignFacts, null, 2)}`,
    `BUYER CONTEXT (facts and personalization only): ${formatContextBlock(ctx)}`,
    `CURRENT STEP: ${ctx.crm.campaign_step} (${stepType})`,
    `STEP-SPECIFIC WRITING REFERENCE:\n${selectedReference}`,
    "Write fresh English copy and its Vietnamese translation. Let the selected reference guide the narrative; use context only for factual substance and personalization. Return subject_en, content_en, and content_vi.",
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
  const contentEn = withCampaignSignature(output.content_en, senderName, { mode: "draft" })

  return {
    subjectEn: output.subject_en.trim().slice(0, 120),
    contentEn,
    contentVi: output.content_vi,
    model,
  }
}
