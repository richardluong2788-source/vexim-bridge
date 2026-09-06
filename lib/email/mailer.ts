import "server-only"

/**
 * Unified email client backed by Resend.
 *
 * Required env vars:
 *   RESEND_API_KEY      Resend API key from https://resend.com/api-keys
 *   MAIL_FROM           (optional) the "From" header, e.g. "Vexim Trade <noreply@veximtrade.com>"
 *                       Defaults to "noreply@veximtrade.com" if not set.
 *
 * Domain: veximtrade.com (verified on Resend)
 */

const RESEND_API_URL = "https://api.resend.com/emails"

/**
 * Base email addresses — all must be on a verified domain in Resend.
 * Domain: veximtrade.com (verified)
 *
 * NOTE: For buyer-facing emails, use buildPersonalizedSender() to create
 * a human-like sender name (e.g., "Hoc Luong <trade@veximtrade.com>")
 * instead of generic "Vexim Trade" to improve deliverability.
 */
export const SENDER_EMAILS = {
  /** Default: system notifications, password resets, auto-replies */
  noreply: "noreply@veximtrade.com",
  /** Commercial: buyer outreach emails, quotations, follow-ups */
  trade: "trade@veximtrade.com",
  /** General contact & consultation enquiries */
  hello: "hello@veximtrade.com",
} as const

export type SenderKey = keyof typeof SENDER_EMAILS

/**
 * Build a personalized sender address with human name.
 *
 * Why this matters for deliverability:
 * - "Hoc Luong <trade@veximtrade.com>" looks like a real person
 * - "Vexim Trade <trade@veximtrade.com>" looks like automated marketing
 * - Gmail/Outlook spam filters strongly prefer human-looking senders
 *
 * IMPORTANT — display name stripping: if the SAME address is repeatedly
 * used with MANY DIFFERENT display names (e.g. every AE sending from the
 * shared trade@veximtrade.com), Gmail/Outlook eventually stop trusting the
 * display name and show only the raw address. Pass `workEmail` (a person's
 * own address, e.g. "linh@veximtrade.com") whenever one is available —
 * see lib/email/work-email.ts — so each person's name stays stable and tied
 * to their own address instead.
 *
 * @param senderName - Full name of the person sending (e.g., "Hoc Luong")
 * @param options.workEmail - The person's own address, if one has been
 *   provisioned (profiles.work_email). Takes priority over `senderKey`.
 * @param options.senderKey - Fallback shared address to use when no
 *   personal work email exists (trade, hello, noreply).
 * @returns Formatted sender string like '"Hoc Luong" <linh@veximtrade.com>'
 */
export function buildPersonalizedSender(
  senderName: string | null | undefined,
  options: SenderKey | { workEmail?: string | null; senderKey?: SenderKey } = "trade",
): string {
  const opts = typeof options === "string" ? { senderKey: options } : options
  const email = opts.workEmail?.trim() || SENDER_EMAILS[opts.senderKey ?? "trade"]
  // If no sender name, fall back to company name (less ideal but acceptable)
  const displayName = senderName?.trim() || "Vexim Trade"
  // RFC 5322 recommends quoting display names that contain spaces or special characters
  // This ensures email clients properly parse the sender name
  return `"${displayName}" <${email}>`
}

/**
 * @deprecated Use buildPersonalizedSender() for buyer-facing emails.
 * Kept for backward compatibility with system emails.
 */
export const SENDERS = {
  noreply: `"Vexim Trade" <${SENDER_EMAILS.noreply}>`,
  trade: `"Vexim Trade" <${SENDER_EMAILS.trade}>`,
  hello: `"Vexim Trade" <${SENDER_EMAILS.hello}>`,
} as const

function getApiKey(): string {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    throw new Error(
      "Resend is not configured — please set RESEND_API_KEY in your environment variables.",
    )
  }
  return key
}

/**
 * Returns the default From address (deprecated sender style).
 * Priority: MAIL_FROM env var → SENDERS.noreply
 * 
 * @deprecated For buyer-facing emails, use buildPersonalizedSender() instead.
 */
export function getFromAddress(sender: SenderKey = "noreply"): string {
  if (sender === "noreply" && process.env.MAIL_FROM) {
    return process.env.MAIL_FROM
  }
  return SENDERS[sender]
}

/**
 * Get the bare email address (without display name) for a sender key.
 * Useful for Reply-To and other technical headers.
 */
export function getSenderEmail(sender: SenderKey = "trade"): string {
  return SENDER_EMAILS[sender]
}

export interface SendMailInput {
  from?: string
  to: string | string[]
  /** Additional recipients CC'd on the email (e.g. other contacts at the buyer company). */
  cc?: string | string[]
  /**
   * Reply-To header. When set, recipients' "Reply" button targets this
   * address instead of `from`. We use plus-addressing here (e.g.
   * `notifications+opp-A3F9C2@veximtrade.com`) so inbound replies can be routed
   * back to the originating opportunity.
   */
  replyTo?: string
  subject: string
  html?: string
  text?: string
  headers?: Record<string, string>
  /**
   * File đính kèm (Resend API): content là chuỗi base64.
   * VD: hóa đơn PDF đính kèm email gửi khách.
   */
  attachments?: Array<{ filename: string; content: string }>
}

export type SendMailResult =
  | { data: { id: string | null }; error: null }
  | { data: null; error: { message: string } }

/**
 * Send an email via Resend. Returns a `{ data, error }` object shape
 * so call sites can handle both success and error cases uniformly.
 */
export async function sendMail(
  input: SendMailInput,
): Promise<SendMailResult> {
  try {
    const apiKey = getApiKey()
    // Resend API requires `to` as an array of strings
    const toArray = Array.isArray(input.to) ? input.to : [input.to]

    const payload: Record<string, unknown> = {
      from: input.from ?? getFromAddress(),
      to: toArray,
      subject: input.subject,
    }
    if (input.attachments && input.attachments.length > 0) {
      payload.attachments = input.attachments
    }

    if (input.html) payload.html = input.html
    if (input.text) payload.text = input.text
    if (input.replyTo) payload.reply_to = input.replyTo
    if (input.headers) payload.headers = input.headers
    if (input.cc) {
      const ccArray = Array.isArray(input.cc) ? input.cc : [input.cc]
      if (ccArray.length > 0) payload.cc = ccArray
    }

    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const responseText = await response.text()

    if (!response.ok) {
      throw new Error(
        `Resend API error (${response.status}): ${responseText || response.statusText}`,
      )
    }

    const data = JSON.parse(responseText) as { id?: string }
    return { data: { id: data.id ?? null }, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[mailer] sendMail error:", message)
    return { data: null, error: { message } }
  }
}
