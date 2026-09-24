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
import {
  buildSupplierTrustSignals,
  buildBuyerSupplierMapping,
  getVeximPositioningSnippet,
  getSoftProductDescription,
  getSoftSeasonalityHook,
  getSeasonalCapacityAngle,
} from "@/lib/ai/vexim-positioning"

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
  introduction: `COLD INTRODUCTION - Soft 60/40 Compliance + Product & Seasonality (V4).

Vexim positioning (60% — MUST reflect):
Vexim is a compliance consulting partner for Vietnamese factories exporting to the US — not a marketplace, not a trading company.
We help Vietnamese manufacturers meet US compliance requirements: FDA registration, HACCP, ISO 22000, BRC, traceability from raw material to finished goods, lot tracking, food safety training, audit readiness.
We only work with factories we've visited and audited. We reject 80% that apply. Only those meeting US compliance standards join our network. Direct factory, transparent pricing, no trading companies.
Buyers get US-compliant suppliers, not random quotes.

BUYER PRODUCT & SEASONALITY (40% — MUST reflect, soft, not surveillance):
You have internal buyer data for reasoning, but must produce SOFT language using main_product_soft, season_hook_soft, capacity_angle_soft from context:
- Mention buyer's specific product category softly using main_product_soft (e.g., 'premium cashew kernels', 'arabica coffee', 'black pepper') — DO NOT use HS codes
- Mention seasonality softly using season_hook_soft and capacity_angle_soft (e.g., 'As we approach peak year-end sourcing period, securing consistent capacity and compliant supply is likely top of mind') — DO NOT mention exact months like 'Oct, Nov, Dec' or 'your peak is Oct-Dec' or shipment counts, TEU, volumes
- Example desired 40% part from context: example_40_percent — adapt naturally
- BAD (surveillance): 'I noticed you import cashew W320 under HS 0801.32 from Vietnam and Chile, with peak around Oct-Dec and 120 shipments, 16,800kg — capacity 80 tons lead time 15 days FDA active'
- GOOD (soft 40%): 'I noticed [Company] has a strong presence in premium cashew kernels for the US market. As we approach peak year-end sourcing period, securing consistent capacity and compliant supply is likely top of mind.'
- GOOD: 'We work with a number of buyers in the cashew category who are looking to strengthen their Vietnam supply with US-compliant factories'
- This 40% part should be 1-2 sentences at opening, right after greeting, before Vexim intro, or woven into same sentence as Vexim intro

CRITICAL — SOFT APPROACH & DATA PRIVACY (do not violate):
- Internal buyer intelligence (_internal_* fields) and supplier vetting (_internal_supplier_vetting) are FOR INTERNAL REASONING ONLY to choose angle and compliance pillar. NEVER expose raw data verbatim.
- NEVER write HS codes, specific supplier names, shipment counts, TEU, exact peak months, origin/destination ports, BOL descriptions, exact volumes/years, purchase_history details
- Supplier data also internal: do NOT list 'capacity 80 tons/month, lead time 15 days, FDA active, 5 QC engineers, FOB, T/T + L/C'. Instead soft: 'The factory we work with has been through our US compliance program and audit — FDA registration, HACCP, traceability in place, and we have verified capacity and lead time for this category'
- 60/40 SPLIT: Email must feel like 40% about buyer's product & seasonal timing + 60% about Vexim compliance consulting

STRUCTURE V4 — 60/40 (120-170 words, excluding signature):
1. SUBJECT: Soft, human, sentence case, compliance angle, under 50 chars. E.g., 'Vietnam {category} — US compliance support' or '{Company} — {product} for US market, compliance included'. NEVER Re:/Fwd.
2. HOOK — 40% Buyer insight & seasonality (1-2 sentences): Use main_product_soft + season_hook_soft + capacity_angle_soft from context. E.g., 'Hi John, I noticed [Company] has a strong presence in premium cashew kernels for the US market. As we approach peak year-end sourcing period, securing consistent capacity and compliant supply is likely top of mind.' — this is 40% part. Must be first after greeting.
3. COMPLIANCE — 60% Vexim compliance consulting (2-3 sentences): E.g., 'I'm Hoc with Vexim in Vietnam — we work as a compliance consulting partner for Vietnamese factories exporting to the US, helping them meet FDA, HACCP, and traceability requirements. Our factories go through our US compliance program and audit before joining our network — direct factory, not trading companies, only those meeting US standards.' — this is 60% part.
4. SOFT CTA (1 sentence): 'Would you be open to exploring additional Vietnam sourcing with compliance support included for your {category}? If now isn't the right time, no worries at all.'
5. CLOSE: Low-pressure out.

TONE: Compliance advisor, peer-to-peer, consultative, confident, soft. Not salesy, not surveillance, not brochure. Like a person who understands both US compliance and seasonal capacity challenges.
AVOID: marketplace pitch, listing all certs/capacity/payment, 'best price', 'cheapest', 'guaranteed', 'free sample', exclamation, ALL CAPS, raw data exposure.
MUST INCLUDE: soft product mention using main_product_soft + soft seasonality using season_hook_soft (40%) + compliance consulting (60%: FDA, HACCP, traceability, audit, direct factory).

Word count: 120-170 words (excluding signature).`,
  follow_up: `FOLLOW-UP — this email type covers TWO different sub-modes. Read the admin's Vietnamese
instruction and the opportunity context to tell which one applies, then follow that structure:

SUB-MODE 1 — "SUPPLIER CREDIBILITY" STAGE (the buyer already replied / showed interest):
This is email 2 of the funnel: Buyer relevance → Supplier credibility → Commercial offer.
Now that the buyer has engaged, it's time to answer the question the introduction email
deliberately left open: "Is this supplier actually any good?" Apply the "3 Pillars of Trust"
proof strategy in full (see the dedicated section below in this prompt for the exact content
and phrasing) — offer factory video/photos, a real COA, and real certifications (FDA, HACCP,
ISO 22000, etc.). This is also where more specific personalization (naming a past Vietnam
supplier, year, or volume) becomes appropriate, since the buyer already opted into the
conversation — see the funnel-stage guidance below for the exact rule.
STRUCTURE: 1) Thank them / acknowledge their reply, 2) answer what they asked or showed
interest in, 3) offer the 3 Pillars proof, 4) soft CTA (sample request, short call, or send
of the COA/certs they'd like to see first).

SUB-MODE 2 — "PATTERN INTERRUPT" (no response yet to a previous introduction):
Use Eugene Schwartz's escalating awareness + Dan Kennedy's urgency principles.
STRUCTURE:
1. PATTERN INTERRUPT (1 sentence): Don't say "just following up." Instead, add NEW value — a relevant industry insight, a price change, a limited availability notice.
2. RECONNECT (1 sentence): Brief reference to previous contact.
3. NEW ANGLE (1-2 sentences): Present the opportunity from a different angle — emphasize a benefit not mentioned before, or address a likely objection.
4. URGENCY + CTA: Real deadline or scarcity if applicable. Clear single action.
Do NOT lead with supplier proof here either — the buyer still hasn't engaged, so this stays
at the "buyer relevance" level, just with a new angle and urgency.

TONE: Respectful persistence. Assume they're busy, not uninterested. Add value, don't just "check in."
Word count: 80-140 words. Subject line: each email uses its own fresh subject (the system intentionally does NOT thread these as Gmail replies) — NEVER prefix with "Re:" or "Fwd:" since there is no real thread to reply to; that fake-reply pattern is flagged as deceptive by spam filters. Use a new hook with urgency instead, e.g. "Following up — [Company]'s [product] supply / [new angle]".`,

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

  sample_offer: `SAMPLE OFFER — gửi/chốt mẫu (deal đã qua giai đoạn đầu, buyer đã quan tâm supplier):
1. Mục tiêu duy nhất: chốt việc gửi mẫu — spec, số lượng mẫu, thời gian nhận.
2. Xác nhận đúng sản phẩm + spec từ deal_commercial trong context; nếu buyer đã đồng ý
   điều gì trong conversation_history thì xây trên đó, KHÔNG hỏi lại.
3. Hỏi đúng 1 nhóm thông tin còn thiếu để gửi mẫu (địa chỉ nhận / DHL-FedEx account / cert cần kèm).
4. Nêu rõ next step + timeline (VD: "DHL 3-4 days after confirmation").
Tone: gọn, operational — buyer giai đoạn này cần logistics, không cần pitch.`,

  negotiation: `NEGOTIATION — đàm phán giá & điều khoản (deal ở giai đoạn negotiation/price_agreed):
1. NEO GIÁ TRỊ trước khi nói giá: chất lượng ổn định, cert, capacity, compliance — rồi mới số.
2. TUYỆT ĐỐI không mâu thuẫn với bất kỳ con số nào đã nói trong conversation_history
   hoặc buyer_intel_notes — đó là sự thật mới nhất.
3. Khi buyer ép giá: đừng giảm ngay — đề xuất phương án thay thế (tăng volume, đổi incoterm,
   điều chỉnh spec/đóng gói, tách lô). Chỉ nhượng khi có cái đổi lại (commit volume, thanh toán tốt hơn).
4. Kết bằng 1 câu chốt cụ thể (confirm số + deadline), không để mở.
Tone: bình đẳng đối tác, tự tin, không van nài.`,

  requirement_inquiry: `REQUIREMENT INQUIRY — hỏi nhu cầu (giai đoạn engagement, chưa bán gì):
1. Mục tiêu duy nhất: hiểu specification hiện tại của buyer — sản phẩm, volume, target price,
   packaging, cert yêu cầu, điểm giao.
2. Dùng dữ liệu ImportYeti trong context để hỏi THÔNG MINH (VD volume they historically import),
   chứng tỏ đã nghiên cứu nhưng không theo dõi kiểu giám sát.
3. KHÔNG pitch supplier, KHÔNG quote giá ở email này.
4. Kết bằng câu hỏi mở đơn giản để buyer dễ trả lời.`,

  shortlist_delivery: `SHORTLIST DELIVERY — gửi danh sách supplier đã chọn (buyer đã trả lời nhu cầu):
1. Mục tiêu duy nhất: đưa buyer mở shortlist link và phản hồi supplier quan tâm.
2. 2-3 câu khác biệt hóa NGẮN cho từng supplier (điểm mạnh thật từ context, không phóng đại).
3. Nhắc buyer bấm nút quan tâm trên từng supplier trong link — hành động cụ thể, không phải "let me know".
4. KHÔNG nhắc giá ở email này (giá nằm trong shortlist).`,
}

