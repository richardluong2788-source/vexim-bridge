/**
 * AI Match: Buyer ↔ Client scoring engine.
 *
 * Pure, synchronous, DB-free functions. Callers (server actions) are
 * responsible for loading `BuyerMatchInput`, `ClientProductInput[]`, and
 * `ClientTrustInput` from Supabase and passing them in here.
 *
 * v1 uses keyword-overlap for product/spec matching (no AI Gateway call) to
 * keep this fast and dependency-free — see v0_plans/deep-method.md for the
 * rationale. This can be upgraded to `semantic-scorer.ts` later without
 * changing the public shape of `ClientMatchResult`.
 */

import type { FactorBreakdown } from "./types"
import {
  CLIENT_MATCH_WEIGHTS,
  CLIENT_TRUST_WEIGHTS,
  MATCH_SCORE_SHARE,
  TRUST_SCORE_SHARE,
  MAX_AI_MATCH_RESULTS,
  type BuyerMatchInput,
  type ClientProductInput,
  type ClientTrustInput,
  type ClientMatchResult,
  type CommercialFlag,
  type TrustLabel,
} from "./client-types"

// ============================================================
// Text helpers
// ============================================================

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "of", "to", "in", "on", "a", "an",
  "va", "cho", "voi", "tu", "cua", "trong", "la",
])

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

function tokenize(text: string | null | undefined): Set<string> {
  if (!text) return new Set()
  const cleaned = stripDiacritics(text.toLowerCase()).replace(/[^a-z0-9\s]/g, " ")
  return new Set(
    cleaned
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t)),
  )
}

/** Jaccard-style overlap between two token sets, scaled to 0-100. */
function tokenOverlapScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let hits = 0
  for (const t of a) if (b.has(t)) hits++
  const union = new Set([...a, ...b]).size
  if (union === 0) return 0
  return Math.round((hits / union) * 100)
}

// ============================================================
// 1) HS Code / category match — 25% of final score
// ============================================================

function digitsOnly(hs: string | null | undefined): string {
  return (hs ?? "").replace(/\D/g, "")
}

function scoreHsCodeMatch(
  buyer: BuyerMatchInput,
  product: ClientProductInput,
): { score: number; detail: string } {
  const buyerHs = digitsOnly(buyer.hs_code)
  const productHs = digitsOnly(product.hs_code)
  const secondaryHs = (buyer.secondary_hs_codes ?? "")
    .split(/[,;\s]+/)
    .map(digitsOnly)
    .filter((h) => h.length >= 2)

  if (buyerHs && productHs) {
    if (buyerHs === productHs) {
      return { score: 100, detail: `HS trùng khớp hoàn toàn (${product.hs_code})` }
    }
    if (buyerHs.slice(0, 4) === productHs.slice(0, 4)) {
      return { score: 60, detail: `HS khớp 4 số đầu (${buyer.hs_code} ↔ ${product.hs_code})` }
    }
    if (buyerHs.slice(0, 2) === productHs.slice(0, 2)) {
      return { score: 30, detail: `HS cùng nhóm 2 số đầu (${buyer.hs_code} ↔ ${product.hs_code})` }
    }
  }

  // Secondary HS codes — buyer imports several categories, this product may
  // match a secondary one rather than the primary code.
  for (let i = 0; i < secondaryHs.length; i++) {
    if (productHs && secondaryHs[i] === productHs) {
      // Earlier positions in the list score higher (closer to primary need).
      const score = Math.max(40, 80 - i * 10)
      return { score, detail: `Khớp HS phụ #${i + 1} của buyer (${product.hs_code})` }
    }
  }

  // No HS data at all on one side — fall back to category/product keyword
  // overlap so we don't hard-zero clients with incomplete HS data.
  const buyerTokens = tokenize(buyer.main_product)
  const productTokens = new Set([
    ...tokenize(product.category),
    ...tokenize(product.subcategory),
    ...tokenize(product.product_name),
  ])
  const overlap = tokenOverlapScore(buyerTokens, productTokens)
  if (overlap > 0) {
    return { score: Math.min(50, overlap), detail: "Không có mã HS đầy đủ, ước lượng theo danh mục sản phẩm" }
  }

  return { score: 0, detail: "Không tìm được điểm khớp HS/danh mục" }
}

// ============================================================
// 2) Product & spec match — 25% of final score
// ============================================================

