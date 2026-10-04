export const SUPPLIER_ENTITY_TYPES = [
  { value: "direct_manufacturer", labelVi: "Nhà sản xuất trực tiếp", labelEn: "Direct manufacturer" },
  { value: "manufacturer_group", labelVi: "Doanh nghiệp thuộc nhóm có nhà máy", labelEn: "Company in a group with manufacturing facilities" },
  { value: "trading_company", labelVi: "Doanh nghiệp thương mại / xuất khẩu", labelEn: "Trading / export company" },
  { value: "authorized_representative", labelVi: "Đại diện / đơn vị được ủy quyền", labelEn: "Authorized representative / agent" },
  { value: "other", labelVi: "Khác", labelEn: "Other" },
  { value: "unknown", labelVi: "Chưa rõ", labelEn: "Not sure yet" },
] as const

export type SupplierEntityType = (typeof SUPPLIER_ENTITY_TYPES)[number]["value"]

export const SOURCE_RELATIONSHIP_TYPES = [
  { value: "direct_manufacturer", labelVi: "Chính doanh nghiệp này trực tiếp sản xuất", labelEn: "This company directly manufactures the products" },
  { value: "group_affiliate", labelVi: "Nhà máy thuộc cùng tập đoàn / có quan hệ sở hữu", labelEn: "Factory in the same corporate group / ownership relationship" },
  { value: "contract_manufacturer", labelVi: "Nhà máy gia công theo hợp đồng", labelEn: "Contract manufacturer" },
  { value: "authorized_representative", labelVi: "Đại diện / được nhà máy ủy quyền", labelEn: "Representative / authorized by the factory" },
  { value: "trading_company", labelVi: "Nhà cung cấp thương mại / trader", labelEn: "Trading company / trader" },
  { value: "other", labelVi: "Khác", labelEn: "Other" },
] as const

export type SourceRelationshipType = (typeof SOURCE_RELATIONSHIP_TYPES)[number]["value"]

export const SOURCE_VERIFICATION_STATUSES = [
  { value: "pending_verification", labelVi: "Chờ Vexim xác minh", labelEn: "Pending Vexim verification" },
  { value: "verified", labelVi: "Đã xác minh", labelEn: "Verified" },
  { value: "needs_follow_up", labelVi: "Cần bổ sung / liên hệ thêm", labelEn: "Follow-up needed" },
] as const

export type SourceVerificationStatus = (typeof SOURCE_VERIFICATION_STATUSES)[number]["value"]

export const PROFILE_SOURCE_STATUSES = [
  { value: "not_assessed", labelVi: "Chưa đánh giá", labelEn: "Not assessed" },
  { value: "awaiting_details", labelVi: "Chờ thông tin cơ sở", labelEn: "Awaiting facility details" },
  { value: "pending_verification", labelVi: "Đã nhận thông tin — chờ xác minh", labelEn: "Details received — verification pending" },
  { value: "verified", labelVi: "Đã xác minh", labelEn: "Verified" },
  { value: "on_hold", labelVi: "Tạm hoãn", labelEn: "On hold" },
] as const

export type ProfileSourceStatus = (typeof PROFILE_SOURCE_STATUSES)[number]["value"]

/** Safe source statuses available before any facility-level verification. */
export const INITIAL_PROFILE_SOURCE_STATUS_VALUES = [
  "not_assessed",
  "awaiting_details",
  "pending_verification",
] as const
export type InitialProfileSourceStatus = (typeof INITIAL_PROFILE_SOURCE_STATUS_VALUES)[number]

export function isInitialProfileSourceStatus(value: unknown): value is InitialProfileSourceStatus {
  return typeof value === "string" &&
    (INITIAL_PROFILE_SOURCE_STATUS_VALUES as readonly string[]).includes(value)
}

export const US_SALES_CHANNEL_STATUSES = [
  { value: "yes", labelVi: "Có buyer / kênh bán tại Mỹ", labelEn: "Yes, existing U.S. buyers or sales channels" },
  { value: "no", labelVi: "Chưa có", labelEn: "No current U.S. buyers or channels" },
  { value: "in_progress", labelVi: "Đang trao đổi / phát triển", labelEn: "In discussion / being developed" },
  { value: "unknown", labelVi: "Chưa rõ", labelEn: "Not sure" },
] as const

export type UsSalesChannelStatus = (typeof US_SALES_CHANNEL_STATUSES)[number]["value"]

export const VEXIM_SUPPORT_OPTIONS = [
  { value: "buyer_introductions", labelVi: "Kết nối buyer / nhà phân phối tại Mỹ", labelEn: "Introductions to U.S. buyers / distributors" },
  { value: "market_entry", labelVi: "Tìm hiểu thị trường và chiến lược vào Mỹ", labelEn: "U.S. market research and entry strategy" },
  { value: "product_fit", labelVi: "Điều chỉnh sản phẩm, quy cách hoặc bao bì", labelEn: "Product, specification, or packaging adaptation" },
  { value: "compliance_guidance", labelVi: "Hướng dẫn tuân thủ theo buyer / sản phẩm / cơ sở", labelEn: "Buyer-, product-, or facility-specific compliance guidance" },
  { value: "pricing", labelVi: "Định giá và điều kiện thương mại", labelEn: "Pricing and commercial terms" },
  { value: "export_logistics", labelVi: "Chứng từ xuất khẩu và logistics", labelEn: "Export documentation and logistics" },
  { value: "other", labelVi: "Nhu cầu khác", labelEn: "Other" },
] as const

