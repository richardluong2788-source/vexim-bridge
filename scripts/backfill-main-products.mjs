#!/usr/bin/env node
/**
 * Dọn dữ liệu thô: tách `client_intake_submissions.main_products` thành
 * `client_products` có cấu trúc (migration 083 + lib/client-intake).
 *
 * VÌ SAO CẦN
 * ----------
 * Nhà máy điền "Sản phẩm chính" bằng một textarea. Phần lớn viết liền một câu,
 * kiểu "Hạt điều rang muối, Cà phê rang xay (HS 0901.21), Tiêu đen và các loại
 * nông sản khác". Trong khi đó mọi thứ phía buyer đọc đều là `client_products`:
 * catalog công khai, trang hồ sơ nhà máy, và AI matching (`ae_client_products`).
 * Text chưa tách = nhà máy đó "không có sản phẩm" trên mọi bề mặt mua hàng.
 *
 * AN TOÀN DỮ LIỆU (đây là điểm chính, vì DB đang có hồ sơ đã publish)
 * --------------------------------------------------------------------
 *  - Chỉ INSERT, không UPDATE/DELETE bất kỳ hàng nào. Danh mục một AE đã tự tay
 *    làm (giá, MOQ, ảnh) không bị đụng tới; mặc định còn bỏ qua cả khách đã có
 *    sản phẩm (`--mode=empty-only`).
 *  - Không ghi vào `client_profiles` — `is_published` nằm ngoài phạm vi script.
 *  - `status='inactive'` (đổi bằng `--status`, có cảnh báo): catalog, trang hồ sơ
 *    và /api/products/search đều lọc `status='active'`, nên hàng mới seed KHÔNG
 *    hiện ra public cho tới khi người duyệt bật lên. AE matching thì thấy (view
 *    `ae_client_products` không lọc status) — đó là mục đích của việc seed.
 *  - Idempotent: `product_code = AUTO-<hash(name)>` va vào UNIQUE(client_id,
 *    product_code), cộng với dedupe theo tên đã chuẩn hoá. Chạy lại = 0 hàng.
 *  - Mặc định là dry-run. Phải có `--apply` mới ghi.
 *
 * CÁCH CHẠY
 * ---------
 *   node --env-file-if-exists=.env.local scripts/backfill-main-products.mjs --dry-run
 *   node --env-file-if-exists=.env.local scripts/backfill-main-products.mjs --limit=5 --apply
 *   node --env-file-if-exists=.env.local scripts/backfill-main-products.mjs --emit-sql   # chạy trong SQL editor
 *   node --env-file-if-exists=.env.local scripts/backfill-main-products.mjs --submission-id=<uuid> --apply
 *   node --env-file-if-exists=.env.local scripts/backfill-main-products.mjs --mode=fill-gaps --include-pending --report=/tmp/seed.json
 *
 * Trên Vercel (theo quy ước của scripts/backfill-buyer-analysis.mjs):
 *   node --env-file-if-exists=/vercel/share/.env.project scripts/backfill-main-products.mjs
 *
 * Bắt buộc: SUPABASE_URL (hoặc NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY.
 * Nên chạy scripts/083_client_products_intake_seed.sql trước để có cột provenance
 * (không có thì script vẫn ghi được, chỉ mất dấu "row này từ hồ sơ nào").
 *
 * Cần Node >= 22.18 (native TypeScript type-stripping) để import thẳng module .ts.
 */

import { writeFile } from "node:fs/promises"

import { createAdminClient } from "../lib/supabase/admin.ts"
import {
  planSeedRows,
  planToSql,
  seedProductsFromMainProducts,
} from "../lib/client-intake/split-main-products.ts"

const USAGE = `
Usage: node scripts/backfill-main-products.mjs [options]

  --dry-run          (MẶC ĐỊNH) chỉ in ra gì sẽ ghi. Không đụng DB.
  --apply            Ghi thật. Bắt buộc phải có nếu muốn insert.
  --limit=N          Số hồ sơ intake xử lý trong lần chạy (mặc định 25)
  --delay=MS         Nghỉ giữa 2 hồ sơ (mặc định 120)
  --mode=empty-only  (mặc định) chỉ seed khách chưa có sản phẩm nào
  --mode=fill-gaps   seed cả khách đã có sản phẩm, bỏ tên đã tồn tại
  --status=STATUS    inactive (mặc định) | active | suspended
  --min-confidence=  low | medium (mặc định) | high — mảnh chữ nào được tin
  --max-per-client=N Trần số sản phẩm sinh ra cho một khách (mặc định 12)
  --include-pending  Xem trước hồ sơ chưa duyệt (không bao giờ ghi nhóm này)
  --submission-id=U  Chỉ xử lý đúng 1 submission (UUID)
  --client-id=U      Chỉ xử lý khách có profiles.id = UUID (UUID)
  --emit-sql         In SQL idempotent thay vì ghi — để chạy trong SQL editor
  --report=PATH      Ghi JSON báo cáo chi tiết ra file
  -h, --help         Hiện trợ giúp này
`