function scoreSpecMatch(
  buyer: BuyerMatchInput,
  product: ClientProductInput,
): { score: number; detail: string } {
  const buyerTokens = new Set([
    ...tokenize(buyer.main_product),
    ...tokenize(buyer.bol_description),
    ...tokenize(buyer.purchase_history),
  ])
  const productTokens = new Set([
    ...tokenize(product.product_name),
    ...tokenize(product.description),
    ...tokenize(product.key_specifications),
  ])

  const score = tokenOverlapScore(buyerTokens, productTokens)
  if (score === 0) {
    return { score: 0, detail: "Chưa tìm được từ khoá trùng khớp giữa yêu cầu buyer và sản phẩm" }
  }
  return { score, detail: `Trùng ${score}% từ khoá mô tả sản phẩm/thông số` }
}

// ============================================================
// 3) Capacity & MOQ — 15% of final score (qualitative, no unit conversion)
// ============================================================

function scoreCapacityMoq(
  buyer: BuyerMatchInput,
  product: ClientProductInput,
): { score: number; detail: string; signal: "sufficient" | "insufficient" | "unknown" } {
  const hasCapacity = product.monthly_capacity_units != null && product.monthly_capacity_units > 0
  const hasMoq = product.moq_value != null && product.moq_value > 0

  if (!hasCapacity && !hasMoq) {
    return {
      score: 50,
      signal: "unknown",
      detail: "Client chưa khai báo năng lực sản xuất / MOQ — không thể so sánh đơn vị với buyer",
    }
  }

  // We deliberately do NOT convert buyer.avg_teu_per_month into kg/units —
  // there is no reliable container/product density data to do so. Instead,
  // use it only as a coarse "buyer is a large recurring importer" signal.
  const buyerLooksLargeVolume = (buyer.avg_teu_per_month ?? 0) >= 5

  if (hasCapacity && buyerLooksLargeVolume && (product.monthly_capacity_units ?? 0) < 100) {
    return {
      score: 30,
      signal: "insufficient",
      detail: "Buyer nhập đều & khối lượng lớn (TEU/tháng cao) nhưng năng lực sản xuất của client có vẻ nhỏ",
    }
  }

  return {
    score: 100,
    signal: "sufficient",
    detail: hasCapacity
      ? `Client có khai báo năng lực sản xuất${hasMoq ? " và MOQ" : ""} rõ ràng`
      : "Client có khai báo MOQ, chưa có dữ liệu công suất chi tiết",
  }
}

// ============================================================
// 4) Compliance & certifications — 10% of final score
//    (FDA lives HERE, not in Trust Score — it's a product/market-access
//    requirement, not an operational-reliability signal.)
// ============================================================

function scoreCompliance(
  product: ClientProductInput,
  trust: ClientTrustInput,
): { score: number; detail: string } {
  let score = 0
  const notes: string[] = []

  const hasFda = !!trust.fda_registration_number?.trim()
  const fdaValid =
    hasFda &&
    (!trust.fda_expires_at || new Date(trust.fda_expires_at) >= new Date(new Date().setHours(0, 0, 0, 0)))

  if (fdaValid) {
    score += 60
    notes.push("FDA còn hiệu lực")
  } else if (hasFda) {
    notes.push("FDA đã hết hạn")
  } else {
    notes.push("Chưa có FDA")
  }

  const badgeCount = product.compliance_badges?.length ?? 0
  if (badgeCount > 0) {
    score += Math.min(40, badgeCount * 15)
    notes.push(`${badgeCount} chứng nhận sản phẩm (${product.compliance_badges.join(", ")})`)
  }

  return { score: Math.min(100, score), detail: notes.join("; ") }
}

// ============================================================
// 5) Logistics & origin — 5% of final score
// ============================================================

function scoreLogistics(
  buyer: BuyerMatchInput,
  product: ClientProductInput,
): { score: number; detail: string } {
  const buyerText = tokenize(
    [buyer.main_import_countries, buyer.origin_ports, buyer.destination_ports, buyer.container_types]
      .filter(Boolean)
      .join(" "),
  )
  const productText = tokenize([product.country_of_origin, product.incoterm].filter(Boolean).join(" "))

  if (buyerText.size === 0 || productText.size === 0) {
    return { score: 50, detail: "Thiếu dữ liệu logistics để so sánh — điểm trung tính" }
  }
  const score = tokenOverlapScore(buyerText, productText)
  return {
    score,
    detail:
      score > 0
        ? `Xuất xứ/incoterm của client khớp với thông tin logistics buyer`
        : "Không tìm thấy điểm khớp logistics rõ ràng",
  }
}

// ============================================================
// Commercial Compatibility — flags only, never affects scores
// ============================================================

