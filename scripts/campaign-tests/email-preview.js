// Email preview demo — chạy ĐÚNG pipeline thật của campaign engine:
//   generateCampaignEmail (parser thật) → runEmailQA (12+ check thật)
//   → assessFollowupJustification + applyFollowupGateDecision (gate thật).
// Completions AI được viết tay theo đúng system prompt của generator (sandbox
// không có API key model) — bố cục, QA, gate, render header đều là code thật.
//
// Usage:
//   OUT=$(mktemp -d) && pnpm exec tsc lib/campaign/constants.ts \
//     lib/campaign/types.ts lib/campaign/email-qa.ts lib/campaign/email-generator.ts \
//     lib/campaign/followup-gate.ts --outDir "$OUT" --module commonjs --target es2020 \
//     --moduleResolution node --skipLibCheck
//   # cài stub 'ai' + symlink zod vào $OUT (xem run.sh), rồi:
//   node scripts/campaign-tests/email-preview.js "$OUT" > preview.md

const fs = require("fs")
const path = require("path")

const OUT = process.argv[2]
const gen = require(path.join(OUT, "email-generator.js"))
const qaMod = require(path.join(OUT, "email-qa.js"))
const gateMod = require(path.join(OUT, "followup-gate.js"))

// ---------------------------------------------------------------------------
// Scripted AI completions — VIẾT THEO ĐÚNG system prompt của generator
// (plain text, không link, không spam word, không bịa số liệu, subject <50 ký
// tự, signature EXACT, follow-up ngắn hơn + khác opening, opt-out mềm).
// Thứ tự khớp thứ tự gọi generateText trong hàm main bên dưới.
// ---------------------------------------------------------------------------
const SIG = [
  "Best regards,",
  "Linda Nguyen",
  "VEXIM GLOBAL CO., LTD",
  "25/6, Lane 51, Ngoa Long Street, Tay Tuu Ward, Hanoi, Vietnam",
  "veximbridge.com",
].join("\n")

