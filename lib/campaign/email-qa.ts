// Email Quality Checker (spec §21) — deterministic rules first, chạy TRƯỚC khi
// draft vào approval queue. risk_level = HIGH → chặn gửi ở UI approve.
//
// B1 dùng rule thuần (nhanh, miễn phí, đoán được lý do) — kiểm "no invented
// facts" bằng cách quét các claim rủi ro (cert/FDA/price/MOQ…) không có nguồn
// trong BuyerContext: nếu context ghi UNKNOWN mà email nhắc tới → issue.

import { MAX_EMAIL_WORDS } from "./constants"
import type { BuyerContext } from "./types"

export interface QAIssue {
  check: string
  severity: "HIGH" | "MEDIUM" | "LOW"
  message: string
}

export interface QAResult {
  passed: boolean
  risk_level: "LOW" | "MEDIUM" | "HIGH"
  issues: QAIssue[]
  word_count: number
}

const SPAM_WORDS = [
  /\bfree\s+(?:sample|trial|offer|quote|gift)\b/i,
  /\bguarantee(d)?\b/i,
  /\bdiscount\b/i,
  /\bact now\b/i,
  /\brisk[- ]free\b/i,
  /\blimited time\b/i,
  /\bno obligation\b/i,
  /\bclick here\b/i,
  /\bcongratulations\b/i,
  /\bdear (friend|sir|madam)\b/i,
]

const UNSUPPORTED_CLAIM_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bFDA[- ](approved|registered|approved facility)\b/i, label: "FDA approval claim" },
  { pattern: /\bUSDA (organic|approved)\b/i, label: "USDA claim" },
  { pattern: /\bcertified\b/i, label: "certification claim" },
  { pattern: /\b(price|pricing)\s*(is|at|of)?\s*\$?\d/i, label: "price mention" },
  { pattern: /\bMOQ\b/i, label: "MOQ mention" },
  { pattern: /\b\d{2,}\s*(mt|tons?|containers?|units?|kg)\b(?:\s*\/?\s*(month|mo))?\b/i, label: "capacity/volume figure" },
]

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

/** Trigram similarity 0..1 — chống duplicate wording giữa các email. */
function trigramSimilarity(a: string, b: string): number {
  const grams = (s: string) => {
    const norm = s.toLowerCase().replace(/\s+/g, " ").trim()
    const set = new Set<string>()
    for (let i = 0; i < norm.length - 2; i++) set.add(norm.slice(i, i + 3))
    return set
  }
  const ga = grams(a)
  const gb = grams(b)
  if (ga.size === 0 || gb.size === 0) return 0
  let inter = 0
  for (const g of ga) if (gb.has(g)) inter++
  return inter / Math.min(ga.size, gb.size)
}

/**
 * Chạy 12 điểm QA (spec §21). Thuần function — test được, không DB, không AI.
 * @param params.email       Bản email sinh ra (hoặc AE sửa)
 * @param params.recipient   Địa chỉ sẽ gửi
 * @param params.ctx         BuyerContext đã dùng để sinh
 * @param params.optOutRequired Every campaign step requires the exact approved opt-out sentence.
 */
