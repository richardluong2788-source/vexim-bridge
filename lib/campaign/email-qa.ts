// Small deterministic deliverability/compliance gate. Editorial style,
// personalization shape, CTA count, word count, and duplicate phrasing are
// intentionally left to the model and human AE review.

import {
  SIGNATURE_ADDRESS,
  SIGNATURE_COMPANY,
} from "./constants"
import type { BuyerContext } from "./types"

export interface QAIssue {
  check: string
  severity: "HIGH" | "MEDIUM" | "LOW"
  message: string
  blocking?: boolean
}

export interface QAResult {
  passed: boolean
  risk_level: "LOW" | "MEDIUM" | "HIGH"
  issues: QAIssue[]
  word_count: number
}

const SPAM_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bfree\s+(?:sample|trial|offer|quote|gift)\b/i, label: "free offer" },
  { pattern: /\bguarantee(?:d)?\b/i, label: "guarantee" },
  { pattern: /\bdiscount\b/i, label: "discount" },
  { pattern: /\b(?:act|reply)\s+now\b/i, label: "urgent action" },
  { pattern: /\brisk[- ]free\b/i, label: "risk-free claim" },
  { pattern: /\blimited time\b/i, label: "limited-time claim" },
  { pattern: /\bno obligation\b/i, label: "no-obligation claim" },
  { pattern: /\bclick here\b/i, label: "click-here wording" },
  { pattern: /\bcongratulations\b/i, label: "congratulations opener" },
]

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

function signatureStartIndex(body: string): number {
  const markers: number[] = []
  const nameToken = body.lastIndexOf("{{sender_name}}")
  if (nameToken >= 0) markers.push(nameToken)

  const signoffs = [...body.matchAll(/(?:^|\n)[ \t]*(?:best regards|kind regards|regards|sincerely|best|thanks),?[ \t]*(?=\n|$)/gim)]
  if (signoffs.length > 0) markers.push(signoffs[signoffs.length - 1].index ?? body.length)

  const companyIndex = body.toLowerCase().lastIndexOf(SIGNATURE_COMPANY.toLowerCase())
  if (companyIndex >= 0) {
    const separator = body.lastIndexOf("\n\n", companyIndex)
    if (separator >= 0) markers.push(separator + 2)
  }
  return markers.length > 0 ? Math.min(...markers) : body.length
}

function proseBeforeSignature(body: string): string {
  return body.slice(0, signatureStartIndex(body)).trimEnd()
}

function hasValidSenderSignature(body: string): boolean {
  const lines = body.trim().split(/\r?\n/).map((line) => line.trim())
  const addressIndex = lines.findIndex((line) => line.toLowerCase() === SIGNATURE_ADDRESS.toLowerCase())
  if (addressIndex < 2) return false

  const senderName = lines[addressIndex - 2]
  const titleLine = lines[addressIndex - 1]
  const titleSuffix = `, ${SIGNATURE_COMPANY}`
  if (!titleLine.toLowerCase().endsWith(titleSuffix.toLowerCase())) return false
  const senderTitle = titleLine.slice(0, -titleSuffix.length).trim()
  const invalidSenderName = /^(?:best regards|kind regards|regards|sincerely|best|thanks|veximtrade|vexim|vexim global)$/i.test(senderName)
  return (senderName === "{{sender_name}}" || (!!senderName && !invalidSenderName)) && !!senderTitle
}

export function runEmailQA(params: {
  email: { subjectEn: string; contentEn: string }
  recipient: string | null | undefined
  ctx: BuyerContext
  optOutRequired: boolean
  stepType?: string
}): QAResult {
  const { email, recipient, optOutRequired } = params
  // Context and step type remain in the public API for callers; content shape
  // is deliberately not constrained by company/product/question/length rules.
  void params.ctx
  void params.stepType

  const issues: QAIssue[] = []
  const body = email.contentEn
  const prose = proseBeforeSignature(body)
  const wordCount = countWords(body)

  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    issues.push({ check: "recipient", severity: "HIGH", message: "Recipient email missing or invalid." })
  }

  if (/^(?:re|fwd?)\s*:/i.test(email.subjectEn.trim())) {
    issues.push({ check: "misleading_subject", severity: "HIGH", message: "Do not use a deceptive Re/Fwd subject." })
  }

  const urlMatch = `${email.subjectEn}\n${body}`.match(/\b(?:https?:\/\/|www\.)\S+|\b(?:[a-z0-9-]+\.)+(?:com|net|org|edu|gov|io|co|vn|us|biz|info|app|dev|trade)\b(?:\/\S*)?/i)
  if (urlMatch) {
    issues.push({ check: "links", severity: "HIGH", message: `Link or bare domain found (${urlMatch[0]}). Remove it from the buyer-facing email.` })
  }

  // Keep the requested privacy safeguard, without dictating how the AI must
  // phrase a legitimate industry-level research opener.
  if (/\b(?:import|customs|shipment|trade)\s+(?:records?|data|database)\b/i.test(prose)) {
    issues.push({ check: "research_source_disclosure", severity: "HIGH", message: "Do not disclose import/customs/shipment record sources directly; describe research at a broad industry level." })
  }

  for (const { pattern, label } of SPAM_PATTERNS) {
    if (pattern.test(body)) {
      issues.push({ check: "spam_word", severity: "MEDIUM", message: `Potential spam wording (${label}).` })
      break
    }
  }

  const requiredOptOut = "If you'd rather not hear from me, just reply 'no thanks' and I won't contact you again."
  if (optOutRequired && !body.includes(requiredOptOut)) {
    issues.push({ check: "opt_out_line", severity: "HIGH", message: "Required opt-out sentence is missing." })
  } else if (optOutRequired && !prose.trimEnd().endsWith(requiredOptOut)) {
    issues.push({ check: "opt_out_position", severity: "HIGH", message: "Place the exact opt-out sentence immediately before the signature." })
  }

  if (!hasValidSenderSignature(body)) {
    issues.push({ check: "signature_missing_sender", severity: "HIGH", message: "Signature must include the real sender (or {{sender_name}}), sender title, legal entity, and postal address." })
  }

  const risk_level: QAResult["risk_level"] = issues.some((issue) => issue.severity === "HIGH")
    ? "HIGH"
    : issues.some((issue) => issue.severity === "MEDIUM")
      ? "MEDIUM"
      : "LOW"

  return {
    passed: !issues.some((issue) => issue.severity === "HIGH" || issue.blocking === true),
    risk_level,
    issues,
    word_count: wordCount,
  }
}
