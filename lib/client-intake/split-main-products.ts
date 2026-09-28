import type { createAdminClient } from "../supabase/admin"

/**
 * Turning the intake's free-text "Sản phẩm chính" into product-shaped data.
 *
 * `client_intake_submissions.main_products` (migration 064) is one textarea the
 * factory fills however they like. In practice that means anything from
 *
 *     Hạt điều rang muối (HS 2008.19), Cà phê rang xay (HS 0901.21), Tiêu đen
 *
 * to a single 400-character sentence with newlines, bullets, "và", and the
 * occasional "các loại nông sản khác". Everything buyer-facing reads
 * `client_products` instead — the catalog (`app/products`), the public supplier
 * profile, the AI matcher (`lib/matching/scorer.ts` via `ae_client_products`) —
 * so whatever is not split here is invisible to a US buyer.
 *
 * Design rules, learned from the data rather than invented:
 *  1. **Never invent a product.** Only split on separators that are actually
 *     there. A run-on sentence with no separator stays one candidate (flagged
 *     `low`) instead of being chopped at commas the writer may not have meant.
 *  2. **Never lose what the client wrote.** The original fragment is kept on
 *     `raw` for the reviewer, and every rejection is reported with a reason a
 *     human can overrule.
 *  3. **Prefer a smaller, honest set.** A row with a wrong name is worse than no
 *     row, so filler ("các loại khác", "v.v.") is dropped, not stored.
 *  4. **Deterministic.** Same input ⇒ same candidates in the same order, which
 *     is what makes the backfill re-runnable and review chips stable.
 *
 * No database, no Supabase, no `next/*` import: this runs identically in a
 * server action, in a `node` script and in a test.
 */

/** Canonical `client_products.category` values, seeded by migration 028. */
export const CANONICAL_CATEGORIES = [
  "Coffee",
  "Cocoa",
  "Pepper",
  "Cashew",
  "Spices",
  "Nuts",
  "Dried Fruits",
  "Grains",
  "Oils",
  "Other",
] as const

export type CanonicalCategory = (typeof CANONICAL_CATEGORIES)[number]

export type SplitConfidence = "high" | "medium" | "low"

export type DropReason =
  | "empty"
  | "too_short"
  | "no_letters"
  | "generic"
  | "company_name"
  | "duplicate"
  | "over_cap"

export interface ProductCandidate {
  /** Exactly what the client typed for this item, before cleanup. */
  raw: string
  /** Value for `client_products.product_name`. */
  productName: string
  /** Case- and diacritic-insensitive key: dedupe + matching existing rows. */
  nameKey: string
  hsCode: string | null
  category: CanonicalCategory | null
  /** Value for `client_products.unit_of_measure`, only when the text says so. */
  unitOfMeasure: string | null
  confidence: SplitConfidence
  /** True when the fragment was cut to `maxFragmentChars`. */
  truncated: boolean
}

export interface DroppedFragment {
  fragment: string
  reason: DropReason
}

export interface SplitMainProductsOptions {
  /** Ceiling on returned candidates (the intake field is unbounded). */
  maxProducts?: number
  /** Fragments shorter than this are noise, not products. */
  minFragmentChars?: number
  /** Names longer than this are cut: a product name is not a paragraph. */
  maxFragmentChars?: number
  /** A fragment that is just the company name repeated is noise. */
  companyName?: string | null
  /**
   * Split on ` / ` and the "và / hoặc / &" connectives too. On by default; turn
   * it off when one product name legitimately contains "và".
   */
  splitOnConnectives?: boolean
}

export interface SplitMainProductsResult {
  candidates: ProductCandidate[]
  dropped: DroppedFragment[]
  /** Separators actually present in the input (drives the "run-on" verdict). */
  separators: string[]
  /** Human-readable caveats, e.g. "no separator found", "capped at 12". */
  notes: string[]
}

export const SPLIT_DEFAULTS = {
  maxProducts: 12,
  minFragmentChars: 3,
  maxFragmentChars: 120,
} as const

// ---------------------------------------------------------------------------
// Keyword maps (matched against a diacritic-free, lowercase key)
// ---------------------------------------------------------------------------

