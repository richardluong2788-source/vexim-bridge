import "server-only"

import { readFileSync } from "node:fs"
import path from "node:path"
import fontkit from "@pdf-lib/fontkit"
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib"
import type { PreferredLanguage, Stage, WeeklyReportPayload } from "@/lib/supabase/types"

/**
 * Weekly report PDF renderer.
 *
 * Produces a clean, client-facing A4 PDF with:
 *   - branded header (Vexim Trade, dark slate + teal accent)
 *   - KPI cards row
 *   - pipeline-by-stage horizontal bar chart
 *   - recent leads table (buyer names pre-masked by the data layer)
 *   - this-week activity chips (bottom, above the footer)
 *   - footer with confidentiality note
 *
 * Fonts: Be Vietnam Pro (SIL OFL 1.1, bundled in /public/fonts) — full
 * Vietnamese diacritic coverage. Loaded from public/ because Vercel
 * includes public assets in the serverless bundle.
 */

// ---------------------------------------------------------------------------
// Fonts (loaded once per server instance)
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
// Palette — mirrors the email template + dashboard chart colors
// ---------------------------------------------------------------------------

const INK = rgb(0.06, 0.09, 0.16) // #0F172A dark slate
const MUTED = rgb(0.42, 0.45, 0.5) // #6B7280
const FAINT = rgb(0.89, 0.91, 0.94) // #E2E8F0 borders
const SOFT = rgb(0.97, 0.98, 0.99) // #F8FAFC panel bg
const TEAL = rgb(0.08, 0.72, 0.65) // #14B8A6 accent
const WHITE = rgb(1, 1, 1)

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

const STAGE_COLOR: Record<Stage, string> = {
  new: "#3b82f6",
  contacted: "#f59e0b",
  sample_requested: "#8b5cf6",
  sample_sent: "#a855f7",
  negotiation: "#f97316",
  price_agreed: "#0ea5e9",
  production: "#6366f1",
  shipped: "#14b8a6",
  won: "#10b981",
  lost: "#ef4444",
}

// ---------------------------------------------------------------------------
// Bilingual labels
// ---------------------------------------------------------------------------

type Dict = Record<string, string>

const LABELS: Record<PreferredLanguage, Dict> = {
  vi: {
    docTitle: "Báo cáo hàng tuần",
    brandBadge: "VEXIM TRADE",
    brandTagline: "Dữ liệu thật — Giá trị thật",
    period: "Kỳ báo cáo",
    preparedFor: "Khách hàng",
    kpiTotal: "Tổng lead",
    kpiActive: "Đang xử lý",
    kpiWon: "Thành công",
    kpiWinRate: "Tỷ lệ thắng",
    activityTitle: "Hoạt động trong tuần",
    newThisWeek: "lead mới trong tuần",
    updatedThisWeek: "lead có tiến triển",
    noActivity: "Không có hoạt động nào trong tuần này.",
    stageTitle: "Phân bổ theo giai đoạn",
    recentTitle: "Lead hoạt động gần đây",
    recentEmpty: "Chưa có lead nào được cập nhật trong tuần.",
    columnBuyer: "Buyer",
    columnStage: "Giai đoạn",
    columnUpdated: "Cập nhật",
    footerNote:
      "Báo cáo được tạo tự động bởi Vexim Trade. Thông tin trong báo cáo mang tính bảo mật.",
    footerGenerated: "Tạo lúc",
    footerSite: "veximtrade.com",
    pageOf: "Trang",
  },
  en: {
    docTitle: "Weekly Report",
    brandBadge: "VEXIM TRADE",
    brandTagline: "Real data — Real value",
    period: "Reporting period",
    preparedFor: "Client",
    kpiTotal: "Total leads",
    kpiActive: "In progress",
    kpiWon: "Won",
    kpiWinRate: "Win rate",
    activityTitle: "This week's activity",
    newThisWeek: "new leads this week",
    updatedThisWeek: "leads progressed",
    noActivity: "No activity during this week.",
    stageTitle: "Pipeline by stage",
    recentTitle: "Recently active leads",
    recentEmpty: "No leads were updated this week.",
    columnBuyer: "Buyer",
    columnStage: "Stage",
    columnUpdated: "Updated",
    footerNote:
      "This report was generated automatically by Vexim Trade. The information contained is confidential.",
    footerGenerated: "Generated",
    footerSite: "veximtrade.com",
    pageOf: "Page",
  },
}

