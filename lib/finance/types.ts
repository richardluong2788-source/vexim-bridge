/**
 * Finance module — shared constants, display helpers, and lookups.
 * Types themselves live in `lib/supabase/types.ts` so they stay
 * colocated with the other DB tables.
 */
import type {
  BillingPlanStatus,
  ExpenseCategory,
  InvoiceKind,
  InvoiceStatus,
  RetainerCreditKind,
} from "@/lib/supabase/types"

// ------------------------------------------------------------
// Invoice kind
// ------------------------------------------------------------
export const INVOICE_KIND_LABELS: Record<InvoiceKind, { vi: string; en: string }> = {
  setup_fee: { vi: "Phí khởi tạo", en: "Setup fee" },
  retainer: { vi: "Phí duy trì tháng", en: "Monthly retainer" },
  success_fee: { vi: "Phí thành công", en: "Success fee" },
  manual: { vi: "Hóa đơn khác", en: "Manual" },
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, { vi: string; en: string }> = {
  draft: { vi: "Nháp", en: "Draft" },
  sent: { vi: "Đã gửi", en: "Sent" },
  paid: { vi: "Đã thu", en: "Paid" },
  partial: { vi: "Thu một phần", en: "Partially paid" },
  overdue: { vi: "Quá hạn", en: "Overdue" },
  cancelled: { vi: "Đã hủy", en: "Cancelled" },
  void: { vi: "Vô hiệu", en: "Void" },
}

export const INVOICE_STATUS_VARIANT: Record<
  InvoiceStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  sent: "secondary",
  paid: "default",
  partial: "secondary",
  overdue: "destructive",
  cancelled: "outline",
  void: "outline",
}

// ------------------------------------------------------------
// Billing plans
// ------------------------------------------------------------
export const BILLING_PLAN_STATUS_LABELS: Record<
  BillingPlanStatus,
  { vi: string; en: string }
> = {
  active: { vi: "Đang hoạt động", en: "Active" },
  paused: { vi: "Tạm dừng", en: "Paused" },
  terminated: { vi: "Đã kết thúc", en: "Terminated" },
}

// ------------------------------------------------------------
// Retainer credit ledger
// ------------------------------------------------------------
export const RETAINER_CREDIT_KIND_LABELS: Record<
  RetainerCreditKind,
  { vi: string; en: string }
> = {
  earned: { vi: "Phát sinh", en: "Earned" },
  applied: { vi: "Đã dùng", en: "Applied" },
  expired: { vi: "Hết hạn", en: "Expired" },
  adjustment: { vi: "Điều chỉnh", en: "Adjustment" },
}

// ------------------------------------------------------------
// Operating expenses
// ------------------------------------------------------------
export const EXPENSE_CATEGORY_LABELS: Record<
  ExpenseCategory,
  { vi: string; en: string }
> = {
  salary: { vi: "Lương", en: "Salary" },
  tools: { vi: "Công cụ / Phần mềm", en: "Tools / Software" },
  marketing: { vi: "Marketing", en: "Marketing" },
  office: { vi: "Văn phòng", en: "Office" },
  legal: { vi: "Pháp lý", en: "Legal" },
  travel: { vi: "Đi lại", en: "Travel" },
  other: { vi: "Khác", en: "Other" },
}

/**
 * Common Vietnamese banks mapped to their Napas 247 BIN code.
 * The BIN is what VietQR needs to encode on the QR payload.
 * Users can override by entering an arbitrary BIN in the settings
 * form, but this list powers the autocomplete.
 */
export const VN_BANKS: { bin: string; name: string; shortName: string }[] = [
  { bin: "970436", name: "Vietcombank (Ngoại thương)", shortName: "Vietcombank" },
  { bin: "970418", name: "BIDV (Đầu tư & Phát triển)", shortName: "BIDV" },
  { bin: "970422", name: "MBBank (Quân đội)", shortName: "MB" },
  { bin: "970415", name: "VietinBank (Công thương)", shortName: "VietinBank" },
  { bin: "970405", name: "Agribank (Nông nghiệp)", shortName: "Agribank" },
  { bin: "970407", name: "Techcombank", shortName: "TCB" },
  { bin: "970423", name: "TPBank (Tiên Phong)", shortName: "TPBank" },
  { bin: "970432", name: "VPBank (Việt Nam Thịnh Vượng)", shortName: "VPBank" },
  { bin: "970416", name: "ACB (Á Châu)", shortName: "ACB" },
  { bin: "970403", name: "Sacombank", shortName: "STB" },
  { bin: "970441", name: "VIB (Quốc tế)", shortName: "VIB" },
  { bin: "970437", name: "HDBank", shortName: "HDBank" },
  { bin: "970443", name: "SHB (Sài Gòn – Hà Nội)", shortName: "SHB" },
  { bin: "970448", name: "OCB (Phương Đông)", shortName: "OCB" },
  { bin: "970429", name: "SCB (Sài Gòn)", shortName: "SCB" },
  { bin: "970454", name: "VietCapitalBank (Bản Việt)", shortName: "VCCB" },
  { bin: "970427", name: "VietABank", shortName: "VAB" },
  { bin: "970431", name: "Eximbank", shortName: "EIB" },
  { bin: "970446", name: "Co-opBank (HTXVN)", shortName: "Co-opBank" },
  { bin: "970428", name: "NamABank", shortName: "NAB" },
  { bin: "970440", name: "SeABank", shortName: "SeABank" },
  { bin: "970433", name: "VietBank", shortName: "VietBank" },
  { bin: "970452", name: "KienLongBank", shortName: "KLB" },
  { bin: "970438", name: "BaoVietBank", shortName: "BVB" },
  { bin: "970409", name: "BacABank", shortName: "BAB" },
  { bin: "970426", name: "MSB (Hàng Hải)", shortName: "MSB" },
]

export function findBankByBin(bin: string | null | undefined) {
  if (!bin) return null
  return VN_BANKS.find((b) => b.bin === bin) ?? null
}
