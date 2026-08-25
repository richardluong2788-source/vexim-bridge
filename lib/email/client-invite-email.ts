import "server-only"

/**
 * Branded "activate your account" email for new/returning clients.
 *
 * Why this exists instead of relying on Supabase Auth's built-in
 * `inviteUserByEmail` email: Supabase's own invite template has a generic
 * subject ("You have been invited") and no Vexim Trade branding, which
 * Gmail/Outlook frequently route to Spam/Promotions for first-time
 * recipients — even though Resend reports the message as "Delivered"
 * (that status only confirms the receiving mail server accepted it, not
 * that it landed in the inbox).
 *
 * Callers should mint the action link themselves via
 * `admin.auth.admin.generateLink({ type: "invite" | "magiclink", ... })`
 * (which creates/refreshes the auth user WITHOUT sending an email) and
 * then call `sendClientInviteEmail` to deliver it through our own
 * verified veximtrade.com sending domain on Resend — same channel already
 * proven to reach inboxes for AE notification emails.
 */

import { sendMail, getFromAddress, type SendMailResult } from "@/lib/email/mailer"

export interface SendClientInviteEmailInput {
  email: string
  /** Contact name, falls back to company name / email local-part. */
  displayName: string
  actionLink: string
  /**
   * "invite" — first-time account creation (manual client creation or
   * intake approval). "resend" — re-sending an activation link because
   * the original OTP expired or was never used.
   */
  variant?: "invite" | "resend"
}

export async function sendClientInviteEmail(
  input: SendClientInviteEmailInput,
): Promise<SendMailResult> {
  const { email, actionLink } = input
  const displayName = input.displayName?.trim() || email.split("@")[0]
  const isResend = input.variant === "resend"

  const subject = isResend
    ? "Vexim Trade — Kích hoạt lại tài khoản của bạn"
    : "Chào mừng bạn đến với Vexim Trade — Kích hoạt tài khoản"

  const heroLine = isResend
    ? "Đây là liên kết kích hoạt tài khoản mới nhất của bạn."
    : "Hồ sơ đăng ký của bạn đã được duyệt. Tài khoản Vexim Trade của bạn đã sẵn sàng."

  const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 24px 32px;">
                <p style="margin:0 0 8px 0;font-size:14px;color:#64748b;letter-spacing:0.08em;text-transform:uppercase;">Vexim Trade</p>
                <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:600;line-height:1.3;color:#0f172a;">
                  Kích hoạt tài khoản Vexim Trade
                </h1>
                <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">
                  Xin chào ${escapeHtml(displayName)},
                </p>
                <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">
                  ${escapeHtml(heroLine)} Nhấn vào nút bên dưới để đặt mật khẩu và đăng nhập vào hệ thống:
                </p>
                <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
                  <tr>
                    <td style="background:#0f172a;border-radius:8px;">
                      <a href="${actionLink}"
                         style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;">
                        Kích hoạt tài khoản
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#64748b;">
                  Nếu nút không hoạt động, copy liên kết sau vào trình duyệt:
                </p>
                <p style="margin:0 0 24px 0;font-size:12px;line-height:1.5;color:#475569;word-break:break-all;">
                  ${actionLink}
                </p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
                  Liên kết có hiệu lực trong 24 giờ. Nếu bạn không yêu cầu kích hoạt,
                  vui lòng bỏ qua email này.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:12px;color:#94a3b8;">
                  Vexim Trade · Cầu nối xuất khẩu Việt – Mỹ<br/>
                  hello@veximtrade.com
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
    `Xin chào ${displayName},`,
    "",
    heroLine,
    "Mở liên kết sau để đặt mật khẩu và đăng nhập:",
    "",
    actionLink,
    "",
    "Liên kết có hiệu lực trong 24 giờ. Nếu bạn không yêu cầu, vui lòng bỏ qua email này.",
    "",
    "— Vexim Trade",
  ].join("\n")

  return sendMail({
    from: getFromAddress(),
    to: email,
    subject,
    html,
    text,
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
