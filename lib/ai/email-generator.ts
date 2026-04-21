/**
 * AI email generator.
 *
 * Sprint 3: takes a Vietnamese prompt from the admin, an opportunity id, and
 * an email type, then asks OpenAI (via Vercel AI Gateway) to produce a
 * professional English export-sales email along with a Vietnamese reference
 * translation in a single structured call.
 *
 * The result is persisted as a row in `email_drafts` with status
 * `pending_approval`. Nothing is emailed until an admin clicks "Approve &
 * Send" from the review dialog.
 */

import { generateText, Output } from "ai"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import type { EmailType } from "@/lib/supabase/types"

const EMAIL_TYPE_GUIDANCE: Record<EmailType, string> = {
  introduction:
    "Cold introduction. Briefly introduce the Vietnamese exporter, state why they are relevant to the buyer (product fit, FDA-registered, competitive origin), and propose a short intro call. Keep tone warm, confident, concise (120-180 words).",
  follow_up:
    "Polite follow-up on a previous thread. Reference the earlier exchange, reiterate the value proposition in one line, and propose a clear next step (sample, call, quote). Keep it short (80-140 words).",
  quotation:
    "Commercial quotation. Clearly state product, quantity, Incoterm (e.g. FOB Ho Chi Minh), unit price in USD, lead time, MOQ, payment terms, and validity. Use a clean structure with short bullets. Tone: professional and precise (140-220 words).",
  custom:
    "Freeform business email. Follow the admin's intent precisely while keeping US-English tone professional and export-sales appropriate.",
}

const outputSchema = z.object({
  subject_en: z
    .string()
    .describe("Concise, specific, US-English email subject line (max 80 chars)."),
  content_en: z
    .string()
    .describe(
      "Full English email body, starting with a greeting (e.g. 'Dear [Name]') and ending with a signature placeholder. No HTML — use plain line breaks.",
    ),
  content_vi: z
    .string()
    .describe(
      "Faithful Vietnamese translation of the English email so the Vietnamese admin can verify intent before sending.",
    ),
})

export type GenerateEmailInput = {
  opportunityId: string
  emailType: EmailType
  viPrompt: string
}

export type GenerateEmailResult = {
  draftId: string
  subject_en: string
  content_en: string
  content_vi: string
  recipient_email: string | null
}

/** Thrown when the caller does not have permission to use the AI email tool. */
export class EmailGeneratorAuthError extends Error {
  constructor(message = "Unauthorized") {
    super(message)
    this.name = "EmailGeneratorAuthError"
  }
}

const ALLOWED_ROLES = new Set([
  "admin",
  "staff",
  "super_admin",
  "account_executive",
])

export async function generateEmailDraft(
  input: GenerateEmailInput,
): Promise<GenerateEmailResult> {
  const supabase = await createClient()

  // ------------------------------------------------------------
  // 1) Auth + role check
  // ------------------------------------------------------------
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new EmailGeneratorAuthError()

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || !ALLOWED_ROLES.has(profile.role)) {
    throw new EmailGeneratorAuthError("Role not permitted to generate emails")
  }

  // ------------------------------------------------------------
  // 2) Load opportunity context so the AI can personalize the email
  // ------------------------------------------------------------
  const { data: opportunity, error: oppError } = await supabase
    .from("opportunities")
    .select(
      `
        id,
        stage,
        potential_value,
        notes,
        leads:leads(*),
        profiles:profiles!opportunities_client_id_fkey(company_name, industry)
      `,
    )
    .eq("id", input.opportunityId)
    .single()

  if (oppError || !opportunity) {
    throw new Error(oppError?.message ?? "Opportunity not found")
  }

  const lead = (opportunity as { leads: Record<string, unknown> | null }).leads
  const exporter = (opportunity as { profiles: Record<string, unknown> | null }).profiles

  if (!lead) {
    throw new Error("Opportunity has no associated lead")
  }

  // ------------------------------------------------------------
  // 3) Build the system prompt with rich context
  // ------------------------------------------------------------
  const contextBlock = JSON.stringify(
    {
      buyer_company: lead["company_name"],
      buyer_contact: lead["contact_person"],
      buyer_email: lead["contact_email"],
      buyer_industry: lead["industry"],
      buyer_notes: lead["notes"],
      exporter_company: exporter?.["company_name"] ?? null,
      exporter_industry: exporter?.["industry"] ?? null,
      opportunity_stage: (opportunity as { stage: string }).stage,
      potential_value_usd: (opportunity as { potential_value: number | null })
        .potential_value,
      opportunity_notes: (opportunity as { notes: string | null }).notes,
    },
    null,
    2,
  )

  // Personalize the system prompt with the exporter's industry so the AI
  // uses the right terminology, certifications, and distribution channels.
  // A client selling cosmetics should NOT receive food-export phrasing.
  const exporterIndustry =
    (exporter?.["industry"] as string | null | undefined) ?? null
  const industryLine = exporterIndustry
    ? `You are writing on behalf of a Vietnamese ${exporterIndustry.toLowerCase()} exporter reaching out to US buyers. Use terminology, certifications, and sales language appropriate for the ${exporterIndustry} industry.`
    : "You are writing on behalf of a Vietnamese exporter reaching out to US buyers. Adapt tone and terminology to the exporter's industry indicated in the context."

  const system = [
    "You are a senior export-sales manager.",
    industryLine,
    "Write warm, professional, US-business English. Never use emoji. Never invent facts not provided in context (especially do not invent product specs, certifications, or company history).",
    "If the admin's intent is unclear, choose the most reasonable interpretation for an export-sales workflow.",
    `Email type guidance: ${EMAIL_TYPE_GUIDANCE[input.emailType]}`,
    "The Vietnamese translation must be a faithful, natural rendering — not a literal word-for-word copy.",
  ].join("\n\n")

  const userPrompt = [
    "Opportunity context (JSON):",
    contextBlock,
    "",
    "Admin instruction (Vietnamese):",
    input.viPrompt,
  ].join("\n")

  // ------------------------------------------------------------
  // 4) Call OpenAI via AI Gateway and get structured output
  // ------------------------------------------------------------
  const { experimental_output: generated } = await generateText({
    model: "openai/gpt-4o-mini",
    system,
    prompt: userPrompt,
    experimental_output: Output.object({ schema: outputSchema }),
  })

  // ------------------------------------------------------------
  // 5) Persist as email_draft awaiting approval
  // ------------------------------------------------------------
  const recipient = (lead["contact_email"] as string | null) ?? null

  const { data: draft, error: draftError } = await supabase
    .from("email_drafts")
    .insert({
      opportunity_id: input.opportunityId,
      email_type: input.emailType,
      vi_prompt: input.viPrompt,
      generated_subject_en: generated.subject_en,
      generated_content_en: generated.content_en,
      translated_content_vi: generated.content_vi,
      recipient_email: recipient,
      status: "pending_approval",
      created_by: user.id,
    })
    .select("id")
    .single()

  if (draftError || !draft) {
    throw new Error(draftError?.message ?? "Failed to save draft")
  }

  return {
    draftId: draft.id,
    subject_en: generated.subject_en,
    content_en: generated.content_en,
    content_vi: generated.content_vi,
    recipient_email: recipient,
  }
}
