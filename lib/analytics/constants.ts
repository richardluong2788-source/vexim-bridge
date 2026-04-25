/**
 * Shared constants and helpers for /admin/analytics and the per-client /
 * per-buyer Performance cards.
 *
 * Three concerns live here:
 *   1. Period parsing  — convert ?period=30d|90d|quarter|year|all into a
 *      concrete [from, to] window for SQL queries.
 *   2. Stage metadata — label + colour + "stuck threshold in days".
 *   3. Stage groupings — terminal vs in-progress, used everywhere.
 */
import type { Stage } from "@/lib/supabase/types"

// ---------------------------------------------------------------------------
// Period
// ---------------------------------------------------------------------------
export type AnalyticsPeriod = "30d" | "90d" | "quarter" | "year" | "all"

export const ANALYTICS_PERIODS: { value: AnalyticsPeriod; labelVi: string; labelEn: string }[] = [
  { value: "30d",     labelVi: "30 ngày qua",   labelEn: "Last 30 days" },
  { value: "90d",     labelVi: "90 ngày qua",   labelEn: "Last 90 days" },
  { value: "quarter", labelVi: "Quý này",       labelEn: "This quarter" },
  { value: "year",    labelVi: "Năm này",       labelEn: "This year" },
  { value: "all",     labelVi: "Tất cả",        labelEn: "All time" },
]

export function parsePeriod(raw: string | undefined | null): AnalyticsPeriod {
  switch (raw) {
    case "30d":
    case "90d":
    case "quarter":
    case "year":
    case "all":
      return raw
    default:
      return "30d"
  }
}

export interface PeriodWindow {
  /** ISO timestamp lower bound (inclusive). Null for "all time". */
  from: string | null
  /** ISO timestamp upper bound (inclusive). Always now() unless we ever ship "previous quarter". */
  to: string
  label: string
}

export function resolvePeriod(period: AnalyticsPeriod, locale: "vi" | "en" = "vi"): PeriodWindow {
  const now = new Date()
  const toIso = now.toISOString()
  const meta = ANALYTICS_PERIODS.find((p) => p.value === period)
  const label = meta ? (locale === "vi" ? meta.labelVi : meta.labelEn) : period

  switch (period) {
    case "30d": {
      const from = new Date(now.getTime() - 30 * 86_400_000)
      return { from: from.toISOString(), to: toIso, label }
    }
    case "90d": {
      const from = new Date(now.getTime() - 90 * 86_400_000)
      return { from: from.toISOString(), to: toIso, label }
    }
    case "quarter": {
      // First day of current quarter, UTC.
      const m = now.getUTCMonth()
      const qStartMonth = m - (m % 3)
      const from = new Date(Date.UTC(now.getUTCFullYear(), qStartMonth, 1))
      return { from: from.toISOString(), to: toIso, label }
    }
    case "year": {
      const from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
      return { from: from.toISOString(), to: toIso, label }
    }
    case "all":
    default:
      return { from: null, to: toIso, label }
  }
}

// ---------------------------------------------------------------------------
// Stage metadata
// ---------------------------------------------------------------------------
export const ALL_STAGES: Stage[] = [
  "new",
  "contacted",
  "sample_requested",
  "sample_sent",
  "negotiation",
  "price_agreed",
  "production",
  "shipped",
  "won",
  "lost",
]

export const IN_PROGRESS_STAGES: Stage[] = [
  "new",
  "contacted",
  "sample_requested",
  "sample_sent",
  "negotiation",
  "price_agreed",
  "production",
  "shipped",
]

export const TERMINAL_STAGES: Stage[] = ["won", "lost"]

export const STAGE_LABEL_VI: Record<Stage, string> = {
  new:              "Mới",
  contacted:        "Đã liên hệ",
  sample_requested: "Yêu cầu mẫu",
  sample_sent:      "Đã gửi mẫu",
  negotiation:      "Đàm phán",
  price_agreed:     "Chốt giá",
  production:       "Sản xuất",
  shipped:          "Đã ship",
  won:              "Thành công",
  lost:             "Thất bại",
}

/**
 * Days a deal is allowed to sit in each stage before we flag it as "stuck".
 * Production / shipped are not flagged because external logistics drive
 * the timing. Terminal stages are excluded entirely.
 */
export const STUCK_THRESHOLD_DAYS: Partial<Record<Stage, number>> = {
  new:              7,
  contacted:        14,
  sample_requested: 21,
  sample_sent:      30,
  negotiation:      30,
  price_agreed:     14,
}

export function isStuck(stage: Stage, daysInStage: number): boolean {
  const threshold = STUCK_THRESHOLD_DAYS[stage]
  if (typeof threshold !== "number") return false
  return daysInStage >= threshold
}

// ---------------------------------------------------------------------------
// Month-bucket helpers — used by the Overview trend chart and per-client view
// ---------------------------------------------------------------------------
export interface MonthBucket {
  /** YYYY-MM key */
  key: string
  /** Localised short label for chart x-axis */
  label: string
}

/**
 * Build N monthly buckets ending in the current month. Returned newest-last,
 * which is what Recharts expects for left-to-right time progression.
 */
export function monthlyBuckets(months: number, locale: "vi" | "en" = "vi"): MonthBucket[] {
  const now = new Date()
  const out: MonthBucket[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
    const label = d.toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    })
    out.push({ key, label })
  }
  return out
}

/** Extract YYYY-MM from an ISO timestamp string. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

// Days helper for table cells
export function formatDaysVi(days: number): string {
  if (days < 1) return "<1 ngày"
  if (days === 1) return "1 ngày"
  return `${days} ngày`
}