export type VeximSupportNeed = (typeof VEXIM_SUPPORT_OPTIONS)[number]["value"]

export interface ManufacturingSourceEntry {
  /** Official legal name of the facility operator; keep in the original language. */
  facility_name: string
  /** Internal verification location only; never map to company/public-profile address. */
  facility_address: string
  /** Product names/types made at this location (translated to English on submit). */
  product_names: string[]
  relationship_type: SourceRelationshipType | ""
  relationship_notes: string
  verification_contact_name: string
  verification_contact_email: string
  verification_contact_phone: string
  evidence_note: string
  /** Internal reviewer-only fields. Public token RPCs must not return these. */
  verification_status: SourceVerificationStatus
  verification_notes: string
}

export const MAX_MANUFACTURING_SOURCES = 5

export function emptyManufacturingSource(): ManufacturingSourceEntry {
  return {
    facility_name: "",
    facility_address: "",
    product_names: [],
    relationship_type: "",
    relationship_notes: "",
    verification_contact_name: "",
    verification_contact_email: "",
    verification_contact_phone: "",
    evidence_note: "",
    verification_status: "pending_verification",
    verification_notes: "",
  }
}

const entityTypeValues = new Set<string>(SUPPLIER_ENTITY_TYPES.map((option) => option.value))
const relationshipValues = new Set<string>(SOURCE_RELATIONSHIP_TYPES.map((option) => option.value))
const verificationStatusValues = new Set<string>(SOURCE_VERIFICATION_STATUSES.map((option) => option.value))
const supportNeedValues = new Set<string>(VEXIM_SUPPORT_OPTIONS.map((option) => option.value))
const usStatusValues = new Set<string>(US_SALES_CHANNEL_STATUSES.map((option) => option.value))
const profileSourceStatusValues = new Set<string>(PROFILE_SOURCE_STATUSES.map((option) => option.value))

export function isSupplierEntityType(value: unknown): value is SupplierEntityType {
  return typeof value === "string" && entityTypeValues.has(value)
}

export function isSourceRelationshipType(value: unknown): value is SourceRelationshipType {
  return typeof value === "string" && relationshipValues.has(value)
}

export function isSourceVerificationStatus(value: unknown): value is SourceVerificationStatus {
  return typeof value === "string" && verificationStatusValues.has(value)
}

export function isProfileSourceStatus(value: unknown): value is ProfileSourceStatus {
  return typeof value === "string" && profileSourceStatusValues.has(value)
}

export function isUsSalesChannelStatus(value: unknown): value is UsSalesChannelStatus {
  return typeof value === "string" && usStatusValues.has(value)
}

export function normalizeSupportNeeds(value: unknown): VeximSupportNeed[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.filter((item): item is VeximSupportNeed => typeof item === "string" && supportNeedValues.has(item))))
}

function text(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function sourceHasContent(source: ManufacturingSourceEntry): boolean {
  return Boolean(
    source.facility_name ||
      source.facility_address ||
      source.product_names.length ||
      source.relationship_type ||
      source.relationship_notes ||
      source.verification_contact_name ||
      source.verification_contact_email ||
      source.verification_contact_phone ||
      source.evidence_note ||
      source.verification_notes,
  )
}

/**
 * Validate and bound facility rows received from the browser or reviewer UI.
 * Public submissions always start as unverified; only an authenticated
 * reviewer may preserve an explicit verification decision.
 */
export function normalizeManufacturingSources(
  value: unknown,
  options: { preserveReviewFields?: boolean } = {},
): ManufacturingSourceEntry[] {
  if (!Array.isArray(value)) return []

  const normalized = value.slice(0, MAX_MANUFACTURING_SOURCES).map((raw): ManufacturingSourceEntry => {
    const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
    const relationship = source.relationship_type
    const verification = source.verification_status
    const productNames = Array.isArray(source.product_names)
      ? source.product_names
          .map((item) => text(item, 160))
          .filter(Boolean)
          .slice(0, 20)
      : typeof source.product_names === "string"
        ? source.product_names
            .split(/\r?\n|;/)
            .map((item) => text(item, 160))
            .filter(Boolean)
            .slice(0, 20)
        : []

    return {
      facility_name: text(source.facility_name, 240),
      facility_address: text(source.facility_address, 500),
      product_names: productNames,
      relationship_type: isSourceRelationshipType(relationship) ? relationship : "",
      relationship_notes: text(source.relationship_notes, 2_000),
      verification_contact_name: text(source.verification_contact_name, 160),
      verification_contact_email: text(source.verification_contact_email, 254).toLowerCase(),
      verification_contact_phone: text(source.verification_contact_phone, 80),
      evidence_note: text(source.evidence_note, 2_000),
      verification_status:
        options.preserveReviewFields && isSourceVerificationStatus(verification)
          ? verification
          : "pending_verification",
      verification_notes: options.preserveReviewFields ? text(source.verification_notes, 2_000) : "",
    }
  })
  return normalized.filter(sourceHasContent)
}

export function deriveProfileSourceStatus(sources: ManufacturingSourceEntry[]): ProfileSourceStatus {
  if (sources.length === 0) return "awaiting_details"
  return sources.every((source) => source.verification_status === "verified")
    ? "verified"
    : "pending_verification"
}
