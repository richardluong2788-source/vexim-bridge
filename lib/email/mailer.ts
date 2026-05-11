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
const DEFAULT_FROM = "Vexim Trade <noreply@veximtrade.com>"

function getApiKey(): string {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    throw new Error(
      "Resend is not configured — please set RESEND_API_KEY in your environment variables.",
    )
  }
  return key
}

export function getFromAddress(): string {
  return process.env.MAIL_FROM ?? DEFAULT_FROM
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
    const toAddress = Array.isArray(input.to) ? input.to.join(", ") : input.to

    const payload: Record<string, unknown> = {
      from: input.from ?? getFromAddress(),
      to: toAddress,
      subject: input.subject,
    }

    if (input.html) payload.html = input.html
    if (input.text) payload.text = input.text
    if (input.replyTo) payload.reply_to = input.replyTo
    if (input.headers) payload.headers = input.headers

    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Resend API error (${response.status}): ${errorText || response.statusText}`,
      )
    }

    const data = (await response.json()) as { id?: string }
    return { data: { id: data.id ?? null }, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[sendMail] Error:", message)
    return { data: null, error: { message } }
  }
}
