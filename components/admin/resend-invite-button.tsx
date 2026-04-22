"use client"

import { useState, useTransition } from "react"
import { Mail, Loader2, Check, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { resendClientInvite } from "@/app/admin/clients/resend-invite-action"

interface ResendInviteButtonProps {
  clientId: string
  clientEmail: string | null
}

/**
 * Admin button to regenerate + resend an invite/activation email for a client
 * whose previous OTP expired or was consumed.
 *
 * Displays a short-lived inline status ("Đã gửi" / "Lỗi") so the admin gets
 * confirmation without needing a toast system.
 */
export function ResendInviteButton({
  clientId,
  clientEmail,
}: ResendInviteButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "success" }
    | { kind: "error"; message: string }
  >({ kind: "idle" })

  const handleClick = () => {
    setStatus({ kind: "idle" })
    startTransition(async () => {
      const res = await resendClientInvite(clientId)
      if (res.ok) {
        setStatus({ kind: "success" })
        // Auto-clear the success badge after a few seconds so the button is
        // ready for another attempt if needed.
        setTimeout(() => setStatus({ kind: "idle" }), 5000)
      } else {
        setStatus({
          kind: "error",
          message: mapError(res.error ?? "unknown"),
        })
      }
    })
  }

  if (!clientEmail) return null

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={isPending}
        className="gap-2"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : status.kind === "success" ? (
          <Check
            className="h-3.5 w-3.5 text-emerald-600"
            aria-hidden="true"
          />
        ) : (
          <Mail className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {isPending
          ? "Đang gửi…"
          : status.kind === "success"
            ? "Đã gửi lại"
            : "Gửi lại email mời"}
      </Button>
      {status.kind === "error" && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" aria-hidden="true" />
          {status.message}
        </p>
      )}
      {status.kind === "success" && (
        <p className="text-xs text-muted-foreground">
          Đã gửi liên kết kích hoạt mới đến {clientEmail}.
        </p>
      )}
    </div>
  )
}

function mapError(code: string): string {
  switch (code) {
    case "unauthenticated":
      return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
    case "forbidden":
      return "Bạn không có quyền thực hiện thao tác này."
    case "not_found":
      return "Không tìm thấy tài khoản client."
    case "not_a_client":
      return "Tài khoản này không phải client."
    case "missing_email":
      return "Client chưa có email để gửi."
    case "generate_link_failed":
      return "Không tạo được liên kết mới. Vui lòng thử lại."
    default:
      if (code.startsWith("smtp:")) {
        return `Gửi email thất bại: ${code.slice(5).trim()}`
      }
      return "Có lỗi xảy ra. Vui lòng thử lại."
  }
}
