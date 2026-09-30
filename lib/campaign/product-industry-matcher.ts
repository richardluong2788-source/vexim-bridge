/**
 * Deterministic buyer-to-campaign matching.
 *
 * Product text is the only way to earn a product/category match. Industry is
 * a fallback discovery signal that is always held for AE review. HS codes may
 * corroborate or flag a text match, but can never create one on their own.
 */

export type CampaignMatchLevel = "product" | "category" | "industry"
export type CampaignMatchStatus = "matched" | "no_match"

export interface CampaignMatchConfig {
  target_product_name?: string | null
  product_category?: string | null
  target_industries?: string[] | string | null
  target_hs_codes?: string[] | string | null
}

export interface CampaignBuyerSignals {
  industry?: string | null
  main_product?: string | null
  product_keywords?: string[] | string | null
  hs_code?: string | null
  hs_codes?: string[] | string | null
  secondary_hs_codes?: string[] | string | null
  bol_description?: string | null
}

export interface CampaignMatchDecision {
  status: CampaignMatchStatus
  level: CampaignMatchLevel | null
  /** Rule-based strength indicator (0–100), not a probability. */
  confidence: number | null
  reason: string
  evidence: string[]
  requiresHumanReview: boolean
}

const PRODUCT_SYNONYMS: string[][] = [
  ["cashew kernel", "cashew kernels", "cashew nut", "cashew nuts"],
  ["shrimp", "prawn", "prawns"],
  ["pangasius", "basa", "basa fish", "swai"],
  ["black pepper", "peppercorn", "peppercorns"],
  ["star anise", "star aniseed"],
  ["coffee bean", "coffee beans", "unroasted coffee beans", "green coffee bean", "green coffee beans"],
]

const COMMON_FOOD_TERMS = [
  "food", "food product", "food products", "processed food", "beverage", "beverages", "grocery", "groceries",
  "coffee", "arabica", "robusta", "tea", "cocoa", "cacao", "chocolate",
  "cashew", "nut", "nuts", "seafood", "shrimp", "prawn", "fish", "tuna",
  "squid", "octopus", "pangasius", "rice", "pepper", "spice", "cinnamon",
  "star anise", "ginger", "turmeric", "chili", "fruit", "mango", "durian",
  "banana", "coconut", "pineapple", "dragon fruit", "vegetable", "dairy",
  "juice", "beverage", "snack", "sauce", "frozen food", "canned food",
]

const CATEGORY_GROUPS: Array<{ names: string[]; terms: string[] }> = [
  {
    names: ["food", "food product", "food products", "food and beverage", "food beverage", "foodstuff", "foodstuffs", "grocery", "groceries"],
    terms: COMMON_FOOD_TERMS,
  },
  {
    names: ["agriculture", "agricultural product", "agricultural products", "agricultural produce", "raw produce"],
    terms: ["green coffee", "unroasted coffee", "raw cashew", "cashew nut", "fresh fruit", "mango", "durian", "banana", "coconut", "pineapple", "pepper", "rice", "rubber", "natural rubber"],
  },
  {
    names: ["coffee", "coffee product", "coffee products"],
    terms: ["coffee", "arabica", "robusta"],
  },
  {
    names: ["seafood", "sea food", "fish and seafood"],
    terms: ["seafood", "shrimp", "prawn", "fish", "tuna", "squid", "octopus", "pangasius", "basa", "swai"],
  },
  {
    names: ["fruit", "fruits", "fruit product", "fruit products", "frozen fruit"],
    terms: ["fruit", "mango", "durian", "banana", "coconut", "pineapple", "dragon fruit", "jackfruit", "lychee", "longan"],
  },
  {
    names: ["spice", "spices", "spice product", "spice products"],
    terms: ["spice", "pepper", "cinnamon", "star anise", "ginger", "turmeric", "chili", "cardamom", "clove"],
  },
  {
    names: ["textile", "textiles", "textile product", "textile products", "garment", "garments", "textiles and garments", "apparel", "clothing"],
    terms: ["textile", "fabric", "garment", "apparel", "clothing", "yarn", "apparel"],
  },
  {
    names: ["footwear", "shoes", "shoe", "sandal", "sandals"],
    terms: ["footwear", "shoe", "sandal", "boot", "sneaker"],
  },
  {
    names: ["furniture", "home decor", "furniture and home decor"],
    terms: ["furniture", "chair", "table", "cabinet", "home decor", "rattan", "wooden furniture"],
  },
  {
    names: ["electronics", "electronic components", "electronics and components", "components"],
    terms: ["electronics", "electronic component", "semiconductor", "circuit board", "electrical component"],
  },
  {
    names: ["machinery", "industrial parts", "machinery and industrial parts"],
    terms: ["machinery", "machine", "industrial part", "industrial component", "mechanical part"],
  },
  {
    names: ["packaging", "packaging and printing", "printing"],
    terms: ["packaging", "carton", "printed packaging", "printing", "label"],
  },
  {
    names: ["cosmetics", "personal care", "cosmetics and personal care"],
    terms: ["cosmetic", "skincare", "personal care", "beauty product", "soap", "shampoo"],
  },
  {
    names: ["chemical", "chemicals", "raw material", "raw materials", "chemicals and raw materials"],
    terms: ["chemical", "industrial chemical", "raw material", "resin", "polymer"],
  },
]

