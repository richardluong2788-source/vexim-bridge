// Display labels for the pre-opportunity pipeline.
//
// These lived inside the engagement card in app/admin/ae-inbox/engagement-list.tsx.
// That card is gone (the inbox is a worklist now, and the buyer's page carries
// the work), so the labels moved here — plain, importable from either surface.

import type { BuyerActionValue } from "@/lib/buyers/engagement-types"

/** How the AE actually reached the buyer. */
export const CONTACT_CHANNEL_LABELS: Record<string, { vi: string; en: string }> = {
  system_email: { vi: "Email trong hệ thống", en: "In-system email" },
  linkedin: { vi: "LinkedIn", en: "LinkedIn" },
  whatsapp: { vi: "WhatsApp", en: "WhatsApp" },
  phone: { vi: "Điện thoại", en: "Phone" },
  other: { vi: "Khác", en: "Other" },
}

/** What the buyer did with a supplier on the public shortlist. */
export const BUYER_ACTION_LABELS: Record<BuyerActionValue, { vi: string; en: string }> = {
  viewed_only: { vi: "Chỉ xem", en: "Viewed only" },
  interested_no_details: { vi: "Quan tâm (chưa chi tiết)", en: "Interested (no details)" },
  requested_info: { vi: "Hỏi thêm thông tin", en: "Requested info" },
  requested_sample: { vi: "Yêu cầu mẫu", en: "Requested sample" },
  requested_meeting: { vi: "Yêu cầu họp", en: "Requested meeting" },
  requested_order_discussion: { vi: "Muốn thảo luận đặt hàng", en: "Wants to discuss an order" },
  selected_primary: { vi: "Chọn làm supplier chính", en: "Selected as primary" },
  sent_price_volume: { vi: "Gửi giá & số lượng", en: "Sent price & volume" },
  sent_po: { vi: "Đã gửi PO", en: "Sent PO" },
  declined: { vi: "Buyer từ chối supplier này", en: "Buyer declined this supplier" },
}

/**
 * Nhãn lý do chê (094). EN hiển thị cho buyer trên share page (trang này
 * chỉ có tiếng Anh), VI cho AE trong notification + dialog pitch.
 */
export const DECLINE_REASON_LABELS: Record<
  import("./engagement-types").BuyerDeclineReason,
  { vi: string; en: string }
> = {
  products_mismatch: { vi: "Sản phẩm không khớp lĩnh vực mình nhập", en: "Products don't match what we buy" },
  price_moq: { vi: "Giá / MOQ không phù hợp", en: "Price / MOQ doesn't work for us" },
  missing_certs: { vi: "Thiếu chứng nhận yêu cầu", en: "Missing certifications we need" },
  existing_supplier: { vi: "Đã có supplier tương tự", en: "We already work with a similar supplier" },
  other: { vi: "Lý do khác", en: "Other" },
}

/** Dwell time on the public shortlist, e.g. "1m 20s". */
export function formatDwell(ms: number, locale: "vi" | "en"): string {
  const totalSeconds = Math.round(ms / 1000)
  if (totalSeconds < 60) {
    return locale === "vi" ? `${totalSeconds} giây` : `${totalSeconds}s`
  }
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes < 60) {
    return locale === "vi" ? `${minutes}p${seconds ? ` ${seconds}s` : ""}` : `${minutes}m ${seconds}s`
  }
  const hours = Math.floor(minutes / 60)
  return locale === "vi" ? `${hours} giờ` : `${hours}h`
}
