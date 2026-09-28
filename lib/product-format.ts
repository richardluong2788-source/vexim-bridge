/**
 * Shared display formatting for `client_products` rows on buyer-facing pages.
 *
 * These helpers used to be byte-identical copies inside `/products/[id]` and
 * `components/profile/profile-products.tsx` (and a third copy in the old
 * `/product/[id]` page). The public catalog index, the product page and a
 * supplier profile must never show two different prices for the same row, so
 * the formatting lives here once.
 */

const CURRENCY_LOCALE = "en-US"

/**
 * Human price for a `min_unit_price` / `max_unit_price` pair.
 *
 * Returns null when neither bound is set, so callers can hide the whole price
 * block instead of rendering "$0" (which buyers read as a real quote).
 */
export function formatPrice(
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string,
): string | null {
  if (!min && !max) return null

  const fmt = (n: number) =>
    new Intl.NumberFormat(CURRENCY_LOCALE, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n)

  if (min && max && min !== max) {
    return `${fmt(min)} - ${fmt(max)}`
  }
  return fmt(min || max || 0)
}

/** "500 boxes" style MOQ, or null when the supplier did not state one. */
export function formatMoq(
  value: number | null | undefined,
  unit: string | null | undefined,
): string | null {
  if (!value) return null
  const formatted = new Intl.NumberFormat(CURRENCY_LOCALE, { maximumFractionDigits: 0 }).format(value)
  return unit ? `${formatted} ${unit}` : formatted
}

/**
 * Plain-text summary of a product's markdown `description`, for
 * `<meta name="description">` and Open Graph. Markdown syntax is stripped
 * rather than rendered because metadata cannot contain markup.
 */
export function toMetaDescription(markdown: string | null | undefined, maxLength = 158): string {
  const text = (markdown ?? "")
    .replace(/```[\s\S]*?```/g, " ") // fenced code blocks
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images -> alt text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links -> label
    .replace(/^\s{0,3}#{1,6}\s+/gm, " ") // heading markers
    .replace(/^\s{0,3}>\s?/gm, " ") // blockquotes
    .replace(/^\s{0,3}[-*+]\s+/gm, " ") // list bullets
    .replace(/[*_~`#]/g, " ") // emphasis / inline code markers
    .replace(/\s+/g, " ")
    .trim()

  const fallback = "Export-ready product listed by a Vietnamese supplier on the Vexim catalog."
  if (!text) return fallback
  if (text.length <= maxLength) return text
  const cut = text.slice(0, maxLength)
  const lastSpace = cut.lastIndexOf(" ")
  return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

/** Monthly capacity sentence, or null when unstated. */
export function formatMonthlyCapacity(
  units: number | null | undefined,
  unitOfMeasure: string | null | undefined,
): string | null {
  if (!units) return null
  const formatted = new Intl.NumberFormat(CURRENCY_LOCALE, { maximumFractionDigits: 0 }).format(units)
  return unitOfMeasure ? `${formatted} ${unitOfMeasure} / month` : `${formatted} / month`
}
