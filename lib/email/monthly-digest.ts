/**
 * Sprint 3 — Monthly digest email for client portal users.
 *
 * Sent on the 1st of every month (see /api/cron/monthly-digest), summarising
 * the client's pipeline activity over the previous calendar month plus a
 * comparison vs the month before that.
 *
 * Design notes
 * ------------
 *   - Inline-styled HTML, single <table> layout (Gmail / Outlook strip
 *     <style> blocks).
 *   - All copy in Vietnamese — the client portal is VI-first; we keep
 *     a single template instead of branching per locale.
 *   - We intentionally don't list individual buyer names (privacy: a
 *     monthly digest gets archived in Gmail forever).
 */

export interface MonthlyDigestData {
  /** Friendly client name shown in the greeting. */
  clientName: string
  /** Month being summarised — e.g. "Tháng 3, 2026". */
  monthLabel: string
  /** Aggregates for the reporting month. */
  metrics: {
    newOpportunities: number
    won: number
    lost: number
    /** sum(potential_value) of deals that transitioned to "won" in the month, USD. */
    wonValueUsd: number
    /** Snapshot at month end. */
    inProgressCount: number
    /** Win rate over decided deals (won / (won + lost)) as a percentage. */
    winRate: number
    /** Commission paid by this client during the month, USD. */
    commissionPaidUsd: number
  }
  /** Same metrics for the prior month — used to render delta arrows. */
  previous: {
    won: number
    winRate: number
    commissionPaidUsd: number
  }
  appUrl: string
}

/** Format a number as USD with no decimals. */
function usd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  })
}

/**
 * Render a delta as "↑ +12% so với tháng trước" / "↓ -3 deals so với tháng trước".
 * Returns inline HTML so it can sit in a flex row.
 */
function delta(
  current: number,
  previous: number,
  unit: "abs" | "pct",
  noun: string,
): string {
  const diff = current - previous
  if (diff === 0) {
    return `<span style="color:#64748b;font:500 12px/16px sans-serif;">— Giữ nguyên so với tháng trước</span>`
  }
  const arrow = diff > 0 ? "▲" : "▼"
  const tone = diff > 0 ? "#059669" : "#e11d48"
  const value =
    unit === "pct"
      ? `${diff > 0 ? "+" : ""}${diff} điểm`
      : `${diff > 0 ? "+" : ""}${diff.toLocaleString()} ${noun}`
  return `<span style="color:${tone};font:600 12px/16px sans-serif;">${arrow} ${value}</span><span style="color:#64748b;font:500 12px/16px sans-serif;"> so với tháng trước</span>`
}

const HEADER_BG = "#0f172a"
const ACCENT = "#14b8a6"
const TEXT = "#0f172a"
const MUTED = "#64748b"
const BORDER = "#e2e8f0"

export function renderMonthlyDigestHtml(data: MonthlyDigestData): string {
  const { clientName, monthLabel, metrics, previous, appUrl } = data

  const kpiRow = (
    label: string,
    value: string,
    sub: string,
  ) => `
    <td style="padding:14px 16px;border:1px solid ${BORDER};border-radius:6px;background:#ffffff;width:33%;vertical-align:top;">
      <div style="font:600 11px/14px sans-serif;letter-spacing:0.06em;text-transform:uppercase;color:${MUTED};">
        ${escapeHtml(label)}
      </div>
      <div style="font:700 22px/28px sans-serif;color:${TEXT};margin-top:6px;">
        ${value}
      </div>
      <div style="margin-top:4px;">${sub}</div>
    </td>
  `

  const decided = metrics.won + metrics.lost
  const winRateDisplay = decided > 0 ? `${metrics.winRate}%` : "—"

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Báo cáo tháng — Vexim Bridge</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid ${BORDER};">
            <tr>
              <td style="background:${HEADER_BG};padding:24px 32px;color:#ffffff;">
                <div style="font:600 12px/16px sans-serif;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">
                  Vexim Bridge · Báo cáo tháng
                </div>
                <div style="font:700 22px/30px sans-serif;margin-top:4px;">
                  ${escapeHtml(monthLabel)}
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 32px 12px;">
                <p style="margin:0 0 12px;font:14px/22px sans-serif;color:${TEXT};">
                  Chào ${escapeHtml(clientName)},
                </p>
                <p style="margin:0 0 22px;font:14px/22px sans-serif;color:${MUTED};">
                  Đây là tổng kết hoạt động pipeline của bạn trong tháng vừa qua.
                  Mọi số liệu được cập nhật theo thời gian thực — bạn có thể bấm
                  nút bên dưới để vào dashboard xem chi tiết.
                </p>

                <!-- KPI grid -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="6" border="0" style="margin-bottom:20px;">
                  <tr>
                    ${kpiRow(
                      "Deal mới",
                      String(metrics.newOpportunities),
                      `<span style="color:${MUTED};font:500 12px/16px sans-serif;">cơ hội phát sinh trong tháng</span>`,
                    )}
                    ${kpiRow(
                      "Đã chốt thành công",
                      String(metrics.won),
                      delta(metrics.won, previous.won, "abs", "deal"),
                    )}
                    ${kpiRow(
                      "Win rate",
                      winRateDisplay,
                      decided > 0
                        ? delta(metrics.winRate, previous.winRate, "pct", "")
                        : `<span style="color:${MUTED};font:500 12px/16px sans-serif;">chưa có deal được quyết định</span>`,
                    )}
                  </tr>
                  <tr>
                    ${kpiRow(
                      "Doanh thu thắng",
                      usd(metrics.wonValueUsd),
                      `<span style="color:${MUTED};font:500 12px/16px sans-serif;">tổng giá trị deal won</span>`,
                    )}
                    ${kpiRow(
                      "Đang chạy",
                      String(metrics.inProgressCount),
                      `<span style="color:${MUTED};font:500 12px/16px sans-serif;">cơ hội cuối tháng</span>`,
                    )}
                    ${kpiRow(
                      "Hoa hồng đã trả VXB",
                      usd(metrics.commissionPaidUsd),
                      delta(
                        Math.round(metrics.commissionPaidUsd),
                        Math.round(previous.commissionPaidUsd),
                        "abs",
                        "USD",
                      ),
                    )}
                  </tr>
                </table>

                <p style="margin:0 0 16px;font:13px/20px sans-serif;color:${MUTED};">
                  ${
                    metrics.lost > 0
                      ? `Có ${metrics.lost} deal kết thúc thất bại — vào dashboard để xem nguyên nhân và tỷ lệ thất bại theo quốc gia / ngành hàng.`
                      : `Không có deal nào thất bại trong tháng — tiếp tục duy trì tốc độ này.`
                  }
                </p>

                <a href="${escapeHtml(appUrl)}/client" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font:600 14px/20px sans-serif;">
                  Mở dashboard
                </a>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid ${BORDER};">
                <p style="margin:0;font:12px/18px sans-serif;color:#94a3b8;">
                  Bạn nhận được email này vì đã đăng ký tài khoản nhà xuất khẩu
                  trên Vexim Bridge. Bạn có thể quản lý các loại email nhận được
                  trong phần Cài đặt → Thông báo.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
