/**
 * Country risk engine for the VXB "Closing & Compliance" gate (SOP Phase 3).
 *
 * Given a buyer's country, classify the deal into low / medium / high risk
 * and surface recommended payment terms + whether the Swift wire copy must
 * be admin-verified before the opportunity can move into production.
 *
 * Keep this file pure and dependency-free — it is imported from both client
 * components (add-lead form preview) and server actions (stage-change gate).
 */

export type RiskLevel = "low" | "medium" | "high"

export interface RiskAssessment {
  level: RiskLevel
  countryCode: string | null
  countryLabel: string | null
  /** Admin must verify a Swift copy before opportunity can pass price_agreed. */
  requiresVerifiedSwift: boolean
  reasons: {
    vi: string[]
    en: string[]
  }
  recommendedPayment: {
    vi: string
    en: string
  }
}

// ---------------------------------------------------------------------------
// ISO-3166 alpha-2 code tables. Derived from Wolfsberg Group + Basel AML
// index + our SOP's explicit callouts (Pakistan, Nigeria). Kept intentionally
// small — easier to audit than a full per-country table.
// ---------------------------------------------------------------------------

const HIGH_RISK_CODES = new Set<string>([
  "PK", // Pakistan — SOP Phase 3.2 explicit callout
  "NG", // Nigeria — SOP Phase 3.2 explicit callout
  "IR", // Iran — sanctions
  "KP", // North Korea — sanctions
  "SY", // Syria — sanctions
  "AF", // Afghanistan — FATF grey list + sanctions
  "YE", // Yemen — conflict zone
  "SD", // Sudan — FATF black/grey list
  "SS", // South Sudan
  "MM", // Myanmar
  "VE", // Venezuela — sanctions / capital controls
  "CU", // Cuba — sanctions
  "IQ", // Iraq — conflict / sanctions
  "LY", // Libya — conflict / sanctions
  "SO", // Somalia — FATF high-risk
  "BY", // Belarus — sanctions
  "RU", // Russia — sanctions
])

const MEDIUM_RISK_CODES = new Set<string>([
  "BD", // Bangladesh
  "IN", // India — large volume, mixed buyer quality
  "ID", // Indonesia
  "PH", // Philippines
  "EG", // Egypt — foreign-exchange risk
  "TR", // Turkey — FX volatility
  "KE", // Kenya
  "GH", // Ghana
  "TZ", // Tanzania
  "UG", // Uganda
  "ZA", // South Africa
  "BR", // Brazil — customs complexity
  "AR", // Argentina — FX controls
  "MX", // Mexico
  "CO", // Colombia
  "PE", // Peru
  "UA", // Ukraine — conflict impact
  "LK", // Sri Lanka — recent default
  "NP", // Nepal
  "KH", // Cambodia
  "LA", // Laos
  "LB", // Lebanon — banking crisis
  "ZW", // Zimbabwe
])

// Common buyer countries the SOP treats as low-risk by default.
const LOW_RISK_CODES = new Set<string>([
  "US",
  "CA",
  "GB",
  "AU",
  "NZ",
  "JP",
  "KR",
  "SG",
  "HK",
  "TW",
  "CN",
  "DE",
  "FR",
  "IT",
  "ES",
  "NL",
  "BE",
  "LU",
  "AT",
  "CH",
  "IE",
  "DK",
  "SE",
  "NO",
  "FI",
  "PT",
  "PL",
  "CZ",
  "AE",
  "SA",
  "QA",
  "KW",
  "IL",
  "MY",
  "TH",
])

