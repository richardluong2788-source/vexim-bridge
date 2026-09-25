// Sending window theo giờ địa phương buyer (yêu cầu 25/09/2026).
//
// Chính sách B1 (backend policy — AI KHÔNG BAO GIỜ quyết định giờ gửi):
//   - Thứ 2–6, hai khung: 08:00–11:30 và 13:00–16:30 GIỜ LOCAL của buyer.
//   - Ngoài khung → scheduler RESCHEDULE sang window kế tiếp (không bỏ step).
//   - Timezone: manual override (leads.buyer_timezone, migration 091) >
//     US-state parse từ import_address > country map > approximate (US/CA → ET).
//   - Timezone không đủ tin cậy (không có / chỉ approximate) → KHÔNG auto-send
//     (CAMPAIGN_AUTO_SEND=true bị chặn ở approve path). Shadow mode vẫn gửi
//     draft qua approval queue — AE là người quyết, không phải AI.
//
// Phần pure (resolveBuyerTimezone, isWithinSendingWindow, msUntilNextWindowStart,
// checkSendingWindow) không import DB — test được bằng node thuần.
// Phần DB (resolveEnrollmentTimezone) nằm cuối file, cut ra khi test.

// ---------------------------------------------------------------------------
// Timezone resolution
// ---------------------------------------------------------------------------

export interface BuyerTzInput {
  buyer_timezone?: string | null
  country?: string | null
  import_address?: string | null
}

export interface BuyerTzInfo {
  /** IANA timezone, null khi không xác định được gì. */
  tz: string | null
  source: "manual" | "us_state" | "country" | "country_approx" | "none"
  /** true = đủ tin cậy để AUTO-SEND. Approximate → chỉ dùng để reschedule. */
  confident: boolean
}

/** Quốc gia có 1 timezone trội rõ — đủ tin cậy ở mức country. */
const COUNTRY_TZ: Record<string, string> = {
  vietnam: "Asia/Ho_Chi_Minh",
  "viet nam": "Asia/Ho_Chi_Minh",
  "united kingdom": "Europe/London",
  england: "Europe/London",
  germany: "Europe/Berlin",
  france: "Europe/Paris",
  italy: "Europe/Rome",
  spain: "Europe/Madrid",
  netherlands: "Europe/Amsterdam",
  belgium: "Europe/Brussels",
  switzerland: "Europe/Zurich",
  austria: "Europe/Vienna",
  sweden: "Europe/Stockholm",
  norway: "Europe/Oslo",
  denmark: "Europe/Copenhagen",
  finland: "Europe/Helsinki",
  poland: "Europe/Warsaw",
  portugal: "Europe/Lisbon",
  ireland: "Europe/Dublin",
  japan: "Asia/Tokyo",
  "south korea": "Asia/Seoul",
  korea: "Asia/Seoul",
  china: "Asia/Shanghai",
  singapore: "Asia/Singapore",
  thailand: "Asia/Bangkok",
  india: "Asia/Kolkata",
  "united arab emirates": "Asia/Dubai",
  "new zealand": "Pacific/Auckland",
  israel: "Asia/Jerusalem",
  turkey: "Europe/Istanbul",
}

/** US state (2 ký tự) → timezone. State split dùng tz trội — chấp nhận được
 *  vì scheduler re-check trước khi gửi nên lệch tối đa 1 giờ DST tự chữa. */