/**
 * The "3 Pillars of Trust" supplier-credibility proof strategy.
 * Only included once the buyer has already engaged (follow_up sub-mode 1),
 * never on a cold introduction — see buildScenarioIntelligenceBlock below.
 */
const THREE_PILLARS_OF_TRUST = `
═══════════════════════════════════════════════════════════════════════════════
THE "3 PILLARS OF TRUST" - SUPPLIER CREDIBILITY STAGE (buyer already engaged)
═══════════════════════════════════════════════════════════════════════════════
The buyer has replied or shown interest, so this — not the introduction — is the right
moment to offer concrete supplier proof.
If the supplier has NO proven U.S. export history, NEVER fabricate case studies or client
references. U.S. buyers can easily verify via ImportYeti or customs data. One lie = total
credibility destruction.

PILLAR 1 - "Who are they?" (Production Capability)
→ Offer to send factory video/photos showing production line, lab, packaging area.
→ "I'd be happy to send a short video walkthrough of our facility..."

PILLAR 2 - "How do they make it?" (Quality Control)
→ Offer real COA (Certificate of Analysis) from a recent batch - doesn't need to be a US shipment.
→ "I can share a recent COA showing our quality specs: moisture, screen size, defect count..."

PILLAR 3 - "Are they trustworthy?" (Compliance)
→ Highlight REAL certifications: FDA-registered, HACCP, ISO 22000, Organic, etc.
→ "Our facility is FDA-registered and [other certs], so we're fully ready for U.S. import..."

KEY PHRASE TO USE: "We may be new to the U.S. market, but we are not new to quality."
This transforms the "weakness" into a strength of honesty and professionalism.
═══════════════════════════════════════════════════════════════════════════════
`

