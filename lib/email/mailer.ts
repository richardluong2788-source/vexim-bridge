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
 * Sender addresses — all must be on a verified domain in Resend.
 * Domain: veximtrade.com (verified)
 *
 * To add a new sender, just add a new entry here and use it in your
 * sendMail() call with: from: SENDERS.trade
 */
export const SENDERS = {
  /** Default: system notifications, password resets, auto-replies */
  noreply: "Vexim Trade <noreply@veximtrade.com>",
  /** Commercial: buyer outreach emails, quotations, follow-ups */
  trade: "Vexim Trade <trade@veximtrade.com>",
  /** General contact & consultation enquiries */
  hello: "Vexim Trade <hello@veximtrade.com>",
} as const

export type SenderKey = keyof typeof SENDERS

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
 * Returns the default From address.
 * Priority: MAIL_FROM env var → SENDERS.noreply
 */
export function getFromAddress(sender: SenderKey = "noreply"): string {
  if (sender === "noreply" && process.env.MAIL_FROM) {
    return process.env.MAIL_FROM
  }
  return SENDERS[sender]
}

export interface SendMailInput {
  from?: string
  to: string | string[]
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

    if (input.html) payload.html = input.html
    if (input.text) payload.text = input.text
    if (input.replyTo) payload.reply_to = input.replyTo
    if (input.headers) payload.headers = input.headers

    console.log("[v0] sendMail payload:", JSON.stringify({ 
      from: payload.from, 
      to: payload.to, 
      subject: payload.subject,
      hasHtml: !!payload.html,
      hasText: !!payload.text,
    }))

    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const responseText = await response.text()
    console.log("[v0] Resend response:", response.status, responseText)

    if (!response.ok) {
      throw new Error(
        `Resend API error (${response.status}): ${responseText || response.statusText}`,
      )
    }

    const data = JSON.parse(responseText) as { id?: string }
    console.log("[v0] Email sent successfully, id:", data.id)
    return { data: { id: data.id ?? null }, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[v0] sendMail Error:", message)
    return { data: null, error: { message } }
  }
}
