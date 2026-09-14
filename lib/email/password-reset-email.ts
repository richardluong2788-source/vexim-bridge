import "server-only"

/**
 * Branded "reset your password" email.
 *
 * Why this exists instead of relying on Supabase Auth's own email:
 * `auth.resetPasswordForEmail` auto-sends Supabase Auth's generic reset
 * email, which fails with "Error sending invite email"-style 500 errors
 * whenever the project's Auth SMTP provider is unconfigured. Callers mint
 * the recovery link themselves via `admin.auth.admin.generateLink({
 * type: "recovery", ... })` (no email sent) and deliver it here through our
 * own verified veximtrade.com Resend domain — the same channel as invites.
 */

import {
  sendMail,
  getFromAddress,
  type SendMailResult,
} from "@/lib/email/mailer"

export interface SendPasswordResetEmailInput {
  email: string
  actionLink: string
}

export async function sendPasswordResetEmail(
  input: SendPasswordResetEmailInput,
): Promise<SendMailResult> {
  const { email, actionLink } = input

  const subject = "Vexim Trade — Đặt lại mật khẩu của bạn"

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
                  Đặt lại mật khẩu
                </h1>
                <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">
                  Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Nhấn nút bên dưới để tạo mật khẩu mới:
                </p>
                <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
                  <tr>
                    <td style="background:#0f172a;border-radius:8px;">
                      <a href="${actionLink}"
                         style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;">
                        Đặt lại mật khẩu
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
                  Liên kết có hiệu lực trong 1 giờ. Nếu bạn không yêu cầu đặt lại mật khẩu,
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
    "Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.",
    "",
    "Mở liên kết sau để tạo mật khẩu mới:",
    "",
    actionLink,
    "",
    "Liên kết có hiệu lực trong 1 giờ. Nếu bạn không yêu cầu, vui lòng bỏ qua email này.",
    "",
    "— Vexim Trade",
  ].join("\n")

  return sendMail({
    from: getFromAddress("noreply"),
    to: email,
    subject,
    html,
    text,
  })
}
