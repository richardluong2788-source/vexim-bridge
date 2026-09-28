import { NextResponse } from "next/server"
import { z } from "zod"
import { sendMail, getFromAddress } from "@/lib/email/mailer"
import { INDUSTRIES } from "@/lib/constants/industries"
import { siteConfig } from "@/lib/site-config"
import { checkRateLimit, type RateRule } from "@/lib/security/rate-limit"
import { clientIpFromHeaders, recordMarketingLead } from "@/lib/marketing/leads"

/**
 * Public endpoint powering the landing "Đặt lịch tư vấn 1:1" form.
 *
 * Flow:
 *   1. Throttle by client IP (before we even parse the body — floods are the
 *      only case where parsing is a cost we pay for free).
 *   2. Validate payload with zod (server-side — never trust the client).
 *   3. Persist to `public.marketing_leads` (migration 082) with a source tag
 *      and utm/referrer attribution. THIS IS THE SYSTEM OF RECORD.
 *   4. Send an internal notification email + an auto-reply to the lead.
 *
 * Ordering matters. Before 082 this route only emailed, which meant a lead was
 * worth exactly as much as the SMTP connection that carried it. Now:
 *   - DB write fails (no service-role key in a preview, migration not applied
 *     yet, transient PostgREST error) → we still send the email and still
 *     answer 200, because the human on the other end did nothing wrong.
 *   - DB write OK but internal email fails → answer 200. The lead is captured;
 *     telling the visitor "try again" would only produce a duplicate.
 *   - Both failed → 502, so the form can show a fallback contact address.
 *
 * Audience note: this form is submitted by VIETNAMESE SUPPLIERS (factories
 * wanting Vexim to sell for them), so the row is tagged audience='supplier'
 * and lands in the sourcing queue. It is deliberately NOT inserted into
 * `public.leads`, which is the BUYER table feeding AI matching (see the header
 * of scripts/082_marketing_leads.sql).
 */

export const runtime = "nodejs"

/**
 * Two cheap windows are enough for a form that should see a handful of
 * submissions a day: a burst guard and a slow-drip guard. Both are per
 * instance — see lib/security/rate-limit.ts for why the durable backstop is
 * the unique index in 082, not this map.
 *
 * 8/10min per IP is deliberately loose for a NAT'd office (one egress IP,
 * several real factories) and tight enough that a scraper has to pace itself.
 * Behind Vercel `x-forwarded-for` is always present; the shared "unknown"
 * bucket only exists in dev, where the same limit applies to the whole
 * machine — use the env var below when testing the form repeatedly.
 */
const IP_RULE: RateRule = { limit: 8, windowMs: 10 * 60 * 1000 }
const EMAIL_RULE: RateRule = { limit: 3, windowMs: 60 * 60 * 1000 }

/** Escape hatch for local QA / load testing: MARKETING_LEAD_RATE_LIMIT_DISABLED=1 */
const RATE_LIMIT_DISABLED = process.env.MARKETING_LEAD_RATE_LIMIT_DISABLED === "1"

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

/** Optional, free-text marketing fields: absent or empty both mean "not given". */
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""))

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
  // ---- Attribution (additive: the form sends these, older clients may not) ----
  locale: z.enum(["vi", "en"]).optional(),
  pagePath: optionalText(200),
  referrer: optionalText(300),
  utmSource: optionalText(120),
  utmMedium: optionalText(120),
  utmCampaign: optionalText(200),
  utmContent: optionalText(200),
  utmTerm: optionalText(200),
  gclid: optionalText(120),
})

