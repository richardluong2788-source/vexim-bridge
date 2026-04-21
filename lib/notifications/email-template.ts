import type { NotificationCategory, PreferredLanguage } from "@/lib/supabase/types"

/**
 * Generic notification email renderer. Produces HTML that renders well in
 * Gmail / Outlook (inline styles only) and a plain-text fallback.
 *
 * Localisation is driven by the caller — they pass already-translated strings
 * in the recipient's `preferred_language`. The template itself only renders
 * the boilerplate (header, footer, unsubscribe) in the correct language.
 */

export interface NotificationEmailInput {
  locale: PreferredLanguage
  category: NotificationCategory
  recipientName: string | null
  /** Already-translated title (shown as big H1). */
  title: string
  /** Already-translated body paragraph. Supports \n for line breaks. */
  body?: string | null
  /** Already-translated CTA label. */
  ctaLabel: string
  /** Absolute URL the CTA button opens. */
  ctaUrl: string
  /** Absolute unsubscribe URL (one-click). */
  unsubscribeUrl: string
}

const CATEGORY_ACCENT: Record<NotificationCategory, string> = {
  action_required: "#ef4444", // red-500
  status_update: "#0ea5e9",   // sky-500
  deal_closed: "#10b981",     // emerald-500
  new_assignment: "#14b8a6",  // teal-500
  system: "#64748b",          // slate-500
}

const BOILERPLATE = {
  vi: {
    brand: "Vexim Bridge",
    greeting: (name: string | null) => (name ? `Chào ${name},` : "Chào bạn,"),
    footer:
      "Bạn nhận email này vì đang sử dụng Vexim Bridge. Bạn có thể điều chỉnh loại email nhận được hoặc ngừng nhận tại liên kết bên dưới.",
    manage: "Quản lý tuỳ chọn email",
    unsubscribe: "Huỷ nhận email",
    subjectPrefix: "",
  },
  en: {
    brand: "Vexim Bridge",
    greeting: (name: string | null) => (name ? `Hi ${name},` : "Hi,"),
    footer:
      "You are receiving this email because you use Vexim Bridge. You can change which emails you get or unsubscribe using the link below.",
    manage: "Manage email preferences",
    unsubscribe: "Unsubscribe",
    subjectPrefix: "",
  },
} as const

export function renderNotificationEmail(input: NotificationEmailInput): {
  html: string
  text: string
} {
  const { locale, category, recipientName, title, body, ctaLabel, ctaUrl, unsubscribeUrl } =
    input

  const t = BOILERPLATE[locale] ?? BOILERPLATE.en
  const accent = CATEGORY_ACCENT[category] ?? CATEGORY_ACCENT.system

  const bodyHtml = (body ?? "")
    .split(/\n+/)
    .filter(Boolean)
    .map(
      (para) =>
        `<p style="margin:0 0 14px;font:14px/22px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#334155;">${escapeHtml(para)}</p>`,
    )
    .join("")

  const html = `<!DOCTYPE html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;max-width:560px;width:100%;">
            <!-- Header -->
            <tr>
              <td style="background:#0f172a;padding:20px 28px;">
                <div style="font:600 12px/16px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">
                  ${escapeHtml(t.brand)}
                </div>
              </td>
            </tr>

            <!-- Accent bar -->
            <tr>
              <td style="height:4px;background:${accent};line-height:4px;font-size:0;">&nbsp;</td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:28px 28px 20px;">
                <h1 style="margin:0 0 14px;font:700 20px/28px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
                  ${escapeHtml(title)}
                </h1>
                <p style="margin:0 0 16px;font:14px/22px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#475569;">
                  ${escapeHtml(t.greeting(recipientName))}
                </p>
                ${bodyHtml}
                <div style="margin:24px 0 8px;">
                  <a href="${escapeAttr(ctaUrl)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font:600 14px/20px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                    ${escapeHtml(ctaLabel)}
                  </a>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0 0 8px;font:12px/18px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#94a3b8;">
                  ${escapeHtml(t.footer)}
                </p>
                <p style="margin:0;font:12px/18px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                  <a href="${escapeAttr(unsubscribeUrl)}" style="color:#64748b;text-decoration:underline;">
                    ${escapeHtml(t.unsubscribe)}
                  </a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  const text = [
    title,
    "",
    t.greeting(recipientName),
    "",
    body ?? "",
    "",
    `${ctaLabel}: ${ctaUrl}`,
    "",
    "---",
    t.footer,
    `${t.unsubscribe}: ${unsubscribeUrl}`,
  ]
    .filter((line) => line !== null && line !== undefined)
    .join("\n")

  return { html, text }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function escapeAttr(s: string): string {
  return escapeHtml(s)
}
