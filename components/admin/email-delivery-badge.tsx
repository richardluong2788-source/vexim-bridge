"use client"

/**
 * Pure presentational badge for the outbound delivery state of a sent
 * email_draft (populated by the Resend outbound webhook — see
 * lib/email/delivery-events.ts). Used both in the AE engagement workspace
 * and in the opportunity email history.
 *
 * Signal reliability (agreed policy):
 *  - bounced / complained: hard facts, loud red, sending auto-blocked
 *  - delivered / clicked: reliable signals
 *  - opened: REFERENCE ONLY — Apple Mail Privacy Protection fabricates
 *    opens and corporate proxies block tracking pixels, so opens are
 *    rendered dimmed and never drive stage changes.
 */

import {
  CheckCircle2,
  Clock,
  Eye,
  Flag,
  Mail,
  MousePointerClick,
  XCircle,
} from "lucide-react"

export type EmailDeliveryStatus =
  | "sent"
  | "delivered"
  | "delayed"
  | "bounced"
  | "complained"

export function DeliveryStatusBadge({
  status,
  sendStatus,
  locale = "vi",
}: {
  status: EmailDeliveryStatus | null | undefined
  sendStatus?: string | null
  locale?: "vi" | "en"
}) {
  if (sendStatus === "failed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
        <XCircle className="h-3 w-3" />
        {locale === "vi" ? "Gửi lỗi" : "Send failed"}
      </span>
    )
  }

  switch (status) {
    case "bounced":
      return (
        <span
          title={
            locale === "vi"
              ? "Email bị trả về (bounce) — đã tự chặn gửi tới địa chỉ cũ"
              : "Bounced — sending to the old address is now blocked"
          }
          className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200"
        >
          <XCircle className="h-3 w-3" />
          {locale === "vi" ? "Bị trả về" : "Bounced"}
        </span>
      )
    case "complained":
      return (
        <span
          title={
            locale === "vi"
              ? "Buyer báo spam — đã chặn gửi, cần admin gỡ"
              : "Buyer marked spam — sending is blocked until an admin lifts it"
          }
          className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200"
        >
          <Flag className="h-3 w-3" />
          {locale === "vi" ? "Báo spam" : "Spam report"}
        </span>
      )
    case "delayed":
      return (
        <span
          title={
            locale === "vi"
              ? "Nhà cung cấp hộp thư đang hoãn nhận, Resend sẽ thử lại"
              : "The recipient mail server is delaying delivery; Resend will retry"
          }
          className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200"
        >
          <Clock className="h-3 w-3" />
          {locale === "vi" ? "Bị hoãn" : "Delayed"}
        </span>
      )
    case "delivered":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-200">
          <CheckCircle2 className="h-3 w-3" />
          {locale === "vi" ? "Đã đến hộp thư" : "Delivered"}
        </span>
      )
    case "sent":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200">
          <Mail className="h-3 w-3" />
          {locale === "vi" ? "Đã gửi, chờ xác nhận" : "Sent, pending"}
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-500 ring-1 ring-inset ring-zinc-200">
          <Mail className="h-3 w-3" />
          {locale === "vi" ? "Đã gửi" : "Sent"}
        </span>
      )
  }
}

export function OpenSignalChip({
  count,
  locale = "vi",
}: {
  count: number | null | undefined
  locale?: "vi" | "en"
}) {
  if (!count || count <= 0) return null
  return (
    <span
      title={
        locale === "vi"
          ? "Chỉ tham khảo: Apple Mail Privacy Protection có thể tạo lượt mở ảo"
          : "Reference only: Apple Mail Privacy Protection can generate fake opens"
      }
      className="inline-flex items-center gap-1 text-xs text-zinc-400"
    >
      <Eye className="h-3 w-3" />
      {locale === "vi" ? `mở ${count}× (tham khảo)` : `opened ${count}× (ref)`}
    </span>
  )
}

export function ClickSignalChip({
  count,
  locale = "vi",
}: {
  count: number | null | undefined
  locale?: "vi" | "en"
}) {
  if (!count || count <= 0) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
      <MousePointerClick className="h-3 w-3" />
      {locale === "vi" ? `nhấp link ${count}×` : `clicked ${count}×`}
    </span>
  )
}