;(globalThis).__AI_SCRIPT = [
  // [0] Email 1 — coffee, initial_outreach
  {
    subject_en: "Vietnamese robusta for your espresso blends",
    content_en:
      "Hi Sarah,\n\n" +
      "Green coffee clearly keeps the team at Atlantic Coffee Traders busy.\n\n" +
      "I'm Linda Nguyen with Vexim, a Hanoi-based compliance consulting partner for Vietnamese factories exporting to the US. We are not a marketplace or a trading company — we prepare coffee factories for US-market expectations such as FDA registration, HACCP and lot-level traceability, and every factory is audited before it can reach a buyer.\n\n" +
      "If adding a US-ready Vietnamese robusta origin alongside your current sources is on this year's roadmap, would a short conversation be worth your time?\n\n" +
      SIG,
    content_vi:
      "Chào chị Sarah,\n\n" +
      "Em thấy đội ngũ Atlantic Coffee Traders đang rất tích cực trong mảng green coffee ạ.\n\n" +
      "Em là Linda Nguyen, thuộc Vexim — đối tác tư vấn tuân thủ tại Hà Nội cho các nhà máy Việt Nam xuất hàng sang Mỹ. Chúng em không phải marketplace hay công ty môi giới — chúng em chuẩn bị nhà máy cà phê cho yêu cầu thị trường Mỹ như đăng ký FDA, HACCP và truy xuất lô, mỗi nhà máy đều được audit trước khi tiếp xúc buyer.\n\n" +
      "Nếu việc thêm một nguồn robusta Việt Nam đạt chuẩn Mỹ vào lộ trình năm nay của chị khả thi, chị có thể dành ít phút trao đổi không ạ?",
  },
  // [1] Gate bước 2 (friction_reduction, conf 0.82 ≥ 0.7 → generate)
  {
    proceed: true,
    reason_category: "friction_reduction",
    reason_summary:
      "No reply after the first email; a much shorter note that lowers the effort to respond (spec-match offer, easy out) adds a new, low-friction entry point.",
    confidence: 0.82,
  },
  // [2] Email 2 — coffee, follow_up (ngắn hơn hẳn, khác opening, có opt-out mềm)
  {
    subject_en: "One easier way to compare robusta origins",
    content_en:
      "Hi Sarah,\n\n" +
      "Quick follow-up, much lighter than my first note.\n\n" +
      "Two ways I can make this easy. If you're weighing a new robusta origin, I can shortlist Vietnamese factories that already document to US import standards, so comparing them costs you no extra homework. And if you have a spec sheet open on your desk right now, mind sending it over? I'll check whether a factory of ours matches it.\n\n" +
      "If Vietnam sourcing isn't a priority at the moment, a quick \"not interested\" is completely fine and I'll leave you be.\n\n" +
      SIG,
    content_vi:
      "Chào chị Sarah,\n\n" +
      "Em nhắc nhanh, nhẹ nhàng hơn email trước.\n\n" +
      "Hai cách em có thể làm dễ dàng cho chị: nếu chị đang cân nhắc thêm nguồn robusta, em có thể chốt danh sách nhà máy Việt Nam đã đạt chuẩn hồ sơ xuất Mỹ để chị so sánh không mất công. Hoặc nếu chị đang mở spec nào trên bàn, gửi em được không ạ? Em kiểm tra nhà máy nào khớp và trả lời có/không ngay.\n\n" +
      "Nếu sourcing Việt Nam chưa phải ưu tiên, chị trả lời \"not interested\" là em dừng ngay ạ.",
  },
  // [3] Gate bước 3 (close_loop_courtesy, conf 0.88 ≥ 0.7 → generate)
  {
    proceed: true,
    reason_category: "close_loop_courtesy",
    reason_summary:
      "Zero replies across the sequence; a final courteous note gives the buyer a dignified way to decline and closes the loop cleanly instead of an open-ended drip.",
    confidence: 0.88,
  },
  // [4] Email 3 — coffee, close_loop (ấm, 4 câu, đường lùi rõ ràng)
  {
    subject_en: "Closing the loop for now",
    content_en:
      "Hi Sarah,\n\n" +
      "I don't want to keep landing in your inbox uninvited, so this will be my last note for a while.\n\n" +
      "If US-ready Vietnamese robusta becomes relevant later — a new blend project, a supply gap, or simple curiosity about what our factories can document — just reply here and I'll pick the thread back up exactly where we left it.\n\n" +
      "If Vietnam sourcing isn't a priority, a simple \"no thanks\" is completely fine and I'll close the file with no hard feelings.\n\n" +
      "Thanks for your time, Sarah.\n\n" +
      SIG,
    content_vi:
      "Chào chị Sarah,\n\n" +
      "Em không muốn tiếp tục xuất hiện trong hộp thư của chị khi chưa được mời, nên đây sẽ là email cuối của em trong một thời gian.\n\n" +
      "Nếu robusta Việt Nam đạt chuẩn Mỹ trở nên phù hợp sau này — dự án blend mới, thiếu nguồn, hoặc đơn giản là muốn tìm hiểu năng lực hồ sơ của nhà máy — chị chỉ cần reply, em sẽ tiếp tục đúng chỗ mình đang dừng.\n\n" +
      "Nếu sourcing Việt Nam chưa phải ưu tiên, một lời \"no thanks\" là đủ và em sẽ đóng hồ sơ, không sao cả ạ.\n\n" +
      "Em cảm ơn chị đã dành thời gian ạ.",
  },
  // [5] Email B — seafood, initial_outreach (campaign khác → positioning khác)
  {
    subject_en: "Vietnam shrimp and pangasius, audit-ready",
    content_en:
      "Hi Mark,\n\n" +
      "Keeping frozen shrimp and pangasius programs supplied on the East Coast usually means juggling vendors, and documentation is where the friction shows up.\n\n" +
      "I'm Linda Nguyen with Vexim, a Hanoi-based compliance consulting partner. We prepare Vietnamese seafood factories for US-market expectations — FDA registration, HACCP plans, traceability records — and every factory is audited before it can be introduced to a buyer. Direct factory relationships, not a marketplace.\n\n" +
      "Would a short call be worth it to see whether any factory in our roster fits a program you're sourcing for?\n\n" +
      SIG,
    content_vi:
      "Chào anh Mark,\n\n" +
      "Duy trì các chương trình tôm và cá tra đông lạnh cho bờ Đông thường đồng nghĩa với xoay xở nhiều vendor, và hồ sơ giấy tờ là chỗ hay vướng.\n\n" +
      "Em là Linda Nguyen, thuộc Vexim — đối tác tư vấn tuân thủ tại Hà Nội. Chúng em chuẩn bị nhà máy hải sản Việt cho yêu cầu thị trường Mỹ — đăng ký FDA, kế hoạch HACCP, hồ sơ truy xuất — và mỗi nhà máy đều được audit trước khi giới thiệu cho buyer. Quan hệ trực tiếp với nhà máy, không phải marketplace.\n\n" +
      "Anh có dành ít phút cuộc gọi ngắn để xem nhà máy nào trong roster phù hợp chương trình anh đang sourcing không ạ?",
  },
  // [6] Email X — cố tình VI PHẠM (spam word + link + giá + thiếu signature)
  //     để minh hoạ QA chặn trước khi vào approval queue.
  {
    subject_en: "AMAZING Vietnamese coffee deal — free samples inside!",
    content_en:
      "Hi Sarah,\n\n" +
      "We guarantee the best price on Vietnamese robusta — only $2.90/lb for orders this month!\n\n" +
      "Book a call now: https://calendly.com/vexim-demo/15min\n\n" +
      "Linda",
    content_vi: "(email vi phạm — không dịch)",
  },
  // [7] Email X2 — vi phạm kiểu #2 (feedback 26/09): trend claim + bịa về
  //     Vexim (superlative/số liệu/ISO) + ép chọn phương án → QA chặn.
  {
    subject_en: "The leading source of US-ready Vietnamese robusta",
    content_en:
      "Hi Sarah,\n\n" +
      "Vietnam's robusta exports are growing fast, and Vexim is the largest compliance partner in the country — 40 factories and 12 years of experience, ISO 22000 certified.\n\n" +
      "Which would you prefer: a call this week or a sample offer?\n\n" +
      SIG,
    content_vi: "(email vi phạm — không dịch)",
  },
]