const INDUSTRY_EQUIVALENTS: Record<string, string> = {
  food: "food beverage",
  "food and beverage": "food beverage",
  "food beverage": "food beverage",
  "textiles": "textiles garments",
  textile: "textiles garments",
  "textiles garments": "textiles garments",
  "textiles and garments": "textiles garments",
  electronics: "electronics components",
  "electronics components": "electronics components",
  "electronics and components": "electronics components",
  furniture: "furniture home decor",
  "furniture home decor": "furniture home decor",
  "furniture and home decor": "furniture home decor",
  manufacturing: "machinery industrial parts",
  "machinery industrial parts": "machinery industrial parts",
  "machinery and industrial parts": "machinery industrial parts",
  handicrafts: "furniture home decor",
  cosmetics: "cosmetics personal care",
  "cosmetics personal care": "cosmetics personal care",
  "cosmetics and personal care": "cosmetics personal care",
  "personal care": "cosmetics personal care",
  "packaging printing": "packaging printing",
  "packaging and printing": "packaging printing",
  "chemicals raw materials": "chemicals raw materials",
  "chemicals and raw materials": "chemicals raw materials",
  agriculture: "agriculture",
  seafood: "seafood",
  pharmaceuticals: "pharmaceuticals",
  footwear: "footwear",
  other: "other",
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

function containsPhrase(text: string, phrase: string): boolean {
  const haystack = normalizeText(text)
  const needle = normalizeText(phrase)
  if (!haystack || !needle) return false
  return ` ${haystack} `.includes(` ${needle} `)
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
  }
  if (typeof value === "string") {
    return value.split(/[;,\n|]+/).map((item) => item.trim()).filter(Boolean)
  }
  return []
}

export function normalizeHsCode(value: string): string | null {
  const digits = value.replace(/\D/g, "")
  return digits.length >= 2 && digits.length <= 10 ? digits : null
}

export function normalizeCampaignHsCodes(value: string[] | string | null | undefined): {
  codes: string[]
  invalid: string[]
} {
  const codes: string[] = []
  const invalid: string[] = []
  for (const raw of asStringList(value)) {
    const normalized = normalizeHsCode(raw)
    if (!normalized) invalid.push(raw)
    else if (!codes.includes(normalized)) codes.push(normalized)
  }
  return { codes, invalid }
}

function industryKey(value: string | null | undefined): string {
  const normalized = normalizeText(value)
  const exact = INDUSTRY_EQUIVALENTS[normalized]
  if (exact) return exact
  const prefix = Object.keys(INDUSTRY_EQUIVALENTS)
    .sort((left, right) => right.length - left.length)
    .find((key) => normalized.startsWith(`${key} `))
  return prefix ? INDUSTRY_EQUIVALENTS[prefix] : normalized
}

function hsAgreement(targetCodes: string[], buyerCodes: string[]): { bonus: number; conflict: boolean; note?: string } {
  if (targetCodes.length === 0 || buyerCodes.length === 0) return { bonus: 0, conflict: false }

  let bestPrefix = 0
  let bestPair: [string, string] | null = null
  for (const target of targetCodes) {
    for (const buyer of buyerCodes) {
      let prefix = 0
      while (prefix < Math.min(target.length, buyer.length) && target[prefix] === buyer[prefix]) prefix += 1
      if (prefix > bestPrefix) {
        bestPrefix = prefix
        bestPair = [target, buyer]
      }
    }
  }

  if (bestPrefix < 2 || !bestPair) {
    return {
      bonus: 0,
      conflict: true,
      note: `Mã HS mục tiêu (${targetCodes.join(", ")}) khác chương với HS buyer (${buyerCodes.join(", ")}); cần AE xác minh.`,
    }
  }
  const bonus = bestPrefix >= 8 ? 5 : bestPrefix >= 6 ? 4 : bestPrefix >= 4 ? 3 : 1
  return {
    bonus,
    conflict: false,
    note: `HS ${bestPair[1]} cùng nhóm với mã mục tiêu ${bestPair[0]} (chỉ là tín hiệu củng cố).`,
  }
}

