// Heuristic "suggested approach" — the rule-based fallback shown on the buyer
// profile's "Phân tích" tab when there is no persisted AI analysis snapshot
// (migration 079).
//
// Why this is its own module
// --------------------------
// Two things need to agree about this data:
//   1. the card that RENDERS the tips/warnings, and
//   2. the tab that decides whether the card has anything to say at all — when
//      it does not, the tab shows the "no analysis yet" empty state instead.
//
// Before this module existed, only the card knew: it returned null on empty,
// but the empty state rendered unconditionally underneath it. A buyer with
// tips therefore showed BOTH the tips and a card announcing that there was no
// analysis — contradictory, and the reason this file exists.
//
// It is plain data + pure functions (no JSX, no "use client") so it can be
// imported by a client component, a server component, or a script.
//
// These are rules over the fields the LR recorded — NOT model output. The card
// that renders them must not claim otherwise.

/**
 * The subset of a buyer row this derivation reads. Structural, so both
 * `BuyerDetailData` (profile UI) and a raw `leads` row satisfy it.
 */
export interface SuggestedApproachSource {
  top_suppliers?: { name: string; country: string | null }[] | null
  top_low_months?: string | null
  top_peak_months?: string | null
  total_shipments?: number | null
  priority_rating?: number | null
  hs_code?: string | null
  main_product?: string | null
  competitors?: string | null
}

export interface SuggestedApproach {
  tips: string[]
  warnings: string[]
}

/** Applied when the source has no ImportYeti-derived monthly seasonality. */
export const EMPTY_APPROACH: SuggestedApproach = { tips: [], warnings: [] }

/**
 * Does this buyer already source from Vietnam? A warm lead, and the single
 * strongest signal the rules look for.
 */
export function hasVietnamSupplier(buyer: SuggestedApproachSource): boolean {
  return (
    buyer.top_suppliers?.some(
      (s) =>
        s.country?.toLowerCase().includes("vietnam") ||
        s.country?.toLowerCase() === "vn",
    ) ?? false
  )
}

/**
 * Derive the fallback tips/warnings for a buyer.
 *
 * `now` is injectable so the result is deterministic in tests — the only
 * time-dependent rule is "are we currently in one of the buyer's low months?".
 */
export function deriveSuggestedApproach(
  buyer: SuggestedApproachSource,
  locale: "vi" | "en",
  now: Date = new Date(),
): SuggestedApproach {
  const tips: string[] = []
  const warnings: string[] = []

  // Check if buyer has VN suppliers (warm lead)
  if (hasVietnamSupplier(buyer)) {
    tips.push(
      locale === "vi"
        ? "Buyer đã có supplier VN - đây là warm lead, có thể đề cập đến việc mở rộng nguồn cung"
        : "Buyer already has VN supplier - warm lead, mention expanding supply sources",
    )
  }

  // Check low season
  const lowMonths = buyer.top_low_months?.toLowerCase() || ""
  const currentMonth = now.toLocaleString("en-US", { month: "long" }).toLowerCase()
  const isLowSeason = lowMonths.includes(currentMonth)
  if (isLowSeason) {
    warnings.push(
      locale === "vi"
        ? `Hiện đang trong tháng thấp điểm (${buyer.top_low_months}) - có thể buyer ít phản hồi`
        : `Currently in low season (${buyer.top_low_months}) - buyer may be less responsive`,
    )
  }

  // Check peak months for best timing
  const peakMonths = buyer.top_peak_months?.toLowerCase() || ""
  if (peakMonths && !isLowSeason) {
    tips.push(
      locale === "vi"
        ? `Gợi ý: Tiếp cận trước tháng cao điểm (${buyer.top_peak_months}) để đàm phán tốt hơn`
        : `Tip: Approach before peak months (${buyer.top_peak_months}) for better negotiations`,
    )
  }

  // Check shipment volume
  if (buyer.total_shipments && buyer.total_shipments > 50) {
    tips.push(
      locale === "vi"
        ? `Buyer có volume lớn (${buyer.total_shipments} shipments) - có thể đàm phán giá tốt hơn`
        : `High volume buyer (${buyer.total_shipments} shipments) - can negotiate better pricing`,
    )
  }

  // Check priority
  if (buyer.priority_rating && buyer.priority_rating >= 4) {
    tips.push(
      locale === "vi"
        ? "LR đánh giá priority cao - ưu tiên follow up nhanh"
        : "LR rated high priority - prioritize quick follow-up",
    )
  }

  // Check HS code for specific approach
  if (buyer.hs_code) {
    tips.push(
      locale === "vi"
        ? `Tập trung vào sản phẩm HS ${buyer.hs_code} (${buyer.main_product || ""})`
        : `Focus on HS ${buyer.hs_code} products (${buyer.main_product || ""})`,
    )
  }

  // Check competitors
  if (buyer.competitors) {
    tips.push(
      locale === "vi"
        ? `Lưu ý đối thủ: ${buyer.competitors} - chuẩn bị điểm khác biệt`
        : `Note competitors: ${buyer.competitors} - prepare differentiators`,
    )
  }

  return { tips, warnings }
}

/** True when the fallback actually has something to show. */
export function hasSuggestedApproachContent(approach: SuggestedApproach): boolean {
  return approach.tips.length > 0 || approach.warnings.length > 0
}
