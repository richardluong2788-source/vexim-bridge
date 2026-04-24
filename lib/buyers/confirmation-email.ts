import "server-only"

/**
 * Buyer confirmation emails — Phase 1.
 *
 * Sends acknowledgement emails directly to the buyer contact (from the
 * `leads` table). This is completely separate from the in-app
 * notification pipeline, which only targets registered users (clients /
 * admins) via `notification_preferences`.
 *
 * Key properties:
 *   - Idempotent: same (lead_id, email_type) within 24h is deduped.
 *   - Respects `leads.email_unsubscribed` — always skipped when true.
 *   - Respects `leads.contact_email` — skipped when missing.
 *   - Always logs the outcome to `buyer_email_log` (even skips), so we
 *     have a complete audit trail for deliverability debugging.
 *   - Adds RFC 2369 / 8058 `List-Unsubscribe` headers so Gmail/Yahoo
 *     surface the one-click unsubscribe affordance.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { sendMail, getFromAddress } from "@/lib/email/mailer"
import { siteConfig } from "@/lib/site-config"

export type BuyerEmailType =
  | "inquiry_received"
  | "sample_sent"
  | "quote_ready"
  | "shipped"
  | "closing"

export type BuyerEmailOutcome =
  | { status: "sent"; messageId: string | null }
  | { status: "skipped_no_email" }
  | { status: "skipped_unsubscribed" }
  | { status: "skipped_duplicate" }
  | { status: "failed"; error: string }

interface LeadRow {
  id: string
  company_name: string | null
  contact_person: string | null
  contact_email: string | null
  country: string | null
  industry: string | null
  unsubscribe_token: string | null
  email_unsubscribed: boolean | null
}

/**
 * Build the buyer unsubscribe URL using the existing /unsubscribe/[token]
 * route (extended to also accept lead tokens).
 */
function buildUnsubscribeUrl(token: string): string {
  return `${siteConfig.url}/unsubscribe/${token}`
}

/**
 * Ultra-simple locale pick for buyer copy. Default English (buyers are
 * international), switch to Vietnamese only when country explicitly is
 * Vietnam — a minority case, but worth covering.
 */
function pickLocale(country: string | null | undefined): "en" | "vi" {
  if (!country) return "en"
  const c = country.trim().toLowerCase()
  if (c === "vietnam" || c === "việt nam" || c === "viet nam" || c === "vn") {
    return "vi"
  }
  return "en"
}