export function runEmailQA(params: {
  email: { subjectEn: string; contentEn: string }
  recipient: string | null | undefined
  ctx: BuyerContext
  optOutRequired: boolean
  /** Loại bước hiện tại — close_loop/nurture không bắt buộc câu hỏi CTA. */
  stepType?: string
}): QAResult {
  const issues: QAIssue[] = []
  const { email, recipient, ctx, optOutRequired, stepType } = params
  const body = email.contentEn
  const words = countWords(body)
  const proseBeforeSignature = body.split(/\n\s*Best regards,/i)[0]

  if (/^\s*(?:[-*•]|\d+[.)])\s+/m.test(proseBeforeSignature)) {
    issues.push({ check: "body_bullets", severity: "HIGH", message: "Campaign email bodies must use plain prose, not bullet lists." })
  }

  // Pilot-specific hard language guardrails: these should never reach approval.
  const bannedCopy = body.match(/\bverified suppliers?\b|\baudited\b|\bleading\b|\btrusted\b|\bbest\b(?!\s+regards)|\bworld[- ]class\b|\bone[- ]stop\b|\bgame[- ]changer\b|hope this email finds you well|I wanted to reach out|\bsynergy\b|\bcutting[- ]edge\b/i)
  if (bannedCopy) {
    issues.push({ check: "campaign_banned_copy", severity: "HIGH", message: `Banned campaign wording: "${bannedCopy[0]}".` })
  }
  if (/\b(?:your|the buyer'?s|your team's) team in Vietnam\b|\bteam in Vietnam\b/i.test(body)) {
    issues.push({ check: "buyer_location", severity: "HIGH", message: "Do not describe the buyer or buyer team as being in Vietnam." })
  }
  if (/align(?:ing|s)? product fit|aligning .* compliance needs/i.test(body)) {
    issues.push({ check: "consultant_jargon", severity: "HIGH", message: "Avoid consultant jargon; say plainly that Veximtrade reviews product fit and relevant import requirements." })
  }
  if (/\b(?:FDA|FSVP|CFIA)\b/i.test(body)) {
    issues.push({ check: "unconfirmed_regulation", severity: "HIGH", message: "Do not name a specific regulator or import program unless its relevance is confirmed for this buyer." })
  }
  if ((!ctx.buyer.source_of_personalization || ctx.buyer.source_of_personalization === "UNKNOWN") && /\bI came across\b|\bI found your company\b|\bwhile researching you\b/i.test(body)) {
    issues.push({ check: "unsupported_personalization_source", severity: "HIGH", message: "A research-source personalization line requires an explicit source in BuyerContext." })
  }
  if (/\b(?:replace|replacing|switch from|move away from) your current (?:supplier|source|country)/i.test(body)) {
    issues.push({ check: "replace_current_source", severity: "HIGH", message: "Position Vietnam only as an additional source, never as a replacement." })
  }
  if (ctx.crm.campaign_step === 1) {
    if (/\b(?:finding|sourcing) (?:the )?(?:right )?suppliers?\b.{0,100}\b(?:easy|straightforward|simple)\b.{0,100}\b(?:challenging|difficult|complicated)\b/i.test(body)) {
      issues.push({ check: "contradictory_opener", severity: "HIGH", message: "Self-contradicting first-touch opener." })
    }
    if (/\b(?:quick )?(?:call|meeting|chat)\b|schedule a call|book a call|set up a meeting/i.test(body)) {
      issues.push({ check: "first_email_meeting_ask", severity: "HIGH", message: "Email 1 must ask about current sourcing needs, not request a call or meeting." })
    }
    const prose = body.split(/\n\s*Best regards,/i)[0]
      .replace(/If you'd rather not hear from me, just reply ['’]no thanks['’] and I won't contact you again\.?/i, "")
    const proseWords = countWords(prose)
    if (proseWords < 120 || proseWords > 160) {
      issues.push({ check: "first_email_word_count", severity: "HIGH", message: `Email 1 body is ${proseWords} words; required range is 120-160 excluding opt-out/signature.` })
    }
    const questions = (body.match(/\?/g) ?? []).length
    if (questions !== 1) {
      issues.push({ check: "first_email_question_count", severity: "HIGH", message: `Email 1 must contain exactly one question; found ${questions}.` })
    } else {
      const finalQuestion = body.slice(0, body.lastIndexOf("?")).split(/[.!?\n]/).pop()?.trim() ?? ""
      if (!/\b(?:sourc|supply|product|category|manufacturer|purchase|import|need|currently|current|looking|buy|procure)\b/i.test(finalQuestion)) {
        issues.push({ check: "first_email_situation_question", severity: "HIGH", message: "Email 1's one question must ask about the buyer's current sourcing or supply situation." })
      }
    }
  }
  if (/^(?:re|fwd?)\s*:/i.test(email.subjectEn.trim())) {
    issues.push({ check: "misleading_subject", severity: "HIGH", message: "Do not use Re/Fwd subject tricks." })
  }

  // 1. Correct recipient? (dạng email hợp lệ + không rỗng)
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    issues.push({ check: "recipient", severity: "HIGH", message: "Recipient email missing or invalid." })
  }

  // 2. Correct company? (tên công ty buyer phải xuất hiện HOẶC greeting cá nhân hoá —
  // KYC nhẹ: email không được nhắc công ty KHÁC)
  const otherCompany = body.match(/\b(?:at|from)\s+(?:[A-Z][A-Za-z&.,'-]+(?:\s+[A-Z][A-Za-z&.,'-]+){0,3})\b/g)
  if (otherCompany && ctx.buyer.company_name) {
    const ownCompany = ctx.buyer.company_name.toLowerCase()
    const foreign = otherCompany.find((m) => !ownCompany.includes(m.toLowerCase().replace(/^(at|from)\s+/, "")) && m.length > 8)
    if (foreign) {
      issues.push({ check: "company_reference", severity: "MEDIUM", message: `Possible wrong company reference: "${foreign.trim()}".` })
    }
  }

  // 3. Correct product? — context không biết sản phẩm cụ thể (UNKNOWN) mà email
  // khẳng định sản phẩm → cảnh báo.
  if (ctx.import_data.main_products === "UNKNOWN" && /\byour (rice|coffee|cashew|pepper|fruit|snack|seafood|spice)[a-z ]*/i.test(body)) {
    issues.push({ check: "product", severity: "MEDIUM", message: "Email asserts a specific product but context has no product data (UNKNOWN)." })
  }

  // 4. Correct stage? — bước 1 không được pitch supplier cụ thể.
  if (ctx.crm.campaign_step === 1 && /\bour (factory|manufacturer|client) (in|from) Vietnam can (offer|provide|supply)/i.test(body)) {
    issues.push({ check: "stage_fit", severity: "MEDIUM", message: "Initial outreach should not pitch a specific supplier." })
  }

  // 5. Consistent with previous email — subject lặp hoặc similarity quá cao.
  const prev = ctx.crm.previous_emails
  if (prev.length > 0) {
    const sameSubject = prev.some((p) => p.subject.trim().toLowerCase() === email.subjectEn.trim().toLowerCase())
    if (sameSubject) {
      issues.push({ check: "duplicate_subject", severity: "HIGH", message: "Subject identical to a previous email." })
    }
    const tooSimilar = prev.some((p) => trigramSimilarity(p.content, body) > 0.72)
    if (tooSimilar) {
      issues.push({ check: "duplicate_body", severity: "HIGH", message: "Body too similar to a previously sent email (anti-repeat violated)." })
    }
  }

  // 6+7. No invented facts / unsupported claims — cert/FDA/price/MOQ khi không có data.
  for (const { pattern, label } of UNSUPPORTED_CLAIM_PATTERNS) {
    if (pattern.test(body)) {
      issues.push({ check: "unsupported_claim", severity: "HIGH", message: `Unsupported ${label} present — B1 cold outreach must not commit commercial/compliance facts.` })
      break
    }
  }

  // 8. (duplicate wording đã ở mục 5.)

  // 9. CTA appropriate — phải có câu hỏi/mời gọi; không được dùng CTA ép.
  //    close_loop/nurture thì ngược lại: PHẢI đóng vòng, không ép câu hỏi
  //    (feedback 26/09/2026) → bỏ yêu cầu "?".
  const strongCta = /\b(reply (now|today)|book a call (now|today)|buy now|order now)\b/i
  if (strongCta.test(body)) {
    issues.push({ check: "cta_pressure", severity: "MEDIUM", message: "Aggressive CTA detected." })
  }
  const ctaOptional = stepType === "close_loop" || stepType === "nurture"
  if (!/\?/.test(body) && !ctaOptional) {
    issues.push({ check: "cta_missing", severity: "LOW", message: "No question/CTA found in email." })
  }

  // 10. Not too long?
  if (words > MAX_EMAIL_WORDS) {
    issues.push({ check: "length", severity: "MEDIUM", message: `Email is ${words} words (limit ${MAX_EMAIL_WORDS}).` })
  }

  // 11. No links / attachments / unnecessary URLs, including bare domains.
  // Keep the website out of cold-email copy; sender identity and postal
  // address are already present in From/signature.
  const urlMatch = body.match(/\b(?:https?:\/\/|www\.)\S+|\b(?:[a-z0-9-]+\.)+(?:com|net|org|edu|gov|io|co|vn|us|biz|info|app|dev|trade)\b(?:\/\S*)?/i)
  if (urlMatch) {
    issues.push({ check: "links", severity: "HIGH", message: `Link or domain found in cold email (${urlMatch[0]}). Remove URLs and bare domains.` })
  }

  // 12. Exact opt-out sentence is required in every campaign email.
  const requiredOptOut = "If you'd rather not hear from me, just reply 'no thanks' and I won't contact you again."
  if (optOutRequired && !body.includes(requiredOptOut)) {
    issues.push({ check: "opt_out_line", severity: "HIGH", message: "Required exact opt-out sentence is missing." })
  } else if (optOutRequired && !proseBeforeSignature.trimEnd().endsWith(requiredOptOut)) {
    issues.push({ check: "opt_out_position", severity: "HIGH", message: "Place the exact opt-out sentence immediately before the signature." })
  }

  // Consistent brand wording belongs in the body; the legal entity is in the signature.
  const bodyWithoutSignature = body.split(/\n\s*Best regards,/i)[0]
  if (!/\bVeximtrade\b/i.test(bodyWithoutSignature)) {
    issues.push({ check: "brand_wording", severity: "HIGH", message: "Use the consistent brand name Veximtrade in the email body." })
  }
  // Địa chỉ thật — check theo street/ward của signature chuẩn (chung chung
  // "Vietnam" sẽ false-positive vì tên quốc gia xuất hiện tự nhiên trong body).
  if (!/(Ngoa Long|Tay Tuu)/i.test(body)) {
    issues.push({ check: "signature_address", severity: "MEDIUM", message: "Physical postal address missing from signature (CAN-SPAM requires a valid physical address)." })
  }

  // Spam words (deliverability).
  for (const w of SPAM_WORDS) {
    if (w.test(body)) {
      issues.push({ check: "spam_word", severity: "MEDIUM", message: `Spam trigger word detected (${w}).` })
      break
    }
  }

  // 13. Trend claims (feedback 26/09/2026): không khẳng định xu hướng khi
  // không có dữ liệu. Check THEO CÂU để không chặn khung điều kiện được phép
  // ("if expanding your supplier base is on the radar..." là hợp lệ).
  const TREND_WORD = /\b(growing|increasing|expanding|rising|surging|booming|accelerating|skyrocketing|more and more|rapidly)\b/i
  const CONDITIONAL = /\b(if|whether|when|should|in case|whenever)\b/i
  const trendSentence = body
    .split(/[.!?\n]+/)
    .find((s) => TREND_WORD.test(s) && !CONDITIONAL.test(s))
  if (trendSentence) {
    issues.push({
      check: "trend_claim",
      severity: "HIGH",
      message: `Trend/growth claim without verifiable data ("${trendSentence.trim().slice(0, 80)}…") — rephrase neutrally or conditionally.`,
    })
  }

  // 14. Claims về Vexim/supplier (feedback 26/09/2026): chỉ whitelist
  // APPROVED_VEXIM_CLAIMS được phép — chặn superlative, số liệu bịa, chứng
  // nhận ngoài services (FDA registration / HACCP / traceability).
  const superlative = body.match(/\b(leading|largest|premier|foremost|world-class|award-winning|number one|no\.\s?1|#1|top-rated)\b/i)
  if (superlative) {
    issues.push({ check: "vexim_claim", severity: "HIGH", message: `Superlative claim ("${superlative[0]}") is not on the approved Vexim facts list.` })
  }
  const inventedCount = body.match(/\b\d{1,4}\s+(factories|manufacturers|suppliers|buyers|partners|years)\b/i)
  if (inventedCount) {
    issues.push({ check: "vexim_claim", severity: "HIGH", message: `Specific count about Vexim ("${inventedCount[0].trim()}") is unverifiable — remove it.` })
  }
  if (/\bISO\s?\d{4,5}\b|\b(BRC|SQF|GFSI|SMETA)\b|\b(halal|kosher)\s+certified\b/i.test(body)) {
    issues.push({ check: "vexim_claim", severity: "HIGH", message: "Certification claim beyond approved services (FDA registration, HACCP, traceability only)." })
  }

  // 15. Close-loop phải THẬT SỰ đóng vòng (feedback 26/09/2026): không ép
  // buyer chọn phương án trả lời ("which would you prefer?"...).
  if (/which\s+(would|do|can)\s+you\s+(prefer|like)|let me know which|either\s+(way|works)[,—-]*\s*(just\s+)?(reply|let me know)/i.test(body)) {
    issues.push({ check: "close_loop_pressure", severity: "MEDIUM", message: "Forced-choice ending hands the buyer an admin task — close the loop without demanding a reply." })
  }

  // Keep subject lines plain, while allowing a simple question mark when it
  // sounds natural. Marketing separators and stylized punctuation stay flagged.
  const subjectPunct = email.subjectEn.match(/[\u2014\u2013:;'"()!]/)
  if (subjectPunct) {
    issues.push({ check: "subject_punctuation", severity: "MEDIUM", message: `Subject has a distracting separator ("${subjectPunct[0]}"). Keep it plain and conversational.` })
  }

  // 16. Punctuation (V5.2): em/en dash trong body là AI-tell — cấm.
  if (/[\u2014\u2013]/.test(body)) {
    issues.push({ check: "punctuation", severity: "MEDIUM", message: "Em/en dash in body (AI-generated tell) — use periods or commas." })
  }

  // 17. AI-style polished phrasing (V5.2) — cảm giác marketing/AI.
  const aiPhrase = body.match(/no hard feelings|I'?d be delighted|I'?d love to|I hope this (email|message) finds you well/i)
  if (aiPhrase) {
    issues.push({ check: "ai_phrasing", severity: "MEDIUM", message: `AI-style phrasing ("${aiPhrase[0]}") — say it plainly.` })
  }

  // ALL CAPS / exclamation (bắt từ requirement-email anti-spam kinh nghiệm).
  if (/!/.test(body)) {
    issues.push({ check: "exclamation", severity: "LOW", message: "Exclamation mark found — keep tone flat." })
  }

  const risk_level: QAResult["risk_level"] = issues.some((i) => i.severity === "HIGH")
    ? "HIGH"
    : issues.some((i) => i.severity === "MEDIUM")
      ? "MEDIUM"
      : "LOW"

  return {
    passed: risk_level !== "HIGH",
    risk_level,
    issues,
    word_count: words,
  }
}
