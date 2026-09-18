#!/usr/bin/env node
/**
 * Backfill `leads.buyer_analysis` / `buyer_strategy` (migration 079).
 *
 * WHY THIS EXISTS
 * ---------------
 * Migration 079 is additive, so every buyer created before it has
 * buyer_analysis IS NULL and falls back to the heuristic SuggestedApproachCard
 * on the "Phân tích" tab. This script fills them in.
 *
 * It re-runs the exact same pipeline the live intake flow uses, so a backfilled
 * buyer is indistinguishable from a newly created one:
 *
 *   leads.source_ref (ImportYeti link, stored since migration 032)
 *     -> extractSlugFromUrl()
 *     -> fetchRawImportYetiCompany()   raw payload, NOT the flattened projection
 *     -> analyzeBuyer()                deterministic scores, no tokens
 *     -> analyzeAndGenerateStrategy()  LLM strategy, with heuristic fallback
 *     -> UPDATE leads
 *
 * The raw payload matters: analyzeBuyer() needs suppliers_table / hs_codes /
 * recent_bols / time_series / map_table, and none of those survive
 * fetchAndTransformImportYetiData()'s projection into the intake form shape.
 *
 * RESUMABLE BY CONSTRUCTION
 * -------------------------
 * Candidates are selected with `buyer_analysis IS NULL`, so every successful
 * row drops out of the next run. Interrupt at any point (Ctrl-C once = finish
 * the current buyer, then stop) and just run it again.
 *
 * COST
 * ----
 * Per buyer: 1 ImportYeti credit + 1 LLM call (~1-2k tokens). ImportYeti
 * reports `creditsRemaining` and this script logs it so you can watch the
 * balance drain. Use --no-ai to skip the LLM entirely (scores only, free),
 * and --dry-run to see the candidate list without spending anything.
 *
 * USAGE
 * -----
 *   node --env-file-if-exists=.env.local scripts/backfill-buyer-analysis.mjs --dry-run
 *   node --env-file-if-exists=.env.local scripts/backfill-buyer-analysis.mjs --limit=10
 *   node --env-file-if-exists=.env.local scripts/backfill-buyer-analysis.mjs --limit=200 --delay=800
 *   node --env-file-if-exists=.env.local scripts/backfill-buyer-analysis.mjs --no-ai --limit=500
 *   node --env-file-if-exists=.env.local scripts/backfill-buyer-analysis.mjs --lead-id=<uuid>
 *
 * On Vercel, matching the convention of scripts/disable-resend-tracking.mjs:
 *   node --env-file-if-exists=/vercel/share/.env.project scripts/backfill-buyer-analysis.mjs
 *
 * Required env: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL),
 *               SUPABASE_SERVICE_ROLE_KEY, IMPORTYETI_API_KEY
 * For the LLM:  OPENAI_API_KEY or AI_GATEWAY_API_KEY (not needed with --no-ai)
 *
 * Requires Node >= 22.18 (native TypeScript type-stripping) so this .mjs can
 * import the real .ts modules instead of duplicating ~400 lines of scoring
 * logic. On 22.6-22.17 add --experimental-strip-types.
 */

import { createAdminClient } from "../lib/supabase/admin.ts"
import { analyzeBuyer } from "../lib/ai/buyer-analyzer.ts"
import {
  analyzeAndGenerateStrategy,
  BUYER_STRATEGY_MODEL,
} from "../lib/ai/buyer-strategy-generator.ts"
import {
  extractSlugFromUrl,
  fetchRawImportYetiCompany,
} from "../lib/importyeti/api-transformer.ts"

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const USAGE = `
Usage: node scripts/backfill-buyer-analysis.mjs [options]

Options:
  --limit=N        Số buyer xử lý trong lần chạy này (mặc định 25)
  --delay=MS       Nghỉ giữa 2 buyer, để né rate limit (mặc định 1200)
  --dry-run        Chỉ liệt kê candidate. Không gọi ImportYeti, không gọi AI, không ghi.
  --no-ai          Chỉ tính điểm (analyzeBuyer). Bỏ qua LLM -> không tốn token.
                   buyer_strategy sẽ là NULL, card vẫn hiện 3 điểm + ghi chú.
  --force          Ghi đè cả buyer ĐÃ có buyer_analysis (mặc định bỏ qua chúng)
  --lead-id=UUID   Chỉ xử lý đúng 1 buyer — để test trước khi chạy thật
  -h, --help       Hiện trợ giúp này

Script resumable: mỗi lần chạy chỉ lấy buyer có buyer_analysis IS NULL, nên
chạy lại bao nhiêu lần cũng được. Ctrl-C một lần = xong buyer hiện tại rồi dừng.
`

