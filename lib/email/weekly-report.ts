import type { Stage } from "@/lib/supabase/types"

export interface StageSummary {
  stage: Stage
  count: number
}

export interface RecentLead {
  companyName: string
  stage: Stage
  updatedAt: string
}

export interface WeeklyReportData {
  clientName: string
  totalLeads: number
  stageCounts: StageSummary[]
  recentLeads: RecentLead[]
  appUrl: string
}

const STAGE_LABEL: Record<Stage, string> = {
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

/**
 * Generates a simple, inline-styled HTML email for email clients that strip
 * external stylesheets (Gmail, Outlook).
 */
export function renderWeeklyReportHtml(data: WeeklyReportData): string {
  const { clientName, totalLeads, stageCounts, recentLeads, appUrl } = data

  const stageRows = stageCounts
    .map(
      (s) => `
        <tr>
          <td style="padding:8px 0;font:14px/20px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
            <span style="display:inline-block;width:10px;height:10px;border-radius:9999px;background:${STAGE_COLOR[s.stage]};margin-right:8px;vertical-align:middle;"></span>
            ${STAGE_LABEL[s.stage]}
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
                ${escapeHtml(l.companyName)}
              </td>
              <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right;">
                <span style="display:inline-block;padding:2px 8px;border-radius:9999px;background:${STAGE_COLOR[l.stage]};color:#fff;font:600 12px/18px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                  ${STAGE_LABEL[l.stage]}
                </span>
              </td>
            </tr>
          `,
        )
        .join("")
    : `<tr><td style="padding:16px 0;font:14px/20px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#64748b;">No activity this week.</td></tr>`

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Weekly Pipeline Report</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr>
              <td style="background:#0f172a;padding:24px 32px;color:#ffffff;">
                <div style="font:600 12px/16px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Vexim Bridge</div>
                <div style="font:700 20px/28px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin-top:4px;">Weekly Pipeline Report</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px;">
                <p style="margin:0 0 16px;font:14px/22px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
                  Hi ${escapeHtml(clientName)},
                </p>
                <p style="margin:0 0 24px;font:14px/22px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#475569;">
                  Here is a summary of your pipeline this week. You currently have
                  <strong>${totalLeads}</strong> active leads.
                </p>

                <div style="font:600 12px/16px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:8px;">Pipeline by stage</div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;border-top:1px solid #e2e8f0;">
                  ${stageRows}
                </table>

                <div style="font:600 12px/16px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:8px;">Recently updated</div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                  ${recentRows}
                </table>

                <a href="${escapeHtml(appUrl)}/client" style="display:inline-block;background:#14b8a6;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font:600 14px/20px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                  Open your dashboard
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font:12px/18px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#94a3b8;">
                  You are receiving this email because you are registered as an exporter on Vexim Bridge.
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
