#!/usr/bin/env node
/**
 * Checks for the intake product splitter + seeder.
 *
 *   node --test scripts/check-split-main-products.mjs
 *
 * There is no test runner wired into this repo's build, so this uses the Node
 * standard-library one (no devDependency) and imports the real `.ts` modules
 * through Node's native type stripping — same trick as
 * scripts/backfill-buyer-analysis.mjs. These cases are the reason the splitter is
 * pure: the alternative is running a data migration against a live database with
 * published supplier profiles on the other side of it.
 *
 * Requires Node >= 22.18. On 22.6-22.17 add --experimental-strip-types.
 */

import test from "node:test"
import assert from "node:assert/strict"

import {
  detectCategory,
  normalizeHsCode,
  normalizeProductName,
  planSeedRows,
  planToSql,
  seededProductCode,
  splitMainProducts,
} from "../lib/client-intake/split-main-products.ts"

const names = (result) => result.candidates.map((candidate) => candidate.productName)

test("commas + labelled HS codes become one row per product", () => {
  const result = splitMainProducts(
    "Hạt điều rang muối (HS 2008.19), Cà phê rang xay (HS 0901.21), Tiêu đen",
  )
  assert.deepEqual(names(result), ["Hạt điều rang muối", "Cà phê rang xay", "Tiêu đen"])
  assert.equal(result.candidates[0].category, "Cashew")
  assert.equal(result.candidates[0].hsCode, "2008.19")
  assert.equal(result.candidates[1].category, "Coffee")
  assert.equal(result.candidates[1].hsCode, "0901.21")
  assert.equal(result.candidates[2].category, "Pepper")
  assert.equal(result.candidates[2].hsCode, null)
  assert.ok(result.candidates.every((candidate) => candidate.confidence === "high"))
})

test("the raw fragment is preserved for the reviewer", () => {
  const result = splitMainProducts("Cà phê robusta grade 2 (HS 0901.21)")
  assert.equal(result.candidates[0].raw, "Cà phê robusta grade 2 (HS 0901.21)")
})

test("newlines, bullets and numbering all work", () => {
  const result = splitMainProducts(
    ["Gạo trắng 5% tấm", "• Bún khô", "  2. Miến dong", "3) Bột sắn dây"].join("\n"),
  )
  assert.deepEqual(names(result), ["Gạo trắng 5% tấm", "Bún khô", "Miến dong", "Bột sắn dây"])
})

test("semicolons and ' / ' separate; a lone slash inside a name survives", () => {
  assert.deepEqual(names(splitMainProducts("Hạt điều; Tiêu; Muối")), ["Hạt điều", "Tiêu", "Muối"])
  assert.deepEqual(names(splitMainProducts("Xoài sấy / Dứa sấy")), ["Xoài sấy", "Dứa sấy"])
  // "500ml/chai" is one pack size, not two products: only a spaced slash splits.
  assert.deepEqual(names(splitMainProducts("Nước mắm 500ml/chai")), ["Nước mắm 500ml/chai"])
})

test("the 'và' connective splits an enumeration but not a name", () => {
  assert.deepEqual(names(splitMainProducts("Hạt điều và hồ tiêu")), ["Hạt điều", "Hồ tiêu"])
  assert.deepEqual(
    names(splitMainProducts("Phở khô bản đặc sản", { splitOnConnectives: false })),
    ["Phở khô bản đặc sản"],
  )
})

test("filler clauses are dropped, with a reason", () => {
  const result = splitMainProducts(
    "Tiêu đen, Điều, và các loại nông sản khác, v.v., theo yêu cầu khách hàng",
  )
  assert.deepEqual(names(result), ["Tiêu đen", "Điều"])
  const reasons = result.dropped.map((entry) => entry.reason)
  assert.ok(reasons.includes("generic"), `expected a generic drop, got ${reasons.join(",")}`)
})