/**
 * Builds the "Vietnam Supplier Intelligence" (Scenario A/B/C) guidance, gated by
 * funnel stage:
 * - isFirstContact=true (introduction): "buyer relevance" only. Scenario B stays
 *   generic (no naming a former/current supplier) since specific naming on a cold
 *   email reads as surveillance. No sample/COA/proof offers.
 * - isFirstContact=false: buyer has already engaged. Specific naming (extracted
 *   supplier/year/volume) is appropriate. includePillars additionally appends the
 *   full "3 Pillars of Trust" proof content (used for the follow_up credibility stage).
 */
function buildScenarioIntelligenceBlock(isFirstContact: boolean, includePillars: boolean): string {
  const scenarioB = isFirstContact
    ? `SCENARIO B: Previously sourced from Vietnam but switched away
- ⚠️ SOFT VERSION ONLY - this is a cold first-contact email. Do NOT name the exact former
  Vietnam supplier, the exact current supplier, or the exact year/volume — even though the
  data is accurate, naming specific companies on a first email reads as if the buyer is
  being surveilled, not researched.
- OPENING: "We understand that [buyer_company] has previously sourced [main_product] from
  Vietnam. As you evaluate your current supply chain, we'd welcome the chance to reconnect
  you with Vietnam quality."
- Do NOT use purchase_history_vietnam_supplier / purchase_history_current_supplier by name
  in this email. Keep the reference to "Vietnam" general.
- ANGLE: Win them back as an alternative/secondary supplier, offer a fresh start.
- NEVER say "stopped" or "paused" — use "shifted", "diversified", "expanded". Never assume
  the switch was a problem with Vietnam suppliers.`
    : `SCENARIO B: Previously sourced from Vietnam but switched away
- ⚠️ HIGH-CONFIDENCE VERSION - the buyer is already engaged with us, so specific naming now
  reads as informed partnership, not surveillance. The AI has EXTRACTED these for you - do
  NOT re-parse from purchase_history:
  • purchase_history_vietnam_supplier = exact Vietnam supplier name (e.g., "Visimex Corp Joint Stock Com")
  • purchase_history_vietnam_year = year they bought from Vietnam (e.g., "2024")
  • purchase_history_current_supplier = exact current supplier name (e.g., "Procesadora De Alimentos Santa Isab")
  • purchase_history_current_year = year of current supplier (e.g., "2025")
  • purchase_history_volume = specific volume (e.g., "16,800 kg")
- OPENING: "I noticed [buyer_company] previously sourced from [purchase_history_vietnam_supplier]
  in [purchase_history_vietnam_year], then shifted to [purchase_history_current_supplier] in
  [purchase_history_current_year][add volume if available: for your [purchase_history_volume]
  requirements]."
- BODY: Acknowledge the previous relationship by NAME. Focus on "as you evaluate options" and
  "complementary source" — don't criticize their current suppliers.
- ⚠️ MANDATORY at this stage: use the EXTRACTED field values — they are parsed from objective
  customs/purchase history data.
- KEY: Never say "stopped" or "paused" — use "shifted", "diversified to other origins",
  "expanded to", "switched to". Never assume the switch was a problem with Vietnam suppliers.
- ANGLE: Win them back as alternative/secondary supplier, show what's improved, offer fresh start.`

  const scenarioCBody = isFirstContact
    ? `BODY for SCENARIO C:
- Do NOT offer samples, COA, or certifications yet — this email's only job is to open the
  conversation, not prove supplier quality. That comes once the buyer responds.
- Mention specific product using HS code and product name to show expertise.
- End with a QUALIFYING question about THEIR needs rather than a proof offer, e.g. "Would
  you be open to sharing your current specification so we can see if there's a fit?"`
    : `BODY for SCENARIO C:
- Emphasize TRIAL/SAMPLE approach: "We'd welcome the opportunity to send samples so you can
  evaluate our quality firsthand."
- Highlight competitive advantages: FDA-registered, consistent quality, competitive pricing.
- Mention specific product using HS code and product name to show expertise.`

  return `
═══════════════════════════════════════════════════════════════════════════════
CRITICAL: VIETNAM SUPPLIER INTELLIGENCE — FUNNEL STAGE: ${
    isFirstContact ? "EMAIL 1, buyer relevance only" : "buyer already engaged"
  }
═══════════════════════════════════════════════════════════════════════════════
ALWAYS check purchase_history FIRST to understand the buyer's Vietnam sourcing timeline.
${
  isFirstContact
    ? `⚠️ THIS IS A COLD FIRST-CONTACT EMAIL. Its ONLY job is to prove "I understand what you buy
and have a reason to believe I can help" — NOT to prove the supplier is good. Do not offer
factory video, COA, or certifications yet; that comes in the follow-up once the buyer responds.`
    : `⚠️ This email continues a conversation the buyer already engaged with. Specific, detailed
personalization (naming past suppliers, years, volumes) is now appropriate.`
}

SCENARIO A: Currently/Recently sourced from Vietnam (has_vietnam_supplier=true, recent in purchase_history)
- Opening: "Building on your relationship with [vietnam_supplier_names], we'd love to offer a complementary Vietnam source..."
- Angle: Additional supplier, diversification, competitive pricing

${scenarioB}

SCENARIO C: Never sourced from Vietnam (has_vietnam_supplier=false, vietnam_supplier_names is empty)
This buyer has NEVER purchased from Vietnam. ${isFirstContact ? "You need to earn the right to be considered, not sell yet." : "You need to build trust before they'll try Vietnam."}
Use their CURRENT suppliers and countries to position Vietnam as a relevant, worth-exploring option.

OPENING OPTIONS for SCENARIO C (choose based on available data):

Option C1 - If they source from expensive origins (Chile, Brazil, USA, Europe):
"As [buyer_company] evaluates alternatives to [main_import_countries] for your [main_product] needs, Vietnam offers a compelling combination of quality and landed cost savings."

Option C2 - If high volume buyer (total_shipments > 50 or avg_teu_per_month > 2):
"With [buyer_company]'s substantial [main_product] volume — [total_shipments] shipments — diversifying your supply chain to include Vietnam could offer meaningful cost advantages and supply security."

Option C3 - If they have specific suppliers you can name from top_suppliers:
"I noticed [buyer_company] sources [main_product] from [top_suppliers]. As you evaluate options to diversify your supply chain, Vietnam offers quality comparable to [main_import_countries] at significantly more competitive landed costs."

Option C4 - If peak_months data available and approaching:
"With [buyer_company]'s peak months ([peak_months]) approaching, now is an ideal time to explore Vietnam as a complementary source for your [main_product] needs."

Option C5 - Default fallback (use if no other data available):
"As you explore options beyond [main_import_countries] for your [main_product] requirements, Vietnam offers compelling quality at very competitive landed costs."

${scenarioCBody}

ANGLE for SCENARIO C:
- NEW OPPORTUNITY: "expand your supplier base", "diversify supply chain", "explore new origins"
- RISK MITIGATION: "supply chain security", "backup source", "reduce single-origin dependency"
- COST SAVINGS: "competitive landed costs", "favorable pricing", "value proposition"
${includePillars ? THREE_PILLARS_OF_TRUST : ""}
This buyer intelligence shows you've done your homework and builds instant credibility.
DO NOT ignore this data if it exists. DO NOT make negative assumptions about why they switched suppliers.
`
}

