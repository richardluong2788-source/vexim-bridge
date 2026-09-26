// Follow-up Gate — "có lý do hợp lý để liên hệ tiếp không?" (yêu cầu 25/09/2026)
//
// Trước MỌI follow-up (từ step 2 trở đi), AI phải đọc lại:
//   buyer context + research/import data (buyer_analysis, buyer_strategy từ 079)
//   + TOÀN BỘ lịch sử email/interactions (previous_emails, replies trong BuyerContext)
// và tự đánh giá: có lý do hợp lý để gửi email tiếp theo hay không.
// KHÔNG có lý do → KHÔNG gửi (skip step hoặc HOLD cho AE xem).
//
// An toàn lỗi Chernobyl: AI KHÔNG khả dụng hoặc không chắc chắn → không gửi /
// human review. Luôn nghiêng về "không làm phiền buyer" thay vì "gửi cho có".

import { generateText, Output } from "ai"
import { z } from "zod"
import { GATE_CONFIDENCE_THRESHOLD } from "./constants"
import type { BuyerContext } from "./types"

const gateSchema = z.object({
  proceed: z.boolean().describe("true ONLY if there is a genuine, specific reason to send this follow-up email."),
  reason_category: z.enum([
    "new_angle_from_research",
    "friction_reduction",
    "close_loop_courtesy",
    "seasonal_relevance",
    "value_insight",
    "no_valid_reason",
  ]),
  reason_summary: z.string().describe("One sentence: why send (or why not), grounded in the context."),
  confidence: z.number().min(0).max(1),
})

export interface FollowupGateResult {
  proceed: boolean
  reasonCategory: string
  reasonSummary: string
  confidence: number
  source: "rules" | "ai" | "error"
}

/** Hành động scheduler phải làm sau gate. */
export type FollowupGateDecision = "generate" | "skip" | "human_review"

/**
 * Phần THUẦN của gate — map kết quả đánh giá sang hành động. Tách riêng để
 * test được không cần AI.
 */
export function applyFollowupGateDecision(gate: FollowupGateResult): FollowupGateDecision {
  if (!gate.proceed) return "skip"
  if (gate.confidence < GATE_CONFIDENCE_THRESHOLD) return "human_review"
  return "generate"
}

/** Rules phòng thủ — chạy TRƯỚC AI, không tốn tiền/không thể fail. */
function defensiveRules(
  ctx: BuyerContext,
  stepType: string,
): FollowupGateResult | null {
  // Buyer đã reply → sequence lẽ ra đã dừng; nếu vẫn tới đây là bug luồng.
  if (ctx.crm.replies.length > 0) {
    return {
      proceed: false,
      reasonCategory: "no_valid_reason",
      reasonSummary: "Buyer has replied — sequence must be handled by handoff, never by a scheduled follow-up.",
      confidence: 1,
      source: "rules",
    }
  }
  // Chưa từng gửi email nào thì không gọi là follow-up.
  if (ctx.crm.previous_emails.length === 0) {
    return {
      proceed: false,
      reasonCategory: "no_valid_reason",
      reasonSummary: "No prior outbound email on record — cannot follow up on nothing.",
      confidence: 1,
      source: "rules",
    }
  }
  return null
}

/**
 * Đánh giá "có nên gửi follow-up không". KHÔNG BAO GIỜ ném — lỗi AI trả về
 * proceed=false (conservative), để scheduler skip và AE nhìn thấy trong log.
 */
export async function assessFollowupJustification(params: {
  ctx: BuyerContext
  stepNumber: number
  stepType: string
  daysSinceLastContact: number | null
}): Promise<FollowupGateResult> {
  const { ctx, stepNumber, stepType, daysSinceLastContact } = params

  const defensive = defensiveRules(ctx, stepType)
  if (defensive) return defensive

  try {
    const { experimental_output: output } = await generateText({
      model: "openai/gpt-4o-mini",
      experimental_output: Output.object({ schema: gateSchema }),
      system: [
        "You are the gatekeeper of Vexim's outbound email sequence. Before every follow-up email you decide whether there is a GENUINE reason to contact this buyer again.",
        "",
        "A follow-up is justified when it adds something specific for THIS buyer, for example:",
        "- new_angle_from_research: the import/research data suggests an angle not used in any previous email",
        "- friction_reduction: we can make replying easier (e.g. 'send us any spec you're reviewing, we'll check for a matching manufacturer')",
        "- close_loop_courtesy: final courteous email giving the buyer an easy way to decline (valid when there has been zero reply across the sequence)",
        "- seasonal_relevance: a real, non-invented seasonal timing angle grounded in the data",
        "- value_insight: a concrete, supportable insight relevant to their category",
        "",
        "A follow-up is NOT justified when: previous emails already said everything and this one would only repeat them; there is nothing new or useful to add; the only motivation is the schedule.",
        "",
        "Rules:",
        "- Ground every justification in the provided context. NEVER invent research findings, data, or buyer intentions.",
        "- If research/import fields are UNKNOWN they cannot justify anything.",
        "- close_loop_courtesy is acceptable for the final step of a sequence with no replies, but you must still confirm the context supports it.",
        "- When unsure, choose proceed=false. Missing one email is cheap; annoying a buyer is not.",
      ].join("\n"),
      prompt: [
        `STEP: #${stepNumber} (${stepType}) — the next scheduled follow-up.`,
        `DAYS SINCE LAST CONTACT: ${daysSinceLastContact ?? "unknown"}`,
        "",
        "FULL BUYER CONTEXT (curated by backend; UNKNOWN means unknown):",
        JSON.stringify(ctx, null, 2),
        "",
        "Decide: is there a genuine reason to send this follow-up? Return proceed, reason_category, reason_summary, confidence.",
      ].join("\n"),
      maxRetries: 1,
    })

    if (!output) {
      return {
        proceed: false,
        reasonCategory: "no_valid_reason",
        reasonSummary: "Gate AI returned empty output — skipped (fail-safe).",
        confidence: 0,
        source: "error",
      }
    }
    return {
      proceed: output.proceed === true,
      reasonCategory: output.reason_category,
      reasonSummary: output.reason_summary,
      confidence: output.confidence,
      source: "ai",
    }
  } catch (err) {
    console.error("[campaign] followup gate AI failed:", err)
    return {
      proceed: false,
      reasonCategory: "no_valid_reason",
      reasonSummary: `Gate AI unavailable (${err instanceof Error ? err.message.slice(0, 120) : "error"}) — skipped (fail-safe).`,
      confidence: 0,
      source: "error",
    }
  }
}