export async function POST(req: Request) {
  const ip = clientIpFromHeaders(req.headers)

  // 1) Flood gate. Runs before parsing so a spam burst costs us one Map lookup,
  //    not a JSON parse + zod pass + SMTP call. Language comes from the locale
  //    cookie here, because the body has not been read yet.
  if (!RATE_LIMIT_DISABLED) {
    const ipVerdict = checkRateLimit(`consultation:ip:${ip ?? "unknown"}`, IP_RULE)
    if (!ipVerdict.allowed) return rateLimited(ipVerdict.retryAfterSeconds, requestLocale(req))
  }

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

  // Honeypot tripped — silently accept (don't signal to bots that we filtered
  // them). No DB write, no email; the IP bucket above already counted the hit,
  // so a bot that sprays this field still walks into the 429.
  if (data.website && data.website.trim().length > 0) {
    return NextResponse.json({ ok: true })
  }

  // 2) Slow-drip gate per address, so one company can't occupy the queue.
  const emailVerdict = checkRateLimit(`consultation:email:${data.email.toLowerCase()}`, EMAIL_RULE)
  if (!emailVerdict.allowed) {
    return rateLimited(emailVerdict.retryAfterSeconds, data.locale ?? requestLocale(req))
  }

  // 3) Persist first — the row is the system of record, the email is a
  //    notification about it. `recordMarketingLead` never throws: a missing
  //    service-role key or an unapplied 082 migration comes back as
  //    stored=false and we fall through to the email-only behaviour we had
  //    before (no lead lost, just no DB copy).
  const lead = await recordMarketingLead({
    audience: "supplier",
    source: "landing_consultation",
    fullName: data.fullName,
    email: data.email,
    phone: data.phone,
    company: data.company,
    industry: data.industry,
    preferredTime: data.preferredTime,
    message: data.message,
    locale: data.locale,
    attribution: {
      pagePath: data.pagePath,
      // Same-origin fetch sends Referer, so we get the submitting page even if
      // an older build of the form doesn't send pagePath.
      referrer: data.referrer || req.headers.get("referer"),
      utmSource: data.utmSource,
      utmMedium: data.utmMedium,
      utmCampaign: data.utmCampaign,
      utmContent: data.utmContent,
      utmTerm: data.utmTerm,
      gclid: data.gclid,
      userAgent: req.headers.get("user-agent"),
      ip,
    },
    // Keep what the visitor actually sent (minus the honeypot) so future form
    // fields aren't silently dropped when the schema grows.
    rawPayload: { ...data, website: undefined },
  })

  // Same person, same still-untouched row → nothing new to route. Confirm
  // receipt and re-show the original reference instead of emailing twice.
  if (lead.duplicate) {
    return NextResponse.json({ ok: true, reference: lead.reference ?? undefined, duplicate: true })
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
    reference: lead.reference,
    fullName: data.fullName,
    email: data.email,
    phone: data.phone,
    company: data.company,
    industry: data.industry,
    preferredTime: preferredTimeLabel,
    message: data.message?.trim() || "",
    submittedAt: submittedAtLabel,
  })

  const internalTextLines = [
    "Yêu cầu đặt lịch tư vấn 1:1 mới",
    "----------------------------------",
    lead.reference ? `Mã lead:       ${lead.reference}` : "Mã lead:       (không có — DB chưa ghi được)",
    `Họ tên:        ${data.fullName}`,
    `Email:         ${data.email}`,
    `Điện thoại:    ${data.phone}`,
    `Công ty:       ${data.company}`,
    `Ngành hàng:    ${data.industry}`,
    `Thời gian:     ${preferredTimeLabel}`,
    "",
    "Nguồn:",
    `  page:        ${data.pagePath || "/#consultation"}`,
    `  referrer:    ${data.referrer || "(trực tiếp)"}`,
    `  utm:         ${[data.utmSource, data.utmMedium, data.utmCampaign].filter(Boolean).join(" / ") || "(không có)"}`,
    "",
    "Nội dung:",
    data.message?.trim() || "(không có)",
    "",
    `Gửi lúc: ${submittedAtLabel}`,
  ]
  if (!lead.stored) {
    internalTextLines.push(
      "",
      "CẢNH BÁO: không ghi được vào bảng marketing_leads — lead này chỉ tồn tại trong email.",
    )
  }
  const internalText = internalTextLines.join("\n")

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
    "Vexim Trade đã nhận được yêu cầu đặt lịch tư vấn 1:1 của bạn.",
    "Một chuyên gia sẽ liên hệ lại trong vòng 24 giờ làm việc để xác nhận khung giờ phù hợp.",
    "",
    "Thông tin bạn đã gửi:",
    `- Công ty: ${data.company}`,
    `- Ngành hàng: ${data.industry}`,
    `- Thời gian mong muốn: ${preferredTimeLabel}`,
    "",
    "Nếu cần hỗ trợ gấp, bạn có thể trả lời trực tiếp email này.",
    "",
    "— Đội ngũ Vexim Trade",
    siteConfig.url,
  ].join("\n")

  // Fire both emails. Internal first (that's how the team sees the lead); the
  // customer auto-reply is best-effort.
  const referenceTag = lead.reference ? ` #${lead.reference}` : ""
  const internalResult = await sendMail({
    to: internalRecipient,
    subject: `[Tư vấn 1:1${referenceTag}] ${data.company} · ${data.fullName}`,
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
    // If the row is in the DB the enquiry is not lost — failing the request
    // here would only teach the visitor to submit twice. Escalate to an error
    // only when both the DB write and the email are gone.
    if (lead.stored) {
      return NextResponse.json({ ok: true, reference: lead.reference ?? undefined, queued: false })
    }
    return NextResponse.json(
      {
        error: localized(
          {
            vi: "Không gửi được yêu cầu. Vui lòng thử lại hoặc liên hệ trực tiếp contact@veximglobal.com.",
            en: "We could not submit your request. Please try again, or email contact@veximglobal.com directly.",
          },
          data.locale ?? requestLocale(req),
        ),
      },
      { status: 502 },
    )
  }

  const customerResult = await sendMail({
    to: data.email,
    subject: "Đã nhận yêu cầu tư vấn 1:1 · Vexim Trade",
    html: customerHtml,
    text: customerText,
  })

  if (customerResult.error) {
    // Don't fail the request — the lead is captured and the team was notified.
    console.warn(
      "[v0] consultation: customer auto-reply failed:",
      customerResult.error.message,
    )
  }

  return NextResponse.json({ ok: true, reference: lead.reference ?? undefined })
}

