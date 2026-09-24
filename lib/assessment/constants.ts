// ============================================================
// Shared option lists + Vietnamese labels for the factory capability
// assessment (muc 1-9 sau khi xoa muc 6 ve nhan su/gio lam/moi truong).
// Used by both the AE-only internal assessment editor and the
// client-facing intake wizard so the two stay in sync.
// ============================================================

export const QUALITY_SYSTEMS = ["HACCP", "GMP", "ISO22000", "SOP", "QC", "other"] as const
export const OEM_ODM = ["OEM", "ODM", "Private Label", "none"] as const
export const EXPORT_MARKETS = ["US", "EU", "JP", "KR", "CN", "ASEAN", "ME", "other"] as const
export const TRACEABILITY = ["lot", "input", "finished", "recall", "batch-lot", "none"] as const
export const AUDIT_READINESS = ["onsite", "online", "not-ready"] as const
export const INCOTERMS = ["EXW", "FOB", "CIF"] as const
export const COMMITMENTS = ["priority", "cooperation", "accuracy"] as const
export const FDA_STATUS = ["valid", "expired", "in_progress", "none"] as const

export const ASSESSMENT_LABELS: Record<string, string> = {
  HACCP: "HACCP",
  GMP: "GMP",
  ISO22000: "ISO 22000",
  SOP: "SOP noi bo",
  QC: "Quy trinh kiem soat chat luong",
  other: "Khac",
  OEM: "OEM",
  ODM: "ODM",
  "Private Label": "Private Label",
  none: "Khong trien khai / Chua ap dung",
  US: "Hoa Ky",
  EU: "EU",
  JP: "Nhat Ban",
  KR: "Han Quoc",
  CN: "Trung Quoc",
  ASEAN: "ASEAN",
  ME: "Trung Dong",
  lot: "Ho so truy xuat theo tung lo hang",
  input: "Ho so nguyen lieu dau vao",
  finished: "Ho so thanh pham",
  recall: "Quy trinh thu hoi san pham",
  "batch-lot": "Ma Batch/Lot",
  onsite: "San sang tiep don Buyer den khao sat nha may",
  online: "San sang thuc hien Audit Online",
  "not-ready": "Chua san sang",
  EXW: "Bao gia EXW",
  FOB: "Bao gia FOB",
  CIF: "Bao gia CIF",
  priority: "Cam ket uu tien nguon luc de trien khai du an cung Vexim",
  cooperation: "Cam ket phoi hop day du trong suot qua trinh phat trien thi truong",
  accuracy: "Dong y cung cap day du thong tin trung thuc va chiu trach nhiem ve tinh chinh xac",
  valid: "Co - Con han",
  expired: "Co - Het han",
  in_progress: "Dang trien khai",
  pending_supplement: "Dang trien khai",
}

/**
 * Toggle a value in/out of an array. When `single` is provided, selecting
 * any of those values clears the others in that mutually-exclusive group
 * (e.g. "none" clears everything else).
 */
export function toggleAssessmentValue(arr: string[], v: string, single?: string[]) {
  if (single && single.includes(v)) {
    const without = arr.filter((x) => !single.includes(x))
    return arr.includes(v) ? without : [...without, v]
  }
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]
}

/**
 * Shape of the factory-capability answers, shared between the
 * internal assessment form, the client intake wizard, and the AE review
 * screen. All fields optional/nullable since forms fill them incrementally.
 */
export interface FactoryCapabilityAnswers {
  quality_systems: string[]
  quality_systems_other: string
  oem_odm: string[]
  company_scale: string
  export_since_year: string
  export_markets: string[]
  export_markets_other: string
  traceability: string[]
  fda_status: string
  fda_number: string
  fda_expires_at: string
  fda_certificate_url: string
  audit_readiness: string[]
  audit_owner: string
  incoterms: string[]
  payment_policy: string
  oem_policy: string
  odm_policy: string
  has_export_dept: string
  has_english_staff: string
  pricing_decision_maker: string
  commitments: string[]
  project_priority: string
}

export const EMPTY_FACTORY_CAPABILITY_ANSWERS: FactoryCapabilityAnswers = {
  quality_systems: [],
  quality_systems_other: "",
  oem_odm: [],
  company_scale: "",
  export_since_year: "",
  export_markets: [],
  export_markets_other: "",
  traceability: [],
  fda_status: "",
  fda_number: "",
  fda_expires_at: "",
  fda_certificate_url: "",
  audit_readiness: [],
  audit_owner: "",
  incoterms: [],
  payment_policy: "",
  oem_policy: "",
  odm_policy: "",
  has_export_dept: "",
  has_english_staff: "",
  pricing_decision_maker: "",
  commitments: [],
  project_priority: "",
}