const runQA = qaMod.runEmailQA

// ---------------------------------------------------------------------------
// BuyerContext mô phỏng — đúng shape BuyerContext (types.ts)
// ---------------------------------------------------------------------------
const AE_NAME = "Linda Nguyen"
const AE_EMAIL = "linda.nguyen@veximtrade.com"
const UNSUB_TOKEN = "9f2ce8a1d74b4c0f8e21ab77"

function baseRules() {
  return { max_words: 200, no_links: true, no_attachments: true, opt_out_line_required: false }
}

const coffeeCampaign = {
  name: "US Specialty Coffee Roasters — Vietnam Robusta",
  description:
    "Pilot: US green-coffee importers & roasters with sourcing signals from Vietnam; angle = audit-ready robusta for espresso blends.",
  target_segment: "US green-coffee importers and specialty roasters",
  product_category: "coffee",
}

function coffeeCtx(overrides = {}) {
  return {
    buyer: {
      company_name: "Atlantic Coffee Traders",
      country: "United States",
      industry: "Food & Beverage — Coffee importing and roasting",
      website: "atlanticcoffeetraders.com",
      contact_name: "Sarah Mitchell",
      contact_email: "sarah.mitchell@atlanticcoffeetraders.com",
      contact_title: "Category Manager, Green Coffee",
    },
    import_data: {
      hs_codes: ["0901.11", "0901.90"],
      main_products: "Green coffee — arabica and robusta",
      purchase_history: "Recurring green-coffee imports across multiple origins",
      vietnam_supplier_exists: "YES",
      shipment_count: 48,
      peak_months: "UNKNOWN",
    },
    campaign: coffeeCampaign,
    research: {
      buyer_analysis: { summary: "Values consistency and documentation quality; responsive to category-level notes, unlikely to engage with volume pitches." },
      buyer_strategy: { angle: "compliance-readiness, low-friction comparison", tone: "peer-to-peer, no pressure" },
      analysis_age_days: 5,
    },
    crm: {
      stage: "contact_pending",
      campaign_step: 1,
      step_objective: null,
      followup_count: 0,
      previous_emails: [],
      replies: [],
      ...overrides.crm,
    },
    business_rules: baseRules(),
    ...overrides,
  }
}

