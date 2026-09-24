import { NextResponse } from "next/server"
import { z } from "zod"
import { sendMail, getFromAddress } from "@/lib/email/mailer"
import { siteConfig } from "@/lib/site-config"
import { checkRateLimit, type RateRule } from "@/lib/security/rate-limit"
import { clientIpFromHeaders, recordMarketingLead } from "@/lib/marketing/leads"

export const runtime = "nodejs"

const IP_RULE: RateRule = { limit: 8, windowMs: 10 * 60 * 1000 }
const EMAIL_RULE: RateRule = { limit: 5, windowMs: 60 * 60 * 1000 }
const RATE_LIMIT_DISABLED = process.env.MARKETING_LEAD_RATE_LIMIT_DISABLED === "1"

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""))

const payloadSchema = z.object({
  product: z.string().trim().min(2, "Product too short").max(200),
  quantity: z.string().trim().min(1, "Quantity required").max(200),
  email: z.string().trim().email("Invalid email").max(160),
  company: z.string().trim().min(1, "Company required").max(160),
  targetPrice: optionalText(120),
  timeline: optionalText(100),
  specs: optionalText(2000),
  compliance: optionalText(1000),
  // Legacy fields for backwards compat
  needFda: optionalText(10),
  needMocra: optionalText(10),
  needCgmps: optionalText(10),
  needQc: optionalText(10),
  website: z.string().optional(),
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

  if (!RATE_LIMIT_DISABLED) {
    const ipVerdict = checkRateLimit(`sourcing:ip:${ip ?? "unknown"}`, IP_RULE)
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
        error: firstIssue?.message ?? "Invalid data",
        field: firstIssue?.path.join("."),
      },
      { status: 400 },
    )
  }

  const data = parsed.data

  if (data.website && data.website.trim().length > 0) {
    return NextResponse.json({ ok: true })
  }

  const emailVerdict = checkRateLimit(`sourcing:email:${data.email.toLowerCase()}`, EMAIL_RULE)
  if (!emailVerdict.allowed) {
    return rateLimited(emailVerdict.retryAfterSeconds, data.locale ?? requestLocale(req))
  }

  // New compliance field takes precedence, fallback to legacy checkboxes
  const complianceNeeds = data.compliance?.trim()
    ? data.compliance
    : [
        data.needFda ? "FDA check" : null,
        data.needMocra ? "MoCRA review" : null,
        data.needCgmps ? "cGMP/ISO" : null,
        data.needQc ? "QC" : null,
      ]
        .filter(Boolean)
        .join(", ")

  const timelineLabel = data.timeline || "(not specified)"

  const lead = await recordMarketingLead({
    audience: "buyer",
    source: "buyer_sourcing_request",
    fullName: data.product,
    email: data.email,
    company: data.company,
    industry: complianceNeeds || "general",
    message: `Product: ${data.product}\nQuantity: ${data.quantity}\nTarget: ${data.targetPrice || "(not specified)"}\nTimeline: ${timelineLabel}\nSpecs: ${data.specs || ""}\nCompliance & Quality: ${complianceNeeds || "none"}`,
    locale: data.locale,
    attribution: {
      pagePath: data.pagePath,
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
    rawPayload: { ...data, website: undefined },
  })

  if (lead.duplicate) {
    return NextResponse.json({ ok: true, reference: lead.reference ?? undefined, duplicate: true })
  }

  const submittedAt = new Date()
  const submittedAtLabel = new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(submittedAt)

  const internalRecipient = process.env.ZOHO_SMTP_USER ?? getFromAddress()

  const internalHtml = `
    <h2>New Buyer Sourcing Request ${lead.reference ? `#${lead.reference}` : ""}</h2>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
      <tr><td><strong>Reference</strong></td><td>${lead.reference ?? "(no DB)"}</td></tr>
      <tr><td><strong>Product</strong></td><td>${escapeHtml(data.product)}</td></tr>
      <tr><td><strong>Quantity / Scale</strong></td><td>${escapeHtml(data.quantity)}</td></tr>
      <tr><td><strong>Timeline</strong></td><td>${escapeHtml(timelineLabel)}</td></tr>
      <tr><td><strong>Target Price</strong></td><td>${escapeHtml(data.targetPrice || "(not specified - optional)")}</td></tr>
      <tr><td><strong>Company</strong></td><td>${escapeHtml(data.company)}</td></tr>
      <tr><td><strong>Email</strong></td><td>${escapeHtml(data.email)}</td></tr>
      <tr><td><strong>Compliance & Quality Requirements</strong></td><td>${escapeHtml(complianceNeeds || "none - buyer to be advised")}</td></tr>
      <tr><td><strong>Specs / Link</strong></td><td><pre style="white-space:pre-wrap;margin:0">${escapeHtml(data.specs || "")}</pre></td></tr>
      <tr><td><strong>Page</strong></td><td>${escapeHtml(data.pagePath || "")}</td></tr>
      <tr><td><strong>UTM</strong></td><td>${escapeHtml([data.utmSource, data.utmMedium, data.utmCampaign].filter(Boolean).join(" / ") || "")}</td></tr>
    </table>
    <p style="margin-top:16px"><strong>Routing hint:</strong> Buyer intent = ${escapeHtml(data.product)} | ${escapeHtml(complianceNeeds || "general")} | ${escapeHtml(data.quantity)} | ${escapeHtml(timelineLabel)}</p>
    <p>Submitted: ${escapeHtml(submittedAtLabel)} ET</p>
    <p style="font-size:12px;color:#64748b">We use this information to identify suitable suppliers and assess relevant compliance requirements. We do not sell or share your request with third parties.</p>
  `

  const internalResult = await sendMail({
    to: internalRecipient,
    subject: `[Buyer RFQ${lead.reference ? ` #${lead.reference}` : ""}] ${data.product} - ${data.company} - ${timelineLabel}`,
    html: internalHtml,
    text: `Buyer RFQ ${lead.reference ?? ""}\nProduct: ${data.product}\nQuantity: ${data.quantity}\nTimeline: ${timelineLabel}\nCompany: ${data.company}\nEmail: ${data.email}\nTarget: ${data.targetPrice}\nCompliance & Quality: ${complianceNeeds}\nSpecs: ${data.specs}`,
    headers: { "Reply-To": data.email },
  })

  if (internalResult.error && !lead.stored) {
    return NextResponse.json(
      {
        error: "We could not submit your request. Please try again or email hello@veximtrade.com",
      },
      { status: 502 },
    )
  }

  const buyerHtml = `
    <p>Hi,</p>
    <p>Thank you for your sourcing request. We have received your inquiry for <strong>${escapeHtml(data.product)}</strong> (${escapeHtml(data.quantity)}).</p>
    <p>Our team will review your requirements and share initial screened supplier options as soon as possible, typically within 48 business hours depending on category and specifications.</p>
    <p><strong>What we will check for you:</strong><br/>
    - Company information and production capability<br/>
    - Export history and certifications where available<br/>
    - U.S. regulatory readiness (FDA facility registration, MoCRA where applicable - review, not approval)<br/>
    - Product specs and commercial fit</p>
    <p><strong>Compliance & Quality needs you selected:</strong> ${escapeHtml(complianceNeeds || "To be advised")}</p>
    <p><strong>How we are compensated:</strong> No upfront sourcing fee for buyers. We are compensated by suppliers when a transaction is successfully completed. We do not add a separate Vexim line-item markup to your order. Supplier pricing may reflect its own commercial terms.</p>
    <p>We use this information to identify suitable suppliers and assess relevant compliance requirements. We do not sell or share your request with third parties.</p>
    <p>If you have additional specs, you can reply directly to this email.</p>
    <p>— Vexim Trade<br/>${siteConfig.url}</p>
  `
  await sendMail({
    to: data.email,
    subject: "We received your sourcing request - Vexim Trade",
    html: buyerHtml,
    text: `Thank you for your sourcing request for ${data.product}. We will share initial screened options typically within 48 business hours. No upfront fee for buyers.`,
  })

  return NextResponse.json({ ok: true, reference: lead.reference ?? undefined })
}

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
      error: locale === "vi" ? "Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút." : "Too many requests. Please try again in a few minutes.",
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  )
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}