const US_STATE_TZ: Record<string, "America/New_York" | "America/Chicago" | "America/Denver" | "America/Los_Angeles" | "America/Anchorage" | "Pacific/Honolulu"> = {
  // Eastern
  CT: "America/New_York", DE: "America/New_York", DC: "America/New_York", FL: "America/New_York",
  GA: "America/New_York", IN: "America/New_York", KY: "America/New_York", ME: "America/New_York",
  MD: "America/New_York", MA: "America/New_York", MI: "America/New_York", NH: "America/New_York",
  NJ: "America/New_York", NY: "America/New_York", NC: "America/New_York", OH: "America/New_York",
  PA: "America/New_York", RI: "America/New_York", SC: "America/New_York", VT: "America/New_York",
  VA: "America/New_York", WV: "America/New_York",
  // Central
  AL: "America/Chicago", AR: "America/Chicago", IL: "America/Chicago", IA: "America/Chicago",
  KS: "America/Chicago", LA: "America/Chicago", MN: "America/Chicago", MS: "America/Chicago",
  MO: "America/Chicago", NE: "America/Chicago", ND: "America/Chicago", OK: "America/Chicago",
  SD: "America/Chicago", TN: "America/Chicago", TX: "America/Chicago", WI: "America/Chicago",
  // Mountain
  AZ: "America/Denver", CO: "America/Denver", ID: "America/Denver", MT: "America/Denver",
  NM: "America/Denver", UT: "America/Denver", WY: "America/Denver",
  // Pacific
  CA: "America/Los_Angeles", NV: "America/Los_Angeles", OR: "America/Los_Angeles", WA: "America/Los_Angeles",
  // Other
  AK: "America/Anchorage", HI: "Pacific/Honolulu",
}

/** Parse mã state US từ địa chỉ: "... Houston, TX 77002" hoặc "..., TX." */
function parseUsState(importAddress: string | null | undefined): string | null {
  if (!importAddress) return null
  const m =
    importAddress.match(/,\s*([A-Z]{2})\s+\d{5}/) ??
    importAddress.match(/,\s*([A-Z]{2})[.,\s]*$/) ??
    importAddress.match(/\b([A-Z]{2})\s+\d{5}\b/)
  return m ? m[1] : null
}

/** Pure — resolve timezone của buyer theo độ ưu tiên manual > state > country. */
export function resolveBuyerTimezone(lead: BuyerTzInput): BuyerTzInfo {
  const manual = lead.buyer_timezone?.trim()
  if (manual && manual.includes("/")) {
    return { tz: manual, source: "manual", confident: true }
  }

  const country = lead.country?.trim().toLowerCase() ?? ""
  const address = lead.import_address ?? null

  if (country === "united states" || country === "usa" || country === "us" || country === "united states of america") {
    const state = parseUsState(address)
    if (state && US_STATE_TZ[state]) {
      return { tz: US_STATE_TZ[state], source: "us_state", confident: true }
    }
    // Chưa bít state — approximate ET (phần lớn food importer Mỹ ở ET).
    return { tz: "America/New_York", source: "country_approx", confident: false }
  }
  if (country === "canada" || country === "ca") {
    return { tz: "America/Toronto", source: "country_approx", confident: false }
  }

  if (country && COUNTRY_TZ[country]) {
    return { tz: COUNTRY_TZ[country], source: "country", confident: true }
  }

  return { tz: null, source: "none", confident: false }
}

// ---------------------------------------------------------------------------
// Window math — Mon–Fri, [08:00–11:30) và [13:00–16:30) giờ local
// ---------------------------------------------------------------------------

export const WINDOW_STARTS_MIN = [8 * 60, 13 * 60] // 08:00, 13:00
export const WINDOW_ENDS_MIN = [11 * 60 + 30, 16 * 60 + 30] // 11:30, 16:30

/** Local parts của một instant trong timezone (null nếu tz không hợp lệ). */
export function getLocalParts(
  date: Date,
  tz: string,
): { weekday: number; minutes: number } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date)
    const wd = parts.find((p) => p.type === "weekday")?.value
    let h = Number(parts.find((p) => p.type === "hour")?.value)
    const m = Number(parts.find((p) => p.type === "minute")?.value)
    if (h === 24) h = 0 // một số Node trả "24" cho giờ 0 khi hour12:false
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
    if (wd === undefined || !(wd in map) || Number.isNaN(h) || Number.isNaN(m)) return null
    return { weekday: map[wd], minutes: h * 60 + m }
  } catch {
    return null
  }
}

export function isWeekday(weekday: number): boolean {
  return weekday >= 1 && weekday <= 5
}

