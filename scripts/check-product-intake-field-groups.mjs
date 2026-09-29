#!/usr/bin/env node
/**
 * Guard: every product-intake form field must belong to exactly one group.
 *
 * The form submits many products through one link. After each submission the
 * product-level fields are cleared and the supplier-level fields are kept, so
 * a supplier types product #2 into a clean form. If a field is left out of
 * PRODUCT_FIELDS it silently carries over, and a reused HS code files product
 * #2 under product #1's customs classification with a green success toast.
 *
 * Adding a field to useState() without classifying it here is the failure this
 * catches. Run: node scripts/check-product-intake-field-groups.mjs
 */

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const SRC = join(ROOT, "components", "product-intake", "product-intake-form.tsx")
const src = readFileSync(SRC, "utf-8")

function listOf(constName) {
  const m = src.match(new RegExp(`const ${constName} = \\[(.*?)\\] as const`, "s"))
  if (!m) throw new Error(`Không tìm thấy mảng ${constName} trong ${SRC}`)
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
}

// The useState literal is the source of truth for "which fields exist".
const formState = src.match(/const \[formData, setFormData\] = useState\(\{([\s\S]*?)\n  \}\)/)
if (!formState) throw new Error("Không tìm thấy useState formData")
const allFields = [...formState[1].matchAll(/^\s{4}(\w+):/gm)].map((x) => x[1])

const product = listOf("PRODUCT_FIELDS")
const supplier = listOf("SUPPLIER_FIELDS")

const problems = []
const seen = new Map()
for (const f of [...product, ...supplier]) seen.set(f, (seen.get(f) || 0) + 1)

for (const f of allFields) {
  if (!seen.has(f)) problems.push(`  - "${f}" có trong form nhưng chưa được xếp vào nhóm nào`)
}
for (const [f, n] of seen) {
  if (n > 1) problems.push(`  - "${f}" bị khai báo ${n} lần`)
  if (!allFields.includes(f)) problems.push(`  - "${f}" được khai báo nhưng không tồn tại trong form`)
}

console.log(`formData: ${allFields.length} field`)
console.log(`  xóa sau mỗi lần gửi (thuộc sản phẩm): ${product.length}`)
console.log(`  giữ lại (thuộc nhà cung cấp)          : ${supplier.length}`)

if (problems.length) {
  console.error("\n❌ Phân loại field chưa đầy đủ:\n" + problems.join("\n"))
  console.error("\nHệ quả: field bị sót sẽ mang sang sản phẩm tiếp theo (sai mã HS, sai nhóm).")
  process.exit(1)
}

console.log(`\n✅ ${allFields.length}/${allFields.length} field đã được phân loại, không sót.`)
