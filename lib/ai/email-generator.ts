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
 * Extract specific purchase history details (supplier names, years, volumes) from raw text.
 * Input: "Mua của Visimex Corp Joint Stock Com (VN) từ năm 2024, năm 2025 mua của Procesadora De Alimentos Santa Isab (Chile) số lượng 16.800kg"
 * Output: { vietnamSupplier: "Visimex Corp Joint Stock Com", vietnamYear: "2024", currentSupplier: "Procesadora De Alimentos Santa Isab", currentYear: "2025", volume: "16,800kg" }
 */
function extractPurchaseHistoryDetails(text: string | null): {
  vietnamSupplier: string | null
  vietnamYear: string | null
  currentSupplier: string | null
  currentYear: string | null
  volume: string | null
} {
  const result = {
    vietnamSupplier: null,
    vietnamYear: null,
    currentSupplier: null,
    currentYear: null,
    volume: null,
  }

  if (!text?.trim()) return result

  // Extract Vietnam supplier and year: "Mua của [NAME] (VN/Vietnam)" + optional "từ năm [YEAR]"
  const vnMatch = text.match(/[Mm]ua\s+(?:của|của|from)?\s+(.+?)\s*\((?:VN|Việt\s*Nam|Vietnam|Viet Nam)\)(?:.*?(?:từ|from)\s+năm\s+(\d{4}))?/)
  if (vnMatch) {
    result.vietnamSupplier = vnMatch[1].trim()
    if (vnMatch[2]) result.vietnamYear = vnMatch[2]
  }

  // Extract current/recent supplier: Look for "năm [YEAR] mua của [NAME] ([COUNTRY])"
  const currentMatch = text.match(/năm\s+(\d{4})\s+mua\s+(?:của|của|from)?\s+(.+?)\s*\(([^)]+)\)/)
  if (currentMatch) {
    result.currentYear = currentMatch[1]
    result.currentSupplier = currentMatch[2].trim()
  }

  // Extract volume: "số lượng [NUMBER]kg" or just "[NUMBER]kg"
  const volumeMatch = text.match(/(?:số\s+lượng\s+)?(\d+(?:[.,]\d+)?)\s*kg/i)
  if (volumeMatch) {
    result.volume = volumeMatch[1].replace(",", ",") + " kg"
  }

  return result
}

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
      "Full English email body, starting with a greeting (e.g. 'Dear [Name]') and ending with a COMPLETE signature using REAL sender information from context. SIGNATURE FORMAT:\n\nBest regards,\n\n[SENDER_FULL_NAME]\n[EXPORTER_COMPANY_NAME]\n[SENDER_EMAIL]\n[SENDER_PHONE]\n\nNEVER use placeholders like '[Your Name]', '[Your Contact]', etc. Use the actual names and contacts provided in the context. If any info is missing, use only what's available. No HTML — use plain line breaks.",
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
  /** Manual mode - skip AI generation and use provided content directly */
  isManual?: boolean
  manualSubject?: string
  manualContent?: string
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

  // Get AE (sender) full profile information
  const { data: aeProfile } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, role")
    .eq("id", user.id)
    .single()

  console.log("[v0] aeProfile loaded:", { 
    id: aeProfile?.id, 
    full_name: aeProfile?.full_name, 
    email: aeProfile?.email,
    phone: aeProfile?.phone 
  })

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
        profiles:profiles!opportunities_client_id_fkey(
          id,
          company_name, 
          industry,
          email,
          phone
        )
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
  
  // Extract top suppliers and check if any are from Vietnam
  const topSuppliers = lead["top_suppliers"] as { name: string; country: string | null }[] | null
  const hasVietnamSupplier = topSuppliers?.some(
    s => s.country?.toLowerCase().includes("vietnam") || s.country?.toLowerCase().includes("viet nam")
  ) ?? false
  const vietnamSupplierNames = topSuppliers
    ?.filter(s => s.country?.toLowerCase().includes("vietnam") || s.country?.toLowerCase().includes("viet nam"))
    .map(s => s.name) ?? []

  // Format suppliers for context
  const formattedSuppliers = topSuppliers?.map(s => `${s.name} (${s.country || "Unknown"})`).join(", ") ?? null

  // ⚠️ Extract specific purchase history details for SCENARIO detection
  const purchaseHistoryStr = lead["purchase_history"] as string | null
  const purchaseHistoryData = extractPurchaseHistoryDetails(purchaseHistoryStr)

  // ⚠️ DATA QUALITY CHECK: Log when critical fields are missing
  const hasPurchaseHistory = purchaseHistoryStr?.trim() && purchaseHistoryStr.trim().length > 10
  if (!hasPurchaseHistory) {
    console.warn(
      "[v0] Email Generator WARNING: purchase_history is empty or minimal for lead",
      lead["company_name"],
      "→ Email will lack personalization 'ammunition'"
    )
  }
  if (!topSuppliers || topSuppliers.length === 0) {
    console.warn(
      "[v0] Email Generator WARNING: top_suppliers is empty for lead",
      lead["company_name"],
      "→ Cannot detect Vietnam supplier leverage"
    )
  }

  const contextBlock = JSON.stringify(
    {
      // === BUYER BASIC INFO ===
      buyer_company: lead["company_name"],
      buyer_contact: lead["contact_person"],
      buyer_email: lead["contact_email"],
      buyer_industry: lead["industry"],
      buyer_country: lead["country"],
      buyer_notes: lead["notes"],
      
      // === PRODUCT & HS CODE (Critical for personalization) ===
      main_product: lead["main_product"], // e.g., "Cashewnut Kernels", "Arabica Green Coffee"
      hs_code: lead["hs_code"], // Primary HS code
      secondary_hs_codes: lead["secondary_hs_codes"], // Other HS codes they import
      bol_description: lead["bol_description"], // Detailed product description from BOL
      
      // === SUPPLY CHAIN INTELLIGENCE (Key for competitive positioning) ===
      top_suppliers: formattedSuppliers, // Current suppliers with countries
      has_vietnam_supplier: hasVietnamSupplier, // Already buying from VN?
      vietnam_supplier_names: vietnamSupplierNames.length > 0 ? vietnamSupplierNames : null,
      main_import_countries: lead["main_import_countries"], // Origin countries they buy from
      
      // === PURCHASE HISTORY & VOLUME (For sizing the opportunity) ===
      purchase_history: lead["purchase_history"], // Summary of past purchases
      purchase_history_vietnam_supplier: purchaseHistoryData.vietnamSupplier, // ⭐ EXTRACTED: Specific Vietnam supplier name if mentioned
      purchase_history_vietnam_year: purchaseHistoryData.vietnamYear, // ⭐ EXTRACTED: Year when they bought from Vietnam
      purchase_history_current_supplier: purchaseHistoryData.currentSupplier, // ⭐ EXTRACTED: Current/recent supplier name
      purchase_history_current_year: purchaseHistoryData.currentYear, // ⭐ EXTRACTED: Year of current supplier
      purchase_history_volume: purchaseHistoryData.volume, // ⭐ EXTRACTED: Specific volume in kg
      total_shipments: lead["total_shipments"], // Total shipment count
      avg_teu_per_month: lead["avg_teu_per_month"], // Average volume
      last_shipment_date: lead["last_shipment_date"], // Recency of activity
      
      // === TIMING (For outreach timing) ===
      peak_months: lead["peak_months"], // High-demand months
      top_low_months: lead["top_low_months"], // Low-demand months
      
      // === LOGISTICS (For operational fit) ===
      origin_ports: lead["origin_ports"], // Ports they ship from
      destination_ports: lead["destination_ports"], // Ports they receive at
      container_types: lead["container_types"], // Container preferences
      
      // === PRIORITY & QUALIFICATION ===
      priority_rating: lead["priority_rating"], // 1-5 priority score
      
      // === EXPORTER (Our client) INFO ===
      exporter_company: exporter?.["company_name"] ?? null,
      exporter_industry: exporter?.["industry"] ?? null,
      exporter_email: exporter?.["email"] ?? null,
      exporter_phone: exporter?.["phone"] ?? null,
      
      // === SENDER (AE) INFO - Use for email signature ===
      sender_name: aeProfile?.full_name ?? null,
      sender_email: aeProfile?.email ?? user.email ?? null,
      sender_phone: aeProfile?.phone ?? null,
      
      // === OPPORTUNITY INFO ===
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
7. SIGNATURE: ABSOLUTELY CRITICAL - The signature MUST contain:
   - sender_name (the AE's real name - e.g., "Hoc Luong", NOT "[Your Name]")
   - exporter_company (company name - e.g., "Công Ty Long An")
   - sender_email (e.g., hocluongvan88@gmail.com)
   - sender_phone (e.g., 0987868765)
   Format should be clean and professional. NEVER use any placeholder text.
`,
`
═══════════════════════════════════════════════════════════════════════════════
PERSONALIZATION INTELLIGENCE - USE THIS DATA TO WRITE HIGHLY TARGETED EMAILS
════════════════════════════════════════════════════════════════════════════════

⚠️⚠️⚠️ CRITICAL - HIGHEST PRIORITY FIELD ⚠️⚠️⚠️
"purchase_history" is THE MOST POWERFUL data source for email personalization.
This is your FIRST & PRIMARY source of truth for understanding buyer motivation.
If purchase_history is populated → USE IT AGGRESSIVELY in the email opening.
If purchase_history is NULL/EMPTY → Email will be GENERIC and WEAK.
The difference between A+ emails and mediocre ones IS purchase_history data.

⚠️ CRITICAL DATA SOURCE PRIORITY:
- "purchase_history" = OBJECTIVE trade data from customs/shipping records. TRUST THIS ABOVE ALL ELSE.
- "buyer_notes" = Internal admin notes (may contain opinions, outdated info, or errors). USE WITH CAUTION.
- When there's conflict between purchase_history and buyer_notes, ALWAYS trust purchase_history.

HOW TO DETECT WHICH SCENARIO:
1. Read purchase_history carefully
2. If vietnam_supplier_names is not empty AND most recent shipment is from Vietnam: SCENARIO A (still sourcing)
3. If vietnam_supplier_names is not empty AND past shipments mention Vietnam BUT recent shipments show other origins: SCENARIO B (switched)
4. If vietnam_supplier_names is empty: SCENARIO C (never sourced)

Example: "Mua của Visimex Corp Joint Stock Com (VN) từ năm 2024, năm 2025 mua của Procesadora De Alimentos Santa Isab (Chile)"
= SCENARIO B: They bought from VN in 2024, then switched to Chile in 2025. Use the specific opening for B.

You have access to rich buyer intelligence. USE IT to personalize every email:

1. PRODUCT SPECIFICITY (main_product, hs_code, bol_description):
   - NEVER write generic "your products" - use EXACT product names: "your Cashewnut Kernels supply", "your Arabica Grade 1 needs"
   - Reference HS codes when relevant to show expertise: "HS 0801.32 cashews"
   - Use BOL descriptions to understand exact specs they buy

2. SUPPLY CHAIN LEVERAGE (top_suppliers, has_vietnam_supplier, main_import_countries, purchase_history):
   - READ purchase_history WORD BY WORD to extract:
     a) SPECIFIC supplier names (e.g. "Visimex Corp Joint Stock Com", "Procesadora De Alimentos Santa Isab")
     b) SPECIFIC years (e.g. "2024", "2025")
     c) SPECIFIC volumes if mentioned (e.g. "16,800kg")
   
   ⚠️ MANDATORY: You MUST use the EXACT supplier names from purchase_history in the email!
   - WRONG: "I noticed you sourced from Vietnam in 2024, then shifted to Chile"
   - CORRECT: "I noticed you sourced from Visimex Corp in Vietnam during 2024, then shifted to Procesadora De Alimentos in Chile for your 16,800kg requirements"
   
   - If they previously bought from Vietnam but recently switched: "I noticed you sourced from [EXACT_VIETNAM_SUPPLIER_NAME] in [YEAR] — as you evaluate options beyond [EXACT_CURRENT_SUPPLIER], we'd love to reconnect you with Vietnam quality..."
   - If has_vietnam_supplier=true and still active: "Building on your experience with [EXACT_vietnam_supplier_name], we offer a complementary source..."
   - If has_vietnam_supplier=false: "As you expand beyond [main_import_countries], Vietnam offers compelling quality and pricing..."
   
   NEVER use generic terms like "Vietnam" or "Chile" when you have the actual company name!