function parseArgs(argv) {
  const opts = {
    apply: false,
    limit: 25,
    delayMs: 120,
    mode: "empty-only",
    status: "inactive",
    minConfidence: "medium",
    maxPerClient: 12,
    includePending: false,
    submissionId: null,
    clientId: null,
    emitSql: false,
    reportPath: null,
    help: false,
  }
  const errors = []
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  for (const arg of argv) {
    if (arg === "-h" || arg === "--help") {
      opts.help = true
      continue
    }
    if (arg === "--dry-run") continue
    if (arg === "--apply") {
      opts.apply = true
      continue
    }
    if (arg === "--include-pending") {
      opts.includePending = true
      continue
    }
    const m = /^--([a-z-]+)(?:=(.*))?$/.exec(arg)
    if (!m) {
      errors.push(`Không hiểu tham số: ${arg}`)
      continue
    }
    const [, name, raw] = m
    switch (name) {
      case "limit":
      case "delay":
      case "max-per-client": {
        const n = Number.parseInt(raw ?? "", 10)
        const min = name === "max-per-client" ? 1 : 0
        if (!Number.isInteger(n) || n < min) errors.push(`--${name} phải là số nguyên >= ${min}`)
        else if (name === "limit") opts.limit = n
        else if (name === "delay") opts.delayMs = n
        else opts.maxPerClient = n
        break
      }
      case "mode":
        if (raw !== "empty-only" && raw !== "fill-gaps") errors.push("--mode phải là empty-only | fill-gaps")
        else opts.mode = raw
        break
      case "status":
        if (!["inactive", "active", "suspended"].includes(raw)) {
          errors.push("--status phải là inactive | active | suspended")
        } else opts.status = raw
        break
      case "min-confidence":
        if (!["low", "medium", "high"].includes(raw)) {
          errors.push("--min-confidence phải là low | medium | high")
        } else opts.minConfidence = raw
        break
      case "submission-id":
      case "client-id": {
        const v = (raw ?? "").trim()
        if (!UUID_RE.test(v)) errors.push(`--${name} phải là UUID (nhận: ${raw})`)
        else if (name === "submission-id") opts.submissionId = v
        else opts.clientId = v
        break
      }
      case "emit-sql":
        opts.emitSql = true
        break
      case "report":
        opts.reportPath = (raw ?? "").trim() || null
        if (!opts.reportPath) errors.push("--report cần đường dẫn file")
        break
      default:
        errors.push(`Không hiểu tham số: --${name}`)
    }
  }

  return { opts, errors }
}

const log = (...args) => console.log("[v0]", ...args)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

let stopRequested = false
process.on("SIGINT", () => {
  if (stopRequested) {
    console.log("\n[v0] Thoát ngay theo yêu cầu.")
    process.exit(130)
  }
  stopRequested = true
  console.log("\n[v0] Sẽ dừng sau hồ sơ hiện tại. Bấm Ctrl-C lần nữa để thoát ngay.")
})

/**
 * Ứng viên = các submission đã duyệt (có client) — và nếu được yêu cầu, các hồ sơ
 * chưa duyệt chỉ để xem trước.
 */
async function fetchSubmissions(admin, opts) {
  const columns =
    "id, status, company_name, main_products, reviewed_by, created_client_id, submitted_at"

  async function run(build) {
    let query = admin.from("client_intake_submissions").select(columns)
    query = query.not("main_products", "is", null).neq("main_products", "")
    query = build(query)
    const { data, error } = await query.order("submitted_at", { ascending: false }).limit(opts.limit)
    if (error) throw new Error(`client_intake_submissions: ${error.message}`)
    return data ?? []
  }

  const writable = await run((query) =>
    opts.submissionId
      ? query.eq("id", opts.submissionId)
      : query.eq("status", "approved").not("created_client_id", "is", null),
  )
  if (!opts.includePending) return { writable, preview: [] }

  const preview = await run((query) =>
    query.or("status.eq.submitted,status.eq.pending").is("created_client_id", null),
  )
  return { writable, preview }
}