function computeCommercialFlags(product: ClientProductInput): CommercialFlag[] {
  const flags: CommercialFlag[] = []

  flags.push(
    product.min_unit_price != null || product.max_unit_price != null
      ? { factor: "price", level: "yellow", note: "Có khoảng giá tham khảo — cần thương lượng với buyer" }
      : { factor: "price", level: "unknown", note: "Chưa có yêu cầu giá cụ thể từ buyer để so sánh" },
  )

  flags.push(
    product.incoterm
      ? { factor: "incoterm", level: "yellow", note: `Incoterm hiện tại: ${product.incoterm} — cần xác nhận với buyer` }
      : { factor: "incoterm", level: "unknown", note: "Client chưa khai báo Incoterm" },
  )

  flags.push(
    product.payment_terms
      ? { factor: "payment_terms", level: "yellow", note: `Điều khoản: ${product.payment_terms} — cần thương lượng` }
      : { factor: "payment_terms", level: "unknown", note: "Client chưa khai báo điều khoản thanh toán" },
  )

  flags.push(
    product.lead_time
      ? { factor: "lead_time", level: "yellow", note: `Lead time: ${product.lead_time} — cần xác nhận với buyer` }
      : { factor: "lead_time", level: "unknown", note: "Client chưa khai báo lead time" },
  )

  return flags
}

// ============================================================
// Trust Score — 20% of final score, operational reliability only
// ============================================================

function scoreTrust(trust: ClientTrustInput): { score: number; breakdown: FactorBreakdown[]; label: TrustLabel } {
  const kycScore = trust.is_verified ? 100 : 0
  const factoryScore = trust.factoryScoreTotal ?? 50 // neutral when never assessed
  const transactionScore =
    trust.dealsTotal > 0 ? Math.round((trust.dealsSwiftVerified / trust.dealsTotal) * 100) : 50 // neutral for new clients
  const profileScore = trust.hasCompanyProfile ? 100 : 0

  const breakdown: FactorBreakdown[] = [
    {
      factor: "KYC xác minh",
      rawScore: kycScore,
      weight: CLIENT_TRUST_WEIGHTS.kyc,
      weightedScore: (kycScore * CLIENT_TRUST_WEIGHTS.kyc) / 100,
      details: trust.is_verified ? "Đã được Admin xác minh KYC" : "Chưa xác minh KYC",
    },
    {
      factor: "Đánh giá nhà máy",
      rawScore: factoryScore,
      weight: CLIENT_TRUST_WEIGHTS.factoryAssessment,
      weightedScore: (factoryScore * CLIENT_TRUST_WEIGHTS.factoryAssessment) / 100,
      details:
        trust.factoryScoreTotal != null
          ? `Điểm audit nhà máy: ${trust.factoryScoreTotal}/100`
          : "Chưa có đánh giá nhà máy — điểm trung tính",
    },
    {
      factor: "Lịch sử giao dịch",
      rawScore: transactionScore,
      weight: CLIENT_TRUST_WEIGHTS.transactionHistory,
      weightedScore: (transactionScore * CLIENT_TRUST_WEIGHTS.transactionHistory) / 100,
      details:
        trust.dealsTotal > 0
          ? `${trust.dealsSwiftVerified}/${trust.dealsTotal} giao dịch đã xác minh SWIFT`
          : "Chưa có giao dịch nào — điểm trung tính, không bị phạt vì là client mới",
    },
    {
      factor: "Hồ sơ công ty",
      rawScore: profileScore,
      weight: CLIENT_TRUST_WEIGHTS.companyProfile,
      weightedScore: (profileScore * CLIENT_TRUST_WEIGHTS.companyProfile) / 100,
      details: trust.hasCompanyProfile ? "Hồ sơ công ty đầy đủ" : "Hồ sơ công ty còn thiếu thông tin",
    },
  ]

  const totalWeight = Object.values(CLIENT_TRUST_WEIGHTS).reduce((s, w) => s + w, 0)
  const score = Math.round(breakdown.reduce((s, b) => s + b.weightedScore, 0) / (totalWeight / 100))

  let label: TrustLabel = "new_supplier"
  if (trust.is_verified) label = "verified"
  else if (trust.factoryScoreTotal != null) label = "factory_assessed"

  return { score: Math.min(100, Math.max(0, score)), breakdown, label }
}

// ============================================================
// Main entry point
// ============================================================

/**
 * Scores one (buyer, product) pair. `trust` must belong to `product.client_id`.
 */