/**
 * Keyword → canonical category. Order matters: the specific entries run before
 * the broad ones, so "hạt điều" is Cashew and not Nuts, "dầu ăn" is Oils and not
 * Grains. Whole-word matching (see `detectCategory`) is what keeps "hạt" from
 * matching inside another word.
 */
const CATEGORY_KEYWORDS: Array<[CanonicalCategory, string[]]> = [
  ["Coffee", ["ca phe", "caphe", "cafe", "coffee", "robusta", "arabica", "espresso", "moka", "culi"]],
  ["Cocoa", ["cacao", "cocoa", "chocolate", "soco la", "socola"]],
  ["Cashew", ["dieu", "cashew"]],
  ["Pepper", ["tieu", "pepper", "peppercorn", "piper"]],
  [
    "Spices",
    [
      "que",
      "hoi",
      "lang",
      "sa",
      "nghe",
      "gung",
      "khuong",
      "dinh huong",
      "thao qua",
      "gia vi",
      "spice",
      "spices",
      "cinnamon",
      "anise",
      "turmeric",
      "ginger",
      "lemongrass",
      "cardamom",
      "clove",
      "vanilla",
      "bot canh",
    ],
  ],
  [
    "Nuts",
    [
      "macca",
      "mac ca",
      "macadamia",
      "oc cho",
      "hanh nhan",
      "dia qua",
      "dau phong",
      "peanut",
      "walnut",
      "almond",
      "pistachio",
      "hat",
      "nuts",
    ],
  ],
  ["Dried Fruits", ["say", "mut", "dried", "raisin", "tra cay"]],
  [
    "Grains",
    [
      "gao",
      "nep",
      "lua",
      "yen mach",
      "ngu coc",
      "rice",
      "oat",
      "oats",
      "wheat",
      "corn",
      "ngo",
      "mien",
      "bun",
      "pho",
      "mi",
      "tinh bot",
      "bot",
      "flour",
      "starch",
      "noodle",
      "macaroni",
    ],
  ],
  ["Oils", ["dau an", "dua", "dau", "oil", "shortening"]],
]

/** Unit words that sometimes ride along inside the product list. */
const UNIT_KEYWORDS: Array<[string, string[]]> = [
  ["ton", ["tan", "tonne", "metric ton"]],
  ["kg", ["kg", "kilo", "kilogram"]],
  ["piece", ["cai", "chiec", "piece", "pcs"]],
  ["box", ["hop", "box"]],
  ["carton", ["thung", "carton", "ctn"]],
  ["bottle", ["chai", "bottle"]],
  ["bag", ["tui", "bao", "sack", "bag"]],
  ["liter", ["lit", "liter", "litre"]],
]

/**
 * Fragments that read like a filler clause rather than a product. The last one
 * catches the Vietnamese habit of ending a list with "và các loại khác".
 */
const GENERIC_PATTERNS: RegExp[] = [
  /^(vv|v ?v|etc|etcetera|all|other|others|khong|none)$/i,
  /^(va|va\sva|and|or|hoac|cung|gom|cu the|nhu sau|nu|khac|khac nhau)$/i,
  /^(cac loai|nhieu loai|da dang|day du|san pham|nong san|nong nghiep|thuc pham|hang hoa|product|products)$/i,
  /^(theo\s+yeu\s+cau.*|on\s+request.*|khi\s+can.*|lien\s+he.*)$/i,
  // A sentence, not a noun phrase: "chúng tôi chuyên sản xuất và cung cấp …".
  // Splitting on "và" can leave a verb clause behind, and a verb clause is never
  // worth a catalog row.
  /^(chung\s+toi|chuyen|chuyen\s+san\s+xuat|san\s+xuat|cung\s+cap|cung\s+ung|chuyen\s+san\s+xuat\s+va\s+cung\s+cap|nhan\s+gia\s+cong|xuat\s+khau|nhap\s+khau|dai\s+ly|phân\s+phối|ph[âa]n\s+phoi)\b/i,
  /^(danh\s+cho|danh\s+cho\s+khach)$/,
  /^(.*\s)?(cac\s+loai\s+)?(khac|other)(\s+loai)?(\s+nua)?$/,
]