3. VOLUME & SCALE (total_shipments, avg_teu_per_month):
   - High volume (>50 shipments, >2 TEU/month): Emphasize capacity, consistency, dedicated account management
   - Lower volume: Emphasize flexibility, MOQ accommodation, sample programs

4. TIMING INTELLIGENCE (peak_months, top_low_months, last_shipment_date):
   - If approaching peak_months: "With your Q[X] season approaching..."
   - If in low months: Good time for sampling/relationship building
   - Recent last_shipment_date: Active buyer, act fast

5. LOGISTICS FIT (origin_ports, destination_ports, container_types):
   - Reference their destination ports to show you can serve them
   - Container type knowledge shows operational understanding

6. PRIORITY (priority_rating):
   - High priority (4-5): More aggressive follow-up, premium positioning
   - Lower priority: Softer approach, relationship-building focus

CRITICAL: Only use data that exists in the context. If a field is null, don't mention it.

⚠️ DATA CONFLICT HANDLING:
If buyer_notes contradicts purchase_history (e.g., notes say "stopped buying from VN in 2024" but purchase_history says "bought from Visimex VN in 2024"):
- ALWAYS trust purchase_history over buyer_notes
- purchase_history is from objective customs/shipping records
- buyer_notes may be outdated, incorrect, or contain admin opinions
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
- SIGNATURE: Always end with a COMPLETE signature using sender_name, exporter_company, sender_email, sender_phone from context. NEVER use placeholders like "[Your Name]" or "[Your Contact Information]".
`,
    `