const seafoodCampaign = {
  name: "Northeast Seafood Importers — Vietnam Pangasius & Shrimp",
  description: "Pilot: Northeast US seafood importers; angle = audit-ready factories with documentation handled.",
  target_segment: "US Northeast seafood importers & distributors",
  product_category: "seafood",
}

const seafoodCtx = {
  buyer: {
    company_name: "Harborline Seafood LLC",
    country: "United States",
    industry: "Food & Beverage — Seafood importing and distribution",
    website: "harborlineseafood.com",
    contact_name: "Mark Donovan",
    contact_email: "mark.donovan@harborlineseafood.com",
    contact_title: "Director of Procurement",
  },
  import_data: {
    hs_codes: "UNKNOWN",
    main_products: "Frozen seafood — shrimp and pangasius programs",
    purchase_history: "UNKNOWN",
    vietnam_supplier_exists: "UNKNOWN",
    shipment_count: "UNKNOWN",
    peak_months: "UNKNOWN",
  },
  campaign: seafoodCampaign,
  research: { buyer_analysis: "UNKNOWN", buyer_strategy: "UNKNOWN", analysis_age_days: "UNKNOWN" },
  crm: {
    stage: "contact_pending",
    campaign_step: 1,
    step_objective: null,
    followup_count: 0,
    previous_emails: [],
    replies: [],
  },
  business_rules: baseRules(),
}

const STEP_GUIDANCE = {
  coffee1: "Angle: robusta for espresso blends. Tone: peer-to-peer, zero pressure. No supplier pitch yet.",
  coffee2: "Under 110 words. Offer the spec-match shortcut. One soft opt-out line, plain and dignified.",
  coffee3: "3-5 sentences. Give an easy no, leave the door open, no new claims.",
  seafood1: "Angle: documentation handled, audit before introduction. No volume claims, no pricing.",
}

