/**
 * Pure helpers for reasoning about an FDA facility registration's validity.
 *
 * Kept framework-agnostic so the dialog, the clients table, and the cron
 * route can all share the exact same rules. Dates are treated in UTC to avoid
 * timezone-induced off-by-one errors (the <input type="date"> value is always
 * a calendar date, not a moment).
 */

/** Number of days before expiry when we start nagging the client. */
export const FDA_WARNING_DAYS = 90

export type FdaStatus =
  | "missing" // no dates set
  | "expired" // expires_at is in the past
  | "expiring_soon" // expires within FDA_WARNING_DAYS
  | "valid" // > FDA_WARNING_DAYS left

export interface FdaStatusInfo {
  status: FdaStatus
  /**
   * Whole days from `today` to `expires_at`. Negative when expired.
   * `null` when `expires_at` is not set.
   */
  daysUntilExpiry: number | null
}

const MS_PER_DAY = 86_400_000

/** Midnight-UTC of a YYYY-MM-DD string or Date. Returns null on bad input. */
function toUtcMidnight(v: string | Date | null | undefined): Date | null {
  if (!v) return null
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null
    return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()))
  }
  const s = v.trim()
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null
  const d = new Date(`${s.slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** `today` defaults to "now" at UTC midnight so callers don't have to. */
export function getFdaStatus(
  expiresAt: string | Date | null | undefined,
  today: Date = new Date(),
): FdaStatusInfo {
  const expiry = toUtcMidnight(expiresAt)
  const todayUtc = toUtcMidnight(today)!

  if (!expiry) return { status: "missing", daysUntilExpiry: null }

  const days = Math.round((expiry.getTime() - todayUtc.getTime()) / MS_PER_DAY)

  if (days < 0) return { status: "expired", daysUntilExpiry: days }
  if (days <= FDA_WARNING_DAYS) return { status: "expiring_soon", daysUntilExpiry: days }
  return { status: "valid", daysUntilExpiry: days }
}

/**
 * Format a date as "17 Apr 2026" / "17 thg 4, 2026" using Intl.
 * Falls back to the raw ISO string if the input is unparseable.
 */
export function formatFdaDate(v: string | null | undefined, locale: "vi" | "en"): string {
  if (!v) return "—"
  const d = toUtcMidnight(v)
  if (!d) return v
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d)
}
