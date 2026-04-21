/**
 * Shared currency & date formatters for the finance module.
 * Using Intl.NumberFormat ensures the VND / USD strings look
 * correct in both locales (en-US and vi-VN).
 */

const _usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
})

const _vndFmt = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
})

const _numUsdFmt = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return _usdFmt.format(value)
}

/** Thousand-separated with 2 decimals, no symbol. Good for invoice tables. */
export function formatUsdAmount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return _numUsdFmt.format(value)
}

export function formatVnd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return _vndFmt.format(value)
}

export function formatDate(
  iso: string | null | undefined,
  locale: "vi" | "en" = "en",
): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function formatDateTime(
  iso: string | null | undefined,
  locale: "vi" | "en" = "en",
): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString(locale === "vi" ? "vi-VN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