/**
 * HS code with its label (`HS 2008.19`, `Mã HS: 0901.21`, `(HS 0901.21)`),
 * including the punctuation a factory uses around it.
 */
const HS_LABELLED_SOURCE = String.raw`[\(\[\{"']?\s*(?:m[ãa]\s*)?hs\s*(?:code)?\s*[:#]?\s*[0-9][0-9 .\-]{3,17}[0-9]\s*[\)\]\}"']?`
/** A bare dotted code (`0901.21`, `0901.21.00.00`) with no label at all. */
const HS_BARE_SOURCE = String.raw`[0-9]{4}\.[0-9]{2}(?:\.[0-9]{1,2}){0,2}`

const HS_LABELLED_GLOBAL = new RegExp(HS_LABELLED_SOURCE, "gi")
const HS_BARE_GLOBAL = new RegExp(String.raw`(?<![\d.])${HS_BARE_SOURCE}(?![\d.])`, "g")

// ---------------------------------------------------------------------------
// Small pure helpers (exported so the check script can test them directly)
// ---------------------------------------------------------------------------

/** Lowercase, no diacritics, no punctuation: the comparison key. */
export function normalizeProductName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/**
 * `0901.21`, `90121`, `(HS 2008.19.00.00)` → a dotted HS code. Anything that is
 * not 4/6/8/10 digits returns null, so a typo never lands in the catalog as a
 * customs code a buyer might quote to a broker.
 */
export function normalizeHsCode(value: string | null | undefined): string | null {
  if (!value) return null
  const digits = String(value).replace(/[^0-9]/g, "")
  if (digits.length !== 4 && digits.length !== 6 && digits.length !== 8 && digits.length !== 10) {
    return null
  }
  const groups = [digits.slice(0, 4)]
  for (let i = 4; i < digits.length; i += 2) groups.push(digits.slice(i, i + 2))
  return groups.join(".")
}

function wholeWord(keyword: string): RegExp {
  return new RegExp(`(?:^|[^a-z0-9])${keyword}(?:[^a-z0-9]|$)`, "i")
}

/** Best category for a normalized name; null when nothing confident matches. */
export function detectCategory(nameKey: string): CanonicalCategory | null {
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => wholeWord(keyword).test(nameKey))) return category
  }
  return null
}

export function detectUnit(nameKey: string): string | null {
  for (const [unit, keywords] of UNIT_KEYWORDS) {
    if (keywords.some((keyword) => wholeWord(keyword).test(nameKey))) return unit
  }
  return null
}

/**
 * A lead-in the client typed before the list ("Sản phẩm chính:", "Gồm -",
 * "Danh mục:"). Only stripped when the words before the colon are one of these,
 * so "Phở khô: bản đặc sản" keeps its name.
 */
const LEAD_IN =
  /^\s*(?:c[aá]c\s+)?(?:sản\s+phẩm(?:\s+chính)?|san\s+pham(?:\s+chinh)?|danh\s+mục|danh\s+muc|danh\s+sách|danh\s+ sach|products?|gồm|gom|cụ\s+thể|cu\s+the|ví\s+dụ|vi\s+du|capability|năng\s+lực|nang\s+lực)\s*[:\-–]\s*/i

