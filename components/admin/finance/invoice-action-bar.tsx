"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Check,
  Copy,
  Loader2,
  Mail,
  Printer,
  Send,
  Trash2,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_VARIANT,
} from "@/lib/finance/types"
import type { InvoiceStatus } from "@/lib/supabase/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  deleteInvoiceAction,
  markInvoicePaidAction,
  sendInvoiceEmailAction,
  updateInvoiceStatusAction,
} from "@/app/admin/finance/invoices/actions"
import type { Invoice } from "@/lib/supabase/types"

/**
 * Small status pill used in finance tables / cards.
 * Co-located here so any page that already imports from
 * `invoice-action-bar` has a single source of truth for status UI.
 */
export function InvoiceStatusBadge({
  status,
  locale = "vi",
  className,
}: {
  status: InvoiceStatus
  locale?: "vi" | "en"
  className?: string
}) {
  return (
    <Badge
      variant={INVOICE_STATUS_VARIANT[status]}
      className={className}
    >
      {INVOICE_STATUS_LABELS[status][locale]}
    </Badge>
  )
}

interface Props {
  invoice: Invoice
  publicUrl: string
}

export function InvoiceActionBar({ invoice, publicUrl }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [paidRef, setPaidRef] = useState("")
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10))
  const [paidAmount, setPaidAmount] = useState(
    String(Number(invoice.net_amount_usd)),
  )
  const [copied, setCopied] = useState(false)

  function handleSendEmail() {
    setError(null)
    startTransition(async () => {
      const result = await sendInvoiceEmailAction(invoice.id)
      if (!result.ok) {
        setError(
          result.error === "recipient_missing_email"
            ? "Khách hàng chưa có email — hãy cập nhật hồ sơ trước khi gửi."
            : "Không gửi được email. Vui lòng thử lại.",
        )
        return
      }
      router.refresh()
    })
  }

  function handleMarkPaid() {
    setError(null)
    const amount = Number(paidAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Số tiền đã nhận không hợp lệ.")
      return
    }
    startTransition(async () => {
      const result = await markInvoicePaidAction({
        invoiceId: invoice.id,
        paidAmountUsd: amount,
        paymentReference: paidRef.trim() || null,
        paidAt: new Date(paidDate).toISOString(),
      })
      if (!result.ok) {
        setError("Không cập nhật được. Vui lòng thử lại.")
        return
      }
      setPayDialogOpen(false)
      router.refresh()
    })
  }

  function handleStatus(status: "sent" | "cancelled" | "void" | "overdue") {
    setError(null)
    startTransition(async () => {
      const result = await updateInvoiceStatusAction({
        invoiceId: invoice.id,
        status,
      })
      if (!result.ok) {
        setError("Không cập nhật được trạng thái.")
        return
      }
      router.refresh()
    })
  }

  function handleDelete() {
    if (
      !confirm(
        "Xóa hóa đơn này? Chỉ áp dụng với hóa đơn đang ở trạng thái 'Nháp'. " +
          "Hóa đơn đã gửi nên dùng 'Hủy' hoặc 'Void' để giữ lịch sử.",
      )
    ) {
      return
    }
    startTransition(async () => {
      const result = await deleteInvoiceAction(invoice.id)
      if (!result.ok) {
        setError(
          result.error === "only_draft_deletable"
            ? "Chỉ có thể xóa hóa đơn ở trạng thái 'Nháp'."
            : "Không xóa được.",
        )
        return
      }
      router.push("/admin/finance/invoices")
      router.refresh()
    })
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  const canMarkPaid =
    invoice.status !== "paid" &&
    invoice.status !== "cancelled" &&
    invoice.status !== "void"

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSendEmail}
          disabled={pending || !!invoice.paid_at}
          className="gap-2"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          {invoice.email_sent_at ? "Gửi lại email" : "Gửi email cho khách"}
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={() => setPayDialogOpen(true)}
          disabled={pending || !canMarkPaid}
          className="gap-2"
        >
          <Check className="h-3.5 w-3.5" />
          Xác nhận đã thanh toán
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopyLink}
          className="gap-2"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-primary" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Đã copy" : "Copy link khách"}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.print()}
          className="gap-2"
        >
          <Printer className="h-3.5 w-3.5" />
          In
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={pending}>
              Thao tác khác
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {invoice.status === "draft" && (
              <DropdownMenuItem onClick={() => handleStatus("sent")}>
                <Mail className="h-3.5 w-3.5" />
                Đánh dấu đã gửi
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => handleStatus("overdue")}>
              Đánh dấu quá hạn
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatus("cancelled")}>
              <XCircle className="h-3.5 w-3.5" />
              Hủy hóa đơn
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatus("void")}>
              Vô hiệu (void)
            </DropdownMenuItem>
            {invoice.status === "draft" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Xóa hóa đơn
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {error && (
        <p className="w-full text-sm text-destructive">{error}</p>
      )}

      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận đã nhận thanh toán</DialogTitle>
            <DialogDescription>
              Nhập thông tin đối soát từ app ngân hàng. Hệ thống sẽ chuyển hóa đơn
              sang trạng thái <strong>Đã thu</strong> và ghi nhận vào dòng tiền.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paid-amount">Số tiền đã nhận (USD)</Label>
              <Input
                id="paid-amount"
                type="number"
                step="0.01"
                min="0"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paid-date">Ngày nhận</Label>
              <Input
                id="paid-date"
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paid-ref">Mã giao dịch / tham chiếu</Label>
              <Input
                id="paid-ref"
                value={paidRef}
                onChange={(e) => setPaidRef(e.target.value)}
                placeholder="VD: FT240101XYZ"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPayDialogOpen(false)}
              disabled={pending}
            >
              Hủy
            </Button>
            <Button onClick={handleMarkPaid} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