function buyerHsCodes(buyer: CampaignBuyerSignals): string[] {
  const raw = [
    ...asStringList(buyer.hs_codes),
    ...asStringList(buyer.hs_code),
    ...asStringList(buyer.secondary_hs_codes),
  ]
  const normalized = raw.map(normalizeHsCode).filter((code): code is string => !!code)
  return [...new Set(normalized)]
}

function productEvidence(buyer: CampaignBuyerSignals): Array<{ field: string; value: string }> {
  const evidence: Array<{ field: string; value: string }> = []
  const main = buyer.main_product?.trim()
  if (main) evidence.push({ field: "LR main_product", value: main })
  for (const keyword of asStringList(buyer.product_keywords)) {
    evidence.push({ field: "LR product_keywords", value: keyword })
  }
  const bol = buyer.bol_description?.trim()
  if (bol) evidence.push({ field: "LR bol_description", value: bol })
  return evidence
}

function excerpt(value: string, maxLength = 160): string {
  const compact = value.replace(/\s+/g, " ").trim()
  return compact.length <= maxLength ? compact : `${compact.slice(0, maxLength - 1)}…`
}

function productNameMatch(target: string, value: string): string | null {
  const targetKey = normalizeText(target)
  const candidateTerms = new Set([targetKey])
  const synonymGroup = PRODUCT_SYNONYMS.find((group) => group.some((term) => normalizeText(term) === targetKey))
  for (const term of synonymGroup ?? []) candidateTerms.add(normalizeText(term))
  return [...candidateTerms].find((term) => term && containsPhrase(value, term)) ?? null
}

function categoryTerms(category: string): { terms: string[]; grouped: boolean } {
  const key = normalizeText(category)
  const group = CATEGORY_GROUPS.find((candidate) => candidate.names.some((name) => normalizeText(name) === key))
  return group ? { terms: group.terms, grouped: true } : { terms: [category], grouped: false }
}

export function campaignTargetConsistencyIssue(campaign: CampaignMatchConfig): string | null {
  const product = campaign.target_product_name?.trim() || ""
  const category = campaign.product_category?.trim() || ""
  if (!product || !category) return null
  const group = CATEGORY_GROUPS.find((candidate) => candidate.names.some((name) => normalizeText(name) === normalizeText(category)))
  // Custom categories have no reviewed alias set, so do not guess whether they conflict.
  if (!group) return null
  const productFitsCategory = group.terms.some((term) => containsPhrase(product, term))
  if (productFitsCategory) return null
  const conflictsWithAnotherKnownCategory = CATEGORY_GROUPS.some((other) =>
    other !== group && other.terms.some((term) => containsPhrase(product, term)),
  )
  // The reviewed alias lists are intentionally incomplete. Reject a clear
  // cross-category contradiction, but do not guess that an unknown product is invalid.
  return conflictsWithAnotherKnownCategory
    ? `Campaign target is inconsistent: product “${product}” does not map to category “${category}”.`
    : null
}

function noMatch(reason: string, evidence: string[] = []): CampaignMatchDecision {
  return { status: "no_match", level: null, confidence: null, reason, evidence, requiresHumanReview: false }
}

