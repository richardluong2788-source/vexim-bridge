import "server-only"

/**
 * Invoice PDF renderer — hóa đơn PDF chuyên nghiệp cho Vexim Global.
 *
 * Dùng chung pattern với weekly-report-pdf: pdf-lib + fontkit + BeVietnamPro
 * (public/fonts). Layout A4:
 *   1. Header band tối: logo-text VEXIM + số hóa đơn
 *   2. Người bán (issuer snapshot) <-> Người mua (client)
 *   3. Meta: ngày phát hành / hạn thanh toán / kỳ dịch vụ
 *   4. Bảng dịch vụ + thành tiền
 *   5. Tổng kết: tạm tính – tín dụng retainer – CẦN THANH TOÁN (USD) + VND
 *   6. Khối thanh toán: VietQR + thông tin ngân hàng + nội dung chuyển khoản
 *   7. Footer: điều khoản + ghi chú
 */

import { readFileSync } from "node:fs"
import path from "node:path"
import fontkit from "@pdf-lib/fontkit"
import { PDFDocument, rgb, type PDFFont, type PDFImage } from "pdf-lib"
import { buildVietQrImageUrl, usdToVnd } from "@/lib/finance/vietqr"
import { formatUsd, formatVnd, formatDate } from "@/lib/finance/format"
import { INVOICE_KIND_LABELS } from "@/lib/finance/types"
import type { FinanceSettings, Invoice, Profile } from "@/lib/supabase/types"

// ---------------------------------------------------------------------------
// Fonts (BeVietnamPro hỗ trợ tiếng Việt đầy đủ)
// ---------------------------------------------------------------------------

let regularFontBytes: Buffer | null = null
let semiboldFontBytes: Buffer | null = null

function loadFontBytes(): { regular: Buffer; semibold: Buffer } {
  if (!regularFontBytes || !semiboldFontBytes) {
    const dir = path.join(process.cwd(), "public", "fonts")
    regularFontBytes = readFileSync(path.join(dir, "BeVietnamPro-Regular.ttf"))
    semiboldFontBytes = readFileSync(path.join(dir, "BeVietnamPro-SemiBold.ttf"))
  }
  return { regular: regularFontBytes, semibold: semiboldFontBytes }
}

// ---------------------------------------------------------------------------
// Palette — đồng bộ nhận diện với weekly report + app
// ---------------------------------------------------------------------------

const INK = rgb(0.06, 0.09, 0.16) // #0F172A
const MUTED = rgb(0.42, 0.45, 0.5) // #6B7280
const FAINT = rgb(0.89, 0.91, 0.94) // #E2E8F0
const SOFT = rgb(0.97, 0.98, 0.99) // #F8FAFC
const TEAL = rgb(0.08, 0.72, 0.65) // #14B8A6
const WHITE = rgb(1, 1, 1)
const RED = rgb(0.87, 0.25, 0.25)

const A4: [number, number] = [595.28, 841.89]
const MARGIN = 48

export interface InvoicePdfClient {
  company_name?: string | null
  full_name?: string | null
  email?: string | null
}

/**
 * Render hóa đơn PDF. Trả về bytes PDF (Uint8Array).
 * QR VietQR được fetch từ img.vietqr.io — nếu mạng lỗi thì khối QR được bỏ
 * qua (thông tin ngân hàng văn bản vẫn đầy đủ).
 */
