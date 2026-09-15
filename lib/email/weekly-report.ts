import type { PreferredLanguage, Stage } from "@/lib/supabase/types"

export interface StageSummary {
  stage: Stage
  count: number
}

export interface RecentLead {
  /**
   * Pre-masked buyer name (R-07): the real company name only once a deal
   * reaches price_agreed+, otherwise the opaque buyer_code.
   */
  displayName: string
  stage: Stage
  updatedAt: string
}

export interface WeeklyReportData {
  clientName: string
  totalLeads: number
  stageCounts: StageSummary[]
  recentLeads: RecentLead[]
  appUrl: string
  /** Recipient language — picks the whole template locale. Defaults to "vi". */
  locale?: PreferredLanguage
  /** Optional human-readable period, e.g. "25–31/8" (vi) or "Aug 25 – 31" (en). */
  periodLabel?: string | null
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

interface Copy {
  title: string
  greeting: (name: string) => string
  intro: (total: number) => string
  byStage: string
  recentlyUpdated: string
  noActivity: string
  cta: string
  footer: string
}

const COPY: Record<PreferredLanguage, Copy> = {
  vi: {
    title: "Báo cáo pipeline hàng tuần",
    greeting: (name) => `Kính gửi ${name},`,
    intro: (total) =>
      `Dưới đây là tổng quan pipeline của quý doanh nghiệp trong tuần qua. Hiện đang có <strong>${total}</strong> lead đang hoạt động.`,
    byStage: "Pipeline theo giai đoạn",
    recentlyUpdated: "Cập nhật gần đây",
    noActivity: "Tuần này chưa có hoạt động nào.",
    cta: "Xem báo cáo &amp; tải PDF",
    footer:
      "Quý doanh nghiệp nhận email này vì đã đăng ký là nhà xuất khẩu trên Vexim Trade.",
  },
  en: {
    title: "Weekly Pipeline Report",
    greeting: (name) => `Hi ${name},`,
    intro: (total) =>
      `Here is a summary of your pipeline this week. You currently have <strong>${total}</strong> active leads.`,
    byStage: "Pipeline by stage",
    recentlyUpdated: "Recently updated",
    noActivity: "No activity this week.",
    cta: "View report &amp; download PDF",
    footer:
      "You are receiving this email because you are registered as an exporter on Vexim Trade.",
  },
}

/**
 * Generates a simple, inline-styled HTML email for email clients that strip
 * external stylesheets (Gmail, Outlook). The whole template follows the
 * recipient's preferred language (defaults to Vietnamese — the client portal
 * is VI-first).
 */
export function renderWeeklyReportHtml(data: WeeklyReportData): string {
  const locale: PreferredLanguage = data.locale ?? "vi"
  const labels = STAGE_LABEL[locale]
  const t = COPY[locale]
  const { clientName, totalLeads, stageCounts, recentLeads, appUrl } = data

  const stageRows = stageCounts
    .map(
      (s) => `
        <tr>
          <td style="padding:8px 0;font:14px/20px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
            <span style="display:inline-block;width:10px;height:10px;border-radius:9999px;background:${STAGE_COLOR[s.stage]};margin-right:8px;vertical-align:middle;"></span>
            ${labels[s.stage]}
          </td>
          <td style="padding:8px 0;text-align:right;font:600 14px/20px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
            ${s.count}
          </td>
        </tr>
      `,
    )
    .join("")

  const recentRows = recentLeads.length
    ? recentLeads
        .map(
          (l) => `
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font:14px/20px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
                ${escapeHtml(l.displayName)}
              </td>
              <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right;">
                <span style="display:inline-block;padding:2px 8px;border-radius:9999px;background:${STAGE_COLOR[l.stage]};color:#fff;font:600 12px/18px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                  ${labels[l.stage]}
                </span>
              </td>
            </tr>
          `,
        )
        .join("")
    : `<tr><td style="padding:16px 0;font:14px/20px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#64748b;">${t.noActivity}</td></tr>`

  const periodSubtitle = data.periodLabel
    ? `<div style="font:500 13px/20px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#cbd5e1;margin-top:4px;">${escapeHtml(data.periodLabel)}</div>`
    : ""

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${t.title}</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr>
              <td style="background:#0f172a;padding:24px 32px;color:#ffffff;">
                <div style="font:600 12px/16px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Vexim Trade</div>
                <div style="font:700 20px/28px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin-top:4px;">${t.title}</div>
                ${periodSubtitle}
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px;">
                <p style="margin:0 0 16px;font:14px/22px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
                  ${t.greeting(escapeHtml(clientName))}
                </p>
                <p style="margin:0 0 24px;font:14px/22px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#475569;">
                  ${t.intro(totalLeads)}
                </p>

                <div style="font:600 12px/16px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:8px;">${t.byStage}</div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;border-top:1px solid #e2e8f0;">
                  ${stageRows}
                </table>

                <div style="font:600 12px/16px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:8px;">${t.recentlyUpdated}</div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                  ${recentRows}
                </table>

                <a href="${escapeHtml(appUrl)}/client/reports" style="display:inline-block;background:#14b8a6;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font:600 14px/20px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                  ${t.cta}
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font:12px/18px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#94a3b8;">
                  ${t.footer}
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