═══════════════════════════════════════════════════════════════════════════════
CRITICAL: VIETNAM SUPPLIER INTELLIGENCE
═══════════════════════════════════════════════════════════════════════════════

ALWAYS check purchase_history FIRST to understand the buyer's Vietnam sourcing timeline:

SCENARIO A: Currently/Recently sourced from Vietnam (has_vietnam_supplier=true, recent in purchase_history)
- Opening: "Building on your relationship with [vietnam_supplier_names], we'd love to offer a complementary Vietnam source..."
- Angle: Additional supplier, diversification, competitive pricing

SCENARIO B: Previously sourced from Vietnam but switched away (mentioned in purchase_history as past, then switched to other origin)
- ⚠️ CRITICAL: The AI has EXTRACTED these for you - DO NOT re-parse from purchase_history:
  • purchase_history_vietnam_supplier = exact Vietnam supplier name (e.g., "Visimex Corp Joint Stock Com")
  • purchase_history_vietnam_year = year they bought from Vietnam (e.g., "2024")
  • purchase_history_current_supplier = exact current supplier name (e.g., "Procesadora De Alimentos Santa Isab")
  • purchase_history_current_year = year of current supplier (e.g., "2025")
  • purchase_history_volume = specific volume (e.g., "16,800 kg")
  