async function probeProvenanceColumn(admin) {
  const { error } = await admin
    .from("client_products")
    .select("id, source_submission_id")
    .limit(1)
  if (!error) return { present: true, message: null }
  return {
    present: /source_submission_id/i.test(error.message ?? "") ? false : true,
    message: error.message,
  }
}

function formatPlan(plan) {
  const parts = []
  if (plan.rows.length) parts.push(`+${plan.rows.length} row`)
  if (plan.skipped.length) {
    const counts = new Map()
    for (const entry of plan.skipped) counts.set(entry.reason, (counts.get(entry.reason) ?? 0) + 1)
    parts.push(`bỏ: ${[...counts].map(([reason, n]) => `${n}x ${reason}`).join(", ")}`)
  }
  if (plan.notes.length) parts.push(`ghi chú: ${plan.notes.join("; ")}`)
  return parts.join(" · ") || "không có gì"
}

async function main() {
  const { opts, errors } = parseArgs(process.argv.slice(2))
  if (opts.help) {
    console.log(USAGE)
    return 0
  }
  if (errors.length) {
    for (const error of errors) log(error)
    console.log(USAGE)
    return 1
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    log("Thiếu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — script cần service role vì nó ghi nhiều client.")
    return 1
  }
  if (opts.status === "active") {
    log("⚠ --status=active: hàng mới sẽ hiện NGAY trên catalog công khai và trang hồ sơ của nhà máy đã publish.")
  }
  if (!opts.apply && !opts.emitSql) log("Chế độ dry-run — không ghi gì. Thêm --apply để ghi thật.")

  const admin = createAdminClient()
  log(`DB: ${new URL(url).host} · mode=${opts.mode} · status=${opts.status} · limit=${opts.limit}`)

  const provenance = await probeProvenanceColumn(admin)
  if (!provenance.present) {
    log("⚠ Chưa có cột client_products.source_submission_id (scripts/083). Script vẫn ghi, nhưng không lưu provenance.")
  }

  let writable, preview
  try {
    ;({ writable, preview } = await fetchSubmissions(admin, opts))
  } catch (cause) {
    log(`Không đọc được client_intake_submissions: ${cause.message}`)
    log("Kiểm tra SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (và migration 064/065 đã apply chưa).")
    return 1
  }
  log(`Hồ sơ đã duyệt có main_products: ${writable.length}${opts.includePending ? ` · chưa duyệt (xem trước): ${preview.length}` : ""}`)

  const report = {
    generatedAt: new Date().toISOString(),
    options: opts,
    provenanceColumn: provenance.present,
    rows: [],
  }

  if (opts.includePending && preview.length > 0) {
    console.log("")
    log("PREVIEW — hồ sơ CHƯA duyệt (không ghi, client chưa tồn tại):")
    for (const submission of preview) {
      const plan = planSeedRows({
        clientId: "(chưa duyệt)",
        mainProducts: submission.main_products,
        companyName: submission.company_name,
        existing: [],
        onlyWhenClientEmpty: false,
        minConfidence: opts.minConfidence,
        maxProducts: opts.maxPerClient,
      })
      log(
        `  · ${submission.company_name ?? submission.id}: ${plan.candidates.length} ứng viên → ${plan.rows.length} sẽ tạo khi duyệt — ${formatPlan(plan)}`,
      )
      report.rows.push({ submissionId: submission.id, client: submission.company_name, preview: true, plan: planSummary(plan) })
    }
  }

  if (opts.emitSql) {
    const statements = []
    for (const submission of writable) {
      const result = await seedProductsFromMainProducts(admin, {
        clientId: submission.created_client_id,
        mainProducts: submission.main_products,
        submissionId: submission.id,
        createdBy: submission.reviewed_by ?? null,
        companyName: submission.company_name,
        status: opts.status,
        onlyWhenClientEmpty: opts.mode === "empty-only",
        minConfidence: opts.minConfidence,
        maxProducts: opts.maxPerClient,
        dryRun: true,
      })
      if (!result.ok) {
        log(`Lỗi ${submission.company_name}: ${result.error}`)
        continue
      }
      const sql = planToSql(result.plan)
      if (sql) {
        statements.push(`-- ${submission.company_name ?? "?"} · submission ${submission.id}\n${sql}`)
      }
    }
    console.log("")
    console.log(
      statements.length
        ? statements.join("\n\n")
        : "-- không có hàng nào để ghi (các client đã có sản phẩm, hoặc text không tách được)",
    )
    console.log("")
    log("Dán vào Supabase SQL editor. On conflict do nothing → chạy lại an toàn.")
    if (opts.reportPath) await writeReport(opts.reportPath, report)
    return 0
  }

  const totals = { submissions: 0, inserted: 0, planned: 0, skipped: 0, failed: 0 }

  for (let index = 0; index < writable.length; index += 1) {
    const submission = writable[index]
    if (stopRequested) {
      log(`Dừng sớm — còn ${writable.length - index} hồ sơ chưa xử lý. Chạy lại lệnh này để tiếp.`)
      break
    }
    totals.submissions += 1

    const result = await seedProductsFromMainProducts(admin, {
      clientId: submission.created_client_id,
      mainProducts: submission.main_products,
      submissionId: submission.id,
      createdBy: submission.reviewed_by ?? null,
      companyName: submission.company_name,
      status: opts.status,
      onlyWhenClientEmpty: opts.mode === "empty-only",
      minConfidence: opts.minConfidence,
      maxProducts: opts.maxPerClient,
      dryRun: !opts.apply,
    })

    const label = `${index + 1}/${writable.length} ${submission.company_name ?? submission.id}`
    if (!result.ok) {
      totals.failed += 1
      log(`✗ ${label}: ${result.error}`)
      report.rows.push({ submissionId: submission.id, client: submission.company_name, error: result.error })
      if (index < writable.length - 1) await sleep(opts.delayMs)
      continue
    }

    totals.planned += result.plan.rows.length
    totals.inserted += result.inserted
    totals.skipped += result.plan.skipped.length
    log(`${opts.apply ? "✓" : "·"} ${label}: ${formatPlan(result.plan)}`)
    if (opts.apply && result.provenanceColumnMissing) {
      log("  (bỏ cột source_submission_id vì chưa chạy migration 083)")
    }
    report.rows.push({
      submissionId: submission.id,
      clientId: submission.created_client_id,
      client: submission.company_name,
      inserted: result.inserted,
      ...planSummary(result.plan),
    })

    if (opts.apply && index < writable.length - 1) await sleep(opts.delayMs)
  }

  console.log("")
  log(
    `Tổng kết: ${totals.submissions} hồ sơ · ${opts.apply ? `đã ghi ${totals.inserted}` : `sẽ ghi ${totals.planned}`} · ${totals.skipped} bỏ qua · ${totals.failed} lỗi`,
  )
  log("client_profiles: 0 hàng bị ghi — không hồ sơ nào đổi is_published, không sản phẩm nào bị sửa/xoá.")
  if (totals.planned > 0 && !opts.apply) {
    log(`Muốn ghi thật: chạy lại với --apply (nên bắt đầu bằng --limit=5).`)
  } else if (opts.apply && totals.inserted > 0) {
    console.log("")
    log("Sau khi duyệt tay, bật hàng lên catalog bằng:")
    log("  update public.client_products set status = 'active'")
    log("   where source_submission_id is not null and status = 'inactive' and id in (...);")
    log("Hoặc revert cả đợt seed:")
    log("  delete from public.client_products")
    log("   where source_submission_id in (select id from public.client_intake_submissions where status = 'approved');")
    log("(xóa thì chỉ nên nhắm hàng có source_submission_id — đó là lý do nên chạy migration 083 trước).")
  }
  if (opts.reportPath) await writeReport(opts.reportPath, report)
  return totals.failed > 0 ? 2 : 0
}

function planSummary(plan) {
  return {
    candidates: plan.candidates.length,
    toInsert: plan.rows.length,
    productNames: plan.rows.map((row) => row.product_name),
    skipped: plan.skipped,
    notes: plan.notes,
  }
}

async function writeReport(path, report) {
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, "utf8")
  log(`Báo cáo: ${path}`)
}

main()
  .then((code) => process.exit(code ?? 0))
  .catch((error) => {
    console.error("[v0] Lỗi không mong đợi:", error?.stack ?? error)
    process.exit(1)
  })