const STAGE_LABEL: Record<PreferredLanguage, Record<Stage, string>> = {
  vi: {
    new: "Mới",
    contacted: "Đã liên hệ",
    sample_requested: "Yêu cầu mẫu",
    sample_sent: "Đã gửi mẫu",
    negotiation: "Đàm phán",
    price_agreed: "Đã chốt giá",
    production: "Đang sản xuất",
    shipped: "Đã giao hàng",
    won: "Thành công",
    lost: "Thất bại",
  },
  en: {
    new: "New",
    contacted: "Contacted",
    sample_requested: "Sample Requested",
    sample_sent: "Sample Sent",
    negotiation: "Negotiation",
    price_agreed: "Price Agreed",
    production: "In Production",
    shipped: "Shipped",
    won: "Won",
    lost: "Lost",
  },
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

const A4: [number, number] = [595.28, 841.89]
const MARGIN = 44
const CONTENT_WIDTH = A4[0] - MARGIN * 2

function truncate(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
  let t = text
  while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, size) > maxWidth) {
    t = t.slice(0, -1)
  }
  return `${t}…`
}

function fmtDateRange(startISO: string, endISO: string, locale: PreferredLanguage): string {
  const start = new Date(`${startISO}T00:00:00`)
  const end = new Date(`${endISO}T00:00:00`)
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }
  const startStr = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", opts).format(start)
  const endStr = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", opts).format(end)
  return locale === "vi" ? `${startStr} – ${endStr}` : `${startStr} – ${endStr}`
}

