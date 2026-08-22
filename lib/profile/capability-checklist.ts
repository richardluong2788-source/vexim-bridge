import type { PublicCapability } from "@/lib/assessment/actions"

// Nhan hien thi cho danh sach "Nang luc da xac minh" tren trang profile cong khai.
// Chi lay tu quality_systems, traceability va cac tin hieu an toan thuc pham/thiet bi/nguon nuoc.
const QUALITY_SYSTEM_LABELS: Record<string, string> = {
  HACCP: "Đạt chứng nhận HACCP",
  GMP: "Đạt chứng nhận GMP",
  ISO22000: "Đạt chứng nhận ISO 22000",
  SOP: "Có quy trình vận hành nội bộ (SOP)",
  QC: "Có quy trình kiểm soát chất lượng (QC)",
}

const TRACEABILITY_LABELS: Record<string, string> = {
  lot: "Truy xuất nguồn gốc theo lô (Lot)",
  input: "Ghi nhận nguyên liệu đầu vào",
  finished: "Ghi nhận thành phẩm đầu ra",
  recall: "Có quy trình thu hồi sản phẩm",
  "batch-lot": "Mã hóa theo Batch/Lot",
}

/**
 * Xay danh sach checklist "Nang luc da xac minh" tu du lieu nang luc cong khai.
 * Chi bao gom cac tin hieu AN TOAN, khong bao gom diem so/nhan su.
 */
export function buildVerifiedCapabilityChecklist(
  capability: PublicCapability | null | undefined
): string[] {
  if (!capability) return []

  const items: string[] = []

  for (const value of capability.quality_systems ?? []) {
    const label = QUALITY_SYSTEM_LABELS[value]
    if (label) items.push(label)
  }

  for (const value of capability.traceability ?? []) {
    if (value === "none") continue
    const label = TRACEABILITY_LABELS[value]
    if (label) items.push(label)
  }

  if (capability.food_safety_training_regular) {
    items.push("Đào tạo an toàn thực phẩm định kỳ")
  }
  if (capability.equipment_calibration_regular) {
    items.push("Kiểm định máy móc định kỳ")
  }
  if (capability.water_testing) {
    items.push("Nguồn nước được kiểm định định kỳ")
  }

  return items
}