// Friendly names used when the input is a free-text country instead of a code.
const NAME_TO_CODE: Record<string, string> = {
  PAKISTAN: "PK",
  NIGERIA: "NG",
  IRAN: "IR",
  "NORTH KOREA": "KP",
  KOREA: "KR",
  "SOUTH KOREA": "KR",
  SYRIA: "SY",
  AFGHANISTAN: "AF",
  YEMEN: "YE",
  SUDAN: "SD",
  "SOUTH SUDAN": "SS",
  MYANMAR: "MM",
  BURMA: "MM",
  VENEZUELA: "VE",
  CUBA: "CU",
  IRAQ: "IQ",
  LIBYA: "LY",
  SOMALIA: "SO",
  BELARUS: "BY",
  RUSSIA: "RU",
  BANGLADESH: "BD",
  INDIA: "IN",
  INDONESIA: "ID",
  PHILIPPINES: "PH",
  EGYPT: "EG",
  TURKEY: "TR",
  TURKIYE: "TR",
  KENYA: "KE",
  GHANA: "GH",
  TANZANIA: "TZ",
  UGANDA: "UG",
  "SOUTH AFRICA": "ZA",
  BRAZIL: "BR",
  ARGENTINA: "AR",
  MEXICO: "MX",
  COLOMBIA: "CO",
  PERU: "PE",
  UKRAINE: "UA",
  "SRI LANKA": "LK",
  NEPAL: "NP",
  CAMBODIA: "KH",
  LAOS: "LA",
  LEBANON: "LB",
  ZIMBABWE: "ZW",
  "UNITED STATES": "US",
  USA: "US",
  "UNITED STATES OF AMERICA": "US",
  CANADA: "CA",
  "UNITED KINGDOM": "GB",
  UK: "GB",
  ENGLAND: "GB",
  AUSTRALIA: "AU",
  "NEW ZEALAND": "NZ",
  JAPAN: "JP",
  SINGAPORE: "SG",
  "HONG KONG": "HK",
  TAIWAN: "TW",
  CHINA: "CN",
  GERMANY: "DE",
  FRANCE: "FR",
  ITALY: "IT",
  SPAIN: "ES",
  NETHERLANDS: "NL",
  BELGIUM: "BE",
  LUXEMBOURG: "LU",
  AUSTRIA: "AT",
  SWITZERLAND: "CH",
  IRELAND: "IE",
  DENMARK: "DK",
  SWEDEN: "SE",
  NORWAY: "NO",
  FINLAND: "FI",
  PORTUGAL: "PT",
  POLAND: "PL",
  CZECHIA: "CZ",
  "CZECH REPUBLIC": "CZ",
  "UNITED ARAB EMIRATES": "AE",
  UAE: "AE",
  "SAUDI ARABIA": "SA",
  QATAR: "QA",
  KUWAIT: "KW",
  ISRAEL: "IL",
  MALAYSIA: "MY",
  THAILAND: "TH",
}

// ---------------------------------------------------------------------------

/**
 * Normalise free-text country input into an ISO alpha-2 code.
 * Returns null if we cannot confidently resolve a code.
 */
export function normalizeCountry(input: string | null | undefined): string | null {
  if (!input) return null
  const s = input.trim().toUpperCase()
  if (s.length === 0) return null
  if (s.length === 2 && /^[A-Z]{2}$/.test(s)) return s
  const mapped = NAME_TO_CODE[s]
  return mapped ?? null
}

/**
 * Classify the deal risk based on buyer country.
 *
 * If the country is not set, we return "medium" with a clear reason — the
 * admin is nudged to capture the country before moving the deal forward.
 */
