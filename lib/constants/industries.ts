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
 */
export const INDUSTRY_LABELS_VI: Record<Industry, string> = {
  "Food & Beverage": "Thực phẩm & Đồ uống",
  Agriculture: "Nông sản",
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
