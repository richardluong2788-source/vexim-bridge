import { NextResponse } from "next/server"
import { z } from "zod"
import { sendMail, getFromAddress } from "@/lib/email/mailer"
import { INDUSTRIES } from "@/lib/constants/industries"
import { siteConfig } from "@/lib/site-config"

/**
 * Public endpoint powering the landing "Đặt lịch tư vấn 1:1" form.
 *
 * Flow:
 *   1. Validate payload with zod (server-side — never trust the client).
 *   2. Send an internal notification email to the inbox that owns the
 *      Zoho mailbox (ZOHO_SMTP_USER, typically bridge@veximglobal.com).
 *   3. Send an auto-reply confirmation to the lead so they know we got it.
 *
 * We deliberately do NOT persist to the DB here — the user said they
 * manage the database themselves. If they later want leads inserted
 * into the `leads` table, we can extend this route without touching
 * the form UI.
 */

export const runtime = "nodejs"

const ALLOWED_TIMES = [
  "morning",       // 9:00 – 12:00
  "afternoon",     // 13:30 – 17:30
  "evening",       // 18:00 – 21:00
  "anytime",
] as const

const TIME_LABELS_VI: Record<(typeof ALLOWED_TIMES)[number], string> = {
  morning: "Buổi sáng (9:00 – 12:00)",
  afternoon: "Buổi chiều (13:30 – 17:30)",
  evening: "Buổi tối (18:00 – 21:00)",
  anytime: "Giờ nào cũng được",
}

const payloadSchema = z.object({
  fullName: z.string().trim().min(2, "Họ tên quá ngắn").max(120),
  email: z.string().trim().email("Email không hợp lệ").max(160),
  phone: z
    .string()
    .trim()
    .min(8, "Số điện thoại không hợp lệ")
    .max(20)
    .regex(/^[+\d\s().-]+$/, "Số điện thoại chứa ký tự không hợp lệ"),
  company: z.string().trim().min(2, "Tên công ty / nhà máy quá ngắn").max(160),
  industry: z.enum(INDUSTRIES as unknown as [string, ...string[]], {
    errorMap: () => ({ message: "Vui lòng chọn ngành hàng" }),
  }),
  preferredTime: z.enum(ALLOWED_TIMES).optional(),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  // Honeypot — real humans leave this empty. Bots auto-fill it.
  website: z.string().optional(),
})