- OPENING: "I noticed [buyer_company] previously sourced from [purchase_history_vietnam_supplier] in [purchase_history_vietnam_year], then shifted to [purchase_history_current_supplier] in [purchase_history_current_year][add volume if available: for your [purchase_history_volume] requirements]."
- BODY: Acknowledge the previous relationship by NAME. Focus on "as you evaluate options" and "complementary source" — don't criticize their current suppliers.
- ANGLE: Win them back as alternative/secondary supplier, show what's improved, offer fresh start
- ⚠️ MANDATORY: You MUST use the EXTRACTED field values! These are parsed from objective customs/purchase history data.
- EXAMPLE for American Cashew: "I noticed American Cashew worked with Visimex Corp on Cashewnut Kernels in 2024 before shifting to Procesadora De Alimentos in Chile for your 16,800 kg requirements. With your Q2-Q3 season approaching, we'd love to reconnect you with premium Vietnam cashews at landed costs worth comparing."
- KEY: Never say "stopped" or "paused" — use "shifted", "diversified to other origins", "expanded to", "switched to"
- NEVER make negative assumptions about why they switched. Assume it was a business decision, not a problem with Vietnam suppliers.

SCENARIO C: Never sourced from Vietnam (has_vietnam_supplier=false)
- Opening: "As you explore options beyond [main_import_countries], Vietnam offers compelling quality at very competitive landed costs..."
- Angle: New opportunity, expand supplier base

This reference shows you've done your homework and builds instant credibility.
DO NOT ignore this data if it exists. DO NOT make negative assumptions about why they switched suppliers.
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
  // 4) Manual mode bypass - skip AI generation
  // ------------------------------------------------------------
  if (input.isManual && input.manualSubject && input.manualContent) {
    const recipient = (lead["contact_email"] as string | null) ?? null
    
    const { data: draft, error: draftError } = await supabase
      .from("email_drafts")
      .insert({
        opportunity_id: input.opportunityId,
        email_type: input.emailType,
        ai_prompt: "[MANUAL]",
        generated_subject: input.manualSubject,
        generated_content_en: input.manualContent,
        translated_content_vi: input.manualContent, // Same content for manual
        recipient_email: recipient,
        status: "pending_approval",
        created_by: user.id,
      })
      .select("id")
      .single()

    if (draftError || !draft) {
      throw new Error(draftError?.message ?? "Failed to save manual draft")
    }

    return {
      draftId: draft.id,
      subject_en: input.manualSubject,
      content_en: input.manualContent,
      content_vi: input.manualContent,
      recipient_email: recipient,
    }
  }

  // ------------------------------------------------------------
  // 5) Call OpenAI via AI Gateway and get structured output
  // ------------------------------------------------------------
  const { experimental_output: generated } = await generateText({
    model: "openai/gpt-4o-mini",
    system,
    prompt: userPrompt,
    experimental_output: Output.object({ schema: outputSchema }),
  })

  // ------------------------------------------------------------
  // 6) Persist as email_draft awaiting approval
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
