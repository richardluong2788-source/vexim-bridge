"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { siteConfig } from "@/lib/site-config"
import { sendMail, getFromAddress } from "@/lib/email/mailer"

export interface ResendInviteResult {
  ok: boolean
  error?: string
}

/**
 * Admin action: regenerate and re-send the "accept invite" email for a client
 * whose original OTP has expired or been consumed.
 *
 * Why we don't just call `admin.inviteUserByEmail` again:
 *   - It errors with "User already registered" when the auth row exists,
 *     even if the user never accepted the first invite.
 *
 * Why we don't use `admin.generateLink({ type: 'invite' })` alone:
 *   - `generateLink` DOES mint a fresh OTP, but it does NOT send the email.
 *     Supabase only auto-sends for `inviteUserByEmail` / `resetPasswordForEmail`.
 *
 * Strategy:
 *   1. Validate caller is admin/staff.
 *   2. Look up target profile, must be role=client.
 *   3. Generate a fresh magiclink via the admin API. This invalidates the
 *      previous OTP and produces an `action_link` pointing at our
 *      `/auth/accept-invite` page (with tokens in the hash fragment).
 *   4. Send the email ourselves via Zoho SMTP so we control wording/branding.
 */
export async function resendClientInvite(
  clientId: string,
): Promise<ResendInviteResult> {
  if (!clientId || typeof clientId !== "string") {
    return { ok: false, error: "invalid_client_id" }
  }

  // --- 1. AuthZ ---------------------------------------------------------
  const supabase = await createClient()
  const {
    data: { user: caller },
  } = await supabase.auth.getUser()
  if (!caller) return { ok: false, error: "unauthenticated" }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", caller.id)
    .single()

  if (
    !callerProfile ||
    !["admin", "staff", "super_admin"].includes(callerProfile.role)
  ) {
    return { ok: false, error: "forbidden" }
  }

  // --- 2. Lookup target -------------------------------------------------
  const admin = createAdminClient()
  const { data: target, error: targetErr } = await admin
    .from("profiles")
    .select("id, email, full_name, company_name, role")
    .eq("id", clientId)
    .single()

  if (targetErr || !target) return { ok: false, error: "not_found" }
  if (target.role !== "client") return { ok: false, error: "not_a_client" }
  if (!target.email) return { ok: false, error: "missing_email" }

  const redirectTo = `${siteConfig.url}/auth/accept-invite`

  // --- 3. Generate a fresh magic link ----------------------------------
  // Using type='magiclink' works whether the user has confirmed their email
  // or not; type='invite' would fail if they've already confirmed.
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: target.email,
    options: { redirectTo },
  })

  if (linkErr || !linkData?.properties?.action_link) {
    return {
      ok: false,
      error: linkErr?.message ?? "generate_link_failed",
    }
  }

  const actionLink = linkData.properties.action_link

  // --- 4. Send via Zoho SMTP -------------------------------------------
  const displayName =
    target.full_name?.trim() ||
    target.company_name?.trim() ||
    target.email.split("@")[0]

  const subject = "Vexim Bridge — Kích hoạt tài khoản của bạn"

  const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 24px 32px;">
                <p style="margin:0 0 8px 0;font-size:14px;color:#64748b;letter-spacing:0.08em;text-transform:uppercase;">Vexim Bridge</p>
                <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:600;line-height:1.3;color:#0f172a;">
                  Kích hoạt tài khoản Vexim Bridge
                </h1>
                <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">
                  Xin chào ${escapeHtml(displayName)},
                </p>
                <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">
                  Quản trị viên Vexim Bridge vừa gửi lại liên kết kích hoạt tài khoản của bạn.
                  Nhấn vào nút bên dưới để đặt mật khẩu và đăng nhập vào hệ thống:
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
                  Vexim Bridge · Cầu nối xuất khẩu Việt – Mỹ<br/>
                  bridge@veximglobal.com
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
    "Quản trị viên Vexim Bridge vừa gửi lại liên kết kích hoạt tài khoản của bạn.",
    "Mở liên kết sau để đặt mật khẩu và đăng nhập:",
    "",
    actionLink,
    "",
    "Liên kết có hiệu lực trong 24 giờ. Nếu bạn không yêu cầu, vui lòng bỏ qua email này.",
    "",
    "— Vexim Bridge",
  ].join("\n")

  const { error: sendErr } = await sendMail({
    from: getFromAddress(),
    to: target.email,
    subject,
    html,
    text,
  })

  if (sendErr) {
    return { ok: false, error: `smtp: ${sendErr.message}` }
  }

  // --- 5. Audit trail --------------------------------------------------
  await admin.from("activities").insert({
    user_id: caller.id,
    action: "client_invite_resent",
    details: {
      client_id: target.id,
      email: target.email,
    },
  })

  return { ok: true }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
