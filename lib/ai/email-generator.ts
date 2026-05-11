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

/**
 * Email guidance using proven copywriting frameworks from masters:
 * - Gary Halbert: "Reason Why" technique, specificity, curiosity hooks
 * - Dan Kennedy: No-BS direct response, benefit-stacking, urgency
 * - Eugene Schwartz: 5 Levels of Market Awareness, breakthrough advertising
 * - PAS Framework: Problem → Agitate → Solution
 */
const EMAIL_TYPE_GUIDANCE: Record<EmailType, string> = {
  introduction: `COLD INTRODUCTION - "Partnership Invitation" approach (NOT a sales pitch).

═══════════════════════════════════════════════════════════════════════════════
CRITICAL: THE "3 PILLARS OF TRUST" STRATEGY FOR NEW-TO-US-MARKET SUPPLIERS
═══════════════════════════════════════════════════════════════════════════════
If the supplier has NO proven U.S. export history, NEVER fabricate case studies or client references. 
U.S. buyers can easily verify via ImportYeti or customs data. One lie = total credibility destruction.

Instead, use the "3 Pillars of Trust" to build credibility through REAL capabilities:

PILLAR 1 - "Who are they?" (Production Capability)
→ Offer to send factory video/photos showing production line, lab, packaging area
→ "I'd be happy to send a short video walkthrough of our facility..."

PILLAR 2 - "How do they make it?" (Quality Control)
→ Offer real COA (Certificate of Analysis) from a recent batch - doesn't need to be US shipment
→ "I can share a recent COA showing our quality specs: moisture, screen size, defect count..."

PILLAR 3 - "Are they trustworthy?" (Compliance)
→ Highlight REAL certifications: FDA-registered, HACCP, ISO 22000, Organic, etc.
→ "Our facility is FDA-registered and [other certs], so we're fully ready for U.S. import..."

KEY PHRASE TO USE: "We may be new to the U.S. market, but we are not new to quality."
This transforms the "weakness" into a strength of honesty and professionalism.
═══════════════════════════════════════════════════════════════════════════════

CRITICAL RULES:
- NEVER promise specific percentages (e.g. "15-20% savings") unless the admin explicitly provides verified data.
- Instead, use softer framing: "very competitive landed cost", "pricing structure worth comparing".
- ALWAYS offer TANGIBLE PROOF: factory video, COA, certification photos — NOT fake testimonials.

STRUCTURE:
1. SUBJECT LINE: Personalized + specific. Format: "[Name], re: [Company]'s [product] supply / [value hook]". Example: "Richard, re: Nodom's Arabica supply / FDA-registered alternative from Vietnam"
2. HOOK (1 sentence): One sharp question about their pain point. "Are rising costs on your [origin] supply starting to squeeze your margins?"
3. BRIDGE (1-2 sentences): Empathize briefly, then pivot to solution with HONESTY. "We may be new to the U.S. market, but we are not new to quality..."
4. 3 PILLARS PROOF (2-3 sentences): Offer concrete evidence from the 3 pillars. "I can send over our facility video, a recent COA, and our FDA registration certificate..."
5. SOFT CTA (1 sentence): Low-pressure, partnership language. "Would you be open to a 15-minute call this week to compare notes?"

TONE: Peer-to-peer, consultative, HONEST. Admit newness to US market but showcase readiness.
Word count: 100-150 words (shorter = better for cold emails).`,

  follow_up: `FOLLOW-UP - Use Eugene Schwartz's escalating awareness + Dan Kennedy's urgency principles.

STRUCTURE:
1. PATTERN INTERRUPT (1 sentence): Don't say "just following up." Instead, add NEW value — a relevant industry insight, a price change, a limited availability notice.
2. RECONNECT (1 sentence): Brief reference to previous contact.
3. NEW ANGLE (1-2 sentences): Present the opportunity from a different angle — emphasize a benefit not mentioned before, or address a likely objection.
4. URGENCY + CTA: Real deadline or scarcity if applicable. Clear single action.

TONE: Respectful persistence. Assume they're busy, not uninterested. Add value, don't just "check in."
Word count: 80-140 words. Subject line: Re: original thread OR new hook with urgency.`,

  quotation: `COMMERCIAL QUOTATION - Use Gary Halbert's specificity + Dan Kennedy's value stacking.

STRUCTURE:
1. OPENING (1-2 sentences): Thank them for interest. Restate THEIR need (shows you listened).
2. QUOTATION TABLE: Product, quantity, Incoterm (FOB/CIF), unit price USD, lead time, MOQ, payment terms, validity period. Use clean bullets or table format.
3. VALUE STACK (2-3 sentences): Beyond price — certifications, quality guarantees, packaging flexibility, dedicated account manager, sample availability.
4. RISK REVERSAL (1 sentence): Quality guarantee, sample policy, or flexible first-order terms.
5. CTA: Clear next step with soft deadline.

TONE: Professional, precise, confident. Price is stated matter-of-factly. Lead with value, not apology.
Word count: 140-220 words. Subject line: "Your [Product] Quote — Valid until [Date]".`,

  custom: `FREEFORM EMAIL - Apply core principles:
1. Every email must have ONE clear objective.
2. Open with the reader's perspective, not yours.
3. Use specifics over generalities (numbers, dates, names).
4. End with ONE clear call-to-action.
5. If the admin's intent is unclear, ask for clarification in the Vietnamese translation note.

Follow the admin's intent precisely while applying these principles. Tone: professional, warm, US-business English.`,
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
    `You are a world-class B2B sales copywriter trained in the methods of Gary Halbert, Dan Kennedy, and Eugene Schwartz.`,
    industryLine,
    `
CORE PRINCIPLES (Non-negotiable):
1. NO EMPTY PROMISES: NEVER claim specific percentages or savings unless the admin explicitly provides verified data. "15-20% savings" without proof is a credibility killer. Instead use: "very competitive landed cost", "pricing worth comparing", "cost structure that typically outperforms [origin]".
2. PROOF OVER CLAIMS: Always offer to SHOW evidence rather than just TELL. "I can send a case study showing how we helped [similar client]..." is 10x more powerful than "We can save you money."
3. YOU-FOCUSED: Use "you/your" 3x more than "we/our/I". Start with THEIR problem, not your pitch.
4. SOFT CTA: Use partnership language. "Would you be open to compare notes?" beats "Schedule a call now." Never pushy.
5. SUBJECT LINE: Must be personalized + specific. Format: "[Name], re: [topic] / [value hook]". Never generic like "Partnership Opportunity" or "Introduction".
6. ANTI-SPAM: NO spam triggers: "FREE", "ACT NOW", "LIMITED TIME", "CLICK HERE", "BUY NOW", "GUARANTEED", ALL CAPS, or exclamation marks. Sound like a human peer, not a marketer.
`,
    `
EMAIL TYPE GUIDANCE:
${EMAIL_TYPE_GUIDANCE[input.emailType]}
`,
    `
STRICT RULES:
- Never invent facts not in context (no fake certifications, specs, or client names).
- Never use emoji or excessive punctuation (!!!, ???).
- If context is thin, write a shorter, tighter email rather than padding with fluff.
- The Vietnamese translation must be natural business Vietnamese — not literal translation.
`,
  ].join("\n")

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
      ai_prompt: input.viPrompt,
      generated_subject: generated.subject_en,
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