export async function POST(req: Request) {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = payloadSchema.safeParse(json)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return NextResponse.json(
      {
        error: firstIssue?.message ?? "Dữ liệu không hợp lệ",
        field: firstIssue?.path.join("."),
      },
      { status: 400 },
    )
  }

  const data = parsed.data

  // Honeypot tripped — silently accept (don't signal to bots that we filtered them).
  if (data.website && data.website.trim().length > 0) {
    return NextResponse.json({ ok: true })
  }

  const submittedAt = new Date()
  const submittedAtLabel = new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(submittedAt)

  const preferredTimeLabel = data.preferredTime
    ? TIME_LABELS_VI[data.preferredTime]
    : "Chưa chọn"

  // Internal inbox = the Zoho mailbox we're sending from.
  const internalRecipient = process.env.ZOHO_SMTP_USER ?? getFromAddress()

  const internalHtml = renderInternalEmail({
    fullName: data.fullName,
    email: data.email,
    phone: data.phone,
    company: data.company,
    industry: data.industry,
    preferredTime: preferredTimeLabel,
    message: data.message?.trim() || "",
    submittedAt: submittedAtLabel,
  })

  const internalText = [
    "Yêu cầu đặt lịch tư vấn 1:1 mới",
    "----------------------------------",
    `Họ tên:        ${data.fullName}`,
    `Email:         ${data.email}`,
    `Điện thoại:    ${data.phone}`,
    `Công ty:       ${data.company}`,
    `Ngành hàng:    ${data.industry}`,
    `Thời gian:     ${preferredTimeLabel}`,
    "",
    "Nội dung:",
    data.message?.trim() || "(không có)",
    "",
    `Gửi lúc: ${submittedAtLabel}`,
  ].join("\n")

  const customerHtml = renderCustomerEmail({
    fullName: data.fullName,
    company: data.company,
    industry: data.industry,
    preferredTime: preferredTimeLabel,
    message: data.message?.trim() || "",
  })

  const customerText = [
    `Chào ${data.fullName},`,
    "",
    "Vexim Bridge đã nhận được yêu cầu đặt lịch tư vấn 1:1 của bạn.",
    "Một chuyên gia sẽ liên hệ lại trong vòng 24 giờ làm việc để xác nhận khung giờ phù hợp.",
    "",
    "Thông tin bạn đã gửi:",
    `- Công ty: ${data.company}`,
    `- Ngành hàng: ${data.industry}`,
    `- Thời gian mong muốn: ${preferredTimeLabel}`,
    "",
    "Nếu cần hỗ trợ gấp, bạn có thể trả lời trực tiếp email này.",
    "",
    "— Đội ngũ Vexim Bridge",
    siteConfig.url,
  ].join("\n")

  // Fire both emails. We await internal first (must succeed — that's how
  // the team sees the lead). The customer auto-reply is best-effort.
  const internalResult = await sendMail({
    to: internalRecipient,
    subject: `[Tư vấn 1:1] ${data.company} · ${data.fullName}`,
    html: internalHtml,
    text: internalText,
    // Let the team hit "Reply" and go straight to the lead.
    headers: { "Reply-To": data.email },
  })

  if (internalResult.error) {
    console.error(
      "[v0] consultation: internal email failed:",
      internalResult.error.message,
    )
    return NextResponse.json(
      {
        error:
          "Không gửi được yêu cầu. Vui lòng thử lại hoặc liên hệ trực tiếp hello@veximbridge.com.",
      },
      { status: 502 },
    )
  }

  const customerResult = await sendMail({
    to: data.email,
    subject: "Đã nhận yêu cầu tư vấn 1:1 · Vexim Bridge",
    html: customerHtml,
    text: customerText,
  })

  if (customerResult.error) {
    // Don't fail the request — we've already captured the lead internally.
    console.warn(
      "[v0] consultation: customer auto-reply failed:",
      customerResult.error.message,
    )
  }

  return NextResponse.json({ ok: true })
}

// --------------------------------------------------------------------------
// Email renderers — inline styles only so Gmail / Outlook render correctly.
// --------------------------------------------------------------------------

interface InternalEmailData {
  fullName: string
  email: string
  phone: string
  company: string
  industry: string
  preferredTime: string
  message: string
  submittedAt: string
}

function renderInternalEmail(d: InternalEmailData): string {
  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:10px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font:600 12px/18px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#64748b;letter-spacing:0.04em;text-transform:uppercase;width:160px;vertical-align:top;">
        ${escapeHtml(label)}
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font:14px/20px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
        ${escapeHtml(value) || '<span style="color:#94a3b8;">—</span>'}
      </td>
    </tr>
  `

  const messageBlock = d.message
    ? `
      <tr>
        <td colspan="2" style="padding:16px 14px;font:14px/22px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;background:#ffffff;white-space:pre-wrap;">
          <div style="font:600 12px/18px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#64748b;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:6px;">Nội dung cần tư vấn</div>
          ${escapeHtml(d.message)}
        </td>
      </tr>`
    : ""

  return `<!DOCTYPE html>
<html lang="vi">
  <head><meta charset="utf-8" /><title>Yêu cầu tư vấn 1:1</title></head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;max-width:600px;width:100%;">
          <tr>
            <td style="background:#0f172a;padding:20px 24px;">
              <div style="font:600 12px/16px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Vexim Bridge · Lead mới</div>
              <div style="margin-top:4px;font:700 18px/26px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#ffffff;">Yêu cầu đặt lịch tư vấn 1:1</div>
            </td>
          </tr>
          <tr><td style="height:4px;background:#14b8a6;line-height:4px;font-size:0;">&nbsp;</td></tr>
          <tr><td style="padding:20px 24px 8px;font:14px/22px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#475569;">
            Khách hàng vừa gửi yêu cầu tư vấn từ landing page. Vui lòng liên hệ lại trong vòng 24 giờ làm việc.
          </td></tr>
          <tr><td style="padding:8px 24px 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;">
              ${row("Họ và tên", d.fullName)}
              ${row("Email", d.email)}
              ${row("Điện thoại", d.phone)}
              ${row("Công ty / Nhà máy", d.company)}
              ${row("Ngành hàng", d.industry)}
              ${row("Thời gian liên hệ", d.preferredTime)}
              ${messageBlock}
            </table>
            <div style="margin-top:16px;">
              <a href="mailto:${escapeAttr(d.email)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font:600 14px/20px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                Trả lời khách hàng
              </a>
            </div>
          </td></tr>
          <tr><td style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font:12px/18px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#94a3b8;">
            Gửi lúc ${escapeHtml(d.submittedAt)} (giờ Việt Nam) · Nguồn: landing page ${escapeHtml(siteConfig.url)}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}

