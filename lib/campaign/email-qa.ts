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
  /\bfree\b/i,
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
 * @param params.optOutRequired Follow-up/close-loop bắt buộc có opt-out line mềm
 */
export function runEmailQA(params: {
  email: { subjectEn: string; contentEn: string }
  recipient: string | null | undefined
  ctx: BuyerContext
  optOutRequired: boolean
}): QAResult {
  const issues: QAIssue[] = []
  const { email, recipient, ctx, optOutRequired } = params
  const body = email.contentEn
  const words = countWords(body)

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
  const strongCta = /\b(reply (now|today)|book a call (now|today)|buy now|order now)\b/i
  if (strongCta.test(body)) {
    issues.push({ check: "cta_pressure", severity: "MEDIUM", message: "Aggressive CTA detected." })
  }
  if (!/\?/.test(body)) {
    issues.push({ check: "cta_missing", severity: "LOW", message: "No question/CTA found in email." })
  }

  // 10. Not too long?
  if (words > MAX_EMAIL_WORDS) {
    issues.push({ check: "length", severity: "MEDIUM", message: `Email is ${words} words (limit ${MAX_EMAIL_WORDS}).` })
  }

  // 11. No links / attachments / unnecessary URLs.
  const urlMatch = body.match(/https?:\/\/\S+/)
  if (urlMatch) {
    issues.push({ check: "links", severity: "HIGH", message: `Link found in cold email (${urlMatch[0]}). Only veximbridge.com plain-text allowed.` })
  }

  // 12. Opt-out respected — follow-up trở đi cần đường lùi mềm.
  if (optOutRequired && !/(no thanks|not interested|isn'?t (a priority|relevant)|won'?t reach out|stop emailing|feel free to (say|let me know))/i.test(body)) {
    issues.push({ check: "opt_out_line", severity: "MEDIUM", message: "Follow-up emails must offer an easy way out (soft opt-out line)." })
  }

  // Signature chuẩn (CAN-SPAM/Gmail): thương hiệu + địa chỉ thật trong body.
  if (!/vexim/i.test(body)) {
    issues.push({ check: "signature_brand", severity: "LOW", message: "Signature missing Vexim brand." })
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