export function isWithinSendingWindowLocal(weekday: number, minutes: number): boolean {
  if (!isWeekday(weekday)) return false
  for (let i = 0; i < WINDOW_STARTS_MIN.length; i++) {
    if (minutes >= WINDOW_STARTS_MIN[i] && minutes < WINDOW_ENDS_MIN[i]) return true
  }
  return false
}

/** Đang trong window? (tz không hợp lệ → false) */
export function isWithinSendingWindow(now: Date, tz: string): boolean {
  const p = getLocalParts(now, tz)
  return !!p && isWithinSendingWindowLocal(p.weekday, p.minutes)
}

/**
 * Số ms tới lúc mở window kế tiếp. 0 = đang trong window. null = tz hỏng.
 * LƯU Ý: tính bằng local-clock delta nên có thể lệch ±1h nếu vượt DST boundary
 * — vô hại vì scheduler RE-CHECK window trước khi xử lý (self-healing).
 */
export function msUntilNextWindowStart(now: Date, tz: string): number | null {
  const p = getLocalParts(now, tz)
  if (!p) return null
  if (isWithinSendingWindowLocal(p.weekday, p.minutes)) return 0

  for (let d = 0; d <= 7; d++) {
    const wd = (p.weekday + d) % 7
    if (!isWeekday(wd)) continue
    const starts = d === 0 ? WINDOW_STARTS_MIN.filter((s) => s > p.minutes) : WINDOW_STARTS_MIN
    if (starts.length > 0) {
      const deltaMin = d * 1440 + (starts[0] - p.minutes)
      return Math.max(deltaMin, 1) * 60_000
    }
  }
  return null // không xảy ra (7 ngày luôn có 1 weekday)
}

// ---------------------------------------------------------------------------
// Decision — dùng ở scheduler + approve path
// ---------------------------------------------------------------------------

export interface WindowCheck {
  ok: boolean
  /** Khi !ok: mốc下一次 window (scheduler đặt next_action_at = mốc này). */
  nextAt?: Date
  tz: string | null
  confident: boolean
  reason?: "no_timezone" | "outside_window"
}

/**
 * Scheduler check (mọi mode): tz nào đó → enforce window; không có tz →
 * cho qua (shadow mode sẽ để AE quyết; auto-send bị chặn ở approve path).
 */
export function checkSendingWindow(now: Date, info: BuyerTzInfo): WindowCheck {
  if (!info.tz) return { ok: true, tz: null, confident: false, reason: "no_timezone" }
  if (isWithinSendingWindow(now, info.tz)) return { ok: true, tz: info.tz, confident: info.confident }
  const ms = msUntilNextWindowStart(now, info.tz)
  return {
    ok: false,
    nextAt: ms !== null ? new Date(now.getTime() + ms) : new Date(now.getTime() + 3600_000),
    tz: info.tz,
    confident: info.confident,
    reason: "outside_window",
  }
}

/**
 * Auto-send check (CAMPAIGN_AUTO_SEND=true): NGHIÊM hơn — timezone phải tồn
 * tại VÀ đủ tin cậy, đang trong window. Đây là rào cản backend: AI không thể
 * và không cần "quyết định" giờ gửi.
 */
export function checkAutoSendWindow(now: Date, info: BuyerTzInfo): WindowCheck {
  if (!info.tz) return { ok: false, tz: null, confident: false, reason: "no_timezone" }
  if (!info.confident) return { ok: false, tz: info.tz, confident: false, reason: "no_timezone" }
  return checkSendingWindow(now, info)
}

// ---------------------------------------------------------------------------
// DB wrapper — cut phần này khi chạy pure tests
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin"

/** Resolve timezone cho lead của enrollment (1 query nhẹ). */
export async function resolveEnrollmentTimezone(leadId: string): Promise<BuyerTzInfo> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("leads")
    .select("buyer_timezone, country, import_address")
    .eq("id", leadId)
    .single()
  return resolveBuyerTimezone((data ?? {}) as BuyerTzInput)
}