test("a run-on sentence is not chopped into inventions", () => {
  // No separator at all: one candidate, flagged low, never silently truncated
  // into products the client did not list.
  const result = splitMainProducts(
    "Hệ thống dây chuyền rang xay cà phê công suất lớn phục vụ đơn hàng số lượng nhiều nhất khu vực",
  )
  assert.equal(result.candidates.length, 1, result.candidates.map((c) => c.raw).join(" | "))
  assert.equal(result.candidates[0].confidence, "low")
  assert.ok(result.notes.some((note) => note.includes("no separator")))
  // A sentence that is only a verb phrase yields nothing at all.
  const verbs = splitMainProducts("Chúng tôi chuyên sản xuất và cung cấp các mặt hàng nông sản")
  assert.deepEqual(verbs.candidates.map((c) => c.productName), [])
})

test("duplicates collapse on a diacritic- and case-insensitive key", () => {
  const result = splitMainProducts("Hạt điều rang muối, HẠT ĐIỀU RANG MUỐI, hat dieu rang muoi")
  assert.equal(result.candidates.length, 1)
  assert.ok(result.dropped.some((entry) => entry.reason === "duplicate"))
})

test("the candidate ceiling is enforced and reported", () => {
  const many = Array.from({ length: 20 }, (_unused, index) => `Sản phẩm A${index}`).join(", ")
  const result = splitMainProducts(many, { maxProducts: 12 })
  assert.equal(result.candidates.length, 12)
  assert.equal(result.dropped.filter((entry) => entry.reason === "over_cap").length, 8)
  assert.ok(result.notes.some((note) => note.includes("capped")))
})

test("the company name repeated in the list is not a product", () => {
  const result = splitMainProducts("Xanh Farm, Cà phê robusta, Xanh Farm Co Ltd", {
    companyName: "Xanh Farm",
  })
  assert.deepEqual(names(result), ["Cà phê robusta"])
  assert.ok(result.dropped.some((entry) => entry.reason === "company_name"))
})

test("ALL CAPS becomes readable, and a trailing pack size becomes the unit", () => {
  const result = splitMainProducts("HẠT ĐIỀU RANG MUỐI, Cà phê rang xay 500g/hộp, Gạo ST25")
  assert.equal(result.candidates[0].productName, "Hạt điều rang muối")
  assert.equal(result.candidates[1].productName, "Cà phê rang xay")
  assert.equal(result.candidates[1].unitOfMeasure, "box")
  assert.equal(result.candidates[2].productName, "Gạo ST25")
})

test("a lead-in is removed, a colon inside a name is not", () => {
  assert.deepEqual(names(splitMainProducts("Sản phẩm chính: Tiêu, Điều")), ["Tiêu", "Điều"])
  assert.deepEqual(names(splitMainProducts("Phở khô: bản đặc sản")), ["Phở khô: bản đặc sản"])
})

test("over-long fragments are cut at a word boundary and flagged", () => {
  const long = `Cà phê ${"rang xay đặc biệt ".repeat(12)}`
  const result = splitMainProducts(long)
  assert.ok(result.candidates[0].productName.length <= 120)
  assert.equal(result.candidates[0].truncated, true)
  assert.equal(result.candidates[0].confidence, "low")
})

test("empty and null input produce an empty plan, never a throw", () => {
  for (const value of [null, undefined, "", "   ", ", , ; ,"]) {
    const result = splitMainProducts(value)
    assert.equal(result.candidates.length, 0, String(value))
  }
})

test("normalizeProductName / normalizeHsCode / detectCategory units", () => {
  assert.equal(normalizeProductName("  Cà-Phê RANG_XAY! "), "ca phe rang xay")
  assert.equal(normalizeProductName("Đậu Đen"), "dau den")
  assert.equal(normalizeHsCode("0901.21"), "0901.21")
  assert.equal(normalizeHsCode("90121"), null) // 5 digits is not a code shape
  assert.equal(normalizeHsCode("090121"), "0901.21")
  assert.equal(normalizeHsCode("0901.21.00.00"), "0901.21.00.00")
  assert.equal(normalizeHsCode("12"), null)
  assert.equal(normalizeHsCode("12345"), null)
  assert.equal(detectCategory("hat dieu rang muoi"), "Cashew")
  assert.equal(detectCategory("ca phe rang xay"), "Coffee")
  assert.equal(detectCategory("dau an voi"), "Oils")
  assert.equal(detectCategory("dau phong rang"), "Nuts")
  assert.equal(detectCategory("thit heo"), null)
})

