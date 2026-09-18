"use client"

/**
 * Shown on the buyer profile when automatic email suppression is active
 * (hard bounce or spam complaint, received from the Resend outbound
 * webhook). Explains why emails to this buyer are blocked and lets an
 * admin lift the block after verifying a corrected address / false positive.
 */

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Flag, ShieldOff } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { clearEmailSuppressionAction } from "@/app/admin/buyers/email-suppression-actions"

export function EmailSuppressionPanel({
  leadId,
  hardBouncedAt,
  complainedAt,
  note,
  canLift,
  locale,
}: {
  leadId: string
  hardBouncedAt: string | null
  complainedAt: string | null
  note: string | null
  canLift: boolean
  locale: "vi" | "en"
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [reason, setReason] = useState("")
  const [confirming, setConfirming] = useState(false)

  if (!hardBouncedAt && !complainedAt) return null

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(locale === "vi" ? "vi-VN" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    })

  const handleLift = () => {
    startTransition(async () => {
      const res = await clearEmailSuppressionAction(leadId, reason.trim() || undefined)
      if (res.ok) {
        toast.success(
          locale === "vi" ? "Đã gỡ chặn email cho buyer này" : "Email suppression lifted for this buyer",
        )
        setConfirming(false)
        setReason("")
        router.refresh()
      } else if (res.error === "forbidden") {
        toast.error(locale === "vi" ? "Bạn không có quyền gỡ chặn" : "Only admins can lift suppression")
      } else {
        toast.error(locale === "vi" ? "Lỗi máy chủ, thử lại sau" : "Server error, please try again")
      }
    })
  }

  return (
    <div className="rounded-lg border border-red-300 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
        <div className="flex-1 space-y-2 text-sm">
          <h3 className="font-semibold text-red-800">
            {locale === "vi" ? "Đang CHẶN gửi email cho buyer này" : "Outbound email is BLOCKED for this buyer"}
          </h3>
          <ul className="space-y-1 text-red-700">
            {hardBouncedAt && (
              <li className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {locale === "vi"
                    ? `Email bị trả về vĩnh viễn (hard bounce) vào ${fmt(hardBouncedAt)} — địa chỉ không tồn tại. Mọi email gửi lại đúng địa chỉ cũ bị chặn; hãy kiểm tra/sửa địa chỉ mới trước khi gỡ chặn.`
                    : `Hard bounce on ${fmt(hardBouncedAt)} — the address does not exist. Sending to the old address is blocked; verify a corrected address before lifting.`}
                </span>
              </li>
            )}
            {complainedAt && (
              <li className="flex items-start gap-2">
                <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {locale === "vi"
                    ? `Buyer báo spam vào ${fmt(complainedAt)}. Theo CAN-SPAM, KHÔNG được gửi tiếp cho tới khi buyer đồng ý lại. Chỉ gỡ khi đã xác minh rõ hiểu lầm.`
                    : `Buyer marked a message as spam on ${fmt(complainedAt)}. Under CAN-SPAM, do not email again unless they opt back in. Lift only after verifying a clear false positive.`}
                </span>
              </li>
            )}
          </ul>
          {note && (
            <p className="rounded bg-white/70 px-2 py-1 text-xs text-zinc-600">
              {locale === "vi" ? "Ghi chú: " : "Note: "}
              {note}
            </p>
          )}

          {canLift ? (
            confirming ? (
              <div className="space-y-2 pt-1">
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder={
                    locale === "vi"
                      ? "Ghi chú lý do gỡ chặn (vd: buyer cấp lại địa chỉ mới…)"
                      : "Reason for lifting (e.g. buyer provided a corrected address…)"
                  }
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleLift}
                    disabled={pending}
                    className="gap-2"
                  >
                    <ShieldOff className="h-4 w-4" />
                    {pending
                      ? locale === "vi"
                        ? "Đang gỡ…"
                        : "Lifting…"
                      : locale === "vi"
                        ? "Xác nhận gỡ chặn"
                        : "Confirm lift"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirming(false)}
                    disabled={pending}
                  >
                    {locale === "vi" ? "Huỷ" : "Cancel"}
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="gap-2" onClick={() => setConfirming(true)}>
                <ShieldOff className="h-4 w-4" />
                {locale === "vi" ? "Admin gỡ chặn" : "Lift suppression (admin)"}
              </Button>
            )
          ) : (
            <p className="text-xs font-medium text-red-600">
              {locale === "vi"
                ? "Chỉ admin mới được gỡ chặn. Hãy nhắn admin nếu đã có địa chỉ mới hoặc xác minh được hiểu lầm."
                : "Only an admin can lift this. Contact an admin with the corrected address or verification."}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
