import "server-only"

import { getFromAddress, getResend } from "@/lib/email/resend"
import { buildVietQrImageUrl, usdToVnd } from "@/lib/finance/vietqr"
import { formatUsd, formatVnd, formatDate } from "@/lib/finance/format"
import { INVOICE_KIND_LABELS } from "@/lib/finance/types"
import { loadFinanceSettings } from "@/lib/finance/settings"
import { createAdminClient } from "@/lib/supabase/admin"
import type { FinanceSettings, Invoice, Profile } from "@/lib/supabase/types"

type InvoiceWithRecipient = Invoice & {
  profiles:
    | (Pick<Profile, "id" | "full_name" | "company_name" | "email"> & {
        preferred_language?: "vi" | "en"
      })
    | null
}

/**
 * Convenience wrapper for callers that only know the invoice id (e.g. the
 * invoice-overdue cron). Fetches the invoice + client profile and sends the
 * email. The `reminder` flag prepends "[Reminder]" to the subject via the
 * settings snapshot; otherwise behaves identically to sendInvoiceEmail.
 */
export async function sendInvoiceEmailById(
  invoiceId: string,
  opts: { reminder?: boolean } = {},
): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("invoices" as never)
    .select(
      "*, profiles:client_id (id, full_name, company_name, email, preferred_language)",
    )
    .eq("id", invoiceId)
    .single()

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "invoice_not_found",
    }
  }
  const invoice = data as unknown as InvoiceWithRecipient
  const settings = await loadFinanceSettings()
  return sendInvoiceEmail({ invoice, settings, reminder: opts.reminder })
}

function publicInvoiceUrl(token: string): string {
  let base: string
  if (process.env.NEXT_PUBLIC_APP_URL) {
    base = process.env.NEXT_PUBLIC_APP_URL
  } else if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    base = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  } else {
    base = "http://localhost:3000"
  }
  return `${base}/invoice/${token}`
}

export async function sendInvoiceEmail(args: {
  invoice: InvoiceWithRecipient
  settings: FinanceSettings | null
  reminder?: boolean
}): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  const { invoice, settings, reminder } = args
  const toEmail = invoice.profiles?.email
  if (!toEmail) return { ok: false, error: "recipient_missing_email" }

  const lang = invoice.profiles?.preferred_language ?? "vi"
  const bank = invoice.bank_snapshot ?? {
    bank_name: settings?.bank_name ?? null,
    bank_account_no: settings?.bank_account_no ?? null,
    bank_account_name: settings?.bank_account_name ?? null,
    bank_bin: settings?.bank_bin ?? null,
    bank_swift_code: settings?.bank_swift_code ?? null,
  }
  const issuer = invoice.issuer_snapshot ?? {
    company_name: settings?.company_name ?? null,
    company_address: null,
    company_tax_id: null,
    company_email: null,
    company_phone: null,
  }

  const vnd = usdToVnd(Number(invoice.net_amount_usd), Number(invoice.fx_rate_vnd_per_usd))
  const qrUrl =
    bank.bank_bin && bank.bank_account_no
      ? buildVietQrImageUrl({
          bankBin: bank.bank_bin,
          accountNo: bank.bank_account_no,
          accountName: bank.bank_account_name,
          amountVnd: vnd,
          memo: invoice.invoice_number,
        })
      : null

  const kindLabel = INVOICE_KIND_LABELS[invoice.kind][lang]
  const recipient =
    invoice.profiles?.company_name ??
    invoice.profiles?.full_name ??
    toEmail

  const reminderPrefix = reminder ? (lang === "vi" ? "[Nhắc] " : "[Reminder] ") : ""
  const subject =
    lang === "vi"
      ? `${reminderPrefix}[${invoice.invoice_number}] Hóa đơn ${kindLabel} từ ${
          issuer.company_name ?? "VXB"
        }`
      : `${reminderPrefix}[${invoice.invoice_number}] ${kindLabel} invoice from ${
          issuer.company_name ?? "VXB"
        }`

  const html = renderInvoiceEmailHtml({
    lang,
    invoiceNumber: invoice.invoice_number,
    recipient,
    issuerName: issuer.company_name ?? "Vexim Bridge",
    kindLabel,
    amountUsd: formatUsd(Number(invoice.net_amount_usd)),
    amountVnd: vnd != null ? formatVnd(vnd) : null,
    dueDate: formatDate(invoice.due_date, lang),
    bankName: bank.bank_name,
    bankAccountNo: bank.bank_account_no,
    bankAccountName: bank.bank_account_name,
    memo: invoice.invoice_number,
    qrUrl,
    publicUrl: publicInvoiceUrl(invoice.public_token),
  })

  try {
    const resend = getResend()
    const res = await resend.emails.send({
      from: getFromAddress(),
      to: toEmail,
      subject,
      html,
    })
    return { ok: true, id: res.data?.id ?? null }
  } catch (e) {
    console.error("[v0] sendInvoiceEmail failed", e)
    return {
      ok: false,
      error: e instanceof Error ? e.message : "resend_error",
    }
  }
}