test("seededProductCode is stable, and stable means idempotent", () => {
  const a = seededProductCode(normalizeProductName("Hạt điều rang muối"))
  const b = seededProductCode(normalizeProductName("HAT DIEU RANG MUOI"))
  assert.match(a, /^AUTO-[0-9A-F]{8}$/)
  assert.equal(a, b)
  assert.notEqual(a, seededProductCode(normalizeProductName("Tiêu đen")))
})

test("planSeedRows: a client with products is left alone by default", () => {
  const plan = planSeedRows({
    clientId: "c1",
    mainProducts: "Tiêu, Điều",
    existing: [{ product_name: "Hồ tiêu", product_code: "TP-1" }],
  })
  assert.deepEqual(plan.rows, [])
  assert.equal(plan.skipped[0].reason, "client_not_empty")
})

test("planSeedRows: fill-gaps mode skips only what already exists", () => {
  const plan = planSeedRows({
    clientId: "c1",
    mainProducts: "Tiêu đen, Điều, Muối biển",
    existing: [{ product_name: "Tiêu Đen", product_code: "TP-1" }],
    onlyWhenClientEmpty: false,
    createdBy: "ae1",
    submissionId: "s1",
  })
  assert.deepEqual(
    plan.rows.map((row) => [row.product_name, row.status, row.created_by, row.source_submission_id]),
    [
      ["Điều", "inactive", "ae1", "s1"],
      ["Muối biển", "inactive", "ae1", "s1"],
    ],
  )
  assert.ok(plan.skipped.some((entry) => entry.reason === "duplicate_of_existing"))
})

test("planSeedRows: low-confidence rows are not written, but are reported", () => {
  const plan = planSeedRows({
    clientId: "c1",
    mainProducts: "Chúng tôi có nhiều mặt hàng nông sản chủ lực của Việt Nam được trồng và thu hoạch theo mùa vụ tại các tỉnh phía nam",
  })
  assert.deepEqual(plan.rows, [])
  assert.equal(plan.skipped[0].reason, "low_confidence")
})

test("planSeedRows: a second run over the same text writes nothing new", () => {
  const text = "Cà phê robusta (HS 090121), Hạt điều, Tiêu"
  const first = planSeedRows({ clientId: "c1", mainProducts: text })
  assert.equal(first.rows.length, 3)
  // Default mode short-circuits first (the client is no longer empty) ...
  const defaultMode = planSeedRows({ clientId: "c1", mainProducts: text, existing: first.rows })
  assert.deepEqual(defaultMode.rows, [])
  assert.equal(defaultMode.skipped[0].reason, "client_not_empty")
  // ... and gap-filling mode still refuses to duplicate by name.
  const second = planSeedRows({
    clientId: "c1",
    mainProducts: text,
    existing: first.rows,
    onlyWhenClientEmpty: false,
  })
  assert.deepEqual(second.rows, [])
  assert.ok(second.skipped.every((entry) => entry.reason === "duplicate_of_existing"))
})

test("planSeedRows: names stay inside the column and never carry trailing punctuation", () => {
  const plan = planSeedRows({ clientId: "c1", mainProducts: `Tiêu đen. ${"x ".repeat(200)}` })
  for (const row of plan.rows) {
    assert.ok(row.product_name.length <= 160, row.product_name)
    assert.ok(!/[.;,]$/.test(row.product_name), row.product_name)
  }
})

test("planToSql escapes quotes and stays idempotent", () => {
  const plan = planSeedRows({ clientId: "c1", mainProducts: "Bún 'tươi', Tiêu" })
  const sql = planToSql(plan)
  assert.match(sql, /on conflict \(client_id, product_code\) do nothing/)
  assert.ok(sql.includes("'Bún ''tươi'"), sql)
})
