import "server-only"

/**
 * Notifies AE and SR (if any) when a client submits intake form.
 * - System notification (in-app bell) via dispatcher
 * - Email to registration email (profiles.email) via dispatcher
 * - Legacy direct email kept as fallback for AE
 *
 * Sent to registration email, not generic veximtrade inbox.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { sendMail, getFromAddress } from "@/lib/email/mailer"
import { siteConfig } from "@/lib/site-config"
import { dispatchNotification } from "@/lib/notifications/dispatcher"

interface NotifyResult {
  status: "sent" | "skipped_no_ae_email" | "skipped_not_found" | "failed"
  error?: string
}

export async function notifyAeOfIntakeSubmission(token: string): Promise<NotifyResult> {
  try {
    const admin = createAdminClient()

    const { data: submission, error: subErr } = await admin
      .from("client_intake_submissions")
      .select("id, company_name, contact_name, email, phone, ae_id, client_id")
      .eq("token", token)
      .single()

    if (subErr || !submission) {
      return { status: "skipped_not_found" }
    }

    const companyName = submission.company_name?.trim() || "Khách hàng mới"
    const contactName = submission.contact_name?.trim() || null
    const contactEmail = submission.email?.trim() || null
    const contactPhone = submission.phone?.trim() || null

    // Collect userIds to notify: AE + SR (sourced_by) if exists
    const userIds = new Set<string>()
    if (submission.ae_id) userIds.add(submission.ae_id)

    // If this is supplement flow (client_id exists), get sourced_by SR
    if (submission.client_id) {
      const { data: clientProfile } = await admin
        .from("profiles")
        .select("sourced_by")
        .eq("id", submission.client_id)
        .maybeSingle()
      if (clientProfile?.sourced_by) {
        userIds.add(clientProfile.sourced_by as string)
      }
    }

    // Dispatch system + email via dispatcher for each user
    const reviewPath = `/admin/clients/intake/${submission.id}`
    for (const userId of userIds) {
      const isAE = userId === submission.ae_id
      try {
        await dispatchNotification({
          userId,
          category: "new_assignment",
          opportunityId: null,
          linkPath: reviewPath,
          dedupKey: `intake_submitted:${submission.id}:${userId}`,
          title: {
            vi: `Hồ sơ mới đã được gửi — ${companyName}`,
            en: `New intake submitted — ${companyName}`,
          },
          body: {
            vi: `${companyName} vừa hoàn tất hồ sơ${isAE ? " qua link của bạn" : ""}.${contactName ? ` Người liên hệ: ${contactName}` : ""}${contactEmail ? ` – ${contactEmail}` : ""}${contactPhone ? ` – ${contactPhone}` : ""}`,
            en: `${companyName} just submitted their profile${isAE ? " via your link" : ""}.${contactName ? ` Contact: ${contactName}` : ""}`,
          },
          ctaLabel: {
            vi: "Xem & duyệt hồ sơ",
            en: "Review submission",
          },
          subject: {
            vi: `Hồ sơ mới — ${companyName}`,
            en: `New submission — ${companyName}`,
          },
        })
      } catch (e) {
        console.error("[notifyAeOfIntakeSubmission] dispatch failed for", userId, e)
      }
    }

    // Legacy direct email to AE as fallback (keeps previous behavior)
    const { data: ae, error: aeErr } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", submission.ae_id)
      .single()

    if (aeErr || !ae?.email) {
      return { status: "skipped_no_ae_email" }
    }

    const reviewUrl = `${siteConfig.url}/admin/clients/intake/${submission.id}`
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
      contactName ? `<tr><td style="padding:4px 0;color:#64748b;font-size:13px;width:110px;">Người liên hệ</td><td style="padding:4px 0;color:#0f172a;font-size:13px;font-weight:500;\">${escapeHtml(contactName)}</td></tr>` : "",
      contactEmail ? `<tr><td style="padding:4px 0;color:#64748b;font-size:13px;width:110px;\">Email</td><td style="padding:4px 0;color:#0f172a;font-size:13px;font-weight:500;\">${escapeHtml(contactEmail)}</td></tr>` : "",
      contactPhone ? `<tr><td style="padding:4px 0;color:#64748b;font-size:13px;width:110px;\">Điện thoại</td><td style="padding:4px 0;color:#0f172a;font-size:13px;font-weight:500;\">${escapeHtml(contactPhone)}</td></tr>` : "",
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
      // Don't fail overall – dispatcher already sent
      return { status: "sent" }
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