/** Leading bullets/numbering and trailing punctuation a list item comes with. */
function cleanFragment(fragment: string): string {
  return fragment
    .replace(/\u00a0/g, " ")
    .replace(/^[\s\-–—•·*>]+/, "")
    .replace(LEAD_IN, "")
    .replace(/^\(*\s*(?:vd\.?|vi du|example|chang han|ex)[:\-]?\s*/i, "")
    .replace(/^\s*\d+\s*[.)\]]\s*/, "")
    .replace(/[.,;:/|()[\]"'`\s]+$/g, "")
    .replace(/^["'`\s]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim()
}

// The unit words appear with diacritics ("hộp", "tấn", "lít"), and matching only
// the ASCII forms silently kept "Cà phê 500g/hộp" as the product name.
const PACK_QTY = String.raw`\d+(?:[.,]\d+)?`
const PACK_UNIT = String.raw`kg|k[îi] ?l[ôo]|gr?am|gr|g|t[áa]n|l[íi]t(?:er|re)?|ml|ch[aiá]i|h[ộo]p|th[ùu]ng|t[uú]i|c[áa]i|chi[ệe]c`
const PACK_INNER = String.raw`(?:\s*[/,]\s*(?:${PACK_QTY})?\s*(h[ộo]p|th[ùu]ng|carton|kg|t[áa]n|l[íi]t)\b)?`
const PACK_SIZE = new RegExp(String.raw`\s(${PACK_QTY})\s?(?:${PACK_UNIT})${PACK_INNER}\s*$`, "i")

/**
 * "Cà phê rang xay 500g/hộp" is the product "Cà phê rang xay" (the pack size is
 * not part of a name a buyer searches for), but the unit is worth keeping.
 */
function stripPackSize(fragment: string): { name: string; unitHint: string | null } {
  const match = PACK_SIZE.exec(fragment)
  if (!match) return { name: fragment, unitHint: null }
  // "500g/hộp" is sold by the box, so the container beats the base unit;
  // "25 kg" has no container and falls back to the base unit.
  const word = normalizeProductName(match[3] ?? match[2])
  const unit =
    /^kg|^k[îi] ?l[ôo]/.test(word)
      ? "kg"
      : word === "tan"
        ? "ton"
        : word === "hop"
          ? "box"
          : word === "thung"
            ? "carton"
          : word === "chai"
            ? "bottle"
            : word === "tui"
              ? "bag"
              : word === "cai" || word === "chiec"
                ? "piece"
                : /^l[íi]t/.test(word)
                  ? "liter"
                  : null
  return { name: fragment.slice(0, match.index).trim(), unitHint: unit }
}

/** "HẠT ĐIỀU RANG MUỐI" is a typing habit, not a style; "gạo st25" is not a sentence. */
function presentName(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  const letters = trimmed.replace(/[^A-Za-zÀ-ỹ]/g, "")
  if (letters.length > 3 && letters === letters.toUpperCase()) {
    // Vietnamese product names are not Title Case; but a model code that the
    // writer shouted (ST25, 500G) stays as typed.
    const lowered = trimmed
      .split(/\s+/)
      .map((token) => (/\d/.test(token) ? token : token.toLocaleLowerCase("vi")))
      .join(" ")
    return lowered.charAt(0).toUpperCase() + lowered.slice(1)
  }
  if (trimmed === trimmed.toLowerCase()) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  }
  return trimmed
}

// ---------------------------------------------------------------------------
// The splitter
// ---------------------------------------------------------------------------

export function splitMainProducts(
  mainProducts: string | null | undefined,
  options: SplitMainProductsOptions = {},
): SplitMainProductsResult {
  const opts = { ...SPLIT_DEFAULTS, ...options }
  const splitOnConnectives = options.splitOnConnectives !== false

  const notes: string[] = []
  const dropped: DroppedFragment[] = []
  const rawInput = (mainProducts ?? "").replace(/\r\n?/g, "\n").trim()

  if (!rawInput) {
    return { candidates: [], dropped: [], separators: [], notes: ["empty input"] }
  }

  // 1. Lift the HS codes out and leave a marker behind, so a code can be
  //    attributed to the fragment it was written next to. A marker (rather than
  //    deleting the text) also keeps commas/parens inside the code from acting
  //    as separators.
  const codes: string[] = []
  const marked = rawInput
    .replace(HS_LABELLED_GLOBAL, (whole) => {
      const digits = /([0-9][0-9 .\-]{3,}[0-9])/.exec(whole)?.[1]
      const code = normalizeHsCode(digits)
      // Not a usable code (a typo, a phone fragment): leave the text alone so we
      // never delete something the client wrote.
      if (!code) return whole
      codes.push(code)
      return ` @@${codes.length - 1}@@ `
    })
    .replace(HS_BARE_GLOBAL, (whole) => {
      const code = normalizeHsCode(whole)
      if (!code) return whole
      codes.push(code)
      return ` @@${codes.length - 1}@@ `
    })

  // 2. Which separators did the client actually use?
  const separators: string[] = []
  if (/[,;]/.test(marked)) separators.push(",/;")
  if (/\n/.test(marked)) separators.push("newline")
  if (/[•·*]/.test(marked)) separators.push("bullet")
  if (/\s\/\s/.test(marked)) separators.push(" / ")
  if (splitOnConnectives && /\s(?:và|va|hoặc|hoac|&|\+)\s/i.test(marked)) separators.push("connective")

  const splitter = splitOnConnectives
    ? /[\n,;|•·]+|\s\/\s|\s(?:và|va|hoặc|hoac|&|\+)\s/gi
    : /[\n,;|•·]+/g

  const fragments = marked
    // Horizontal whitespace only: collapsing `\s` here would eat the newlines
    // that the split below depends on.
    .replace(/[ \t]{2,}/g, " ")
    .split(splitter)
    .map(cleanFragment)
    .filter(Boolean)

  if (fragments.length === 0) {
    return {
      candidates: [],
      dropped: [{ fragment: rawInput.slice(0, 80), reason: "empty" }],
      separators,
      notes: ["nothing left after cleaning"],
    }
  }

  // Commas, semicolons, newlines and bullets are deliberate list punctuation.
  // Splitting on "và" alone is not: "chúng tôi sản xuất A và B" would otherwise
  // mint a row called "sản xuất A". Without list punctuation only a short
  // fragment that names a known commodity is trusted (see scoreConfidence).
  const punctuated = separators.some((name) => name !== "connective")
  const runOn = fragments.length === 1 && separators.length === 0
  if (runOn) notes.push("no separator found — kept as one candidate")

  const companyKey = opts.companyName ? normalizeProductName(opts.companyName) : ""
  const candidates: ProductCandidate[] = []
  const seen = new Set<string>()

  for (const fragment of fragments) {
    // 3. Re-attach the codes that were written inside this fragment.
    const codeIndexes: number[] = []
    const text = cleanFragment(
      fragment.replace(/\s*@@(\d+)@@\s*/g, (_m, index: string) => {
        const parsed = Number.parseInt(index, 10)
        if (Number.isInteger(parsed) && codes[parsed]) codeIndexes.push(parsed)
        return " "
      }),
    )
    // A fragment that was nothing but a code has no name to keep.
    if (!text) {
      dropped.push({ fragment, reason: "no_letters" })
      continue
    }

    const withUnit = stripPackSize(text)
    const nameKey = normalizeProductName(withUnit.name)

    if (!nameKey) {
      dropped.push({ fragment, reason: "no_letters" })
      continue
    }
    if (nameKey.length < opts.minFragmentChars) {
      dropped.push({ fragment, reason: "too_short" })
      continue
    }
    if (GENERIC_PATTERNS.some((pattern) => pattern.test(nameKey))) {
      dropped.push({ fragment, reason: "generic" })
      continue
    }
    if (companyKey && (nameKey === companyKey || nameKey.startsWith(`${companyKey} `))) {
      dropped.push({ fragment, reason: "company_name" })
      continue
    }
    if (seen.has(nameKey)) {
      dropped.push({ fragment, reason: "duplicate" })
      continue
    }
    if (candidates.length >= opts.maxProducts) {
      dropped.push({ fragment, reason: "over_cap" })
      continue
    }

    let name = withUnit.name
    let truncated = false
    if (name.length > opts.maxFragmentChars) {
      const cut = name.slice(0, opts.maxFragmentChars)
      const lastSpace = cut.lastIndexOf(" ")
      name = (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:\s]+$/, "")
      truncated = true
      if (!notes.includes("truncated")) {
        notes.push("truncated")
      }
    }

    const finalKey = normalizeProductName(name)
    if (!finalKey || seen.has(finalKey)) {
      dropped.push({ fragment, reason: "duplicate" })
      continue
    }
    seen.add(finalKey)

    const hsCode = codeIndexes.length > 0 ? (codes[codeIndexes[0]] ?? null) : null
    const category = detectCategory(finalKey)

    candidates.push({
      // Readable original for the review UI (the marker is an internal detail).
      raw: fragment
        .replace(/\s*@@(\d+)@@\s*/g, (_m, index: string) => {
          const code = codes[Number.parseInt(index, 10)]
          return code ? ` (HS ${code})` : ""
        })
        .replace(/\s{2,}/g, " ")
        .trim(),
      productName: presentName(name),
      nameKey: finalKey,
      hsCode,
      category,
      unitOfMeasure: withUnit.unitHint ?? detectUnit(finalKey),
      truncated,
      confidence: scoreConfidence({
        key: finalKey,
        hsCode,
        category,
        truncated,
        runOn: runOn && finalKey.length > 80,
        punctuated,
      }),
    })
  }

  if (candidates.length === 0 && dropped.length === 0) notes.push("every fragment was filtered out")
  if (dropped.some((entry) => entry.reason === "over_cap")) {
    notes.push(`capped at ${opts.maxProducts} products`)
  }

  return { candidates, dropped, separators, notes }
}

function scoreConfidence(input: {
  key: string
  hsCode: string | null
  category: CanonicalCategory | null
  truncated: boolean
  runOn: boolean
  punctuated: boolean
}): SplitConfidence {
  // A lone long number in the name ("1200", a lot id) means the split caught a
  // quantity rather than a product.
  if (/(^|\s)\d{3,}(\s|$)/.test(input.key)) return "low"
  if (input.runOn || input.truncated) return "low"
  if (!input.punctuated) {
    const listShaped = input.key.length <= 40 && Boolean(input.hsCode || input.category)
    if (!listShaped) return "low"
  }
  if (input.hsCode) return "high"
  // A canonical category hit means the fragment named a real commodity
  // ("Điều", "Tiêu"), so length should not demote it.
  if (input.category) return "high"
  if (input.key.length >= 5) return "medium"
  return "low"
}

/**
 * Stable `product_code` for a seeded row, derived from the name — which is what
 * makes a re-run collide with `UNIQUE(client_id, product_code)` instead of
 * inserting a second copy of the same product.
 */
export function seededProductCode(nameKey: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < nameKey.length; i += 1) {
    hash ^= nameKey.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `AUTO-${hash.toString(16).padStart(8, "0").toUpperCase()}`
}

// ---------------------------------------------------------------------------
// From candidates to rows (pure plan) — same file on purpose
// ---------------------------------------------------------------------------
// One runtime import surface (none at all — the `createAdminClient` import above
// is `import type`, so it is erased). `scripts/*.mjs` load this file through Node's native
// TypeScript stripping, and Node cannot resolve an extension-less relative
// specifier — so splitting "plan" and "write" into two modules would make the
// backfill script unrunnable without a loader hook or a tsconfig change. One
// cohesive file is the cheaper answer: text → candidates → rows → SQL.

export type SeedStatus = "active" | "inactive" | "suspended"

export type SeedSkipReason =
  | "no_input"
  | "no_candidates"
  | "client_not_empty"
  | "low_confidence"
  | "duplicate_of_existing"
  | "duplicate_in_batch"

export interface SeedRow {
  client_id: string
  product_name: string
  product_code: string
  category: string | null
  subcategory: null
  description: null
  hs_code: string | null
  unit_of_measure: string | null
  status: SeedStatus
  created_by: string | null
  source_submission_id: string | null
}

export interface SeedSkipped {
  reason: SeedSkipReason
  detail: string
}

export interface SeedPlan {
  /** Rows to insert, in catalog order. Empty means "nothing to do". */
  rows: SeedRow[]
  candidates: ProductCandidate[]
  skipped: SeedSkipped[]
  notes: string[]
}

export interface PlanSeedRowsInput {
  clientId: string
  mainProducts: string | null | undefined
  /** `client_products` rows the client already has (any status). */
  existing?: Array<{ product_name?: string | null; product_code?: string | null; status?: string | null }>
  submissionId?: string | null
  createdBy?: string | null
  /** Default `inactive` — see the module comment for why. */
  status?: SeedStatus
  /**
   * `true` (default, and what intake approval uses): only seed a client with no
   * products at all, so a curated catalog is never appended to automatically.
   * `false` fills the gaps instead, which is what the backfill can do with a
   * human watching.
   */
  onlyWhenClientEmpty?: boolean
  maxProducts?: number
  /** Candidates below this are reported as skipped, not written. Default medium. */
  minConfidence?: SplitConfidence
  /** Company name is passed through so a repeated brand line is not stored. */
  companyName?: string | null
}

const CONFIDENCE_RANK: Record<SplitConfidence, number> = { low: 0, medium: 1, high: 2 }

/**
 * Deterministic row builder. Split out of the write path so the script can print
 * exactly what it would write (`--emit-sql`) without a database connection.
 */
export function planSeedRows(input: PlanSeedRowsInput): SeedPlan {
  const status: SeedStatus = input.status ?? "inactive"
  const minConfidence = input.minConfidence ?? "medium"
  const existing = input.existing ?? []
  const skipped: SeedSkipped[] = []

  const split = splitMainProducts(input.mainProducts, {
    companyName: input.companyName ?? null,
    ...(input.maxProducts ? { maxProducts: input.maxProducts } : {}),
  })

  if (split.candidates.length === 0) {
    return {
      rows: [],
      candidates: [],
      skipped: [{ reason: "no_candidates", detail: describeDrops(split.dropped) || "no usable text" }],
      notes: split.notes,
    }
  }

  const clientHasProducts = existing.length > 0
  if (input.onlyWhenClientEmpty !== false && clientHasProducts) {
    return {
      rows: [],
      candidates: split.candidates,
      skipped: [
        {
          reason: "client_not_empty",
          detail: `${existing.length} product row(s) already exist for this client`,
        },
      ],
      notes: split.notes,
    }
  }

  // Anything the client (or an AE) already has, under any spelling that
  // normalizes the same way, is off limits.
  const takenNames = new Set<string>()
  const takenCodes = new Set<string>()
  for (const row of existing) {
    const key = normalizeProductName(row.product_name ?? "")
    if (key) takenNames.add(key)
    const code = (row.product_code ?? "").trim().toUpperCase()
    if (code) takenCodes.add(code)
  }

  const rows: SeedRow[] = []
  for (const candidate of split.candidates) {
    if (CONFIDENCE_RANK[candidate.confidence] < CONFIDENCE_RANK[minConfidence]) {
      skipped.push({
        reason: "low_confidence",
        detail: `"${candidate.raw}" (${candidate.confidence})`,
      })
      continue
    }
    if (takenNames.has(candidate.nameKey)) {
      skipped.push({ reason: "duplicate_of_existing", detail: candidate.productName })
      continue
    }
    const code = seededProductCode(candidate.nameKey)
    if (takenCodes.has(code)) {
      skipped.push({ reason: "duplicate_of_existing", detail: `${candidate.productName} [${code}]` })
      continue
    }

    takenNames.add(candidate.nameKey)
    takenCodes.add(code)
    rows.push({
      client_id: input.clientId,
      // A product name is a noun phrase, not a sentence: no trailing period,
      // and never empty (the NOT NULL column would reject it anyway).
      product_name: candidate.productName.replace(/[.;,]+$/, "").slice(0, 160),
      product_code: code,
      category: candidate.category,
      subcategory: null,
      // Deliberately null: a seeded row must not pretend to be a description.
      // The reviewer's job is to replace the intake's wording with one a buyer
      // can act on (grades, moisture, packaging, certifications).
      description: null,
      hs_code: candidate.hsCode,
      unit_of_measure: candidate.unitOfMeasure,
      status,
      created_by: input.createdBy ?? null,
      source_submission_id: input.submissionId ?? null,
    })
  }

  if (rows.length === 0 && skipped.length === 0) {
    skipped.push({ reason: "no_candidates", detail: "every candidate was filtered" })
  }

  const dropNote = describeDrops(split.dropped)
  const notes = [...split.notes]
  if (dropNote) notes.push(`dropped while splitting: ${dropNote}`)

  return { rows, candidates: split.candidates, skipped, notes }
}

function describeDrops(dropped: Array<{ fragment: string; reason: string }>): string {
  if (dropped.length === 0) return ""
  const counts = new Map<string, number>()
  for (const entry of dropped) counts.set(entry.reason, (counts.get(entry.reason) ?? 0) + 1)
  return [...counts.entries()].map(([reason, count]) => `${count}x ${reason}`).join(", ")
}

interface QueryError {
  message: string
  code?: string
}


interface ProductTable {
  select(columns: string): {
    eq(column: string, value: string): {
      limit(rows: number): Promise<{ data: unknown; error: QueryError | null }>
    }
  }
  insert(
    rows: SeedRow[],
    options?: { onConflict?: string; ignoreDuplicates?: boolean },
  ): {
    select(columns?: string): Promise<{ data: unknown; error: QueryError | null }>
  }
}

export interface SeedResult {
  ok: boolean
  plan: SeedPlan
  inserted: number
  error?: string
  /** Set when `scripts/083_…` has not been applied, so the operator can tell. */
  provenanceColumnMissing?: boolean
}

/**
 * Read the client's catalog, plan, insert. Never throws: a data clean-up run
 * beside live data must return a reason instead of taking down the caller (the
 * intake approval action keeps working even if seeding fails).
 */
export async function seedProductsFromMainProducts(
  admin: ReturnType<typeof createAdminClient>,
  input: PlanSeedRowsInput & { dryRun?: boolean },
): Promise<SeedResult> {
  const table = admin.from("client_products") as unknown as ProductTable

  let existing: Array<{ product_name?: string | null; product_code?: string | null }> = []
  try {
    const { data, error } = await table
      .select("product_name, product_code, status")
      .eq("client_id", input.clientId)
      .limit(500)
    if (error) return { ok: false, plan: { rows: [], candidates: [], skipped: [], notes: [] }, inserted: 0, error: error.message }
    existing = (data ?? []) as typeof existing
  } catch (cause) {
    return {
      ok: false,
      plan: { rows: [], candidates: [], skipped: [], notes: [] },
      inserted: 0,
      error: cause instanceof Error ? cause.message : String(cause),
    }
  }

  const plan = planSeedRows({ ...input, existing })
  if (plan.rows.length === 0) {
    return { ok: true, plan, inserted: 0 }
  }
  if (input.dryRun) {
    return { ok: true, plan, inserted: 0 }
  }

  try {
    // `ignoreDuplicates` + the unique (client_id, product_code) constraint means
    // a concurrent or repeated run inserts nothing instead of erroring.
    let response = await table
      .insert(plan.rows, { onConflict: "client_id,product_code", ignoreDuplicates: true })
      .select("id")

    const missingColumn =
      response.error && /source_submission_id/.test(response.error.message ?? "")
    if (missingColumn) {
      // Migration 083 not applied yet: seed anyway, minus the provenance column.
      const rows = plan.rows.map(({ source_submission_id: _dropped, ...rest }) => ({
        ...rest,
      })) as unknown as SeedRow[]
      response = await table.insert(rows, { onConflict: "client_id,product_code", ignoreDuplicates: true }).select("id")
    }

    if (response.error && /could not find the unique constraint/i.test(response.error.message ?? "")) {
      response = await table.insert(plan.rows).select("id")
    }

    if (response.error) {
      return { ok: false, plan, inserted: 0, error: response.error.message, provenanceColumnMissing: Boolean(missingColumn) }
    }

    return {
      ok: true,
      plan,
      inserted: Array.isArray(response.data) ? response.data.length : plan.rows.length,
      provenanceColumnMissing: Boolean(missingColumn),
    }
  } catch (cause) {
    return {
      ok: false,
      plan,
      inserted: 0,
      error: cause instanceof Error ? cause.message : String(cause),
    }
  }
}

/** Idempotent SQL for the same plan, for running inside the Supabase SQL editor. */
export function planToSql(plan: SeedPlan): string {
  const quote = (value: string | null) => (value === null ? "null" : `'${value.replace(/'/g, "''")}'`)
  return plan.rows
    .map(
      (row) =>
        `insert into public.client_products (client_id, product_name, product_code, category, hs_code, unit_of_measure, status, created_by, source_submission_id)\n` +
        `values (${quote(row.client_id)}, ${quote(row.product_name)}, ${quote(row.product_code)}, ${quote(row.category)}, ${quote(row.hs_code)}, ${quote(row.unit_of_measure)}, ${quote(row.status)}, ${quote(row.created_by)}, ${quote(row.source_submission_id)})\n` +
        `on conflict (client_id, product_code) do nothing;`,
    )
    .join("\n")
}