function parseArgs(argv) {
  const opts = {
    limit: 25,
    delayMs: 1200,
    dryRun: false,
    noAi: false,
    force: false,
    leadId: null,
    help: false,
  }
  const errors = []

  for (const arg of argv) {
    if (arg === "-h" || arg === "--help") {
      opts.help = true
      continue
    }
    const m = /^--([a-z-]+)(?:=(.*))?$/.exec(arg)
    if (!m) {
      errors.push(`Không hiểu tham số: ${arg}`)
      continue
    }
    const [, name, rawValue] = m
    switch (name) {
      case "dry-run":
        opts.dryRun = true
        break
      case "no-ai":
        opts.noAi = true
        break
      case "force":
        opts.force = true
        break
      case "limit": {
        const n = Number.parseInt(rawValue ?? "", 10)
        if (!Number.isInteger(n) || n < 1) errors.push(`--limit phải là số nguyên >= 1 (nhận: ${rawValue})`)
        else opts.limit = n
        break
      }
      case "delay": {
        const n = Number.parseInt(rawValue ?? "", 10)
        if (!Number.isInteger(n) || n < 0) errors.push(`--delay phải là số nguyên >= 0 (nhận: ${rawValue})`)
        else opts.delayMs = n
        break
      }
      case "lead-id": {
        const v = (rawValue ?? "").trim()
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) {
          errors.push(`--lead-id phải là UUID (nhận: ${rawValue})`)
        } else opts.leadId = v
        break
      }
      default:
        errors.push(`Không hiểu tham số: --${name}`)
    }
  }

  return { opts, errors }
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const log = (...args) => console.log("[v0]", ...args)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let stopRequested = false
process.on("SIGINT", () => {
  if (stopRequested) {
    console.log("\n[v0] Thoát ngay theo yêu cầu.")
    process.exit(130)
  }
  stopRequested = true
  console.log(
    "\n[v0] Đã nhận Ctrl-C — sẽ dừng SAU buyer hiện tại (để không bỏ dở một lần ghi).",
  )
  console.log("[v0] Bấm Ctrl-C lần nữa nếu muốn thoát ngay.")
})

/**
 * ImportYeti fetch with exponential backoff.
 *
 * Only 429 / 5xx / network errors are retried — a 401 (bad key) or 404
 * (company not on ImportYeti) will never succeed on a second attempt and
 * retrying just burns wall-clock time.
 */
async function fetchRawWithRetry(slug, apiKey, { retries = 3, baseDelayMs = 2000 }) {
  let last = { success: false, error: "unreachable", status: null }

  for (let attempt = 0; attempt <= retries; attempt++) {
    last = await fetchRawImportYetiCompany(slug, apiKey)
    if (last.success) return last

    const retryable = last.status === 429 || last.status === null || last.status >= 500
    if (!retryable || attempt === retries) return last

    const waitMs = baseDelayMs * 2 ** attempt
    log(`      ImportYeti ${last.status ?? "network"} — thử lại ${attempt + 1}/${retries} sau ${waitMs}ms`)
    await sleep(waitMs)
  }

  return last
}

/**
 * Same shape guard the server action applies on the live path
 * (app/admin/leads/new/actions.ts) — a malformed snapshot would blank the
 * "Phân tích" tab rather than fail loudly, so reject it here instead.
 */