export function scoreClientProduct(
  buyer: BuyerMatchInput,
  product: ClientProductInput,
  trust: ClientTrustInput,
  opts: { alreadyAttached: boolean },
): ClientMatchResult {
  const hs = scoreHsCodeMatch(buyer, product)
  const spec = scoreSpecMatch(buyer, product)
  const capacity = scoreCapacityMoq(buyer, product)
  const compliance = scoreCompliance(product, trust)
  const logistics = scoreLogistics(buyer, product)

  const matchWeightTotal = Object.values(CLIENT_MATCH_WEIGHTS).reduce((s, w) => s + w, 0)

  const matchBreakdown: FactorBreakdown[] = [
    {
      factor: "Mã HS / Danh mục",
      rawScore: hs.score,
      weight: CLIENT_MATCH_WEIGHTS.hsCode,
      weightedScore: (hs.score * CLIENT_MATCH_WEIGHTS.hsCode) / 100,
      details: hs.detail,
    },
    {
      factor: "Sản phẩm & Thông số kỹ thuật",
      rawScore: spec.score,
      weight: CLIENT_MATCH_WEIGHTS.specMatch,
      weightedScore: (spec.score * CLIENT_MATCH_WEIGHTS.specMatch) / 100,
      details: spec.detail,
    },
    {
      factor: "Năng lực & MOQ",
      rawScore: capacity.score,
      weight: CLIENT_MATCH_WEIGHTS.capacityMoq,
      weightedScore: (capacity.score * CLIENT_MATCH_WEIGHTS.capacityMoq) / 100,
      details: capacity.detail,
    },
    {
      factor: "Tuân thủ & Chứng nhận",
      rawScore: compliance.score,
      weight: CLIENT_MATCH_WEIGHTS.compliance,
      weightedScore: (compliance.score * CLIENT_MATCH_WEIGHTS.compliance) / 100,
      details: compliance.detail,
    },
    {
      factor: "Logistics & Xuất xứ",
      rawScore: logistics.score,
      weight: CLIENT_MATCH_WEIGHTS.logistics,
      weightedScore: (logistics.score * CLIENT_MATCH_WEIGHTS.logistics) / 100,
      details: logistics.detail,
    },
  ]

  // Re-normalize to 0-100 so "Match Score" is a clean, trust-free percentage.
  const matchScore = Math.round(
    (matchBreakdown.reduce((s, b) => s + b.weightedScore, 0) / matchWeightTotal) * 100,
  )

  const { score: trustScore, breakdown: trustBreakdown, label: trustLabel } = scoreTrust(trust)

  const finalScore = Math.round(matchScore * MATCH_SCORE_SHARE + trustScore * TRUST_SCORE_SHARE)

  const hasFda = !!trust.fda_registration_number?.trim()
  const fdaExpired =
    hasFda && !!trust.fda_expires_at && new Date(trust.fda_expires_at) < new Date(new Date().setHours(0, 0, 0, 0))

  const ineligibleReason = opts.alreadyAttached
    ? "already_attached"
    : !hasFda
      ? "fda_missing"
      : fdaExpired
        ? "fda_expired"
        : null

  return {
    clientId: product.client_id,
    clientName: trust.company_name ?? trust.full_name ?? "—",
    productId: product.id,
    productName: product.product_name,
    matchScore: Math.min(100, Math.max(0, matchScore)),
    trustScore,
    trustLabel,
    finalScore: Math.min(100, Math.max(0, finalScore)),
    matchBreakdown,
    trustBreakdown,
    commercialFlags: computeCommercialFlags(product),
    eligible: ineligibleReason === null,
    ineligibleReason,
  }
}

/**
 * Given a buyer and every active product across all clients, picks each
 * client's single best-matching product and returns the Top N clients
 * sorted by `finalScore` descending.
 */
export function rankClientsForBuyer(
  buyer: BuyerMatchInput,
  products: ClientProductInput[],
  trustByClientId: Map<string, ClientTrustInput>,
  attachedClientIds: Set<string>,
  limit: number = MAX_AI_MATCH_RESULTS,
): ClientMatchResult[] {
  const bestPerClient = new Map<string, ClientMatchResult>()

  for (const product of products) {
    const trust = trustByClientId.get(product.client_id)
    if (!trust) continue

    const result = scoreClientProduct(buyer, product, trust, {
      alreadyAttached: attachedClientIds.has(product.client_id),
    })

    const current = bestPerClient.get(product.client_id)
    if (!current || result.finalScore > current.finalScore) {
      bestPerClient.set(product.client_id, result)
    }
  }

  return Array.from(bestPerClient.values())
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, limit)
}