function renderInvoiceEmailHtml(args: {
  lang: "vi" | "en"
  invoiceNumber: string
  recipient: string
  issuerName: string
  kindLabel: string
  amountUsd: string
  amountVnd: string | null
  dueDate: string
  bankName: string | null
  bankAccountNo: string | null
  bankAccountName: string | null
  memo: string
  qrUrl: string | null
  publicUrl: string
}): string {
  const t =
    args.lang === "vi"
      ? {
          greeting: `Kính gửi ${args.recipient},`,
          intro: `Cảm ơn quý đối tác đã đồng hành cùng ${args.issuerName}. Vui lòng tìm thông tin thanh toán cho hóa đơn bên dưới.`,
          invoiceLabel: "Số hóa đơn",
          kindLabel: "Loại phí",
          amountLabel: "Số tiền",
          dueLabel: "Hạn thanh toán",
          bankLabel: "Thông tin chuyển khoản",
          bankName: "Ngân hàng",
          accountNo: "Số tài khoản",
          accountName: "Chủ tài khoản",
          memoLabel: "Nội dung chuyển khoản",
          qrHint: "Quét mã QR bằng app ngân hàng để tự động điền toàn bộ thông tin:",
          viewPdf: "Xem hóa đơn chi tiết",
          signoff: `Trân trọng,\nĐội ngũ ${args.issuerName}`,
          note:
            "Sau khi chuyển khoản, vui lòng gửi lại email xác nhận hoặc giữ biên lai. Chúng tôi sẽ cập nhật trạng thái hóa đơn sau khi tiền về.",
        }
      : {
          greeting: `Dear ${args.recipient},`,
          intro: `Thank you for partnering with ${args.issuerName}. Below are the payment details for your latest invoice.`,
          invoiceLabel: "Invoice",
          kindLabel: "Type",
          amountLabel: "Amount due",
          dueLabel: "Due by",
          bankLabel: "Wire / transfer details",
          bankName: "Bank",
          accountNo: "Account number",
          accountName: "Account holder",
          memoLabel: "Payment memo",
          qrHint: "Scan the QR with any Vietnamese banking app — amount and memo auto-fill:",
          viewPdf: "View the full invoice",
          signoff: `Best regards,\nThe ${args.issuerName} team`,
          note:
            "After wiring the amount, please reply with a screenshot or keep the receipt. We will flip the invoice status to 'paid' as soon as the funds arrive.",
        }

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:620px;margin:0 auto;padding:24px;color:#111">
  <p>${t.greeting}</p>
  <p style="color:#555">${t.intro}</p>

  <table style="width:100%;border-collapse:collapse;margin:24px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
    <tbody>
      <tr>
        <td style="padding:12px 16px;background:#f9fafb;width:40%;color:#6b7280;font-size:14px">${t.invoiceLabel}</td>
        <td style="padding:12px 16px;font-weight:600">${args.invoiceNumber}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;background:#f9fafb;color:#6b7280;font-size:14px">${t.kindLabel}</td>
        <td style="padding:12px 16px">${args.kindLabel}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;background:#f9fafb;color:#6b7280;font-size:14px">${t.amountLabel}</td>
        <td style="padding:12px 16px;font-weight:600">
          ${args.amountUsd}${args.amountVnd ? ` <span style="color:#6b7280;font-weight:400">(≈ ${args.amountVnd})</span>` : ""}
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;background:#f9fafb;color:#6b7280;font-size:14px">${t.dueLabel}</td>
        <td style="padding:12px 16px">${args.dueDate}</td>
      </tr>
    </tbody>
  </table>

  ${args.qrUrl ? `<p style="color:#555;margin-bottom:8px">${t.qrHint}</p>
  <div style="text-align:center;margin:16px 0"><img src="${args.qrUrl}" alt="VietQR ${args.invoiceNumber}" style="max-width:280px;height:auto;border:1px solid #e5e7eb;border-radius:8px"/></div>` : ""}

  <h3 style="margin-top:24px;margin-bottom:12px;font-size:16px">${t.bankLabel}</h3>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <tbody>
      ${args.bankName ? `<tr><td style="padding:6px 0;color:#6b7280;width:40%">${t.bankName}</td><td style="padding:6px 0">${args.bankName}</td></tr>` : ""}
      ${args.bankAccountNo ? `<tr><td style="padding:6px 0;color:#6b7280">${t.accountNo}</td><td style="padding:6px 0;font-family:monospace">${args.bankAccountNo}</td></tr>` : ""}
      ${args.bankAccountName ? `<tr><td style="padding:6px 0;color:#6b7280">${t.accountName}</td><td style="padding:6px 0">${args.bankAccountName}</td></tr>` : ""}
      <tr><td style="padding:6px 0;color:#6b7280">${t.memoLabel}</td><td style="padding:6px 0;font-family:monospace">${args.memo}</td></tr>
    </tbody>
  </table>

  <p style="margin-top:24px"><a href="${args.publicUrl}" style="display:inline-block;padding:10px 16px;background:#111827;color:white;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500">${t.viewPdf}</a></p>

  <p style="color:#6b7280;font-size:13px;margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb">${t.note}</p>

  <p style="color:#6b7280;font-size:13px;white-space:pre-line">${t.signoff}</p>
</div>`
}
