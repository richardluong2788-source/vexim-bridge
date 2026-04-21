"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatVnd } from "@/lib/finance/format"
import { INVOICE_KIND_LABELS } from "@/lib/finance/types"
import { createManualInvoiceAction } from "@/app/admin/finance/invoices/actions"
import type {
  BillingPlan,
  InvoiceKind,
  Profile,
} from "@/lib/supabase/types"

interface Props {
  clients: Pick<Profile, "id" | "full_name" | "company_name" | "email">[]
  plans: (Pick<
    BillingPlan,
    | "id"
    | "client_id"
    | "plan_name"
    | "setup_fee_usd"
    | "monthly_retainer_usd"
    | "status"
  >)[]
  defaultFxRate: number
}

type KindOption = Exclude<InvoiceKind, "success_fee">

const KIND_OPTIONS: KindOption[] = ["setup_fee", "retainer", "manual"]

export function NewInvoiceForm({ clients, plans, defaultFxRate }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [kind, setKind] = useState<KindOption>("manual")
  const [clientId, setClientId] = useState(clients[0]?.id ?? "")
  const [planId, setPlanId] = useState<string>("")
  const [amount, setAmount] = useState("")
  const [fxRate, setFxRate] = useState(String(defaultFxRate))
  const [issueDate, setIssueDate] = useState(
    new Date().toISOString().slice(0, 10),
  )
  const [dueDate, setDueDate] = useState("")
  const [periodStart, setPeriodStart] = useState("")
  const [periodEnd, setPeriodEnd] = useState("")
  const [memo, setMemo] = useState("")
  const [notes, setNotes] = useState("")
  const [sendNow, setSendNow] = useState(true)

  const clientPlans = useMemo(
    () => plans.filter((p) => p.client_id === clientId && p.status === "active"),
    [plans, clientId],
  )

  // Auto-fill amount when a plan is selected based on the kind.
  function onPlanChange(id: string) {
    setPlanId(id)
    const plan = plans.find((p) => p.id === id)
    if (!plan) return
    if (kind === "setup_fee" && plan.setup_fee_usd != null) {
      setAmount(String(plan.setup_fee_usd))
    } else if (kind === "retainer" && plan.monthly_retainer_usd != null) {
      setAmount(String(plan.monthly_retainer_usd))
    }
  }

  const amountNum = Number(amount)
  const fxNum = Number(fxRate) || defaultFxRate
  const vndPreview =
    Number.isFinite(amountNum) && amountNum > 0 ? amountNum * fxNum : null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!clientId) {
      setError("Vui lòng chọn khách hàng.")
      return
    }
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError("Số tiền phải lớn hơn 0.")
      return
    }

    startTransition(async () => {
      const result = await createManualInvoiceAction({
        kind,
        client_id: clientId,
        billing_plan_id: planId || null,
        amount_usd: amountNum,
        fx_rate_vnd_per_usd: Number(fxRate) || null,
        issue_date: issueDate || undefined,
        due_date: dueDate || undefined,
        period_start: periodStart || null,
        period_end: periodEnd || null,
        memo: memo.trim() || null,
        notes: notes.trim() || null,
        status: sendNow ? "sent" : "draft",
      })

      if (!result.ok) {
        setError(
          result.error === "invalid_amount"
            ? "Số tiền không hợp lệ."
            : result.error === "missing_client"
              ? "Vui lòng chọn khách hàng."
              : "Không tạo được hóa đơn. Vui lòng thử lại.",
        )
        return
      }
      router.push(`/admin/finance/invoices/${result.id}`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Thông tin hóa đơn</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-kind">
                Loại phí <span className="text-destructive">*</span>
              </Label>
              <Select value={kind} onValueChange={(v) => setKind(v as KindOption)}>
                <SelectTrigger id="inv-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {INVOICE_KIND_LABELS[k].vi}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">
                Phí thành công được sinh tự động khi deal chuyển sang giai đoạn
                &ldquo;đã ship&rdquo;.
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-client">
                Khách hàng <span className="text-destructive">*</span>
              </Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger id="inv-client">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company_name ?? c.full_name ?? c.email ?? c.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {clientPlans.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-plan">Gói dịch vụ áp dụng (nếu có)</Label>
              <Select value={planId || "__none__"} onValueChange={(v) => onPlanChange(v === "__none__" ? "" : v)}>
                <SelectTrigger id="inv-plan">
                  <SelectValue placeholder="Không liên kết gói cụ thể" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Không liên kết</SelectItem>
                  {clientPlans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.plan_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-amount">
                Số tiền (USD) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="inv-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              {vndPreview != null && (
                <span className="text-xs text-muted-foreground">
                  ≈ {formatVnd(vndPreview)}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-fx">Tỷ giá VND/USD</Label>
              <Input
                id="inv-fx"
                type="number"
                step="1"
                min="0"
                value={fxRate}
                onChange={(e) => setFxRate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-issue">Ngày phát hành</Label>
              <Input
                id="inv-issue"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-due">Hạn thanh toán</Label>
              <Input
                id="inv-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              <span className="text-xs text-muted-foreground">
                Bỏ trống để dùng mặc định từ Finance Settings.
              </span>
            </div>
          </div>

          {kind === "retainer" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inv-ps">Kỳ tính phí - bắt đầu</Label>
                <Input
                  id="inv-ps"
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inv-pe">Kỳ tính phí - kết thúc</Label>
                <Input
                  id="inv-pe"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inv-memo">Mô tả (hiện trên hóa đơn)</Label>
            <Input
              id="inv-memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="VD: Phí duy trì tháng 01/2026"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inv-notes">Ghi chú nội bộ</Label>
            <Textarea
              id="inv-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              id="inv-send"
              type="checkbox"
              checked={sendNow}
              onChange={(e) => setSendNow(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="inv-send" className="text-sm font-normal">
              Đánh dấu là &ldquo;Đã gửi&rdquo; ngay sau khi tạo (vẫn cần bấm nút
              gửi email ở trang chi tiết để thực sự gửi).
            </Label>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive border border-destructive/30">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={pending}
        >
          Hủy
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Tạo hóa đơn
        </Button>
      </div>
    </form>
  )
}
