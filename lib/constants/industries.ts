/**
 * Canonical list of industries used to classify Buyer (Lead) records.
 *
 * Source of truth — import from here any time a dropdown, filter, CSV
 * parser, or AI prompt needs the authoritative list. Never hard-code
 * these strings in components.
 *
 * Values are stored in the DB as canonical English strings so existing
 * rows keep working. The localized label map below is only used for
 * display; it falls back to the canonical value if a locale is missing.
 */

export const INDUSTRIES = [
  "Food & Beverage",
  "Agriculture",
  "Seafood",
  // NOTE: The stored value stays "Agriculture" for backward compatibility
  // with existing leads/profiles — only the display label changes (below)
  // and only for the boundary this constant exists to clarify.

  "Cosmetics & Personal Care",
  "Pharmaceuticals",
  "Textiles & Garments",
  "Footwear",
  "Furniture & Home Decor",
  "Machinery & Industrial Parts",
  "Electronics & Components",
  "Packaging & Printing",
  "Chemicals & Raw Materials",
  "Other",
] as const

export type Industry = (typeof INDUSTRIES)[number]

/**
 * Vietnamese display labels. Keep keys aligned with INDUSTRIES above.
 * Admin form will show "Food & Beverage · Thực phẩm & Đồ uống" style
 * bilingual labels when locale === "vi".
 *
 * "Agriculture" / "Food & Beverage" are spelled out with their raw vs.
 * processed distinction inline because LRs were repeatedly picking
 * "Agriculture" for buyers who were actually sourcing processed food —
 * the two plain labels read as near-synonyms in practice. The stored
 * value is still the bare "Agriculture" string (see INDUSTRIES above);
 * only these display labels changed.
 */
export const INDUSTRY_LABELS_VI: Record<Industry, string> = {
  "Food & Beverage": "Thực phẩm & Đồ uống (đã chế biến, đóng gói)",
  Agriculture: "Nông sản thô (chưa qua chế biến)",
  Seafood: "Thủy hải sản",
  "Cosmetics & Personal Care": "Mỹ phẩm & Chăm sóc cá nhân",
  Pharmaceuticals: "Dược phẩm",
  "Textiles & Garments": "Dệt may",
  Footwear: "Giày dép",
  "Furniture & Home Decor": "Nội thất & Trang trí",
  "Machinery & Industrial Parts": "Máy móc & Linh kiện công nghiệp",
  "Electronics & Components": "Điện tử & Linh kiện",
  "Packaging & Printing": "Bao bì & In ấn",
  "Chemicals & Raw Materials": "Hóa chất & Nguyên liệu",
  Other: "Khác",
}

/**
 * English display labels — same rationale as INDUSTRY_LABELS_VI above.
 * Falls back to the bare canonical value for industries where the plain
 * name isn't ambiguous.
 */
export const INDUSTRY_LABELS_EN: Record<Industry, string> = {
  "Food & Beverage": "Food & Beverage (processed, packaged)",
  Agriculture: "Agriculture (raw, unprocessed produce)",
  Seafood: "Seafood",
  "Cosmetics & Personal Care": "Cosmetics & Personal Care",
  Pharmaceuticals: "Pharmaceuticals",
  "Textiles & Garments": "Textiles & Garments",
  Footwear: "Footwear",
  "Furniture & Home Decor": "Furniture & Home Decor",
  "Machinery & Industrial Parts": "Machinery & Industrial Parts",
  "Electronics & Components": "Electronics & Components",
  "Packaging & Printing": "Packaging & Printing",
  "Chemicals & Raw Materials": "Chemicals & Raw Materials",
  Other: "Other",
}

/**
 * One-line helper text shown under the industry picker in lead/client
 * intake forms, specifically to resolve the Agriculture vs. Food &
 * Beverage ambiguity at the point LRs make the choice (not just in the
 * label itself).
 */
export const INDUSTRY_HELP_TEXT: Record<"en" | "vi", string> = {
  en: "Tip: choose Agriculture for raw, unprocessed produce (e.g. green coffee beans, raw cashew, fresh fruit). Choose Food & Beverage for anything processed or packaged (e.g. roasted coffee, roasted/salted cashew, dried fruit, sauces).",
  vi: "Gợi ý: chọn \"Nông sản thô\" cho hàng chưa qua chế biến (VD: cà phê nhân, hạt điều thô, trái cây tươi). Chọn \"Thực phẩm & Đồ uống\" cho hàng đã chế biến/đóng gói (VD: cà phê rang, điều rang muối, trái cây sấy, nước sốt).",
}

/**
 * Legacy value migration. Old records may carry "Textiles", "Electronics",
 * "Furniture", "Manufacturing" — resolve to the nearest new label so
 * kanban cards and client tables still render a readable category.
 */
export const LEGACY_INDUSTRY_MAP: Record<string, Industry> = {
  Textiles: "Textiles & Garments",
  Electronics: "Electronics & Components",
  Furniture: "Furniture & Home Decor",
  Manufacturing: "Machinery & Industrial Parts",
  Handicrafts: "Furniture & Home Decor",
}

export function normalizeIndustry(raw: string | null | undefined): Industry | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if ((INDUSTRIES as readonly string[]).includes(trimmed)) return trimmed as Industry
  if (trimmed in LEGACY_INDUSTRY_MAP) return LEGACY_INDUSTRY_MAP[trimmed]
  return null
}
