/**
 * Canonical option lists for client_products form fields.
 *
 * Source of truth — both the Admin product dialog and the Client
 * self-service product dialog must import from here so the two forms
 * never drift apart. These fields feed the AI matching engine
 * (lib/matching/client-scorer.ts): incoterm/payment_terms drive the
 * commercial-compatibility flags, compliance_badges drive the
 * Compliance score, and country_of_origin drives the Logistics score.
 */

export const PRODUCT_UNITS = [
  { value: "kg", label: "kg" },
  { value: "ton", label: "tấn" },
  { value: "liter", label: "lít" },
  { value: "boxes", label: "thùng" },
  { value: "bags", label: "bao" },
  { value: "units", label: "cái" },
] as const

export const PRODUCT_CURRENCIES = ["USD", "EUR", "VND", "CNY", "SGD", "MYR"] as const

export const INCOTERMS = ["EXW", "FOB", "CIF", "CFR", "FCA", "DAP", "DDP"] as const

export const PAYMENT_TERMS_OPTIONS = [
  { value: "tt_30_70", label: "T/T 30% đặt cọc, 70% trước giao hàng" },
  { value: "tt_100_advance", label: "T/T 100% trả trước" },
  { value: "lc_at_sight", label: "L/C trả ngay (at sight)" },
  { value: "lc_usance", label: "L/C trả chậm (usance)" },
  { value: "dp", label: "D/P (nhờ thu kèm chứng từ)" },
  { value: "net_30", label: "Net 30 ngày" },
  { value: "net_60", label: "Net 60 ngày" },
] as const

export const COMPLIANCE_BADGES = [
  { value: "fda", label: "FDA Registered", description: "FDA đã đăng ký" },
  { value: "coa", label: "COA Available", description: "Có chứng nhận phân tích" },
  { value: "organic", label: "Organic Certified", description: "Chứng nhận hữu cơ" },
  { value: "fsvp", label: "FSVP Compliant", description: "Tuân thủ FSVP" },
  { value: "halal", label: "Halal Certified", description: "Chứng nhận Halal" },
  { value: "kosher", label: "Kosher Certified", description: "Chứng nhận Kosher" },
  { value: "brcgs", label: "BRCGS", description: "BRCGS Food Safety" },
  { value: "haccp", label: "HACCP", description: "Chứng nhận HACCP" },
] as const
