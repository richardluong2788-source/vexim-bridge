"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, FileText, Loader2, Wallet } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { proposeBillingPlanAction } from "@/app/admin/finance/billing-plans/actions"

export interface SourcingBillingClient {
  id: string
  label: string
  planStatus: "none" | "draft" | "active"
  retainerUsd: number | null
  setupFeeUsd: number | null
  successFeePct: number | null
  outstandingUsd: number
  paidUsd: number
}

type Locale = "vi" | "en"

const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n)

export function SourcingBillingList({
  clients,
  locale,
}: {
  clients: SourcingBillingClient[]
  locale: Locale
}) {
  const tr = (vi: string, en: string) => (locale === "vi" ? vi : en)

  if (clients.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <Wallet className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {tr(
              "Bạn chưa có supplier nào trong danh sách phụ trách. Supplier do bạn tạo sẽ xuất hiện ở đây.",
              "You have no sourced suppliers yet. Suppliers you create will show up here.",
            )}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {clients.map((c) => (
        <SourcingBillingCard key={c.id} client={c} locale={locale} />
      ))}
    </div>
  )
}

function SourcingBillingCard({
  client,
  locale,
}: {
  client: SourcingBillingClient
  locale: Locale
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const tr = (vi: string, en: string) => (locale === "vi" ? vi : en)

  const [setup, setSetup] = useState("")
  const [retainer, setRetainer] = useState("")
  const [success, setSuccess] = useState("10")
  const [anchor, setAnchor] = useState("1")
  const [startDate, setStartDate] = useState("")
  const [notes, setNotes] = useState("")

  const numOrNull = (v: string): number | null => {
    const t = v.trim()
    if (!t) return null
    const n = Number(t)
    return Number.isFinite(n) ? n : null
  }

  function openDialog() {
    setSetup("")
    setRetainer("")
    setSuccess("10")
    setAnchor("1")
    setStartDate("")
    setNotes("")
    setError(null)
    setOpen(true)
  }

  function handlePropose() {
    setError(null)
    startTransition(async () => {
      const result = await proposeBillingPlanAction({
        client_id: client.id,
        plan_name: "Gói tiêu chuẩn",
        setup_fee_usd: numOrNull(setup),
        monthly_retainer_usd: numOrNull(retainer),
        success_fee_percent: numOrNull(success),
        retainer_credit_percent: 50,
        contract_start_date: startDate || null,
        contract_end_date: null,
        billing_anchor_day: Number.parseInt(anchor, 10) || 1,
        fx_rate_vnd_per_usd: null,
        status: "draft",
        notes: notes.trim() || null,
      })

      if (!result.ok) {
        setError(
          result.error === "not_your_client"
            ? tr("Bạn không phụ trách khách hàng này.", "This client is not yours.")
            : result.error === "draft_exists"
              ? tr("Đã có một đề xuất đang chờ duyệt cho khách hàng này.", "This client already has a pending proposal.")
              : tr("Không gửi được đề xuất. Vui lòng thử lại.", "Could not send the proposal. Please try again."),
        )
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  const statusBadge = {
    none: { label: tr("Chưa có hợp đồng", "No contract"), variant: "outline" as const },
    draft: { label: tr("Đề xuất — chờ duyệt", "Proposed — pending"), variant: "secondary" as const },
    active: { label: tr("Đang hoạt động", "Active"), variant: "default" as const },
  }[client.planStatus]

  return (
    <>
      <Card className="border-border">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-foreground">{client.label}</span>
              <Badge variant={statusBadge.variant} className="text-xs">
                {statusBadge.label}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {client.retainerUsd != null && (
                <span>
                  {tr("Retainer", "Retainer")}: {fmtUsd(client.retainerUsd)}/tháng
                </span>
              )}
              {client.setupFeeUsd != null && (
                <span>
                  {tr("Setup", "Setup")}: {fmtUsd(client.setupFeeUsd)}
                </span>
              )}
              {client.successFeePct != null && (
                <span>
                  {tr("Success fee", "Success fee")}: {client.successFeePct}%
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="text-muted-foreground">
                {tr("Chưa thu", "Outstanding")}:{" "}
                <span className={client.outstandingUsd > 0 ? "font-medium text-amber-600 dark:text-amber-400" : "font-medium"}>
                  {fmtUsd(client.outstandingUsd)}
                </span>
              </span>
              <span className="text-muted-foreground">
                {tr("Đã thu", "Paid")}:{" "}
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {fmtUsd(client.paidUsd)}
                </span>
              </span>
            </div>
          </div>

          {client.planStatus === "none" && (
            <Button type="button" onClick={openDialog} className="gap-2 shrink-0">
              <FileText className="h-4 w-4" />
              {tr("Đề xuất hợp đồng", "Propose contract")}
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tr("Đề xuất hợp đồng", "Propose contract")}</DialogTitle>
            <DialogDescription>
              {tr(
                `Điều khoản thương mại cho ${client.label}. Đề xuất sẽ ở trạng thái chờ duyệt — Finance kích hoạt thì hóa đơn retainer hàng tháng mới bắt đầu chạy.`,
                `Commercial terms for ${client.label}. The proposal stays pending — Finance activates it to start monthly retainer billing.`,
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Phí khởi tạo (USD)</Label>
                <Input type="number" inputMode="decimal" step="0.01" min="0" value={setup} onChange={(e) => setSetup(e.target.value)} placeholder="500" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Phí duy trì / tháng (USD)</Label>
                <Input type="number" inputMode="decimal" step="0.01" min="0" value={retainer} onChange={(e) => setRetainer(e.target.value)} placeholder="500" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Phí thành công (%)</Label>
                <Input type="number" inputMode="decimal" step="0.001" min="0" max="100" value={success} onChange={(e) => setSuccess(e.target.value)} placeholder="10" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Ngày chốt invoice (1–28)</Label>
                <Input type="number" min="1" max="28" value={anchor} onChange={(e) => setAnchor(e.target.value)} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Ngày bắt đầu hợp đồng</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Ghi chú hợp đồng</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Điều khoản đặc biệt, điều kiện điều chỉnh phí…" />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="text-pretty">{error}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              {tr("Hủy", "Cancel")}
            </Button>
            <Button onClick={handlePropose} disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tr("Gửi đề xuất", "Send proposal")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
