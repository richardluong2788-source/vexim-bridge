import "server-only"

/**
 * Resend Email Configuration
 *
 * Required env vars:
 *  - RESEND_API_KEY: Resend API key from https://resend.com/api-keys
 *
 * Domain: veximtrade.com (verified on Resend)
 */

const RESEND_BASE_URL = "https://api.resend.com"
const DEFAULT_FROM = "Vexim Trade <noreply@veximtrade.com>"

function getApiKey(): string {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    throw new Error(
      "[mail] Missing RESEND_API_KEY environment variable. " +
        "Configure it in the Vercel project before sending mail.",
    )
  }
  return key
}

export type MailAttachment = {
  filename: string
  content?: string | Buffer
  path?: string
  contentType?: string
}

export type SendMailOptions = {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  from?: string
  replyTo?: string
  cc?: string | string[]
  bcc?: string | string[]
  attachments?: MailAttachment[]
  headers?: Record<string, string>
}

export type SendMailResult = {
  id: string
  accepted: (string | { address: string; name: string })[]
  rejected: (string | { address: string; name: string })[]
}

/** Returns the From address used by default. */
export function getDefaultFrom(): string {
  const explicit = process.env.MAIL_FROM
  if (explicit) return explicit
  return DEFAULT_FROM
}

/**
 * Send an email via Resend.
 *
 * Usage:
 *   await sendMail({
 *     to: "user@example.com",
 *     subject: "Hello",
 *     html: "<p>Hi</p>",
 *   })
 */
export async function sendMail(
  options: SendMailOptions,
): Promise<SendMailResult> {
  const apiKey = getApiKey()
  const from = options.from ?? getDefaultFrom()

  // Normalize to and other fields to arrays or strings as needed
  const to = Array.isArray(options.to) ? options.to.join(",") : options.to

  const payload: Record<string, unknown> = {
    from,
    to,
    subject: options.subject,
  }

  if (options.html) payload.html = options.html
  if (options.text) payload.text = options.text
  if (options.replyTo) payload.reply_to = options.replyTo
  if (options.cc) {
    payload.cc = Array.isArray(options.cc) ? options.cc.join(",") : options.cc
  }
  if (options.bcc) {
    payload.bcc = Array.isArray(options.bcc)
      ? options.bcc.join(",")
      : options.bcc
  }
  if (options.headers) {
    payload.headers = options.headers
  }

  // Note: Resend does not support attachments in the same way as nodemailer.
  // If you need attachments, consider storing them in Blob and sending a link.
  if (options.attachments && options.attachments.length > 0) {
    console.warn(
      "[mail] Resend does not support attachments via this API. Skipping attachments.",
    )
  }

  try {
    const response = await fetch(`${RESEND_BASE_URL}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(
        `[mail] Resend API error (${response.status}): ${error}`,
      )
    }

    const data = (await response.json()) as { id: string }

    // Return a result in the same format as nodemailer for compatibility
    return {
      id: data.id,
      accepted: Array.isArray(options.to) ? options.to : [options.to],
      rejected: [],
    }
  } catch (error) {
    console.error("[mail] Failed to send email:", error)
    throw error
  }
}
