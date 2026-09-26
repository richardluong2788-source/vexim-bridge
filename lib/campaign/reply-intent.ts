// Campaign reply classifier v2 (spec §14, quyết định 25/09/2026).
//
// Kiến trúc 2 lớp, RULES TRƯỚC:
//   1. RULES (keyword/guardrail) — deterministic, thắng khi xung đột với AI ở
//      các intent dừng (OPT_OUT / NOT_INTERESTED / OUT_OF_OFFICE / WRONG_CONTACT).
//      Lý do: sát thương của phân loại sai kiểu "tiếp tục email cho người đã
//      hỏi dừng" cao hơn nhiều của phân loại sai kiểu "bỏ lỡ một buyer quan tâm".
//   2. AI (7-intent, zod structured) — chỉ chạy khi rules không chắc chắn.
//   3. Merge: rule confident → dùng rule; AI confident ≥ 0.85 và không mâu
//      thuẫn rule stop-intent → dùng AI; còn lại → UNKNOWN + HUMAN_REVIEW.
//
// OUT_OF_OFFICE là PAUSE — KHÔNG bao giờ được coi là reply (state-machine
// onReplyClassified xử lý pause; isPauseOnly ở đây chỉ để audit).

import { generateText, Output } from "ai"
import { z } from "zod"
import { CONFIDENCE_THRESHOLD, type CampaignIntent, type CampaignReplyClassification } from "./constants"

// ---------------------------------------------------------------------------
// Lớp 1: Rules
// ---------------------------------------------------------------------------

interface RuleHit {
  intent: CampaignIntent
  confidence: number
  matched: string
}

/**
 * Thứ tự QUAN TRỌNG: OPT_OUT kiểm trước NOT_INTERESTED ("please remove me"
 * phải thắng cả khi câu cũng mang nghĩa không quan tâm).
 */