// ---------------------------------------------------------------------------
// Chạy pipeline thật
// ---------------------------------------------------------------------------
async function main() {
  const results = {}
  const push = (k, v) => (results[k] = v)

  // Email 1 — coffee initial
  push("coffee1", await gen.generateCampaignEmail(coffeeCtx(), "initial_outreach", STEP_GUIDANCE.coffee1, AE_NAME))

  // Gate bước 2 → email 2
  const ctx2 = coffeeCtx({ crm: {
    stage: "waiting_reply", campaign_step: 2, step_objective: "Earn a reply with a lower-effort ask", followup_count: 0,
    previous_emails: [{ step: 1, sent_at: "2026-09-21T13:05:00Z", subject: results.coffee1.subjectEn, content: results.coffee1.contentEn }],
    replies: [],
  }})
  const gate2 = await gateMod.assessFollowupJustification({ ctx: ctx2, stepNumber: 2, stepType: "follow_up", daysSinceLastContact: 6 })
  const gate2Decision = gateMod.applyFollowupGateDecision(gate2)
  push("gate2", { gate: gate2, decision: gate2Decision })
  push("coffee2", await gen.generateCampaignEmail(ctx2, "follow_up", STEP_GUIDANCE.coffee2, AE_NAME))

  // Gate bước 3 → email 3
  const ctx3 = coffeeCtx({ crm: {
    stage: "waiting_reply", campaign_step: 3, step_objective: "Close the loop politely", followup_count: 1,
    previous_emails: [
      { step: 1, sent_at: "2026-09-21T13:05:00Z", subject: results.coffee1.subjectEn, content: results.coffee1.contentEn },
      { step: 2, sent_at: "2026-09-28T13:10:00Z", subject: results.coffee2.subjectEn, content: results.coffee2.contentEn },
    ],
    replies: [],
  }})
  const gate3 = await gateMod.assessFollowupJustification({ ctx: ctx3, stepNumber: 3, stepType: "close_loop", daysSinceLastContact: 13 })
  const gate3Decision = gateMod.applyFollowupGateDecision(gate3)
  push("gate3", { gate: gate3, decision: gate3Decision })
  push("coffee3", await gen.generateCampaignEmail(ctx3, "close_loop", STEP_GUIDANCE.coffee3, AE_NAME))

  // Email B — seafood initial (campaign khác)
  push("seafood1", await gen.generateCampaignEmail(seafoodCtx, "initial_outreach", STEP_GUIDANCE.seafood1, AE_NAME))

  // Email X — vi phạm, để QA chặn
  const bad = await gen.generateCampaignEmail(coffeeCtx(), "initial_outreach", "deliberately bad", AE_NAME)
  push("bad", bad)

  // Email X2 — vi phạm kiểu #2 (feedback 26/09): trend claim + bịa về Vexim.
  const bad2 = await gen.generateCampaignEmail(coffeeCtx(), "initial_outreach", "deliberately bad #2", AE_NAME)
  push("bad2", bad2)

  // QA thật cho từng email
  const qaFor = (email, ctx, optOutRequired, stepType) =>
    runQA({ email: { subjectEn: email.subjectEn, contentEn: email.contentEn }, recipient: ctx.buyer.contact_email, ctx, optOutRequired, stepType })

  push("qa.coffee1", qaFor(results.coffee1, coffeeCtx(), false, "initial_outreach"))
  push("qa.coffee2", qaFor(results.coffee2, ctx2, true, "follow_up"))
  push("qa.coffee3", qaFor(results.coffee3, ctx3, true, "close_loop"))
  push("qa.seafood1", qaFor(results.seafood1, seafoodCtx, false, "initial_outreach"))
  push("qa.bad", qaFor(results.bad, coffeeCtx(), false, "initial_outreach"))
  push("qa.bad2", qaFor(results.bad2, coffeeCtx(), false, "initial_outreach"))

  render(results)
}

// ---------------------------------------------------------------------------
// Render markdown — headers mô phỏng đúng logic approve.ts + email-sender.ts
// ---------------------------------------------------------------------------
function headerBlock(to, subject, { thread = false } = {}) {
  return [
    `From: "${AE_NAME}" <${AE_EMAIL}>          ← buildPersonalizedSender: tên người thật, không phải brand`,
    `Reply-To: ${AE_EMAIL}          ← work_email của AE (fallback trade@)`,
    `To: ${to}`,
    `Subject: ${subject}`,
    ``,
    `# ── headers vô hình với buyer ──`,
    `List-Unsubscribe: <https://veximbridge.com/unsubscribe/${UNSUB_TOKEN}>   ← RFC 2369; Gmail hiện nút hủy đăng ký gốc thay vì Report spam`,
    `X-Entity-Ref-ID: <c4f19e02-7b31-4a8e-9f2d-6b5c8e1a90d4@veximtrade.com>   ← chống Gmail thread nhầm (chỉ khi KHÔNG phải reply-thread)`,
  ].join("\n")
}

