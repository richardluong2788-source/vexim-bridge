"use client"

/**
 * Quick actions trên mỗi hàng hóa đơn trong danh sách:
 *   - Gửi email cho khách (gọi sendInvoiceEmailAction — draft→sent, kèm PDF đính kèm)
 *   - Tải PDF
 * Tách khỏi <Link> bao hàng để tránh nested-interactive (nút nằm TRONG link là
 * HTML không hợp lệ + click bị nuốt).
 */

import { useState, useTransition } from "react"
import { FileDown, Send } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { sendInvoiceEmailAction } from "@/app/admin/finance/invoices/actions"

interface Props {
  invoiceId: string
  invoiceNumber: string
  status: string
  emailSentAt: string | null
  paidAt: string | null
}

export function InvoiceRowActions({
  invoiceId,
  invoiceNumber,
  status,
  emailSentAt,
  paidAt,
}: Props) {
  const [pending, startTransition] = useTransition()
  const [sent, setSent] = useState(Boolean(emailSentAt))

  function handleSend() {
    startTransition(async () => {
      const res = await sendInvoiceEmailAction(invoiceId)
      if (res.ok) {
        setSent(true)
        toast.success(`Đã gửi ${invoiceNumber} cho khách (kèm PDF)`)
      } else {
        toast.error(`Gửi thất bại: ${res.error}`)
      }
    })
  }

  const canSend = !paidAt && !["cancelled", "void"].includes(status)

  return (
    <div className="flex items-center gap-1">
      {canSend && (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={handleSend}
          disabled={pending}
          title={sent ? "Gửi lại email" : "Gửi email cho khách"}
        >
          <Send className="h-3.5 w-3.5" />
          {sent ? "Gửi lại" : "Gửi"}
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5"
        asChild
      >
        <a
          href={`/api/finance/invoice/${invoiceId}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          title="Tải PDF"
        >
          <FileDown className="h-3.5 w-3.5" />
          PDF
        </a>
      </Button>
    </div>
  )
}
