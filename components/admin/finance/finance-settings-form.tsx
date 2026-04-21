"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { saveFinanceSettings } from "@/app/admin/finance/settings/actions"
import type { FinanceSettings } from "@/lib/supabase/types"

export function FinanceSettingsForm({
  initial,
}: {
  initial: FinanceSettings | null
}) {
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState(() => ({
    invoice_prefix: initial?.invoice_prefix ?? "VXB",
    default_fx_rate_vnd_per_usd: initial?.default_fx_rate_vnd_per_usd ?? 25000,
    default_payment_terms_days: initial?.default_payment_terms_days ?? 7,
    company_name: initial?.company_name ?? "",
    company_address: initial?.company_address ?? "",
    company_tax_id: initial?.company_tax_id ?? "",
    company_email: initial?.company_email ?? "",
    company_phone: initial?.company_phone ?? "",
    bank_name: initial?.bank_name ?? "",
    bank_account_no: initial?.bank_account_no ?? "",
    bank_account_name: initial?.bank_account_name ?? "",
    bank_bin: initial?.bank_bin ?? "",
    bank_swift_code: initial?.bank_swift_code ?? "",
  }))

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await saveFinanceSettings({
        ...form,
        default_fx_rate_vnd_per_usd: Number(form.default_fx_rate_vnd_per_usd),
        default_payment_terms_days: Number(form.default_payment_terms_days),
      })
      if (res.ok) {
        toast.success("Đã lưu cài đặt tài chính")
      } else {
        toast.error(res.error ?? "Không thể lưu")
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* General */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold mb-4">Thiết lập chung</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="invoice_prefix">Prefix hóa đơn</Label>
            <Input
              id="invoice_prefix"
              value={form.invoice_prefix}
              onChange={(e) => set("invoice_prefix", e.target.value)}
              maxLength={8}
            />
            <p className="text-xs text-muted-foreground mt-1">
              VD: VXB → VXB-2026-0001
            </p>
          </div>
          <div>
            <Label htmlFor="fx">Tỷ giá VND/USD</Label>
            <Input
              id="fx"
              type="number"
              min={1000}
              step={100}
              value={form.default_fx_rate_vnd_per_usd}
              onChange={(e) =>
                set("default_fx_rate_vnd_per_usd", Number(e.target.value))
              }
            />
            <p className="text-xs text-muted-foreground mt-1">
              Áp dụng cho hóa đơn mới
            </p>
          </div>
          <div>
            <Label htmlFor="terms">Hạn thanh toán (ngày)</Label>
            <Input
              id="terms"
              type="number"
              min={0}
              max={90}
              value={form.default_payment_terms_days}
              onChange={(e) =>
                set("default_payment_terms_days", Number(e.target.value))
              }
            />
          </div>
        </div>
      </Card>

      {/* Company info */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold mb-4">Thông tin công ty (phát hành hóa đơn)</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="company_name">Tên công ty</Label>
            <Input
              id="company_name"
              value={form.company_name}
              onChange={(e) => set("company_name", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="company_tax_id">Mã số thuế</Label>
            <Input
              id="company_tax_id"
              value={form.company_tax_id}
              onChange={(e) => set("company_tax_id", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="company_address">Địa chỉ</Label>
            <Input
              id="company_address"
              value={form.company_address}
              onChange={(e) => set("company_address", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="company_email">Email</Label>
            <Input
              id="company_email"
              type="email"
              value={form.company_email}
              onChange={(e) => set("company_email", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="company_phone">Số điện thoại</Label>
            <Input
              id="company_phone"
              value={form.company_phone}
              onChange={(e) => set("company_phone", e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Bank */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold mb-1">Tài khoản nhận thanh toán</h2>
        <p className="text-xs text-muted-foreground mb-4">
          VietQR sẽ được sinh từ <b>BIN</b> ngân hàng và số tài khoản. Tra cứu
          BIN tại{" "}
          <a
            href="https://api.vietqr.io/v2/banks"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            api.vietqr.io/v2/banks
          </a>
          .
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="bank_name">Tên ngân hàng</Label>
            <Input
              id="bank_name"
              value={form.bank_name}
              onChange={(e) => set("bank_name", e.target.value)}
              placeholder="Vietcombank"
            />
          </div>
          <div>
            <Label htmlFor="bank_bin">Mã BIN</Label>
            <Input
              id="bank_bin"
              value={form.bank_bin}
              onChange={(e) => set("bank_bin", e.target.value)}
              placeholder="970436"
              maxLength={8}
            />
          </div>
          <div>
            <Label htmlFor="bank_account_no">Số tài khoản</Label>
            <Input
              id="bank_account_no"
              value={form.bank_account_no}
              onChange={(e) => set("bank_account_no", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="bank_account_name">Tên chủ tài khoản</Label>
            <Input
              id="bank_account_name"
              value={form.bank_account_name}
              onChange={(e) => set("bank_account_name", e.target.value)}
              placeholder="VEXIM BRIDGE CO LTD"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="bank_swift_code">SWIFT code (cho thanh toán quốc tế)</Label>
            <Input
              id="bank_swift_code"
              value={form.bank_swift_code}
              onChange={(e) => set("bank_swift_code", e.target.value)}
              placeholder="BFTVVNVX"
            />
          </div>
        </div>
      </Card>

      <Separator />

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending} className="gap-2">
          {pending && <Spinner className="h-4 w-4" />}
          Lưu cài đặt
        </Button>
      </div>
    </form>
  )
}