function qaBox(qa) {
  const lines = []
  lines.push(`**QA:** ${qa.word_count} từ · risk **${qa.risk_level}** · ${qa.passed ? "PASSED (được vào approval queue)" : "BLOCKED (không thể approve)"}`)
  if (qa.issues.length === 0) lines.push(`&nbsp;&nbsp;── 0 issue`)
  for (const i of qa.issues) lines.push(`&nbsp;&nbsp;── [${i.severity}] \`${i.check}\` ${i.message}`)
  return lines.join("\n")
}

function gateBox(g) {
  return [
    `**Follow-up gate (AI đánh giá lại trước khi cho gửi):** proceed=**${g.gate.proceed}** · confidence **${g.gate.confidence}** ≥ 0.7 · category \`${g.gate.reasonCategory}\``,
    `> ${g.gate.reasonSummary}`,
    `→ Quyết định scheduler: **${g.decision.toUpperCase()}**`,
  ].join("\n")
}

function emailSection(title, to, metaLines, email, qa, gateMd) {
  const parts = [`## ${title}`, "", metaLines.join("  \n"), ""]
  if (gateMd) parts.push(gateMd, "")
  parts.push(
    `**Như buyer nhận được** (headers mô phỏng theo \`approve.ts\` → \`sendEmailDraft\`):`,
    "",
    "```text",
    headerBlock(to, email.subjectEn),
    "```",
    "",
    "```text",
    email.contentEn,
    "```",
    "",
    qaBox(qa),
    "",
    `<details><summary><b>Bản VI cho AE review</b> (approval queue hiển thị song ngữ)</summary>`,
    "",
    email.contentVi.split("\n").map((l) => "> " + l).join("\n"),
    "",
    `</details>`,
    "",
    "---",
    "",
  )
  return parts.join("\n")
}

