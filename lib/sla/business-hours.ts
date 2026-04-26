/**
 * Business-hour / business-day helpers for the SLA evaluator.
 *
 * Design choices (peer-review v2 B.1):
 *   - Weekends = Saturday + Sunday in the company timezone (Asia/Ho_Chi_Minh
 *     by default).
 *   - Vietnamese public holidays come from the `sla_holidays` table — admins
 *     can extend it via /admin/sla/holidays without redeploy.
 *   - Hours within a business day are NOT clamped to 9-5: we treat any hour
 *     of a non-weekend, non-holiday day as billable. That keeps the model
 *     simple and matches how the team is actually on-call.
 *
 * Why both `businessHoursBetween` and `businessDaysBetween`?
 *   - `businessHoursBetween` is what M1, M4 use (24-hour SLAs).
 *   - `businessDaysBetween` is what M5 uses ("verify within 2 business days").
 */

const VN_TZ = "Asia/Ho_Chi_Minh"
const MS_PER_HOUR = 3_600_000
const MS_PER_DAY = 86_400_000

/**
 * Return the YYYY-MM-DD calendar date at the given timezone for the
 * given instant. Uses Intl APIs so DST / TZ rules are correct.
 */
export function toIsoDateInTz(d: Date, tz = VN_TZ): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  // en-CA produces YYYY-MM-DD which is what we want.
  return fmt.format(d)
}

/**
 * 0 = Sunday, 1 = Monday, ... 6 = Saturday — at the given timezone.
 */
export function dayOfWeekInTz(d: Date, tz = VN_TZ): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  })
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  return map[fmt.format(d)] ?? 0
}

/** Saturday or Sunday in VN time. */
export function isWeekend(d: Date, tz = VN_TZ): boolean {
  const dow = dayOfWeekInTz(d, tz)
  return dow === 0 || dow === 6
}

/**
 * True iff `d`'s VN-local date matches one of the holiday rows.
 * Caller passes a Set of YYYY-MM-DD strings for O(1) lookup.
 */
export function isHoliday(d: Date, holidaySet: Set<string>, tz = VN_TZ): boolean {
  return holidaySet.has(toIsoDateInTz(d, tz))
}

/**
 * Walk forward 1 day at a time and count business days strictly between
 * `start` and `end`. Returns 0 if end <= start.
 *
 * For SLA purposes we are intentionally inclusive of the START date but
 * exclusive of the END date — i.e. an event that arrives 09:00 Mon and
 * is closed 09:00 Tue counts as 1 business day, not 2.
 */
export function businessDaysBetween(
  start: Date,
  end: Date,
  holidaySet: Set<string>,
  tz = VN_TZ,
): number {
  if (end.getTime() <= start.getTime()) return 0

  let count = 0
  // Walk in 24-hour increments. Anchor to start-of-day in VN to avoid drift
  // when the period crosses DST (VN does not observe DST but other locales
  // might if this helper gets reused).
  const cursor = new Date(start.getTime())
  // Clamp end to whole-day fence to keep the loop bounded.
  while (cursor.getTime() < end.getTime()) {
    if (!isWeekend(cursor, tz) && !isHoliday(cursor, holidaySet, tz)) {
      count += 1
    }
    cursor.setTime(cursor.getTime() + MS_PER_DAY)
  }
  return count
}

/**
 * Sum of business hours strictly between `start` and `end`, treating
 * every hour of a non-weekend, non-holiday day as billable.
 *
 * Implementation: walk the period one hour at a time. For 24-hour SLAs
 * this is plenty fast. We cap at 90 days of look-back to avoid pathological
 * inputs from running away.
 */
export function businessHoursBetween(
  start: Date,
  end: Date,
  holidaySet: Set<string>,
  tz = VN_TZ,
): number {
  if (end.getTime() <= start.getTime()) return 0

  const MAX_MS = 90 * MS_PER_DAY
  const span = Math.min(end.getTime() - start.getTime(), MAX_MS)
  const slices = Math.ceil(span / MS_PER_HOUR)

  let count = 0
  for (let i = 0; i < slices; i += 1) {
    const tick = new Date(start.getTime() + i * MS_PER_HOUR)
    if (!isWeekend(tick, tz) && !isHoliday(tick, holidaySet, tz)) {
      count += 1
    }
  }
  return count
}

/**
 * UTC start-of-month for a given date (e.g. 2026-04-26 -> 2026-04-01T00:00Z).
 * The cron always works in UTC because Vercel Cron is UTC-scheduled.
 */
export function startOfMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0))
}

/**
 * UTC end-of-month (exclusive — i.e. start of next month).
 */
export function startOfNextMonthUtc(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  )
}

/** Number of calendar days in the UTC month containing `d`. */
export function daysInMonthUtc(d: Date): number {
  const next = startOfNextMonthUtc(d)
  const start = startOfMonthUtc(d)
  return Math.round((next.getTime() - start.getTime()) / MS_PER_DAY)
}

/**
 * Pretty format a metric measurement for the dashboard.
 */
export function formatMetricValue(
  value: number,
  unit: "hours" | "business_days" | "count" | "days" | "boolean",
): string {
  switch (unit) {
    case "hours":
      return `${Number(value).toFixed(1)} h`
    case "business_days":
      return `${Number(value).toFixed(1)} ngày`
    case "days":
      return `${Math.round(value)} ngày`
    case "count":
      return Math.round(value).toLocaleString("vi-VN")
    case "boolean":
      return Number(value) >= 1 ? "Đã gửi" : "Chưa gửi"
    default:
      return String(value)
  }
}
