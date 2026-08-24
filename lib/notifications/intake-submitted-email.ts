import "server-only"

/**
 * Notifies the AE (the account_executive who generated the intake link)
 * by email as soon as a prospect submits the public /client-intake/[token]
 * form — so the AE doesn't need to keep checking the admin dashboard for
 * new submissions.
 *
 * Sent to `profiles.email` — the AE's own account email (the one they
 * registered / log in with), NOT a shared inbox.
 *
 * Best-effort: failures here are logged but never block or fail the
 * client's submission — the submission itself is already saved by the
 * time this runs.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { sendMail, getFromAddress } from "@/lib/email/mailer"
import { siteConfig } from "@/lib/site-config"

interface NotifyResult {
  status: "sent" | "skipped_no_ae_email" | "skipped_not_found" | "failed"
  error?: string
}

/**
 * Look up the submission by token (admin/service-role — bypasses RLS,
 * safe here since we already know the token was just accepted by the
 * `submit_client_intake` RPC) and email the owning AE.
 */
export async function notifyAeOfIntakeSubmission(
  token: string,
): Promise<NotifyResult> {
  try {
    const admin = createAdminClient()

    const { data: submission, error: subErr } = await admin
      .from("client_intake_submissions")
      .select("id, company_name, contact_name, email, phone, ae_id")
      .eq("token", token)
      .single()

    if (subErr || !submission) {
      return { status: "skipped_not_found" }
    }

    const { data: ae, error: aeErr } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", submission.ae_id)
      .single()

    if (aeErr || !ae?.email) {
      return { status: "skipped_no_ae_email" }
    }

    const reviewUrl = `${siteConfig.url}/admin/clients/intake/${submission.id}`
    const companyName = submission.company_name?.trim() || "Khách hàng mới"
    const contactName = submission.contact_name?.trim() || null
    const contactEmail = submission.email?.trim() || null
    const contactPhone = submission.phone?.trim() || null

    const greeting = ae.full_name?.trim() ? `Chào ${ae.full_name.trim()},` : "Chào bạn,"

    const subject = `Hồ sơ mới đã được gửi — ${companyName}`

    const text = [
      greeting,
      "",
      `${companyName} vừa hoàn tất và gửi hồ sơ đăng ký qua link intake của bạn trên ${siteConfig.name}.`,
      "",
      contactName ? `Người liên hệ: ${contactName}` : null,
      contactEmail ? `Email: ${contactEmail}` : null,
      contactPhone ? `Điện thoại: ${contactPhone}` : null,
      "",
      `Xem và duyệt hồ sơ: ${reviewUrl}`,
      "",
      `— ${siteConfig.name}`,
    ]
      .filter((line) => line !== null)
      .join("\n")

    const detailRowsHtml = [
      contactName ? `<tr><td style="padding:4px 0;color:#64748b;font-size:13px;width:110px;">Người liên hệ</td><td style="padding:4px 0;color:#0f172a;font-size:13px;font-weight:500;">${escapeHtml(contactName)}</td></tr>` : "",
      contactEmail ? `<tr><td style="padding:4px 0;color:#64748b;font-size:13px;width:110px;">Email</td><td style="padding:4px 0;color:#0f172a;font-size:13px;font-weight:500;">${escapeHtml(contactEmail)}</td></tr>` : "",
      contactPhone ? `<tr><td style="padding:4px 0;color:#64748b;font-size:13px;width:110px;">Điện thoại</td><td style="padding:4px 0;color:#0f172a;font-size:13px;font-weight:500;">${escapeHtml(contactPhone)}</td></tr>` : "",
    ]
      .filter(Boolean)
      .join("")

    const html = `<!doctype html>
<html lang="vi">
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;max-width:560px;width:100%;">
          <tr>
            <td style="background:#0f172a;padding:20px 28px;">
              <div style="font:600 12px/16px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">
                ${escapeHtml(siteConfig.name)}
              </div>
            </td>
          </tr>
          <tr>
            <td style="height:4px;background:#10b981;line-height:4px;font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 28px 20px;">
              <h1 style="margin:0 0 14px;font:700 20px/28px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
                Hồ sơ mới đã được gửi
              </h1>
              <p style="margin:0 0 16px;font:14px/22px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#475569;">
                ${escapeHtml(greeting)}
              </p>
              <p style="margin:0 0 16px;font:14px/22px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#334155;">
                <strong>${escapeHtml(companyName)}</strong> vừa hoàn tất và gửi hồ sơ đăng ký qua link intake của bạn.
              </p>
              ${detailRowsHtml ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">${detailRowsHtml}</table>` : ""}
              <div style="margin:8px 0 8px;">
                <a href="${escapeAttr(reviewUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font:600 14px/20px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                  Xem &amp; duyệt hồ sơ
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font:12px/18px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#94a3b8;">
                Email tự động từ hệ thống ${escapeHtml(siteConfig.name)} — gửi vì bạn là AE phụ trách link intake này.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim()

    const result = await sendMail({
      from: getFromAddress(),
      to: ae.email,
      subject,
      html,
      text,
    })

    if (result.error) {
      console.error("[v0] notifyAeOfIntakeSubmission send failed:", result.error.message)
      return { status: "failed", error: result.error.message }
    }

    return { status: "sent" }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[v0] notifyAeOfIntakeSubmission error:", message)
    return { status: "failed", error: message }
  }
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
