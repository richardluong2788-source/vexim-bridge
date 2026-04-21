/**
 * Printable / shareable invoice view.
 * Used by:
 *   - /admin/finance/invoices/[id]           (admin preview)
 *   - /invoice/[token]                        (public client view)
 *
 * Kept as a pure Server Component (no state) so it can be rendered
 * deeply inside static server pages and printed via the browser.
 */
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { buildVietQrImageUrl, usdToVnd } from "@/lib/finance/vietqr"
import { formatDate, formatUsd, formatUsdAmount, formatVnd } from "@/lib/finance/format"
import {
  INVOICE_KIND_LABELS,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_VARIANT,
  findBankByBin,
} from "@/lib/finance/types"
import type { Invoice, Profile } from "@/lib/supabase/types"

interface Props {
  invoice: Invoice
  client: Pick<Profile, "full_name" | "company_name" | "email"> | null
  locale?: "vi" | "en"
}

export function InvoicePrintable({ invoice, client, locale = "vi" }: Props) {
  const issuer = invoice.issuer_snapshot
  const bank = invoice.bank_snapshot
  const vnd = usdToVnd(
    Number(invoice.net_amount_usd),
    Number(invoice.fx_rate_vnd_per_usd),
  )
  const qrUrl =
    bank?.bank_bin && bank.bank_account_no
      ? buildVietQrImageUrl({
          bankBin: bank.bank_bin,
          accountNo: bank.bank_account_no,
          accountName: bank.bank_account_name,
          amountVnd: vnd,
          memo: invoice.invoice_number,
        })
      : null

  const bankMeta = findBankByBin(bank?.bank_bin)
  const kindLabel = INVOICE_KIND_LABELS[invoice.kind][locale]
  const amount = Number(invoice.amount_usd)
  const credit = Number(invoice.credit_applied_usd)
  const net = Number(invoice.net_amount_usd)

  return (
    <Card className="border-border print:shadow-none print:border-0">
      <CardContent className="p-8 print:p-0 flex flex-col gap-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex flex-col gap-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {locale === "vi" ? "Từ" : "From"}
            </p>
            <p className="text-lg font-semibold text-foreground">
              {issuer?.company_name ?? "Vexim Bridge"}
            </p>
            {issuer?.company_address && (
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {issuer.company_address}
              </p>
            )}
            <div className="flex gap-3 text-xs text-muted-foreground mt-1">
              {issuer?.company_email && <span>{issuer.company_email}</span>}
              {issuer?.company_phone && <span>· {issuer.company_phone}</span>}
            </div>
            {issuer?.company_tax_id && (
              <p className="text-xs text-muted-foreground">
                {locale === "vi" ? "MST" : "Tax ID"}: {issuer.company_tax_id}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-1">
            <h1 className="text-3xl font-semibold text-foreground tracking-tight">
              {locale === "vi" ? "HÓA ĐƠN" : "INVOICE"}
            </h1>
            <p className="font-mono text-sm text-muted-foreground">
              {invoice.invoice_number}
            </p>
            <Badge variant={INVOICE_STATUS_VARIANT[invoice.status]}>
              {INVOICE_STATUS_LABELS[invoice.status][locale]}
            </Badge>
          </div>
        </div>

        <Separator />

        {/* Bill to + meta */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {locale === "vi" ? "Gửi tới" : "Bill to"}
            </p>
            <p className="text-base font-medium text-foreground">
              {client?.company_name ?? client?.full_name ?? "—"}
            </p>
            {client?.full_name && client?.company_name && (
              <p className="text-sm text-muted-foreground">{client.full_name}</p>
            )}
            {client?.email && (
              <p className="text-sm text-muted-foreground">{client.email}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">
                {locale === "vi" ? "Ngày phát hành" : "Issued"}
              </p>
              <p className="font-medium">{formatDate(invoice.issue_date, locale)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {locale === "vi" ? "Hạn thanh toán" : "Due"}
              </p>
              <p className="font-medium">{formatDate(invoice.due_date, locale)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {locale === "vi" ? "Loại phí" : "Type"}
              </p>
              <p className="font-medium">{kindLabel}</p>
            </div>
            {invoice.period_start && invoice.period_end && (
              <div>
                <p className="text-xs text-muted-foreground">
                  {locale === "vi" ? "Kỳ phí" : "Period"}
                </p>
                <p className="font-medium text-xs">
                  {formatDate(invoice.period_start, locale)} –{" "}
                  {formatDate(invoice.period_end, locale)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Line items */}
        <div className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {locale === "vi" ? "Nội dung" : "Description"}
          </p>
          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">
                    {locale === "vi" ? "Mô tả" : "Item"}
                  </th>
                  <th className="text-right px-4 py-2 font-medium w-36">USD</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{kindLabel}</div>
                    {invoice.memo && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {invoice.memo}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatUsdAmount(amount)}
                  </td>
                </tr>
                {credit > 0 && (
                  <tr className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {locale === "vi"
                          ? "Khấu trừ phí duy trì đã đóng"
                          : "Retainer credit applied"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {locale === "vi"
                          ? "Tự động theo điều khoản hợp đồng"
                          : "Automatic per contract terms"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                      −{formatUsdAmount(credit)}
                    </td>
                  </tr>
                )}
                <tr className="border-t border-border bg-muted/30">
                  <td className="px-4 py-3 text-right font-semibold">
                    {locale === "vi" ? "Tổng phải trả" : "Total due"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-base">
                    {formatUsd(net)}
                  </td>
                </tr>
                {vnd != null && (
                  <tr>
                    <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                      {locale === "vi"
                        ? `Tham chiếu @ ${Number(invoice.fx_rate_vnd_per_usd).toLocaleString(
                            "en-US",
                          )} VND/USD`
                        : `Reference @ ${Number(
                            invoice.fx_rate_vnd_per_usd,
                          ).toLocaleString("en-US")} VND/USD`}
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-muted-foreground font-mono">
                      ≈ {formatVnd(vnd)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 flex flex-col gap-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {locale === "vi" ? "Hướng dẫn thanh toán" : "Payment instructions"}
            </p>
            <div className="flex flex-col gap-2 text-sm">
              {bank?.bank_name && (
                <Row
                  label={locale === "vi" ? "Ngân hàng" : "Bank"}
                  value={
                    bankMeta ? `${bankMeta.name} (${bank.bank_name})` : bank.bank_name
                  }
                />
              )}
              {bank?.bank_account_no && (
                <Row
                  label={locale === "vi" ? "Số tài khoản" : "Account number"}
                  value={bank.bank_account_no}
                  mono
                />
              )}
              {bank?.bank_account_name && (
                <Row
                  label={locale === "vi" ? "Chủ tài khoản" : "Account holder"}
                  value={bank.bank_account_name}
                />
              )}
              {bank?.bank_swift_code && (
                <Row label="SWIFT" value={bank.bank_swift_code} mono />
              )}
              <Row
                label={locale === "vi" ? "Nội dung CK" : "Memo"}
                value={invoice.invoice_number}
                mono
                highlight
              />
            </div>

            {invoice.notes && (
              <div className="mt-2 rounded-md bg-muted/40 p-3 text-sm text-muted-foreground whitespace-pre-line">
                {invoice.notes}
              </div>
            )}
          </div>

          {qrUrl && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                VietQR
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrUrl}
                alt={`VietQR ${invoice.invoice_number}`}
                className="w-full max-w-[220px] rounded-md border border-border"
              />
              <p className="text-xs text-muted-foreground text-center text-pretty">
                {locale === "vi"
                  ? "Quét bằng app ngân hàng để điền sẵn số tiền và nội dung."
                  : "Scan with any Vietnamese banking app to auto-fill amount & memo."}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function Row({
  label,
  value,
  mono,
  highlight,
}: {
  label: string
  value: string
  mono?: boolean
  highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={[
          mono ? "font-mono" : "",
          highlight ? "text-primary font-semibold" : "font-medium",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  )
}