function render(r) {
  const out = []
  out.push(`# Mẫu email AI Campaign Engine — bố cục nội dung thật qua pipeline thật`)
  out.push("")
  out.push('Cách tạo: chạy **code thật** của repo — generateCampaignEmail (parser + append signature), runEmailQA (toàn bộ check), assessFollowupJustification + applyFollowupGateDecision (gate), render header theo logic approve.ts → sendEmailDraft. Sandbox không có API key model nên **phần chữ trong email** được viết tay theo đúng system prompt của generator (đó chính là việc của model khi chạy production). Còn From/Reply-To/List-Unsubscribe là format thật của pipeline.')
  out.push("")
  out.push(`**Kịch bản demo** (đúng segment pilot: food importer + tín hiệu sourcing VN):`)
  out.push("")
  out.push(`| # | Campaign | Buyer | Bước |`)
  out.push(`|---|----------|-------|------|`)
  out.push(`| 1 | ${coffeeCampaign.name} | Sarah Mitchell — Atlantic Coffee Traders (Newark, US) | Email đầu tiên (initial_outreach) |`)
  out.push(`| 2 | ↑ cùng sequence | ↑ không reply sau 6 ngày | Follow-up (gate CHẤP THUẬN) |`)
  out.push(`| 3 | ↑ cùng sequence | ↑ không reply sau 13 ngày | Close-loop cuối sequence |`)
  out.push(`| 4 | ${seafoodCampaign.name} | Mark Donovan — Harborline Seafood LLC (Boston, US) | Email đầu tiên — campaign khác, positioning khác |`)
  out.push(`| 5 | (minh hoạ) | — | Email VI PHẠM rule → bị QA chặn |
| 6 | (minh hoạ) | — | Email VI PHẠM kiểu #2: trend claim + bịa về Vexim (superlative/số liệu/ISO) → bị QA chặn |`)
  out.push("")
  out.push("---")
  out.push("")

  const meta1 = [`**Campaign:** ${coffeeCampaign.name}`, `**To buyer:** sarah.mitchell@atlanticcoffeetraders.com`, `**Step:** 1 · initial_outreach · guidance: _${STEP_GUIDANCE.coffee1}_`]
  out.push(emailSection("1 · Email đầu tiên — coffee", "sarah.mitchell@atlanticcoffeetraders.com", meta1, r.coffee1, r["qa.coffee1"]))

  const meta2 = [`**Campaign:** ↑ cùng sequence`, `**To buyer:** sarah.mitchell@atlanticcoffeetraders.com`, `**Step:** 2 · follow_up · guidance: _${STEP_GUIDANCE.coffee2}_`]
  out.push(emailSection("2 · Follow-up — ngắn hơn, khác opening, có đường lùi", "sarah.mitchell@atlanticcoffeetraders.com", meta2, r.coffee2, r["qa.coffee2"], gateBox(r.gate2)))

  const meta3 = [`**Campaign:** ↑ cùng sequence`, `**To buyer:** sarah.mitchell@atlanticcoffeetraders.com`, `**Step:** 3 · close_loop · guidance: _${STEP_GUIDANCE.coffee3}_`]
  out.push(emailSection("3 · Close-loop — email cuối của sequence", "sarah.mitchell@atlanticcoffeetraders.com", meta3, r.coffee3, r["qa.coffee3"], gateBox(r.gate3)))

  const metaB = [
    `**Campaign:** ${seafoodCampaign.name}`,
    `**To buyer:** mark.donovan@harborlineseafood.com`,
    `**Step:** 1 · initial_outreach · guidance: _${STEP_GUIDANCE.seafood1}_`,
    `**Khác biệt:** import_data gần như UNKNOWN → email chỉ nói theo category, không nêu bất kỳ số liệu nào`,
  ]
  out.push(emailSection("4 · Email đầu tiên — campaign seafood (positioning khác)", "mark.donovan@harborlineseafood.com", metaB, r.seafood1, r["qa.seafood1"]))

  // Bad email
  out.push(`## 5 · Email vi phạm → QA chặn trước approval queue`, "")
  out.push(`Minh hoạ vì sao shadow mode + QA quan trọng — model thi thoảng lạc đề, các lớp sau phải bắt được. (Chú ý: đoạn "Linda" cuối email là generator **tự append signature** vì model quên — behaviour thật của buildSignature fallback.)`, "")
  out.push("**Như buyer sẽ nhận được (nếu không có QA):**", "")
  out.push("```text", headerBlock("sarah.mitchell@atlanticcoffeetraders.com", r.bad.subjectEn), "```", "")
  out.push("```text", r.bad.contentEn, "```", "")
  out.push(qaBox(r["qa.bad"]), "")
  out.push(`→ \`risk_level = HIGH\` → **nút Approve bị chặn ở UI** (\`approveAndSendCampaignDraft\` trả \`qa_blocked\`). Draft vẫn nằm trong queue để AE xem model sai ở đâu.`, "")

  // Bad email #2 — vi phạm kiểu #2 (feedback 26/09/2026)
  out.push(`## 6 · Email vi phạm kiểu #2 — trend claim + bịa về Vexim → QA chặn`, "")
  out.push('Minh hoạ các check mới (feedback 26/09): trend_claim ("growing fast" không dữ liệu), vexim_claim (superlative "largest", số liệu bịa "40 factories / 12 years", chứng nhận ISO ngoài whitelist) và close_loop_pressure (ép buyer chọn phương án):', "")
  out.push("**Như buyer sẽ nhận được (nếu không có QA):**", "")
  out.push("```text", headerBlock("sarah.mitchell@atlanticcoffeetraders.com", r.bad2.subjectEn), "```", "")
  out.push("```text", r.bad2.contentEn, "```", "")
  out.push(qaBox(r["qa.bad2"]), "")
  out.push("→ `risk_level = HIGH` → **blocked**. Model hay lạc đúng kiểu này khi prompt lỏng — whitelist fact + QA theo câu giúp chặn trước khi tới AE.", "")

  fs.writeFileSync(process.argv[3] ?? "/tmp/preview.md", out.join("\n"))
  console.log("rendered ok")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