function fmtDateTime(date: Date, locale: PreferredLanguage): string {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

/** Draw a horizontal bar chart row. Returns the new y cursor. */
function drawStageBar(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  y: number,
  label: string,
  count: number,
  maxCount: number,
  colorHex: string,
): number {
  const barX = MARGIN + 128
  const barMaxWidth = CONTENT_WIDTH - 128 - 40
  const barHeight = 8.5
  const rowGap = 20.5

  // Label (left column)
  const labelSize = 8.5
  page.drawText(truncate(label, font, labelSize, 120), {
    x: MARGIN,
    y: y + 2,
    size: labelSize,
    font,
    color: INK,
  })

  // Track
  page.drawRectangle({
    x: barX,
    y,
    width: barMaxWidth,
    height: barHeight,
    color: FAINT,
  })

  // Fill
  if (count > 0) {
    const w = Math.max(
      4,
      Math.round((count / Math.max(maxCount, 1)) * barMaxWidth),
    )
    page.drawRectangle({
      x: barX,
      y,
      width: w,
      height: barHeight,
      color: hexToRgb(colorHex),
    })
  }

  // Count (right)
  const countText = String(count)
  page.drawText(countText, {
    x: A4[0] - MARGIN - bold.widthOfTextAtSize(countText, 8.5),
    y: y + 2,
    size: 8.5,
    font: bold,
    color: INK,
  })

  return y - rowGap
}

// ---------------------------------------------------------------------------
// Main renderer
// ---------------------------------------------------------------------------

export async function renderWeeklyReportPdf(
  payload: WeeklyReportPayload,
  locale: PreferredLanguage = "vi",
): Promise<Uint8Array> {
  const L = LABELS[locale] ?? LABELS.vi
  const S = STAGE_LABEL[locale] ?? STAGE_LABEL.vi

  const { regular, semibold } = loadFontBytes()
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const font = await pdf.embedFont(regular, { subset: true })
  const bold = await pdf.embedFont(semibold, { subset: true })

  pdf.setTitle(`${L.docTitle} — ${payload.clientName}`)
  pdf.setSubject(fmtDateRange(payload.periodStart, payload.periodEnd, locale))
  pdf.setProducer("Vexim Trade")
  pdf.setCreator("Vexim Trade — Weekly Report")
  pdf.setCreationDate(new Date())

  let page = pdf.addPage(A4)
  let y = A4[1]

  // ---- 1) Header band ------------------------------------------------
  const headerHeight = 118
  page.drawRectangle({ x: 0, y: y - headerHeight, width: A4[0], height: headerHeight, color: INK })
  page.drawRectangle({ x: 0, y: y - headerHeight, width: A4[0], height: 3, color: TEAL })

  page.drawText(L.brandBadge, {
    x: MARGIN,
    y: y - 38,
    size: 10,
    font: bold,
    color: rgb(0.58, 0.64, 0.72),
  })
  page.drawText(L.docTitle, {
    x: MARGIN,
    y: y - 68,
    size: 24,
    font: bold,
    color: WHITE,
  })

  // Client name + period (right-aligned block)
  const periodText = fmtDateRange(payload.periodStart, payload.periodEnd, locale)
  const clientName = truncate(payload.clientName, bold, 11, CONTENT_WIDTH - 180)
  page.drawText(clientName, {
    x: A4[0] - MARGIN - bold.widthOfTextAtSize(clientName, 11),
    y: y - 38,
    size: 11,
    font: bold,
    color: WHITE,
  })
  page.drawText(`${L.period}: ${periodText}`, {
    x: A4[0] - MARGIN - font.widthOfTextAtSize(`${L.period}: ${periodText}`, 9),
    y: y - 55,
    size: 9,
    font,
    color: rgb(0.72, 0.76, 0.82),
  })
  page.drawText(L.brandTagline, {
    x: A4[0] - MARGIN - font.widthOfTextAtSize(L.brandTagline, 8),
    y: y - 70,
    size: 8,
    font,
    color: rgb(0.48, 0.55, 0.64),
  })

  y = y - headerHeight - 34

  // ---- 2) KPI cards ---------------------------------------------------
  const kpis = [
    { label: L.kpiTotal, value: String(payload.totalLeads) },
    { label: L.kpiActive, value: String(payload.activeLeads) },
    { label: L.kpiWon, value: String(payload.wonCount) },
    { label: L.kpiWinRate, value: `${payload.winRate}%` },
  ]

  const cardGap = 10
  const cardWidth = (CONTENT_WIDTH - cardGap * 3) / 4
  const cardHeight = 58
  kpis.forEach((kpi, i) => {
    const x = MARGIN + i * (cardWidth + cardGap)
    page.drawRectangle({
      x,
      y: y - cardHeight,
      width: cardWidth,
      height: cardHeight,
      color: SOFT,
      borderColor: FAINT,
      borderWidth: 1,
    })
    page.drawText(kpi.label.toUpperCase(), {
      x: x + 12,
      y: y - 22,
      size: 7,
      font,
      color: MUTED,
    })
    page.drawText(kpi.value, {
      x: x + 12,
      y: y - 46,
      size: 20,
      font: bold,
      color: INK,
    })
  })

  y = y - cardHeight - 30

  // ---- 3) Pipeline by stage --------------------------------------------
  page.drawText(L.stageTitle, {
    x: MARGIN,
    y,
    size: 12,
    font: bold,
    color: INK,
  })
  y -= 24

  const maxCount = Math.max(...payload.stageCounts.map((s) => s.count), 1)
  for (const { stage, count } of payload.stageCounts) {
    y = drawStageBar(
      page,
      font,
      bold,
      y,
      S[stage],
      count,
      maxCount,
      STAGE_COLOR[stage],
    )
  }

  y -= 12

  // ---- 4) Recent leads table -------------------------------------------
  page.drawText(L.recentTitle, {
    x: MARGIN,
    y,
    size: 12,
    font: bold,
    color: INK,
  })
  y -= 22

  const colBuyerX = MARGIN
  const colStageX = MARGIN + CONTENT_WIDTH - 210
  const colUpdatedX = A4[0] - MARGIN - 78

  if (payload.recentLeads.length === 0) {
    page.drawText(L.recentEmpty, { x: MARGIN, y, size: 9, font, color: MUTED })
    y -= 16
  } else {
    // Header row
    page.drawText(L.columnBuyer.toUpperCase(), { x: colBuyerX, y, size: 7, font, color: MUTED })
    page.drawText(L.columnStage.toUpperCase(), { x: colStageX, y, size: 7, font, color: MUTED })
    page.drawText(L.columnUpdated.toUpperCase(), { x: colUpdatedX, y, size: 7, font, color: MUTED })
    y -= 8
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: A4[0] - MARGIN, y },
      thickness: 1,
      color: FAINT,
    })
    y -= 18

    for (const lead of payload.recentLeads) {
      // Start a new page when running out of room (keep 90pt for footer)
      if (y < 120) {
        page = pdf.addPage(A4)
        y = A4[1] - MARGIN
      }

      const name = truncate(lead.displayName, font, 9.5, colStageX - colBuyerX - 16)
      page.drawText(name, { x: colBuyerX, y, size: 9.5, font, color: INK })

      // Stage chip
      const stageLabel = S[lead.stage]
      const chipWidth = bold.widthOfTextAtSize(stageLabel, 8) + 16
      const color = hexToRgb(STAGE_COLOR[lead.stage])
      page.drawRectangle({
        x: colStageX,
        y: y - 4,
        width: chipWidth,
        height: 16,
        color,
        opacity: 0.14,
      })
      page.drawText(stageLabel, {
        x: colStageX + 8,
        y,
        size: 8,
        font: bold,
        color,
      })

      const updatedText = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
        day: "2-digit",
        month: "2-digit",
      }).format(new Date(lead.updatedAt))
      page.drawText(updatedText, {
        x: colUpdatedX,
        y,
        size: 9,
        font,
        color: MUTED,
      })

      y -= 26
      page.drawLine({
        start: { x: MARGIN, y: y + 8 },
        end: { x: A4[0] - MARGIN, y: y + 8 },
        thickness: 0.5,
        color: FAINT,
      })
      y -= 6
    }
  }

  // ---- 5) This week's activity chips (bottom, above the footer) ---------
  // Needs ~70pt (title + chips); start a fresh page when the table above
  // already filled the current one.
  if (y < 150) {
    page = pdf.addPage(A4)
    y = A4[1] - MARGIN
  }
  y -= 8

  page.drawText(L.activityTitle, {
    x: MARGIN,
    y,
    size: 12,
    font: bold,
    color: INK,
  })
  y -= 22

  if (payload.newThisWeek === 0 && payload.updatedThisWeek === 0) {
    page.drawText(L.noActivity, { x: MARGIN, y, size: 9, font, color: MUTED })
  } else {
    const chips: Array<{ text: string; color: string }> = []
    if (payload.newThisWeek > 0) {
      chips.push({ text: `+${payload.newThisWeek} ${L.newThisWeek}`, color: "#10b981" })
    }
    if (payload.updatedThisWeek > 0) {
      chips.push({ text: `${payload.updatedThisWeek} ${L.updatedThisWeek}`, color: "#0ea5e9" })
    }
    let x = MARGIN
    for (const chip of chips) {
      const textWidth = font.widthOfTextAtSize(chip.text, 9)
      page.drawRectangle({
        x,
        y: y - 6,
        width: textWidth + 20,
        height: 22,
        color: hexToRgb(chip.color),
        opacity: 0.12,
      })
      page.drawText(chip.text, {
        x: x + 10,
        y,
        size: 9,
        font: bold,
        color: hexToRgb(chip.color),
      })
      x += textWidth + 20 + 10
    }
  }

  // ---- 6) Footer on every page ------------------------------------------
  const pages = pdf.getPages()
  pages.forEach((p, i) => {
    const footerY = 40
    p.drawRectangle({ x: 0, y: 0, width: A4[0], height: 2, color: TEAL })
    p.drawText(L.footerNote, {
      x: MARGIN,
      y: footerY - 14,
      size: 7.5,
      font,
      color: MUTED,
    })
    const generated = `${L.footerGenerated}: ${fmtDateTime(new Date(), locale)} · ${L.footerSite}`
    p.drawText(generated, {
      x: A4[0] - MARGIN - font.widthOfTextAtSize(generated, 7.5),
      y: footerY - 14,
      size: 7.5,
      font,
      color: MUTED,
    })
    const pageLabel = `${L.pageOf} ${i + 1}/${pages.length}`
    p.drawText(pageLabel, {
      x: A4[0] / 2 - font.widthOfTextAtSize(pageLabel, 7.5) / 2,
      y: footerY - 26,
      size: 7.5,
      font,
      color: MUTED,
    })
  })

  return pdf.save()
}

// ---------------------------------------------------------------------------
// Filename helper
// ---------------------------------------------------------------------------

/** ASCII-safe download filename, e.g. "Vexim-WeeklyReport-Scafe-2025-09-01.pdf" */
export function weeklyReportFilename(payload: WeeklyReportPayload): string {
  const slug = payload.clientName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/đ/gi, "d")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
  const name = slug || "Client"
  return `Vexim-WeeklyReport-${name}-${payload.weekStart}.pdf`
}