const outputSchema = z.object({
  subject_en: z
    .string()
    .describe("Concise, specific, US-English email subject line (max 80 chars)."),
  content_en: z
    .string()
    .describe(
      "Full English email body, starting with a greeting (e.g. 'Hi [first name],') and ending with a COMPLETE signature using REAL sender information from context. SIGNATURE FORMAT (follow exactly, name then title then legal entity then postal address; never a phone number or email address):\n\nBest regards,\n\n[sender_name]\n[sender_title]\nVEXIM GLOBAL CO., LTD\n25/6, Lane 51, Ngoa Long Street, Tay Tuu Ward, Hanoi, Vietnam\n\nFor a COLD first-contact introduction or a follow-up the buyer has NOT answered, add one short human opt-out line as the final body sentence before the signature: 'If this isn't relevant right now, just reply \"no\" and I won't reach out again — no hard feelings.' Never add that line once the buyer is in an active conversation (quotations, negotiations, replies). NEVER use placeholders like '[Your Name]', '[Your Title]'. No HTML — use plain line breaks.",
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
  /**
   * AE đã tích chọn một liên hệ cụ thể trong danh bạ làm "email chính".
   * Khi có giá trị, đây LÀ người nhận thật (ghi vào recipient_email) và
   * AI phải dùng đúng tên này để cá nhân hóa (VD: "Dear Mark Johnson"),
   * thay vì mặc định lấy contact_person/contact_email của lead.
   */
  recipientContactName?: string | null
  recipientContactEmail?: string | null
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

  // ------------------------------------------------------------
  // 2) Load opportunity context so the AI can personalize the email
  // ------------------------------------------------------------
  const { data: opportunity, error: oppError } = await supabase
    .from("opportunities")
    .select(
      `
        id,
        client_id,
        stage,
        potential_value,
        notes,
        products_interested,
        quantity_required,
        target_price_usd,
        price_unit,
        incoterms,
        payment_terms,
        destination_port,
        next_step,
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

  const lead = (opportunity as unknown as { leads: Record<string, unknown> | null }).leads
  const exporter = (opportunity as unknown as { profiles: Record<string, unknown> | null }).profiles

  if (!lead) {
    throw new Error("Opportunity has no associated lead")
  }

  // ------------------------------------------------------------
  // 2b) Load supplier vetting data (factory assessment, profile, products, certs)
  // ------------------------------------------------------------
  const clientId = (opportunity as any).client_id as string | undefined
  let supplierVetting: any = null
  let supplierProducts: any[] = []
  let supplierCerts: any[] = []
  let supplierProfile: any = null

  if (clientId) {
    const [factoryRes, profileRes, productsRes, certsRes, intakeRes] = await Promise.all([
      supabase.from("client_factory_assessments").select("*").eq("client_id", clientId).maybeSingle(),
      supabase.from("client_profiles").select("*").eq("client_id", clientId).maybeSingle(),
      supabase.from("client_products").select("product_name, hs_code, compliance_badges, moq_value, lead_time, category").eq("client_id", clientId).eq("status", "active").limit(5),
      supabase.from("compliance_docs").select("kind, title, expires_at").eq("owner_id", clientId).limit(10),
      supabase.from("profiles").select("fda_registration_number, fda_expires_at, company_name, industries, country").eq("id", clientId).maybeSingle(),
    ])

    const fa = factoryRes.data as any
    const cp = profileRes.data as any
    const prof = intakeRes.data as any

    supplierProfile = cp
    supplierProducts = productsRes.data ?? []
    supplierCerts = certsRes.data ?? []

    supplierVetting = {
      companyName: prof?.company_name ?? (opportunity as any).profiles?.company_name ?? null,
      certifications: cp?.featured_certifications ?? supplierCerts.filter((d: any) => d.kind !== "factory_video" && d.kind !== "factory_photo").map((d: any) => d.title || d.kind),
      qualitySystems: fa?.quality_systems ?? null,
      fdaStatus: fa ? (prof?.fda_registration_number ? "registered" : "checking") : (prof?.fda_registration_number ? "registered" : null),
      fdaNumber: prof?.fda_registration_number ?? null,
      productionCapacity: cp?.production_capacity ?? fa?.production_capacity_monthly ?? null,
      moq: cp?.moq ?? null,
      leadTimeDays: cp?.lead_time_days ?? fa?.lead_time_days ?? null,
      incoterms: fa?.incoterms ?? null,
      paymentPolicy: fa?.payment_policy ?? null,
      traceability: fa?.traceability ?? null,
      exportMarkets: fa?.export_markets ?? null,
      exportSinceYear: fa?.export_since_year ?? null,
      oemOdm: fa?.oem_odm ?? null,
      companyScale: fa?.company_scale ?? null,
      hasExportDept: fa?.has_export_dept ?? null,
      hasEnglishStaff: fa?.has_english_staff ?? null,
      uspPoints: cp?.usp_points ?? null,
      products: supplierProducts.map((p: any) => ({
        productName: p.product_name,
        hsCode: p.hs_code,
        complianceBadges: p.compliance_badges,
        moqValue: p.moq_value,
        leadTime: p.lead_time,
      })),
    }
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

  // ------------------------------------------------------------
  // 2b) Ngữ cảnh SỐNG của deal: email đã gửi, phản hồi buyer gần
  // nhất, và intel AE đã thu được. Không có 3 thứ này, AI soạn email
  // "mù hội thoại" — có thể trích giá khác với giá đã báo trong email
  // trước, hoặc hỏi lại điều buyer đã trả lời.
  // ------------------------------------------------------------
  const [sentDraftsRes, buyerRepliesRes, intelNotesRes] = await Promise.all([
    supabase
      .from("email_drafts")
      .select("generated_subject, generated_content_en, created_at")
      .eq("opportunity_id", input.opportunityId)
      .eq("status", "sent")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("buyer_replies")
      .select("raw_content, received_at")
      .eq("opportunity_id", input.opportunityId)
      .order("received_at", { ascending: false })
      .limit(5),
    supabase
      .from("buyer_intel_notes")
      .select("category, ai_summary, raw_note, created_at")
      .eq("opportunity_id", input.opportunityId)
      .order("created_at", { ascending: false })
      .limit(5),
  ])

  type Opp = {
    products_interested?: string | null
    quantity_required?: string | null
    target_price_usd?: number | null
    price_unit?: string | null
    incoterms?: string | null
    payment_terms?: string | null
    destination_port?: string | null
    next_step?: string | null
  }
  const opp = opportunity as unknown as Opp

  // Chronological (oldest -> newest) để AI đọc như một cuộc hội thoại.
  const conversationHistory = [
    ...(sentDraftsRes.data ?? []).map((d) => ({
      direction: "sent_to_buyer" as const,
      at: d.created_at,
      subject: d.generated_subject,
      excerpt: (d.generated_content_en ?? "").slice(0, 700),
    })),
    ...(buyerRepliesRes.data ?? []).map((r) => ({
      direction: "buyer_replied" as const,
      at: r.received_at,
      subject: null as string | null,
      excerpt: String(r.raw_content ?? "").slice(0, 700),
    })),
  ]
    .sort((a, b) => String(a.at).localeCompare(String(b.at)))
    .slice(-8) // 8 lượt trao đổi gần nhất — đủ ngữ cảnh, không phình token

  const buyerIntel = (intelNotesRes.data ?? []).map((n) => ({
    category: n.category,
    summary: n.ai_summary ?? String(n.raw_note ?? "").slice(0, 200),
    at: n.created_at,
  }))

  // Compute supplier trust signals and buyer-supplier mapping + soft 60/40 helpers
  let supplierTrustText: string | null = null
  let buyerSupplierMappingText: string | null = null
  let productSoft: string = "your product category"
  let seasonHookSoft: string = "upcoming sourcing cycle"
  let capacityAngleSoft: string = "securing reliable capacity and compliant supply is likely important"
  try {
    productSoft = getSoftProductDescription((lead["main_product"] as string) || null)
    seasonHookSoft = getSoftSeasonalityHook((lead["top_peak_months"] as string) || (lead["peak_months"] as string) || null, new Date())
    capacityAngleSoft = getSeasonalCapacityAngle(seasonHookSoft)
  } catch {
    const mp = (lead["main_product"] as string) || ""
    if (mp.toLowerCase().includes("cashew")) productSoft = "premium cashew kernels"
    else if (mp) productSoft = mp.split(",")[0].toLowerCase()
    const now = new Date()
    const month = now.getMonth() + 1
    if (month >= 9 && month <= 11) seasonHookSoft = "peak year-end sourcing period"
    else if (month >= 6 && month <= 8) seasonHookSoft = "pre-peak preparation period"
    else seasonHookSoft = "upcoming sourcing cycle"
    capacityAngleSoft = "securing consistent capacity and compliant supply is likely top of mind"
  }

  if (supplierVetting) {
    try {
      supplierTrustText = buildSupplierTrustSignals(supplierVetting as any)
    } catch {}
    try {
      const buyerForMap = {
        companyName: (lead["company_name"] as string) || "",
        country: (lead["country"] as string) || null,
        mainProduct: (lead["main_product"] as string) || null,
        hsCode: (lead["hs_code"] as string) || null,
        purchaseHistory: (lead["purchase_history"] as string) || null,
        topSuppliers: (lead["top_suppliers"] as any) || null,
        mainImportCountries: (lead["main_import_countries"] as string) || null,
        topPeakMonths: (lead["top_peak_months"] as string) || (lead["peak_months"] as string) || null,
        topLowMonths: (lead["top_low_months"] as string) || null,
        totalShipments: (lead["total_shipments"] as number) || null,
        avgTeuPerMonth: (lead["avg_teu_per_month"] as number) || null,
        originPorts: (lead["origin_ports"] as string) || null,
        destinationPorts: (lead["destination_ports"] as string) || null,
      }
      buyerSupplierMappingText = buildBuyerSupplierMapping(buyerForMap as any, supplierVetting as any)
    } catch {}
  }

  const contextBlock = JSON.stringify(
    {
      // === BUYER BASIC INFO — safe to reference softly ===
      buyer_company: lead["company_name"],
      buyer_contact: input.recipientContactName ?? lead["contact_person"],
      buyer_email: input.recipientContactEmail ?? lead["contact_email"],
      buyer_industry: lead["industry"],
      buyer_country: lead["country"],
      buyer_notes: lead["notes"],
      
      // === PRODUCT — main_product safe for soft category reference, HS and others INTERNAL ONLY ===
      main_product: lead["main_product"],
      _internal_hs_code: lead["hs_code"],
      _internal_secondary_hs_codes: lead["secondary_hs_codes"],
      _internal_bol_description: lead["bol_description"],
      
      // === SUPPLY CHAIN INTELLIGENCE — INTERNAL ONLY, never expose verbatim ===
      _internal_top_suppliers: formattedSuppliers,
      _internal_has_vietnam_supplier: hasVietnamSupplier,
      _internal_vietnam_supplier_names: vietnamSupplierNames.length > 0 ? vietnamSupplierNames : null,
      _internal_main_import_countries: lead["main_import_countries"],
      
      // === PURCHASE HISTORY & VOLUME — INTERNAL ONLY ===
      _internal_purchase_history: lead["purchase_history"],
      _internal_purchase_history_vietnam_supplier: purchaseHistoryData.vietnamSupplier,
      _internal_purchase_history_vietnam_year: purchaseHistoryData.vietnamYear,
      _internal_purchase_history_current_supplier: purchaseHistoryData.currentSupplier,
      _internal_purchase_history_current_year: purchaseHistoryData.currentYear,
      _internal_purchase_history_volume: purchaseHistoryData.volume,
      _internal_total_shipments: lead["total_shipments"],
      _internal_avg_teu_per_month: lead["avg_teu_per_month"],
      _internal_last_shipment_date: lead["last_shipment_date"],
      
      // === TIMING — INTERNAL ONLY ===
      _internal_peak_months: lead["peak_months"],
      _internal_top_low_months: lead["top_low_months"],
      
      // === LOGISTICS — INTERNAL ONLY ===
      _internal_origin_ports: lead["origin_ports"],
      _internal_destination_ports: lead["destination_ports"],
      _internal_container_types: lead["container_types"],
      
      // === PRIORITY ===
      priority_rating: lead["priority_rating"],
      
      // === EXPORTER (Our client) INFO ===
      exporter_company: exporter?.["company_name"] ?? null,
      exporter_industry: exporter?.["industry"] ?? null,
      exporter_email: exporter?.["email"] ?? null,
      exporter_phone: exporter?.["phone"] ?? null,
      
      // === SENDER (AE) INFO ===
      sender_name: aeProfile?.full_name ?? null,
      sender_title: 
        aeProfile?.role === "super_admin" ? "Founder & CEO" :
        aeProfile?.role === "account_executive" ? "Account Executive" :
        aeProfile?.role === "staff" ? "Business Development Manager" :
        "Business Development",
      sender_company: "VEXIM GLOBAL CO., LTD",
      sender_address: "25/6, Lane 51, Ngoa Long Street, Tay Tuu Ward, Hanoi, Vietnam",
      
      // === OPPORTUNITY INFO ===
      opportunity_stage: (opportunity as { stage: string }).stage,
      potential_value_usd: (opportunity as { potential_value: number | null })
        .potential_value,
      opportunity_notes: (opportunity as { notes: string | null }).notes,

      // === DEAL COMMERCIAL TERMS ===
      deal_products_interested: opp.products_interested ?? null,
      deal_quantity_required: opp.quantity_required ?? null,
      deal_target_price_usd: opp.target_price_usd ?? null,
      deal_price_unit: opp.price_unit ?? null,
      deal_incoterms: opp.incoterms ?? null,
      deal_payment_terms: opp.payment_terms ?? null,
      deal_destination_port: opp.destination_port ?? null,
      deal_next_step: opp.next_step ?? null,

      // === CONVERSATION HISTORY ===
      conversation_history: conversationHistory,

      // === LIVE BUYER INTEL ===
      buyer_intel_notes: buyerIntel,

      // === SOFT 60/40 HELPERS — safe to use in email ===
      main_product_soft: productSoft,
      season_hook_soft: seasonHookSoft,
      capacity_angle_soft: capacityAngleSoft,
      current_date: new Date().toISOString().split("T")[0],
      current_month: new Date().getMonth() + 1,
      example_40_percent: `I noticed ${lead["company_name"] || "your company"} has a strong presence in ${productSoft} for the US market. As we approach ${seasonHookSoft}, ${capacityAngleSoft}.`,

      // === SUPPLIER VETTING — INTERNAL ONLY, for reasoning, never expose raw specs ===
      _internal_supplier_vetting: supplierVetting ? {
        company_name: supplierVetting.companyName,
        certifications: supplierVetting.certifications,
        quality_systems: supplierVetting.qualitySystems,
        fda_status: supplierVetting.fdaStatus,
        fda_number: supplierVetting.fdaNumber,
        production_capacity: supplierVetting.productionCapacity,
        moq: supplierVetting.moq,
        lead_time: supplierVetting.leadTimeDays,
        incoterms: supplierVetting.incoterms,
        payment_policy: supplierVetting.paymentPolicy,
        traceability: supplierVetting.traceability,
        export_markets: supplierVetting.exportMarkets,
        export_since_year: supplierVetting.exportSinceYear,
        oem_odm: supplierVetting.oemOdm,
        company_scale: supplierVetting.companyScale,
        has_export_dept: supplierVetting.hasExportDept,
        has_english_staff: supplierVetting.hasEnglishStaff,
        usp_points: supplierVetting.uspPoints,
        key_products: supplierVetting.products,
        trust_signals_text: supplierTrustText,
      } : null,

      // === BUYER-SUPPLIER MAPPING — INTERNAL REASONING ONLY ===
      _internal_buyer_supplier_mapping: buyerSupplierMappingText,

      // === VEXIM POSITIONING — compliance consulting for VN exporters to US ===
      vexim_positioning: {
        who_we_are: "Vexim is a compliance consulting partner for Vietnamese factories exporting to the US — not a marketplace, not a trading company",
        what_we_do: "We help Vietnamese manufacturers meet US compliance: FDA registration, HACCP, ISO 22000, BRC, traceability from raw material to finished goods, lot tracking, food safety training, audit readiness",
        how_we_select: "Only factories we've visited and audited, that meet US compliance standards, join our network. We reject 80% that apply. Direct factory, transparent pricing, no trading companies",
        trust_pillars_soft: [
          "Compliance program for US market: FDA, HACCP, ISO, BRC, traceability",
          "Factory audit by Vexim team, direct factory, 50-300 workers typical",
          "Quality system: traceability, QC engineers, English export team",
          "Support: 24h response, video factory tour, flexible payment T/T and L/C at sight",
        ],
      },
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

  // Funnel stage flags gating the buyer-intelligence playbook:
  // Buyer relevance (introduction) → Supplier credibility (follow_up) → Commercial offer (quotation).
  // introduction must never lead with supplier proof or name a past Vietnam supplier by
  // name (reads as surveillance on a cold email). follow_up is where the "3 Pillars of
  // Trust" proof and specific historical naming belong, since the buyer already engaged.
  const isFirstContact = input.emailType === "introduction"
  const includeThreePillars = input.emailType === "follow_up"

  // Quy tắc nhất quán hội thoại: bắt buộc khi đã có lịch sử trao đổi.
  const conversationGuidance =
    conversationHistory.length > 0
      ? `
CONVERSATION CONTINUITY (CRITICAL): the context's "conversation_history" contains the most
recent emails BOTH WAYS in this thread (oldest -> newest). Your draft MUST stay consistent
with everything already said:
- NEVER contradict a price, quantity, lead time, term, or date from an earlier email.
- Do NOT re-ask a question the buyer already answered; build on their answer instead.
- Match the evolving tone: if the buyer is warm and specific, skip cold-open formality.
- If "buyer_intel_notes" is present, it is verified live intel from calls/chats (e.g. the
  negotiated target price) — treat it as the most current truth when it conflicts with
  older emails.`
      : `
CONVERSATION CONTINUITY: no prior emails recorded for this deal — write a fresh, appropriate
touch for the chosen email type, using deal_commercial terms and buyer intel if present.`

  const system = [
    `You are a world-class B2B sales copywriter trained in the methods of Gary Halbert, Dan Kennedy, and Eugene Schwartz.`,
    industryLine,
    conversationGuidance,
    `
VEXIM POSITIONING - WHO WE ARE (never contradict this):
Vexim Trade is a sourcing/export PARTNER that connects US buyers with vetted Vietnamese manufacturers
matched to their specific requirements — NOT a broker blasting out a generic supplier list.
- Prefer partner language over broker language. Instead of "we work with a few Vietnamese
  manufacturers that may fit your sourcing requirements," write: "Rather than sending you a general
  supplier list, we can shortlist manufacturers based on your current specification, volume and
  compliance requirements."
- Vexim's value is in understanding the buyer's sourcing profile FIRST, then matching the right
  manufacturer — never in pushing a specific supplier before the buyer's needs are understood.`,
    `
CONTEXT DATA - Do NOT get confused:
- "exporter_company" = The BUYER's company (e.g., "Công Ty Long An"). This is NOT for the signature.
- "sender_name", "sender_title", "sender_company", "sender_address" = The AE's info from VEXIM GLOBAL CO., LTD. These go in the signature (name, title, legal entity, then the postal address on its own line). There is no sender_email or sender_phone in context — never invent or ask for them, and never put a phone number or email address in the email.

Example to avoid confusion:
- Exporter company: "Công Ty Long An" (This is the buyer we're reaching out to)
- Sender: "Luong Van Hoc, Account Executive at VEXIM GLOBAL CO., LTD" (This is the AE sending the email)
- The email is FROM Luong Van Hoc (Vexim) TO the buyer at Công Ty Long An. In the body, call the company "Vexim"; the signature line is always "VEXIM GLOBAL CO., LTD".`,
    `
GREETING & SUBJECT PERSONALIZATION:
- "buyer_contact" is the EXACT person this email is addressed to (the AE explicitly selected them as the main recipient). ALWAYS greet them by this name: "Dear [buyer_contact]," or "Hi [first name],". Never use a generic greeting like "Dear Sir/Madam" or "Dear Team" when buyer_contact is provided.
- Use only the person's given first name in the subject line personalization (e.g. buyer_contact="Mark Johnson" → "Mark, ..." — NEVER "Mark, re: ..." since a fake "Re:" on a non-reply is flagged as a deceptive subject line by spam filters), and their full name or first name in the greeting.
- If buyer_contact is null, fall back to a professional generic greeting referencing buyer_company, e.g. "Dear [buyer_company] Team,".`,
    `
1. NO EMPTY PROMISES: NEVER claim specific percentages or savings unless the admin explicitly provides verified data. "15-20% savings" without proof is a credibility killer. Instead use: "very competitive landed cost", "pricing worth comparing", "cost structure that typically outperforms [origin]".
2. PROOF OVER CLAIMS: Always offer to SHOW evidence rather than just TELL. "I can send a case study showing how we helped [similar client]..." is 10x more powerful than "We can save you money."
3. YOU-FOCUSED: Use "you/your" 3x more than "we/our/I". Start with THEIR problem, not your pitch.
4. SOFT CTA: Use partnership language. "Would you be open to compare notes?" beats "Schedule a call now." Never pushy.
5. SUBJECT LINE: Must be personalized + specific. Format: "[Name], [value hook] / [topic]". NEVER prefix with "Re:" or "Fwd:" — there is no real prior thread, and a fake reply prefix is flagged as a deceptive subject line by Gmail/Outlook spam filters. Never generic like "Partnership Opportunity" or "Introduction" either.
6. ANTI-SPAM: NO spam triggers: "FREE", "ACT NOW", "LIMITED TIME", "CLICK HERE", "BUY NOW", "GUARANTEED", ALL CAPS, or exclamation marks. Sound like a human peer, not a marketer.
7. SIGNATURE: ABSOLUTELY CRITICAL - The signature MUST contain ONLY:
   - sender_name (the AE's real name - e.g., "Luong Van Hoc", NOT "[Your Name]")
   - sender_title (the AE's title/role - e.g., "Account Executive" or "Business Development Manager")
   - sender_company, exactly "VEXIM GLOBAL CO., LTD"
   - sender_address, the registered postal address, verbatim on its own line

   SIGNATURE FORMAT (MUST FOLLOW EXACTLY):
   Best regards,

   [sender_name]
   [sender_title]
   VEXIM GLOBAL CO., LTD
   25/6, Lane 51, Ngoa Long Street, Tay Tuu Ward, Hanoi, Vietnam

   ⚠️ NEVER include email addresses (personal or work) in the signature.
   ⚠️ NEVER include phone numbers of any kind in the signature.
   ⚠️ NEVER use placeholder text like "[Your Name]" or "[Your Title]".
   ⚠️ NEVER use the buyer/exporter name in the signature.

   The signature should be minimal and professional. Buyers reply to the email directly - no need for additional contact info. In the body, refer to the company conversationally as "Vexim"; the legal line "VEXIM GLOBAL CO., LTD" appears only in the signature.

8. CAN-SPAM ON COLD EMAILS: for the cold "introduction" and any "follow_up" sent while the buyer has NOT replied, end the body (just before the signature) with one short, human opt-out line: 'If this isn't relevant right now, just reply "no" and I won't reach out again — no hard feelings.' Do NOT include it once the buyer has replied (quotations, sample offers, negotiations, active replies).
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
   
   ⚠️ HOW SPECIFIC TO GET DEPENDS ON THE FUNNEL STAGE — see the "VIETNAM SUPPLIER
   INTELLIGENCE" section further below for the exact rule. On a COLD FIRST-CONTACT
   email (introduction), naming the exact former/current supplier by name reads as
   surveillance, not insight — use the soft version instead. Once the buyer has
   replied and is engaged (follow_up credibility stage), naming the exact extracted
   supplier/year/volume is the high-impact move.
   
   - If has_vietnam_supplier=true and still active: "Building on your experience with [EXACT_vietnam_supplier_name], we offer a complementary source..." (this framing is fine even on a first email, since it is not surfacing a SWITCH, just an ongoing relationship)
   - If has_vietnam_supplier=false: "As you expand beyond [main_import_countries], Vietnam offers compelling quality and pricing..."

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
- SIGNATURE: Always end with a COMPLETE signature using ONLY sender_name, sender_title, sender_company ("VEXIM GLOBAL CO., LTD"), and sender_address (registered Hanoi postal address) from context, in that order. No email line, no phone number. NEVER use placeholders like "[Your Name]" or "[Your Contact Information]".
- OPT-OUT: cold introductions and unanswered follow-ups must close with the one-line human opt-out (reply "no"); omit it in every email inside an active conversation.
`,
    buildScenarioIntelligenceBlock(isFirstContact, includeThreePillars),
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
    const recipient = input.recipientContactEmail ?? (lead["contact_email"] as string | null) ?? null
    
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
  const recipient = input.recipientContactEmail ?? (lead["contact_email"] as string | null) ?? null

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