export function matchBuyerToCampaign(
  campaign: CampaignMatchConfig,
  buyer: CampaignBuyerSignals,
): CampaignMatchDecision {
  const configIssue = campaignTargetConsistencyIssue(campaign)
  if (configIssue) return noMatch(configIssue)
  const targetProduct = campaign.target_product_name?.trim() || ""
  const targetCategory = campaign.product_category?.trim() || ""
  const targetIndustries = asStringList(campaign.target_industries)
  const targetHs = normalizeCampaignHsCodes(campaign.target_hs_codes).codes
  const buyerHs = buyerHsCodes(buyer)
  const industry = buyer.industry?.trim() || ""
  const normalizedIndustry = industryKey(industry)
  const industryMatch = !!normalizedIndustry && targetIndustries.some((target) => industryKey(target) === normalizedIndustry)
  const evidence = productEvidence(buyer)

  let productHit: { source: { field: string; value: string }; matchedTerm: string } | null = null
  if (targetProduct) {
    for (const source of evidence) {
      const matchedTerm = productNameMatch(targetProduct, source.value)
      if (matchedTerm) {
        productHit = { source, matchedTerm }
        break
      }
    }
  }

  let categoryHit: { source: { field: string; value: string }; matchedTerm: string; grouped: boolean } | null = null
  if (targetCategory) {
    const terms = categoryTerms(targetCategory)
    for (const source of evidence) {
      const matchedTerm = terms.terms.find((term) => containsPhrase(source.value, term))
      if (matchedTerm) {
        categoryHit = { source, matchedTerm, grouped: terms.grouped }
        break
      }
    }
  }

  // A direct product descriptor always outranks a broad category hit.
  const level: CampaignMatchLevel | null = productHit ? "product" : categoryHit ? "category" : null
  if (level) {
    const hit = productHit ?? categoryHit!
    const sourceText = excerpt(hit.source.value)
    const matchEvidence = [
      `${hit.source.field}: ${sourceText}`,
      `matched term: ${hit.matchedTerm}`,
    ]
    const hs = hsAgreement(targetHs, buyerHs)
    if (hs.note) matchEvidence.push(hs.note)

    const industryConflict = targetIndustries.length > 0 && !!industry && !industryMatch
    const requiresHumanReview = hs.conflict || industryConflict
    let confidence = level === "product"
      ? hit.source.field === "LR bol_description" ? 90 : 96
      : categoryHit?.grouped ? 78 : 82
    confidence = Math.min(99, confidence + hs.bonus + (industryMatch ? 1 : 0))

    const reason = level === "product"
      ? `Tên sản phẩm mục tiêu “${targetProduct}” khớp qua cụm “${hit.matchedTerm}” trong ${hit.source.field}: “${sourceText}”.`
      : `LR product data khớp ở cấp danh mục “${targetCategory}” qua cụm “${hit.matchedTerm}” trong ${hit.source.field}: “${sourceText}”. Chưa đủ bằng chứng cho một sản phẩm cụ thể nên chỉ dùng nội dung rộng.`
    const caveats = [
      hs.note,
      industryConflict ? `Ngành buyer “${industry}” không khớp industry mục tiêu (${targetIndustries.join(", ")}); cần AE xác minh.` : null,
    ].filter((value): value is string => !!value)

    return {
      status: "matched",
      level,
      confidence,
      reason: caveats.length ? `${reason} ${caveats.join(" ")}` : reason,
      evidence: matchEvidence,
      requiresHumanReview,
    }
  }

  // An industry-only campaign, or missing buyer product descriptors, can be
  // included only as a discovery candidate; scheduler holds it for AE review.
  const hasProductTarget = !!targetProduct || !!targetCategory
  if (industryMatch && (!hasProductTarget || evidence.length === 0)) {
    const hsOnlyNote = buyerHs.length > 0 && targetHs.length > 0
      ? ` Có HS ${buyerHs.join(", ")} nhưng HS không đủ để kết luận nhu cầu sản phẩm.`
      : buyerHs.length > 0
        ? ` Có HS ${buyerHs.join(", ")} nhưng chưa có product descriptor khớp; HS không được dùng độc lập.`
        : ""
    const reason = `Chỉ khớp ngành “${industry}”; chưa có bằng chứng product/category phù hợp. Đây là ứng viên discovery, cần AE review và không được kết luận buyer có nhu cầu sản phẩm mục tiêu.${hsOnlyNote}`
    return {
      status: "matched",
      level: "industry",
      confidence: 45,
      reason,
      evidence: [`LR industry: ${industry}`, ...(buyerHs.length ? [`LR HS codes (không tự tạo match): ${buyerHs.join(", ")}`] : [])],
      requiresHumanReview: true,
    }
  }

  if (evidence.length > 0 && hasProductTarget) {
    const recorded = evidence.slice(0, 3).map((item) => `${item.field}: ${excerpt(item.value, 80)}`).join("; ")
    const industryNote = industryMatch ? ` Ngành “${industry}” có khớp, nhưng industry đơn lẻ không đủ để suy ra nhu cầu sản phẩm.` : ""
    return noMatch(`Không tìm thấy product/category evidence khớp campaign. LR ghi nhận ${recorded}.${industryNote}`)
  }

  if (industryMatch) {
    return {
      status: "matched",
      level: "industry",
      confidence: 45,
      reason: `Chỉ khớp ngành “${industry}”; đây là ứng viên discovery cần AE review, không phải bằng chứng buyer cần sản phẩm mục tiêu.`,
      evidence: [`LR industry: ${industry}`],
      requiresHumanReview: true,
    }
  }

  return noMatch("Không có bằng chứng product/category hoặc industry khớp với campaign.")
}
