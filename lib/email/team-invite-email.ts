import "server-only"

/**
 * Branded "join the team" invitation email for internal Vexim Trade staff.
 *
 * Why this exists instead of relying on Supabase Auth's built-in email:
 * `admin.inviteUserByEmail` both creates the auth user AND auto-sends
 * Supabase Auth's own generic invite email. That send path fails with
 * "Error sending invite email" (status 500, unexpected_failure) whenever the
 * project's Auth SMTP provider is unconfigured or unavailable — so team
 * invites break even though our own Resend channel works fine.
 *
 * Callers mint the action link themselves via
 * `admin.auth.admin.generateLink({ type: "invite", ... })` (creates the user
 * WITHOUT sending any email) and then call `sendTeamInviteEmail` to deliver
 * it through our own verified veximtrade.com sending domain on Resend — the
 * same channel already proven to reach inboxes.
 */

import {
  sendMail,
  getFromAddress,
  type SendMailResult,
} from "@/lib/email/mailer"

export interface SendTeamInviteEmailInput {
  email: string
  fullName: string
  /** Vietnamese role label, e.g. "Supplier Researcher". */
  roleLabel: string
  /** Industries the member will cover (may be empty = all industries). */
  industries?: string[]
  actionLink: string
}

export async function sendTeamInviteEmail(
  input: SendTeamInviteEmailInput,
): Promise<SendMailResult> {
  const { email, actionLink, roleLabel } = input
  const displayName = input.fullName?.trim() || email.split("@")[0]
  const industriesText =
    input.industries && input.industries.length > 0
      ? input.industries.join(", ")
      : "Tất cả các ngành"

  const subject = `Mời bạn tham gia đội ngũ Vexim Trade — vai trò ${roleLabel}`

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
                  Chào mừng bạn đến với đội ngũ Vexim Trade
                </h1>
                <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">
                  Xin chào ${escapeHtml(displayName)},
                </p>
                <p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:#334155;">
                  Bạn đã được thêm vào hệ thống với vai trò <strong>${escapeHtml(roleLabel)}</strong>.
                </p>
                <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">
                  Ngành phụ trách: <strong>${escapeHtml(industriesText)}</strong>.
                </p>
                <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">
                  Nhấn vào nút bên dưới để đặt mật khẩu và bắt đầu làm việc:
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
                  Liên kết có hiệu lực trong 24 giờ. Nếu bạn không mong đợi email này,
                  vui lòng bỏ qua.
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
    `Bạn đã được thêm vào hệ thống Vexim Trade với vai trò ${roleLabel}.`,
    `Ngành phụ trách: ${industriesText}.`,
    "",
    "Mở liên kết sau để đặt mật khẩu và bắt đầu làm việc:",
    "",
    actionLink,
    "",
    "Liên kết có hiệu lực trong 24 giờ. Nếu bạn không mong đợi email này, vui lòng bỏ qua.",
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