const RULES: Array<{ intent: CampaignIntent; confidence: number; patterns: RegExp[] }> = [
  {
    intent: "OPT_OUT",
    confidence: 0.98,
    patterns: [
      /\b(remove me|take me off|unsubscribe|opt[- ]?out|stop emailing|stop contacting|do not (email|contact) me|don'?t (email|contact) me|no further emails?|remove (my|this) (email|address)|take me out of your)\b/i,
    ],
  },
  {
    intent: "OUT_OF_OFFICE",
    confidence: 0.95,
    patterns: [
      /\b(out of (the )?office|automatic(al)? reply|auto[- ]reply|away from (the )?office|annual leave|on vacation|on leave until|returning (on|from)|limited access to email|if (urgent|this is urgent))/i,
    ],
  },
  {
    intent: "WRONG_CONTACT",
    confidence: 0.9,
    patterns: [
      /\b(wrong person|not the right person|not responsible for|i'?m not (the )?(buyer|purchasing|in charge)|please contact [a-z. ]+@|forward(ed)? (this )?to (the )?(right|correct|appropriate)|reaching out to the wrong)\b/i,
    ],
  },
  {
    intent: "NOT_INTERESTED",
    confidence: 0.92,
    patterns: [
      /\b(not interested|no thanks|no thank you|we'?re all set|we are all set|not a fit|not a good fit|don'?t need|do not need|stop reaching out|we already have (a|our) (supplier|partner|source)|not looking for)\b/i,
    ],
  },
  {
    intent: "NOT_NOW",
    confidence: 0.88,
    patterns: [
      /\b(not (right|at this) now|not at the moment|maybe (later|next (quarter|year))|revisit (this )?(in|later)|circle back (in|later)|touch base (in|later|next)|not this (quarter|year)|in the future|for now)\b/i,
    ],
  },
]

const POSITIVE_SIGNALS: RegExp[] = [
  /\b(interested|tell me more|more (information|details?)|send (me )?(the )?(information|details|catalog|list)|happy to (chat|discuss|connect)|sounds (good|interesting)|let'?s (talk|discuss)|open to (it|a call|exploring)|would like to (know|learn|hear)|can you (share|send|provide)|looking for)\b/i,
]

function runRules(text: string): RuleHit | null {
  for (const rule of RULES) {
    for (const p of rule.patterns) {
      if (p.test(text)) {
        return { intent: rule.intent, confidence: rule.confidence, matched: p.source }
      }
    }
  }
  // Positive signal KHÔNG đủ để auto-INTERESTED ở rule layer (dễ nhỉnh)
  // — chỉ nâng nhẹ tin cậy cho AI layer.
  return null
}

function hasPositiveSignal(text: string): boolean {
  return POSITIVE_SIGNALS.some((p) => p.test(text))
}

// ---------------------------------------------------------------------------
// Lớp 2: AI
// ---------------------------------------------------------------------------

const aiSchema = z.object({
  intent: z
    .enum(["INTERESTED", "NOT_INTERESTED", "NOT_NOW", "OPT_OUT", "OUT_OF_OFFICE", "WRONG_CONTACT", "UNKNOWN"])
    .describe("Primary intent of the buyer's reply."),
  confidence: z.number().min(0).max(1).describe("Confidence 0-1 in the intent."),
  reasoning: z.string().describe("One short sentence explaining the classification."),
})

/**
 * Phân loại reply của buyer cho campaign engine. KHÔNG BAO GIỜ ném — luôn trả
 * kết quả, fallback là UNKNOWN + requiresHuman.
 */
export async function classifyCampaignReply(params: {
  replyText: string
  buyerCompany?: string | null
  lastOutboundSubject?: string | null
}): Promise<CampaignReplyClassification> {
  const text = params.replyText ?? ""
  if (!text.trim()) {
    return {
      intent: "UNKNOWN",
      confidence: 0,
      source: "rules",
      requiresHuman: true,
      isPauseOnly: false,
      stopsSequence: false,
      reason: "empty_reply",
    }
  }

  // --- Rules trước ---------------------------------------------------------
  const ruleHit = runRules(text)
  if (ruleHit && ruleHit.confidence >= CONFIDENCE_THRESHOLD) {
    const isPause = ruleHit.intent === "OUT_OF_OFFICE"
    return {
      intent: ruleHit.intent,
      confidence: ruleHit.confidence,
      source: "rules",
      requiresHuman: false,
      isPauseOnly: isPause,
      stopsSequence: !isPause,
      reason: `rule: ${ruleHit.matched}`,
    }
  }

  // --- AI ------------------------------------------------------------------
  let aiIntent: CampaignIntent = "UNKNOWN"
  let aiConfidence = 0
  let aiReason = ""
  try {
    const { experimental_output: output } = await generateText({
      model: "openai/gpt-4o-mini",
      experimental_output: Output.object({ schema: aiSchema }),
      system: [
        "You classify replies from US food import buyers to Vexim's cold outreach emails.",
        "Intent meanings:",
        "- INTERESTED: buyer shows genuine interest, asks for info, invites conversation about Vietnam sourcing.",
        "- NOT_INTERESTED: clear refusal, no future relevance.",
        "- NOT_NOW: not a no — wrong timing, revisit later.",
        "- OPT_OUT: asks to stop receiving emails (legal: never email again).",
        "- OUT_OF_OFFICE: automatic/absence reply — NOT a real response.",
        "- WRONG_CONTACT: the person is not the right contact.",
        "- UNKNOWN: anything you cannot classify confidently.",
        "Never fabricate content. Judge only from the text.",
      ].join("\n"),
      prompt: [
        params.buyerCompany ? `Buyer company: ${params.buyerCompany}` : "",
        params.lastOutboundSubject ? `Subject of our last email: ${params.lastOutboundSubject}` : "",
        "Buyer reply:",
        "---",
        text.slice(0, 4000),
        "---",
      ]
        .filter(Boolean)
        .join("\n"),
      maxRetries: 1,
    })
    if (output) {
      aiIntent = output.intent as CampaignIntent
      aiConfidence = output.confidence
      aiReason = output.reasoning
    }
  } catch (err) {
    console.error("[campaign] classifyCampaignReply AI failed:", err)
    return {
      intent: "UNKNOWN",
      confidence: 0,
      source: "rules",
      requiresHuman: true,
      isPauseOnly: false,
      stopsSequence: false,
      reason: `ai_failed: ${err instanceof Error ? err.message : "unknown"}`,
    }
  }

  // --- Merge ---------------------------------------------------------------
  // Rule low-confidence (<threshold) vẫn tồn tại: nếu AI mâu thuẫn với rule
  // stop-intent → rule thắng (an toàn là trên hết).
  if (ruleHit && ruleHit.intent !== aiIntent) {
    const ruleIsStop = ["OPT_OUT", "NOT_INTERESTED", "WRONG_CONTACT"].includes(ruleHit.intent)
    if (ruleIsStop) {
      const isPause = ruleHit.intent === "OUT_OF_OFFICE"
      return {
        intent: ruleHit.intent,
        confidence: ruleHit.confidence,
        source: "ai+rules",
        requiresHuman: false,
        isPauseOnly: isPause,
        stopsSequence: !isPause,
        reason: `rule overrides AI (${aiIntent} ${aiConfidence.toFixed(2)}): ${ruleHit.matched}`,
      }
    }
  }

  if (aiIntent !== "UNKNOWN" && aiConfidence >= CONFIDENCE_THRESHOLD) {
    // Phòng thủ: AI nói INTERESTED nhưng không có tín hiệu dương nào trong text
    // → hạ.requiresHuman cho AE nhìn thêm một bước (guardrail spec §14).
    if (aiIntent === "INTERESTED" && !hasPositiveSignal(text) && aiConfidence < 0.95) {
      return {
        intent: "INTERESTED",
        confidence: aiConfidence,
        source: "ai",
        requiresHuman: true,
        isPauseOnly: false,
        stopsSequence: true,
        reason: `ai INTERESTED without explicit positive signals — human confirm: ${aiReason}`,
      }
    }
    const isPause = aiIntent === "OUT_OF_OFFICE"
    return {
      intent: aiIntent,
      confidence: aiConfidence,
      source: "ai",
      requiresHuman: false,
      isPauseOnly: isPause,
      // OUT_OF_OFFICE không dừng sequence (chỉ pause tạm). Mọi intent xác nhận
      // khác đều làm scheduler rời khỏi luồng follow-up.
      stopsSequence: !isPause,
      reason: aiReason,
    }
  }

  return {
    intent: "UNKNOWN",
    confidence: aiConfidence,
    source: "ai",
    requiresHuman: true,
    isPauseOnly: false,
    stopsSequence: false,
    reason: aiConfidence < CONFIDENCE_THRESHOLD ? `low_confidence_${aiConfidence.toFixed(2)}: ${aiReason}` : aiReason || "unknown_intent",
  }
}
