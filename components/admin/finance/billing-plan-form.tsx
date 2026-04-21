"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Loader2 } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
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
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { formatVnd } from "@/lib/finance/format"
import {
  BILLING_PLAN_STATUS_LABELS,
} from "@/lib/finance/types"
import {
  createBillingPlanAction,
  updateBillingPlanAction,
  deleteBillingPlanAction,
  type BillingPlanInput,
} from "@/app/admin/finance/billing-plans/actions"
import type { BillingPlan, BillingPlanStatus, Profile } from "@/lib/supabase/types"

interface Props {
  mode: "create" | "edit"
  clients: Pick<Profile, "id" | "full_name" | "company_name" | "email">[]
  plan?: BillingPlan | null
  defaultFxRate: number
  /** When set, the client selector is locked to this id (e.g. from client detail page) */
  lockClientId?: string
}

function numOrNull(v: string): number | null {
  const t = v.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export function BillingPlanForm({
  mode,
  clients,
  plan,
  defaultFxRate,
  lockClientId,
}: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const [clientId, setClientId] = useState(
    lockClientId ?? plan?.client_id ?? clients[0]?.id ?? "",
  )
  const [planName, setPlanName] = useState(plan?.plan_name ?? "Gói tiêu chuẩn")
  const [setupFee, setSetupFee] = useState(
    plan?.setup_fee_usd != null ? String(plan.setup_fee_usd) : "",
  )
  const [retainer, setRetainer] = useState(
    plan?.monthly_retainer_usd != null ? String(plan.monthly_retainer_usd) : "",
  )
  const [successFee, setSuccessFee] = useState(
    plan?.success_fee_percent != null ? String(plan.success_fee_percent) : "10",
  )
  const [creditPct, setCreditPct] = useState(
    plan?.retainer_credit_percent != null ? String(plan.retainer_credit_percent) : "50",
  )
  const [anchorDay, setAnchorDay] = useState(
    plan?.billing_anchor_day ? String(plan.billing_anchor_day) : "1",
  )
  const [startDate, setStartDate] = useState(plan?.contract_start_date ?? "")
  const [endDate, setEndDate] = useState(plan?.contract_end_date ?? "")
  const [fxRate, setFxRate] = useState(
    plan?.fx_rate_vnd_per_usd != null
      ? String(plan.fx_rate_vnd_per_usd)
      : String(defaultFxRate),
  )
  const [status, setStatus] = useState<BillingPlanStatus>(plan?.status ?? "active")
  const [notes, setNotes] = useState(plan?.notes ?? "")

  const retainerNum = numOrNull(retainer)
  const setupNum = numOrNull(setupFee)
  const fxNum = numOrNull(fxRate) ?? defaultFxRate
  const retainerVnd = retainerNum != null ? retainerNum * fxNum : null
  const setupVnd = setupNum != null ? setupNum * fxNum : null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const input: BillingPlanInput = {
      client_id: clientId,
      plan_name: planName,
      setup_fee_usd: setupNum,
      monthly_retainer_usd: retainerNum,
      success_fee_percent: numOrNull(successFee),
      retainer_credit_percent: numOrNull(creditPct) ?? 50,
      contract_start_date: startDate || null,
      contract_end_date: endDate || null,
      billing_anchor_day: Number.parseInt(anchorDay, 10) || 1,
      fx_rate_vnd_per_usd: numOrNull(fxRate),
      status,
      notes: notes.trim() || null,
    }

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createBillingPlanAction(input)
          : await updateBillingPlanAction(plan!.id, input)

      if (!result.ok) {
        setError(errorMessage(result.error))
        return
      }

      router.push("/admin/finance/billing-plans")
      router.refresh()
    })
  }

  function handleDelete() {
    if (!plan) return
    if (
      !confirm(
        `Xóa gói "${plan.plan_name}"? Thao tác này không thể hoàn tác. ` +
          `Nếu đã có hóa đơn, hãy chuyển sang trạng thái "Đã kết thúc" thay vì xóa.`,
      )
    ) {
      return
    }
    startTransition(async () => {
      const result = await deleteBillingPlanAction(plan.id)
      if (!result.ok) {
        setError(errorMessage(result.error))
        return
      }
      router.push("/admin/finance/billing-plans")
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Thông tin hợp đồng</CardTitle>
          <CardDescription>
            Thiết lập điều khoản tài chính giữa Vexim Bridge và nhà cung cấp Việt Nam.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bp-client">
                Khách hàng <span className="text-destructive">*</span>
              </Label>
              <Select
                value={clientId}
                onValueChange={setClientId}
                disabled={!!lockClientId || mode === "edit"}
              >
                <SelectTrigger id="bp-client">
                  <SelectValue placeholder="Chọn khách hàng" />
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

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bp-name">
                Tên gói <span className="text-destructive">*</span>
              </Label>
              <Input
                id="bp-name"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="VD: Gói Starter, Gói Growth"
                required
              />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bp-setup">Phí khởi tạo (USD)</Label>
              <Input
                id="bp-setup"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={setupFee}
                onChange={(e) => setSetupFee(e.target.value)}
                placeholder="VD: 500"
              />
              {setupVnd != null && (
                <span className="text-xs text-muted-foreground">
                  ≈ {formatVnd(setupVnd)}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bp-retainer">Phí duy trì hàng tháng (USD)</Label>
              <Input
                id="bp-retainer"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={retainer}
                onChange={(e) => setRetainer(e.target.value)}
                placeholder="VD: 500"
              />
              {retainerVnd != null && (
                <span className="text-xs text-muted-foreground">
                  ≈ {formatVnd(retainerVnd)} / tháng
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bp-success">Phí thành công (% lợi nhuận)</Label>
              <Input
                id="bp-success"
                type="number"
                inputMode="decimal"
                step="0.001"
                min="0"
                max="100"
                value={successFee}
                onChange={(e) => setSuccessFee(e.target.value)}
                placeholder="10"
              />
              <span className="text-xs text-muted-foreground">
                Tính trên lợi nhuận biên (profit margin) của mỗi deal thành công.
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bp-credit">% retainer được hoàn khi có deal</Label>
              <Input
                id="bp-credit"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                max="100"
                value={creditPct}
                onChange={(e) => setCreditPct(e.target.value)}
                placeholder="50"
              />
              <span className="text-xs text-muted-foreground">
                Retainer đã đóng sẽ được khấu trừ vào phí thành công theo tỷ lệ này.
              </span>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bp-anchor">Ngày chốt invoice trong tháng</Label>
              <Input
                id="bp-anchor"
                type="number"
                min="1"
                max="28"
                value={anchorDay}
                onChange={(e) => setAnchorDay(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bp-start">Ngày bắt đầu hợp đồng</Label>
              <Input
                id="bp-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bp-end">Ngày kết thúc (nếu có)</Label>
              <Input
                id="bp-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bp-fx">Tỷ giá VND/USD tại thời điểm ký</Label>
              <Input
                id="bp-fx"
                type="number"
                step="1"
                min="0"
                value={fxRate}
                onChange={(e) => setFxRate(e.target.value)}
              />
              <span className="text-xs text-muted-foreground">
                Dùng để tính giá trị VND tham chiếu trên invoice. Không ảnh hưởng
                tỷ giá mặc định toàn hệ thống.
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bp-status">Trạng thái</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as BillingPlanStatus)}
              >
                <SelectTrigger id="bp-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(BILLING_PLAN_STATUS_LABELS) as BillingPlanStatus[]).map(
                    (s) => (
                      <SelectItem key={s} value={s}>
                        {BILLING_PLAN_STATUS_LABELS[s].vi}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">
                Chỉ gói <Badge variant="outline">active</Badge> mới được cron tạo
                hóa đơn tự động hàng tháng.
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bp-notes">Ghi chú hợp đồng</Label>
            <Textarea
              id="bp-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Điều khoản đặc biệt, điều kiện điều chỉnh phí, v.v."
            />
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive border border-destructive/30">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        {mode === "edit" ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleDelete}
            disabled={pending}
          >
            Xóa gói
          </Button>
        ) : (
          <div />
        )}

        <div className="flex gap-2">
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
            {mode === "create" ? "Tạo gói" : "Lưu thay đổi"}
          </Button>
        </div>
      </div>
    </form>
  )
}

function errorMessage(code: string): string {
  switch (code) {
    case "unauthorized":
      return "Bạn không có quyền thực hiện thao tác này."
    case "missing_client":
      return "Vui lòng chọn khách hàng."
    case "missing_plan_name":
      return "Tên gói không được để trống."
    case "invalid_anchor_day":
      return "Ngày chốt invoice phải nằm trong khoảng 1–28."
    case "invalid_credit_percent":
      return "% hoàn retainer phải nằm trong khoảng 0–100."
    case "invalid_success_fee":
      return "% phí thành công phải nằm trong khoảng 0–100."
    case "active_plan_exists":
      return "Khách hàng này đã có một gói đang active. Vui lòng tạm dừng gói cũ trước."
    case "has_invoices":
      return "Gói này đã phát sinh hóa đơn — hãy chuyển sang trạng thái 'Đã kết thúc' thay vì xóa."
    default:
      return "Không lưu được. Vui lòng thử lại."
  }
}