interface CustomerEmailData {
  fullName: string
  company: string
  industry: string
  preferredTime: string
  message: string
}

function renderCustomerEmail(d: CustomerEmailData): string {
  return `<!DOCTYPE html>
<html lang="vi">
  <head><meta charset="utf-8" /><title>Đã nhận yêu cầu tư vấn</title></head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;max-width:560px;width:100%;">
          <tr>
            <td style="background:#0f172a;padding:20px 28px;">
              <div style="font:600 12px/16px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Vexim Bridge</div>
            </td>
          </tr>
          <tr><td style="height:4px;background:#14b8a6;line-height:4px;font-size:0;">&nbsp;</td></tr>
          <tr><td style="padding:28px 28px 20px;">
            <h1 style="margin:0 0 14px;font:700 22px/30px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
              Đã nhận yêu cầu tư vấn của bạn
            </h1>
            <p style="margin:0 0 14px;font:14px/22px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#475569;">
              Chào ${escapeHtml(d.fullName)},
            </p>
            <p style="margin:0 0 14px;font:14px/22px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#334155;">
              Cảm ơn bạn đã quan tâm tới dịch vụ phòng kinh doanh xuất khẩu thuê ngoài của Vexim Bridge. Một chuyên gia phụ trách thị trường Mỹ sẽ liên hệ lại với bạn trong vòng <strong>24 giờ làm việc</strong> để xác nhận khung giờ tư vấn 1:1.
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;">
              <tr>
                <td style="padding:10px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font:600 12px/18px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#64748b;letter-spacing:0.04em;text-transform:uppercase;width:160px;">Công ty</td>
                <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font:14px/20px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">${escapeHtml(d.company)}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font:600 12px/18px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#64748b;letter-spacing:0.04em;text-transform:uppercase;">Ngành hàng</td>
                <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font:14px/20px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">${escapeHtml(d.industry)}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;background:#f8fafc;font:600 12px/18px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#64748b;letter-spacing:0.04em;text-transform:uppercase;">Thời gian mong muốn</td>
                <td style="padding:10px 14px;font:14px/20px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">${escapeHtml(d.preferredTime)}</td>
              </tr>
            </table>
            <p style="margin:0 0 14px;font:14px/22px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#334155;">
              Trong thời gian chờ, bạn có thể tham khảo quy trình làm việc của chúng tôi tại <a href="${escapeAttr(siteConfig.url)}#how-it-works" style="color:#0f172a;">${escapeAttr(siteConfig.url)}</a>.
            </p>
            <p style="margin:18px 0 0;font:14px/22px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#334155;">
              Trân trọng,<br/>Đội ngũ Vexim Bridge
            </p>
          </td></tr>
          <tr><td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font:12px/18px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#94a3b8;">
            Email này được gửi tự động. Bạn có thể trả lời trực tiếp để trao đổi thêm.
          </td></tr>
        </table>
      </td></tr>
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

function escapeAttr(s: string): string {
  return escapeHtml(s)
}