export async function renderInvoicePdf(args: {
  invoice: Invoice
  client: InvoicePdfClient | null
  settings: FinanceSettings | null
}): Promise<Uint8Array> {
  const { invoice, client, settings } = args

  const { regular, semibold } = loadFontBytes()
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const font = await pdf.embedFont(regular, { subset: true })
  const bold = await pdf.embedFont(semibold, { subset: true })

  pdf.setTitle(`Hóa đơn ${invoice.invoice_number}`)
  pdf.setProducer("Vexim Global")
  pdf.setCreator("Vexim Global — Invoice")
  pdf.setCreationDate(new Date())

  const page = pdf.addPage(A4)
  const W = A4[0]
  let y = A4[1]

  const text = (
    t: string,
    x: number,
    yy: number,
    opts: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb> } = {},
  ) => {
    page.drawText(t, {
      x,
      y: yy,
      size: opts.size ?? 9,
      font: opts.f ?? font,
      color: opts.color ?? INK,
    })
  }

  const right = (
    t: string,
    xRight: number,
    yy: number,
    opts: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb> } = {},
  ) => {
    const f = opts.f ?? font
    const size = opts.size ?? 9
    text(t, xRight - f.widthOfTextAtSize(t, size), yy, opts)
  }

  // ---- 1) Header band ---------------------------------------------------
  const bandH = 104
  page.drawRectangle({ x: 0, y: y - bandH, width: W, height: bandH, color: INK })
  page.drawRectangle({ x: 0, y: y - bandH, width: W, height: 3, color: TEAL })

  const issuer = invoice.issuer_snapshot ?? {
    company_name: settings?.company_name ?? "CÔNG TY TNHH MỘT THÀNH VIÊN VEXIM GLOBAL",
    company_tax_id: settings?.company_tax_id ?? null,
    company_address: settings?.company_address ?? null,
    company_email: settings?.company_email ?? null,
    company_phone: settings?.company_phone ?? null,
  }
  const companyName =
    (issuer.company_name ?? "CÔNG TY TNHH MỘT THÀNH VIÊN VEXIM GLOBAL").toUpperCase()

  text("VEXIM", MARGIN, y - 44, { size: 20, f: bold, color: WHITE })
  text("GLOBAL", MARGIN + 62, y - 44, { size: 20, f: bold, color: TEAL })
  text("Sourcing & Export Partner — veximtrade.com", MARGIN, y - 60, {
    size: 8,
    color: rgb(0.7, 0.74, 0.8),
  })

  right("HÓA ĐƠN THANH TOÁN", W - MARGIN, y - 44, { size: 13, f: bold, color: WHITE })
  right(`Số: ${invoice.invoice_number}`, W - MARGIN, y - 62, {
    size: 10,
    f: bold,
    color: TEAL,
  })
  right(`Ngày phát hành: ${formatDate(invoice.issue_date, "vi")}`, W - MARGIN, y - 78, {
    size: 8,
    color: rgb(0.7, 0.74, 0.8),
  })
  right(`Hạn thanh toán: ${formatDate(invoice.due_date, "vi")}`, W - MARGIN, y - 90, {
    size: 8,
    color: rgb(0.7, 0.74, 0.8),
  })

  y -= bandH + 26

  // ---- 2) Bên bán / bên mua ---------------------------------------------
  const colW = (W - MARGIN * 2 - 24) / 2
  const xLeft = MARGIN
  const xRight = MARGIN + colW + 24

  text("BÊN BÁN / ISSUER", xLeft, y, { size: 8, f: bold, color: MUTED })
  text("BÊN MUA / BILL TO", xRight, y, { size: 8, f: bold, color: MUTED })
  y -= 14

  const issuerLines = [
    issuer.company_name ?? companyName,
    issuer.company_tax_id ? `MST: ${issuer.company_tax_id}` : null,
    issuer.company_address,
    issuer.company_email,
    issuer.company_phone ? `Tel: ${issuer.company_phone}` : null,
  ].filter((l): l is string => Boolean(l && l.trim()))

  const clientLines = [
    client?.company_name ?? client?.full_name ?? "—",
    client?.full_name && client?.company_name ? `ATTN: ${client.full_name}` : null,
    client?.email ? `Email: ${client.email}` : null,
  ].filter((l): l is string => Boolean(l && l.trim()))

  const rows = Math.max(issuerLines.length, clientLines.length)
  for (let i = 0; i < rows; i++) {
    const iy = y - i * 12
    if (issuerLines[i]) {
      text(issuerLines[i], xLeft, iy, {
        size: 8.5,
        f: i === 0 ? bold : font,
        color: i === 0 ? INK : MUTED,
      })
    }
    if (clientLines[i]) {
      text(clientLines[i], xRight, iy, {
        size: 8.5,
        f: i === 0 ? bold : font,
        color: i === 0 ? INK : MUTED,
      })
    }
  }
  y -= rows * 12 + 20

  // ---- 3) Bảng dịch vụ ---------------------------------------------------
  const kindLabel = INVOICE_KIND_LABELS[invoice.kind]?.vi ?? invoice.kind
  const periodText =
    invoice.period_start && invoice.period_end
      ? `Kỳ dịch vụ: ${formatDate(invoice.period_start, "vi")} – ${formatDate(invoice.period_end, "vi")}`
      : null

  const tableTop = y
  const rowH = 18
  page.drawRectangle({ x: MARGIN, y: tableTop - rowH, width: W - MARGIN * 2, height: rowH, color: SOFT })
  page.drawLine({
    start: { x: MARGIN, y: tableTop - rowH },
    end: { x: W - MARGIN, y: tableTop - rowH },
    thickness: 0.8,
    color: FAINT,
  })
  text("DIỄN GIẢI / DESCRIPTION", MARGIN + 10, tableTop - 13, { size: 8, f: bold, color: MUTED })
  right("THÀNH TIỀN / AMOUNT (USD)", W - MARGIN - 10, tableTop - 13, {
    size: 8,
    f: bold,
    color: MUTED,
  })

  y = tableTop - rowH
  const descLines: Array<{ label: string; bold?: boolean }> = [
    { label: invoice.memo ?? kindLabel, bold: true },
    ...(periodText ? [{ label: periodText }] : []),
    { label: `Loại: ${kindLabel}` },
  ]
  for (const d of descLines) {
    y -= 14
    text(d.label, MARGIN + 10, y, {
      size: 9,
      f: d.bold ? bold : font,
      color: d.bold ? INK : MUTED,
    })
  }
  right(formatUsd(Number(invoice.amount_usd)), W - MARGIN - 10, tableTop - rowH - 14, {
    size: 10,
    f: bold,
  })

  y -= 12
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: W - MARGIN, y },
    thickness: 0.8,
    color: FAINT,
  })
  y -= 8

  // ---- 4) Tổng kết (căn phải) -------------------------------------------
  const totalsX = W - MARGIN
  const labelX = W - MARGIN - 220

  const credit = Number(invoice.credit_applied_usd ?? 0)
  const rows2: Array<{ label: string; value: string; strong?: boolean; color?: ReturnType<typeof rgb> }> = [
    { label: "Tạm tính (Subtotal)", value: formatUsd(Number(invoice.amount_usd)) },
    ...(credit > 0
      ? [
          {
            label: `Tín dụng retainer áp dụng (Credit)`,
            value: `− ${formatUsd(credit)}`,
          },
        ]
      : []),
  ]

  for (const r of rows2) {
    y -= 15
    text(r.label, labelX, y, { size: 9, color: MUTED })
    right(r.value, totalsX, y, { size: 9, f: font })
  }

  // Khối "CẦN THANH TOÁN"
  y -= 34
  const dueBoxH = 30
  page.drawRectangle({ x: labelX - 12, y: y - 2, width: totalsX - labelX + 12, height: dueBoxH, color: INK })
  text("CẦN THANH TOÁN / AMOUNT DUE", labelX, y + 8, { size: 9, f: bold, color: WHITE })
  right(formatUsd(Number(invoice.net_amount_usd)), totalsX - 10, y + 6, {
    size: 13,
    f: bold,
    color: TEAL,
  })

  const vnd = usdToVnd(Number(invoice.net_amount_usd), Number(invoice.fx_rate_vnd_per_usd))
  y -= 14
  right(
    `≈ ${formatVnd(vnd)} (tỷ giá ${Number(invoice.fx_rate_vnd_per_usd).toLocaleString("vi-VN")} đ/USD)`,
    totalsX,
    y,
    { size: 8, color: MUTED },
  )

  // Đã thanh toán stamp
  if (invoice.status === "paid") {
    y -= 16
    right("• ĐÃ THANH TOÁN / PAID", totalsX, y, { size: 10, f: bold, color: TEAL })
  } else if (invoice.status === "overdue") {
    y -= 16
    right("QUÁ HẠN / OVERDUE", totalsX, y, { size: 10, f: bold, color: RED })
  }

  y -= 30

  // ---- 5) Khối thanh toán: VietQR + ngân hàng ----------------------------
  const bank = invoice.bank_snapshot ?? {
    bank_name: settings?.bank_name ?? null,
    bank_account_no: settings?.bank_account_no ?? null,
    bank_account_name: settings?.bank_account_name ?? null,
    bank_bin: settings?.bank_bin ?? null,
    bank_swift_code: settings?.bank_swift_code ?? null,
  }

  let qrImage: PDFImage | null = null
  if (bank.bank_bin && bank.bank_account_no) {
    const qrUrl = buildVietQrImageUrl({
      bankBin: bank.bank_bin,
      accountNo: bank.bank_account_no,
      accountName: bank.bank_account_name ?? null,
      amountVnd: Math.round(Number(vnd ?? 0)) || undefined,
      memo: invoice.invoice_number,
      template: "print",
    })
    if (qrUrl) {
      try {
        const res = await fetch(qrUrl, { cache: "no-store" })
        if (res.ok) {
          qrImage = await pdf.embedPng(await res.arrayBuffer())
        }
      } catch {
        // Không có mạng / VietQR lỗi — vẫn còn thông tin ngân hàng dạng chữ
      }
    }
  }

  const payPanelTop = y
  const payPanelH = qrImage ? 128 : 86
  page.drawRectangle({
    x: MARGIN,
    y: payPanelTop - payPanelH,
    width: W - MARGIN * 2,
    height: payPanelH,
    color: SOFT,
    borderColor: FAINT,
    borderWidth: 1,
  })

  text("THÔNG TIN THANH TOÁN / PAYMENT", MARGIN + 14, payPanelTop - 18, {
    size: 8,
    f: bold,
    color: MUTED,
  })

  let bankY = payPanelTop - 36
  const bankLines = [
    bank.bank_name ? `Ngân hàng: ${bank.bank_name}${bank.bank_swift_code ? ` (SWIFT: ${bank.bank_swift_code})` : ""}` : null,
    bank.bank_account_no ? `Số tài khoản: ${bank.bank_account_no}` : null,
    bank.bank_account_name ? `Chủ tài khoản: ${bank.bank_account_name}` : null,
    `Nội dung chuyển khoản: ${invoice.invoice_number}`,
  ].filter((l): l is string => Boolean(l))
  for (const l of bankLines) {
    text(l, MARGIN + 14, bankY, { size: 8.5 })
    bankY -= 13
  }

  if (qrImage) {
    const qrSize = 96
    page.drawRectangle({
      x: W - MARGIN - qrSize - 12,
      y: payPanelTop - payPanelH + 10,
      width: qrSize + 8,
      height: qrSize + 8,
      color: WHITE,
      borderColor: FAINT,
      borderWidth: 1,
    })
    page.drawImage(qrImage, {
      x: W - MARGIN - qrSize - 8,
      y: payPanelTop - payPanelH + 14,
      width: qrSize,
      height: qrSize,
    })
    text("Quét bằng app ngân hàng", W - MARGIN - qrSize - 8, payPanelTop - payPanelH + 2, {
      size: 6.5,
      color: MUTED,
    })
  }

  y = payPanelTop - payPanelH - 24

  // ---- 6) Footer ----------------------------------------------------------
  page.drawRectangle({ x: 0, y: 0, width: W, height: 34, color: INK })
  text(
    "Cảm ơn Quý khách đã đồng hành cùng Vexim Global. Hóa đơn được tạo tự động bởi hệ thống Vexim Trade.",
    MARGIN,
    20,
    { size: 7.5, color: rgb(0.7, 0.74, 0.8) },
  )
  right("veximtrade.com", W - MARGIN, 20, { size: 7.5, f: bold, color: TEAL })

  if (invoice.notes) {
    text(`Ghi chú: ${invoice.notes}`, MARGIN, y, { size: 8, color: MUTED })
  }

  return pdf.save()
}