function buildInquiryReceivedContent(lead: LeadRow): {
  subject: string
  html: string
  text: string
} {
  const locale = pickLocale(lead.country)
  const greeting =
    lead.contact_person?.trim()
      ? locale === "vi"
        ? `Xin chào ${lead.contact_person},`
        : `Hi ${lead.contact_person},`
      : locale === "vi"
        ? "Xin chào,"
        : "Hello,"

  const industry = lead.industry?.trim() || null

  const unsubscribeUrl = lead.unsubscribe_token
    ? buildUnsubscribeUrl(lead.unsubscribe_token)
    : null

  const brand = siteConfig.name
  const supportEmail = siteConfig.contact.email

  if (locale === "vi") {
    const subject = `Đã tiếp nhận yêu cầu của ${lead.company_name ?? "quý công ty"} — ${brand}`
    const text = [
      greeting,
      "",
      `Cảm ơn quý công ty đã gửi yêu cầu qua ${brand}. Chúng tôi đã tiếp nhận thông tin${industry ? ` về ngành ${industry}` : ""} và đang rà soát các nhà cung cấp Việt Nam phù hợp nhất.`,
      "",
      `Đội ngũ ${brand} sẽ liên hệ lại với quý công ty trong vòng 1–3 ngày làm việc với các phương án chào giá cụ thể.`,
      "",
      `Nếu có câu hỏi, xin phản hồi trực tiếp email này hoặc gửi về ${supportEmail}.`,
      "",
      "Trân trọng,",
      `Đội ngũ ${brand}`,
      `${siteConfig.domain}`,
    ].join("\n")

    const html = `
<!doctype html>
<html lang="vi">
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; line-height: 1.6; max-width: 560px; margin: 0 auto; padding: 24px;">
  <p style="margin: 0 0 16px;">${escapeHtml(greeting)}</p>
  <p style="margin: 0 0 16px;">Cảm ơn quý công ty đã gửi yêu cầu qua <strong>${escapeHtml(brand)}</strong>. Chúng tôi đã tiếp nhận thông tin${industry ? ` về ngành <strong>${escapeHtml(industry)}</strong>` : ""} và đang rà soát các nhà cung cấp Việt Nam phù hợp nhất với nhu cầu của quý công ty.</p>
  <p style="margin: 0 0 16px;">Đội ngũ ${escapeHtml(brand)} sẽ liên hệ lại trong vòng <strong>1–3 ngày làm việc</strong> với các phương án chào giá cụ thể.</p>
  <p style="margin: 0 0 24px;">Nếu có câu hỏi, xin phản hồi trực tiếp email này hoặc gửi về <a href="mailto:${escapeHtml(supportEmail)}" style="color: #0f766e;">${escapeHtml(supportEmail)}</a>.</p>
  <p style="margin: 0 0 4px;">Trân trọng,</p>
  <p style="margin: 0 0 24px; color: #555;">Đội ngũ ${escapeHtml(brand)}<br/><a href="${escapeHtml(siteConfig.url)}" style="color: #0f766e;">${escapeHtml(siteConfig.domain)}</a></p>
  ${unsubscribeUrl ? `<hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;"/><p style="font-size: 12px; color: #888; margin: 0;">Bạn nhận email này vì đã gửi yêu cầu sourcing qua ${escapeHtml(brand)}. <a href="${escapeHtml(unsubscribeUrl)}" style="color: #888;">Hủy đăng ký nhận email</a>.</p>` : ""}
</body>
</html>`.trim()

    return { subject, html, text }
  }

  // English (default)
  const subject = `We received your inquiry — ${brand}`
  const text = [
    greeting,
    "",
    `Thank you for reaching out to ${brand}. We've received your sourcing inquiry${industry ? ` in the ${industry} category` : ""} and our team is now reviewing qualified Vietnamese suppliers for you.`,
    "",
    `You can expect a follow-up from us within 1–3 business days with concrete quote options.`,
    "",
    `If you have any questions in the meantime, just reply to this email or reach us at ${supportEmail}.`,
    "",
    "Best regards,",
    `The ${brand} team`,
    siteConfig.domain,
  ].join("\n")

  const html = `
<!doctype html>
<html lang="en">
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; line-height: 1.6; max-width: 560px; margin: 0 auto; padding: 24px;">
  <p style="margin: 0 0 16px;">${escapeHtml(greeting)}</p>
  <p style="margin: 0 0 16px;">Thank you for reaching out to <strong>${escapeHtml(brand)}</strong>. We&#39;ve received your sourcing inquiry${industry ? ` in the <strong>${escapeHtml(industry)}</strong> category` : ""} and our team is now reviewing qualified Vietnamese suppliers for you.</p>
  <p style="margin: 0 0 16px;">You can expect a follow-up from us within <strong>1–3 business days</strong> with concrete quote options.</p>
  <p style="margin: 0 0 24px;">If you have any questions in the meantime, just reply to this email or reach us at <a href="mailto:${escapeHtml(supportEmail)}" style="color: #0f766e;">${escapeHtml(supportEmail)}</a>.</p>
  <p style="margin: 0 0 4px;">Best regards,</p>
  <p style="margin: 0 0 24px; color: #555;">The ${escapeHtml(brand)} team<br/><a href="${escapeHtml(siteConfig.url)}" style="color: #0f766e;">${escapeHtml(siteConfig.domain)}</a></p>
  ${unsubscribeUrl ? `<hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;"/><p style="font-size: 12px; color: #888; margin: 0;">You&#39;re receiving this email because you submitted a sourcing inquiry through ${escapeHtml(brand)}. <a href="${escapeHtml(unsubscribeUrl)}" style="color: #888;">Unsubscribe</a>.</p>` : ""}
</body>
</html>`.trim()

  return { subject, html, text }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * Send the "inquiry received" email to a buyer. Safe to call immediately
 * after the lead is created — failure here never rolls back the lead.
 *
 * Never throws. All outcomes (including skips and failures) are written
 * to buyer_email_log for auditing.
 */
export async function sendBuyerInquiryReceivedEmail(
  leadId: string,
  options: { sentBy?: string | null } = {},
): Promise<BuyerEmailOutcome> {
  const admin = createAdminClient()
  const emailType: BuyerEmailType = "inquiry_received"

  // 1. Load the lead
  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .select(
      "id, company_name, contact_person, contact_email, country, industry, unsubscribe_token, email_unsubscribed",
    )
    .eq("id", leadId)
    .single<LeadRow>()

  if (leadErr || !lead) {
    return { status: "failed", error: leadErr?.message ?? "Lead not found" }
  }

  // 2. Gate: must have an email
  if (!lead.contact_email) {
    await admin.from("buyer_email_log").insert({
      lead_id: lead.id,
      email_type: emailType,
      recipient_email: "",
      status: "skipped_no_email",
      sent_by: options.sentBy ?? null,
    })
    return { status: "skipped_no_email" }
  }

  // 3. Gate: must not be unsubscribed
  if (lead.email_unsubscribed) {
    await admin.from("buyer_email_log").insert({
      lead_id: lead.id,
      email_type: emailType,
      recipient_email: lead.contact_email,
      status: "skipped_unsubscribed",
      sent_by: options.sentBy ?? null,
    })
    return { status: "skipped_unsubscribed" }
  }

  // 4. Gate: dedup within 24h for this (lead, type)
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: recent } = await admin
    .from("buyer_email_log")
    .select("id")
    .eq("lead_id", lead.id)
    .eq("email_type", emailType)
    .eq("status", "sent")
    .gte("sent_at", dayAgo)
    .limit(1)

  if (recent && recent.length > 0) {
    await admin.from("buyer_email_log").insert({
      lead_id: lead.id,
      email_type: emailType,
      recipient_email: lead.contact_email,
      status: "skipped_duplicate",
      sent_by: options.sentBy ?? null,
    })
    return { status: "skipped_duplicate" }
  }

  // 5. Build content
  const { subject, html, text } = buildInquiryReceivedContent(lead)

  const unsubscribeUrl = lead.unsubscribe_token
    ? buildUnsubscribeUrl(lead.unsubscribe_token)
    : null

  const headers: Record<string, string> = {}
  if (unsubscribeUrl) {
    // RFC 2369 + RFC 8058: one-click unsubscribe for Gmail/Yahoo bulk
    // sender requirements.
    headers["List-Unsubscribe"] = `<${unsubscribeUrl}>`
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
  }

  // 6. Send
  const result = await sendMail({
    from: getFromAddress(),
    to: lead.contact_email,
    subject,
    html,
    text,
    headers,
  })

  if (result.error) {
    await admin.from("buyer_email_log").insert({
      lead_id: lead.id,
      email_type: emailType,
      recipient_email: lead.contact_email,
      subject,
      status: "failed",
      error_message: result.error.message,
      sent_by: options.sentBy ?? null,
    })
    return { status: "failed", error: result.error.message }
  }

  await admin.from("buyer_email_log").insert({
    lead_id: lead.id,
    email_type: emailType,
    recipient_email: lead.contact_email,
    subject,
    status: "sent",
    provider_message_id: result.data?.id ?? null,
    sent_by: options.sentBy ?? null,
  })

  return { status: "sent", messageId: result.data?.id ?? null }
}
