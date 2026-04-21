/**
 * AI reply classifier — Sprint D.
 *
 * Takes a raw buyer email (English), asks OpenAI via the Vercel AI Gateway
 * to classify intent, summarize, suggest next step, and translate to
 * Vietnamese in a single structured call. The result is meant to be
 * persisted in `buyer_replies` by the server action.
 */

import { generateText, Output } from "ai"
import { z } from "zod"
import type { BuyerReplyIntent } from "@/lib/supabase/types"

const intentSchema = z.enum([
  "price_request",
  "sample_request",
  "objection",
  "closing_signal",
  "general",
])

const outputSchema = z.object({
  intent: intentSchema.describe(
    "Best-fit single intent. price_request = buyer asks for quotation/FOB/prices; sample_request = buyer asks for samples; objection = buyer raises concerns/doubts/rejections; closing_signal = buyer ready to move forward (PO, payment terms); general = anything else.",
  ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("How confident you are in the intent, 0-1."),
  summary_vi: z
    .string()
    .describe(
      "One-sentence Vietnamese summary of what the buyer is asking or saying. No greetings, no names.",
    ),
  translated_vi: z
    .string()
    .describe(
      "Faithful Vietnamese translation of the buyer's email, preserving tone and any numbers/units.",
    ),
  suggested_next_step_vi: z
    .string()
    .describe(
      "One actionable Vietnamese sentence telling the Vietnamese account executive what to do next, in export-sales context (e.g. 'Gửi báo giá FOB HCM kèm MOQ 5 tấn và thời hạn thanh toán').",
    ),
})

export type ClassifyReplyResult = {
  intent: BuyerReplyIntent
  confidence: number
  summaryVi: string
  translatedVi: string
  suggestedNextStepVi: string
  model: string
}

/**
 * Call the AI to classify + translate + summarize a buyer reply.
 * Never throws on empty input — callers are expected to validate first.
 */
export async function classifyBuyerReply(
  rawContentEn: string,
  context: {
    buyerCompany?: string | null
    buyerIndustry?: string | null
    opportunityStage?: string | null
  },
): Promise<ClassifyReplyResult> {
  const system = [
    "You are a senior export-sales operations assistant helping a Vietnamese agricultural/food exporter.",
    "The admin will paste in an English email from a US/EU buyer. Your job is:",
    "1) Classify the buyer's primary intent.",
    "2) Translate faithfully to Vietnamese.",
    "3) Summarize what the buyer wants in one Vietnamese sentence.",
    "4) Suggest one concrete Vietnamese next-step for the account executive.",
    "Never fabricate numbers, prices, or quantities that aren't in the email.",
    "Keep Vietnamese natural and concise — not word-for-word literal.",
  ].join("\n")

  const contextBlock = JSON.stringify(
    {
      buyer_company: context.buyerCompany ?? null,
      buyer_industry: context.buyerIndustry ?? null,
      opportunity_stage: context.opportunityStage ?? null,
    },
    null,
    2,
  )

  const prompt = [
    "Opportunity context:",
    contextBlock,
    "",
    "Buyer email (English):",
    "---",
    rawContentEn,
    "---",
  ].join("\n")

  const model = "openai/gpt-4o-mini"

  const { experimental_output } = await generateText({
    model,
    system,
    prompt,
    experimental_output: Output.object({ schema: outputSchema }),
  })

  return {
    intent: experimental_output.intent,
    confidence: experimental_output.confidence,
    summaryVi: experimental_output.summary_vi,
    translatedVi: experimental_output.translated_vi,
    suggestedNextStepVi: experimental_output.suggested_next_step_vi,
    model,
  }
}