export function assessCountryRisk(
  country: string | null | undefined,
): RiskAssessment {
  const code = normalizeCountry(country)
  const label = country?.trim() || null

  if (!code) {
    return {
      level: "medium",
      countryCode: null,
      countryLabel: label,
      requiresVerifiedSwift: true,
      reasons: {
        vi: [
          "Chưa ghi nhận quốc gia của người mua. Mặc định coi là trung bình cho đến khi cập nhật.",
        ],
        en: [
          "Buyer country is not recorded yet. Treated as medium risk until set.",
        ],
      },
      recommendedPayment: {
        vi: "Yêu cầu 30% đặt cọc qua T/T, xác minh Swift trước khi sản xuất.",
        en: "Request 30% T/T deposit and verify Swift before production.",
      },
    }
  }

  if (HIGH_RISK_CODES.has(code)) {
    return {
      level: "high",
      countryCode: code,
      countryLabel: label,
      requiresVerifiedSwift: true,
      reasons: {
        vi: [
          `Quốc gia "${label ?? code}" nằm trong danh sách rủi ro cao (cảnh báo SOP Phase 3).`,
          "Bắt buộc yêu cầu L/C tại chỗ hoặc 100% T/T trước khi sản xuất.",
          "Admin phải xác minh Swift Copy trên tài khoản ngân hàng trước khi chuyển sang Production.",
        ],
        en: [
          `"${label ?? code}" is flagged as high-risk (SOP Phase 3 guardrail).`,
          "Require sight L/C or 100% T/T before production.",
          "Admin must verify the Swift copy against our bank before moving to Production.",
        ],
      },
      recommendedPayment: {
        vi: "L/C tại chỗ (Sight L/C) hoặc 100% T/T trả trước.",
        en: "Sight L/C or 100% T/T upfront.",
      },
    }
  }

  if (MEDIUM_RISK_CODES.has(code)) {
    return {
      level: "medium",
      countryCode: code,
      countryLabel: label,
      requiresVerifiedSwift: true,
      reasons: {
        vi: [
          `Quốc gia "${label ?? code}" thuộc nhóm rủi ro trung bình (kiểm soát ngoại hối / thanh toán chậm).`,
          "Nên yêu cầu 30–50% đặt cọc T/T và xác minh Swift trước khi sản xuất.",
        ],
        en: [
          `"${label ?? code}" is medium risk (FX controls or slow-payment history).`,
          "Recommend 30–50% T/T deposit and Swift verification before production.",
        ],
      },
      recommendedPayment: {
        vi: "T/T 30–50% đặt cọc, số dư trước khi giao B/L.",
        en: "30–50% T/T deposit, balance before B/L release.",
      },
    }
  }

  if (LOW_RISK_CODES.has(code)) {
    return {
      level: "low",
      countryCode: code,
      countryLabel: label,
      requiresVerifiedSwift: false,
      reasons: {
        vi: [
          `Quốc gia "${label ?? code}" thuộc nhóm rủi ro thấp theo SOP.`,
          "Có thể áp dụng điều khoản thanh toán linh hoạt (T/T hoặc L/C theo chuẩn).",
        ],
        en: [
          `"${label ?? code}" is classified as low risk per SOP.`,
          "Standard payment terms (T/T or L/C) are acceptable.",
        ],
      },
      recommendedPayment: {
        vi: "T/T tiêu chuẩn hoặc L/C theo điều khoản chuẩn.",
        en: "Standard T/T or L/C per house terms.",
      },
    }
  }

  // Unknown code → fall back to medium for safety.
  return {
    level: "medium",
    countryCode: code,
    countryLabel: label,
    requiresVerifiedSwift: true,
    reasons: {
      vi: [
        `Quốc gia "${label ?? code}" chưa có trong danh mục rủi ro, mặc định coi là trung bình.`,
      ],
      en: [
        `"${label ?? code}" is not in the risk catalogue yet; defaulted to medium.`,
      ],
    },
    recommendedPayment: {
      vi: "Yêu cầu 30% T/T đặt cọc, xác minh Swift trước khi sản xuất.",
      en: "Require 30% T/T deposit and Swift verification before production.",
    },
  }
}

/**
 * Stages that require a verified Swift copy when the deal is high-risk.
 * Used by the kanban board + stage-change gate.
 */
export const SWIFT_REQUIRED_STAGES = [
  "production",
  "shipped",
  "won",
] as const

export type SwiftRequiredStage = (typeof SWIFT_REQUIRED_STAGES)[number]

export function stageRequiresSwift(stage: string): stage is SwiftRequiredStage {
  return (SWIFT_REQUIRED_STAGES as readonly string[]).includes(stage)
}
