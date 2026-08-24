// ============================================================
// Shared option lists + Vietnamese labels for the factory capability
// assessment (mục 6–15 of the internal Vexim form). Used by both the
// AE-only internal assessment editor (admin-factory-assessment.tsx) and
// the client-facing intake wizard (client-intake-form.tsx) so the two
// stay in sync — same option codes, same wording.
// ============================================================

export const QUALITY_SYSTEMS = ["HACCP", "GMP", "ISO22000", "SOP", "QC", "other"] as const
export const OEM_ODM = ["OEM", "ODM", "Private Label", "none"] as const
export const EXPORT_MARKETS = ["US", "EU", "JP", "KR", "CN", "ASEAN", "ME", "other"] as const
export const TRACEABILITY = ["lot", "input", "finished", "recall", "batch-lot", "none"] as const
export const AUDIT_READINESS = ["onsite", "online", "not-ready"] as const
export const INCOTERMS = ["EXW", "FOB", "CIF"] as const
export const COMMITMENTS = ["priority", "cooperation", "accuracy"] as const
export const WATER_SOURCES = ["municipal", "well", "filtered", "other"] as const
export const FDA_STATUS = ["valid", "expired", "none"] as const

export const ASSESSMENT_LABELS: Record<string, string> = {
  HACCP: "HACCP",
  GMP: "GMP",
  ISO22000: "ISO 22000",
  SOP: "SOP nội bộ",
  QC: "Quy trình kiểm soát chất lượng",
  other: "Khác",
  OEM: "OEM",
  ODM: "ODM",
  "Private Label": "Private Label",
  none: "Không triển khai / Chưa áp dụng",
  US: "Hoa Kỳ",
  EU: "EU",
  JP: "Nhật Bản",
  KR: "Hàn Quốc",
  CN: "Trung Quốc",
  ASEAN: "ASEAN",
  ME: "Trung Đông",
  lot: "Hồ sơ truy xuất theo từng lô hàng",
  input: "Hồ sơ nguyên liệu đầu vào",
  finished: "Hồ sơ thành phẩm",
  recall: "Quy trình thu hồi sản phẩm",
  "batch-lot": "Mã Batch/Lot",
  onsite: "Sẵn sàng tiếp đón Buyer đến khảo sát nhà máy",
  online: "Sẵn sàng thực hiện Audit Online",
  "not-ready": "Chưa sẵn sàng",
  EXW: "Báo giá EXW",
  FOB: "Báo giá FOB",
  CIF: "Báo giá CIF",
  priority: "Cam kết ưu tiên nguồn lực để triển khai dự án cùng Vexim",
  cooperation: "Cam kết phối hợp đầy đủ trong suốt quá trình phát triển thị trường",
  accuracy: "Đồng ý cung cấp đầy đủ thông tin trung thực và chịu trách nhiệm về tính chính xác",
  municipal: "Nước máy / thủy cục",
  well: "Nước giếng khoan (đã xử lý)",
  filtered: "Hệ thống lọc RO / xử lý nội bộ",
  valid: "Còn hạn",
  expired: "Hết hạn",
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
 * Shape of the factory-capability answers (mục 6–15), shared between the
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
  staff_engineers_count: string
  staff_workers_count: string
  work_hours_start: string
  work_hours_end: string
  work_days_per_week: string
  food_safety_training_regular: string
  equipment_calibration_regular: string
  water_source: string[]
  water_source_other: string
  water_testing: string
  near_pollution_source: string
  pollution_source_note: string
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
  staff_engineers_count: "",
  staff_workers_count: "",
  work_hours_start: "",
  work_hours_end: "",
  work_days_per_week: "",
  food_safety_training_regular: "",
  equipment_calibration_regular: "",
  water_source: [],
  water_source_other: "",
  water_testing: "",
  near_pollution_source: "",
  pollution_source_note: "",
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