function isValidAnalysis(a) {
  if (!a || typeof a !== "object") return false
  const scores = [a.healthScore, a.loyaltyScore, a.vietnamReadiness]
  if (scores.some((n) => typeof n !== "number" || !Number.isFinite(n))) return false
  return Boolean(
    a.healthBreakdown &&
      typeof a.healthBreakdown === "object" &&
      a.loyaltyBreakdown &&
      typeof a.loyaltyBreakdown === "object" &&
      a.vietnamBreakdown &&
      typeof a.vietnamBreakdown === "object",
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { opts, errors } = parseArgs(process.argv.slice(2))

  if (opts.help) {
    console.log(USAGE)
    return 0
  }
  if (errors.length > 0) {
    for (const e of errors) console.error("[v0]", e)
    console.log(USAGE)
    return 1
  }

  // --- env preflight -------------------------------------------------------
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const importYetiKey = process.env.IMPORTYETI_API_KEY
  const aiKey = process.env.OPENAI_API_KEY ?? process.env.AI_GATEWAY_API_KEY

  const missing = []
  if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL (hoặc SUPABASE_URL)")
  if (!supabaseKey) missing.push("SUPABASE_SERVICE_ROLE_KEY")
  if (!importYetiKey && !opts.dryRun) missing.push("IMPORTYETI_API_KEY")

  if (missing.length > 0) {
    console.error("[v0] Thiếu biến môi trường:", missing.join(", "))
    console.error(
      "[v0] Chạy kiểu: node --env-file-if-exists=.env.local scripts/backfill-buyer-analysis.mjs",
    )
    return 1
  }

  if (!aiKey && !opts.noAi && !opts.dryRun) {
    log(
      "CẢNH BÁO: không thấy OPENAI_API_KEY / AI_GATEWAY_API_KEY. LLM sẽ thất bại và",
    )
    log(
      "          analyzeAndGenerateStrategy() sẽ trả về strategy heuristic (model = NULL).",
    )
    log("          Thêm --no-ai nếu bạn cố ý chỉ muốn tính điểm.")
  }

  // --- banner --------------------------------------------------------------
  const mode = opts.dryRun
    ? "DRY-RUN (không gọi API, không ghi)"
    : opts.noAi
      ? "SCORES ONLY (--no-ai, không tốn token)"
      : `FULL (ImportYeti + ${BUYER_STRATEGY_MODEL})`

  console.log("")
  log("════════════════════════════════════════════════════════════")
  log("Backfill buyer analysis — migration 079")
  log("════════════════════════════════════════════════════════════")
  log(`Chế độ      : ${mode}`)
  log(`Limit       : ${opts.leadId ? `1 (lead-id ${opts.leadId})` : opts.limit}`)
  log(`Delay       : ${opts.delayMs}ms giữa 2 buyer`)
  log(`Ghi đè      : ${opts.force ? "CÓ (--force)" : "không, chỉ buyer chưa có analysis"}`)
  console.log("")

  const admin = createAdminClient()

  // --- candidate query -----------------------------------------------------
  const selectCols =
    "id, company_name, country, source_ref, created_at, buyer_analysis"

  const baseQuery = () => {
    let q = admin.from("leads").select(selectCols)
    if (opts.leadId) {
      q = q.eq("id", opts.leadId)
    } else {
      // source_ref holds the ImportYeti link (migration 032). Without it there
      // is no customs data to analyse — those buyers legitimately stay on the
      // heuristic fallback forever.
      q = q.not("source_ref", "is", null)
      if (!opts.force) q = q.is("buyer_analysis", null)
    }
    return q
  }

  const { count: totalCandidates, error: countError } = await baseQuery()
    .select(selectCols, { count: "exact", head: true })

  if (countError) {
    console.error("[v0] Không đếm được candidate:", countError.message)
    if (/buyer_analysis/.test(countError.message)) {
      console.error(
        "[v0] -> Có vẻ migration 079 CHƯA được chạy. Apply scripts/079_buyer_analysis_persistence.sql trước.",
      )
    }
    return 1
  }

  const { data: rows, error: rowsError } = await baseQuery()
    // Oldest first: the newest buyers are the ones most likely to already have
    // a snapshot from the live path, so draining from the old end gets the
    // backlog down fastest.
    .order("created_at", { ascending: true })
    .limit(opts.leadId ? 1 : opts.limit)

  if (rowsError) {
    console.error("[v0] Không đọc được leads:", rowsError.message)
    return 1
  }

  log(`Tổng buyer còn thiếu phân tích : ${totalCandidates ?? "?"}`)
  log(`Lấy trong lần chạy này         : ${rows?.length ?? 0}`)

  if (!rows || rows.length === 0) {
    console.log("")
    log(
      opts.leadId
        ? "Không tìm thấy lead-id đó (hoặc nó không có source_ref)."
        : "Không còn buyer nào cần backfill. Xong!",
    )
    return 0
  }

  if (opts.dryRun) {
    console.log("")
    log("── DRY-RUN: candidate ──────────────────────────────────────")
    for (const r of rows) {
      const slug = extractSlugFromUrl(r.source_ref ?? "")
      log(
        `  ${slug ? "✓" : "✗"} ${String(r.company_name ?? "(không tên)").padEnd(38).slice(0, 38)} ` +
          `${(r.country ?? "—").padEnd(3)} slug=${slug ?? "KHÔNG PARSE ĐƯỢC từ source_ref"}`,
      )
    }
    const unusable = rows.filter((r) => !extractSlugFromUrl(r.source_ref ?? "")).length
    console.log("")
    log(`Sẽ xử lý được : ${rows.length - unusable}/${rows.length}`)
    if (unusable > 0) {
      log(`Bỏ qua        : ${unusable} (source_ref không phải link ImportYeti hợp lệ)`)
    }
    log(
      `Ước tính chi phí khi chạy thật: ${rows.length - unusable} ImportYeti credit` +
        (opts.noAi ? ", 0 token" : `, ~${rows.length - unusable} lần gọi ${BUYER_STRATEGY_MODEL}`),
    )
    log("Bỏ --dry-run để chạy thật.")
    return 0
  }

  // --- process -------------------------------------------------------------
  const stats = {
    ok: 0,
    okWithAi: 0,
    okFallback: 0,
    scoresOnly: 0,
    skipped: [],
    failed: [],
  }

  console.log("")
  log("── Bắt đầu ────────────────────────────────────────────────")

  for (let i = 0; i < rows.length; i++) {
    if (stopRequested) {
      log(`Dừng theo yêu cầu ở vị trí ${i + 1}/${rows.length}.`)
      break
    }

    const row = rows[i]
    const label = `${String(i + 1).padStart(3)}/${rows.length}`
    const name = String(row.company_name ?? "(không tên)").slice(0, 42)

    const slug = extractSlugFromUrl(row.source_ref ?? "")
    if (!slug) {
      log(`${label}  SKIP  ${name} — source_ref không parse ra slug ImportYeti`)
      stats.skipped.push({ id: row.id, name, reason: "no_slug" })
      continue
    }

    // 1) Raw ImportYeti payload
    const raw = await fetchRawWithRetry(slug, importYetiKey)
    if (!raw.success) {
      log(`${label}  FAIL  ${name} — ImportYeti: ${raw.error}`)
      stats.failed.push({ id: row.id, name, reason: `importyeti: ${raw.error}` })
      // A 401/404 will never self-heal; retrying the rest of the batch against
      // a dead key just burns time, so bail out early.
      if (raw.status === 401) {
        console.error("[v0] ImportYeti key sai — dừng toàn bộ.")
        break
      }
      await sleep(opts.delayMs)
      continue
    }

    // 2) Deterministic scores (+ optional LLM strategy).
    // analyzeBuyer() is pure and runs once; analyzeAndGenerateStrategy() takes
    // that result rather than recomputing it.
    let analysis
    let strategy = null
    let strategySource = "none"
    try {
      const baseAnalysis = analyzeBuyer(raw.data)
      if (opts.noAi) {
        analysis = baseAnalysis
      } else {
        const full = await analyzeAndGenerateStrategy(baseAnalysis, raw.data)
        analysis = full.analysis
        strategy = full.strategy
        strategySource = full.strategySource
      }
    } catch (err) {
      log(`${label}  FAIL  ${name} — analyze: ${err instanceof Error ? err.message : err}`)
      stats.failed.push({ id: row.id, name, reason: "analyze threw" })
      await sleep(opts.delayMs)
      continue
    }

    if (!isValidAnalysis(analysis)) {
      log(`${label}  FAIL  ${name} — kết quả phân tích không hợp lệ, không ghi`)
      stats.failed.push({ id: row.id, name, reason: "invalid shape" })
      await sleep(opts.delayMs)
      continue
    }

    // 3) Write
    const { error: updateError } = await admin
      .from("leads")
      .update({
        buyer_analysis: analysis,
        buyer_strategy: strategy,
        buyer_analysis_at: new Date().toISOString(),
        // Truthful attribution: NULL when the heuristic fallback ran instead of
        // the LLM (same rule as the live intake path).
        buyer_analysis_model: strategySource === "ai" ? BUYER_STRATEGY_MODEL : null,
      })
      .eq("id", row.id)

    if (updateError) {
      log(`${label}  FAIL  ${name} — UPDATE: ${updateError.message}`)
      stats.failed.push({ id: row.id, name, reason: `update: ${updateError.message}` })
      await sleep(opts.delayMs)
      continue
    }

    // Counters only move after a successful write, so the summary can never
    // claim a buyer that failed to persist.
    stats.ok++
    if (opts.noAi) stats.scoresOnly++
    else if (strategySource === "ai") stats.okWithAi++
    else stats.okFallback++

    const creditNote =
      raw.creditsRemaining != null ? `  ImportYeti còn ${raw.creditsRemaining} credit` : ""
    log(
      `${label}  OK    ${name}  health=${analysis.healthScore} loyalty=${analysis.loyaltyScore} ` +
        `vn=${analysis.vietnamReadiness}  strategy=${strategySource}${creditNote}`,
    )

    if (i < rows.length - 1 && opts.delayMs > 0) await sleep(opts.delayMs)
  }

  // --- summary -------------------------------------------------------------
  console.log("")
  log("════════════════════════════════════════════════════════════")
  log("Tổng kết")
  log("════════════════════════════════════════════════════════════")
  log(`Ghi thành công            : ${stats.ok}`)
  if (!opts.noAi) {
    log(`  ├─ strategy từ AI thật  : ${stats.okWithAi}  (model = ${BUYER_STRATEGY_MODEL})`)
    log(`  └─ strategy heuristic   : ${stats.okFallback}  (model = NULL)`)
  } else {
    log(`  └─ chỉ có điểm, không strategy : ${stats.scoresOnly}`)
  }
  log(`Bỏ qua (slug không hợp lệ): ${stats.skipped.length}`)
  log(`Thất bại                  : ${stats.failed.length}`)

  if (stats.okWithAi === 0 && stats.okFallback > 0 && !opts.noAi) {
    console.log("")
    log("LƯU Ý: 100% strategy là heuristic fallback — không lần nào LLM trả về được.")
    log("       Kiểm tra OPENAI_API_KEY / AI_GATEWAY_API_KEY và log phía trên.")
  }

  if (stats.failed.length > 0 || stats.skipped.length > 0) {
    console.log("")
    log("Các lead chưa backfill được (chạy lại sẽ thử tiếp):")
    for (const f of [...stats.failed, ...stats.skipped]) {
      log(`  ${f.id}  ${f.name}  — ${f.reason}`)
    }
    console.log("")
    log("Gợi ý: buyer 404 trên ImportYeti sẽ KHÔNG BAO GIỜ backfill được và sẽ")
    log("       xuất hiện lại ở mỗi lần chạy. Chúng vẫn dùng fallback heuristic")
    log("       trên UI, nên có thể bỏ qua an toàn.")
  }

  const remaining = Math.max(0, (totalCandidates ?? 0) - stats.ok)
  if (!opts.leadId && remaining > 0) {
    console.log("")
    log(`Còn khoảng ${remaining} buyer chưa có phân tích — chạy lại lệnh này để tiếp tục.`)
  }

  console.log("")
  return stats.failed.length > 0 ? 2 : 0
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("[v0] Lỗi không mong muốn:", err)
    process.exit(1)
  })