// --------------------------------------------------------------------------
// Responses
// --------------------------------------------------------------------------

/** Picks the copy for the submitter's language, defaulting to VI (the landing's primary audience). */
function localized(copies: { vi: string; en: string }, locale?: "vi" | "en"): string {
  return locale === "en" ? copies.en : copies.vi
}

/**
 * Locale before the body is parsed — the same `esh_locale` cookie the app's own
 * locale switcher writes (lib/i18n/config.ts). Needed because the flood gate
 * answers 429 without ever reading the payload, and an English-speaking visitor
 * should not be told to retry in Vietnamese.
 */
function requestLocale(req: Request): "vi" | "en" | undefined {
  const raw = req.headers.get("cookie")
  if (!raw) return undefined
  for (const part of raw.split(";")) {
    const [name, value] = part.trim().split("=")
    if (name === "esh_locale" && (value === "en" || value === "vi")) return value
  }
  return undefined
}

function rateLimited(retryAfterSeconds: number, locale?: "vi" | "en") {
  return NextResponse.json(
    {
      error: localized(
        {
          vi: "Bạn vừa gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.",
          en: "Too many requests from you right now. Please try again in a few minutes.",
        },
        locale,
      ),
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds), "X-RateLimit-Remaining": "0" },
    },
  )
}

// --------------------------------------------------------------------------
// Email renderers — inline styles only so Gmail / Outlook render correctly.
// --------------------------------------------------------------------------

interface InternalEmailData {
  /** Row id in marketing_leads — null when the DB write was unavailable. */
  reference: string | null
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
              <div style="font:600 12px/16px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Vexim Trade · Lead mới</div>
              <div style="margin-top:4px;font:700 18px/26px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#ffffff;">Yêu cầu đặt lịch tư vấn 1:1</div>
            </td>
          </tr>
          <tr><td style="height:4px;background:#14b8a6;line-height:4px;font-size:0;">&nbsp;</td></tr>
          <tr><td style="padding:20px 24px 8px;font:14px/22px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#475569;">
            Khách hàng vừa gửi yêu cầu tư vấn từ landing page. Vui lòng liên hệ lại trong vòng 24 giờ làm việc.
          </td></tr>
          <tr><td style="padding:8px 24px 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;">
              ${d.reference ? row("Mã lead", d.reference) : ""}
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
            Gửi lúc ${escapeHtml(d.submittedAt)} (giờ Việt Nam) · Nguồn: landing page ${escapeHtml(siteConfig.url)}${
              d.reference
                ? ` · Đã lưu vào bảng <code>marketing_leads</code> — tra theo mã ${escapeHtml(d.reference)}`
                : " · ⚠ Chưa lưu được vào DB (kiểm tra migration 082 / service-role key)"
            }
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
              <div style="font:600 12px/16px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Vexim Trade</div>
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
              Cảm ơn bạn đã quan tâm tới dịch vụ phòng kinh doanh xuất khẩu thuê ngoài của Vexim Trade. Một chuyên gia phụ trách thị trường Mỹ sẽ liên hệ lại với bạn trong vòng <strong>24 giờ làm việc</strong> để xác nhận khung giờ tư vấn 1:1.
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
              Trân trọng,<br/>Đội ngũ Vexim Trade
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
