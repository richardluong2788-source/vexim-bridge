import "server-only"

import nodemailer, { type Transporter } from "nodemailer"

/**
 * Unified SMTP mailer backed by Zoho.
 *
 * Required env vars:
 *   ZOHO_SMTP_HOST      e.g. smtp.zoho.com (or smtp.zoho.in / smtppro.zoho.com for Zoho Mail Premium)
 *   ZOHO_SMTP_USER      full Zoho mailbox, e.g. notifications@yourdomain.com
 *   ZOHO_SMTP_PASSWORD  Zoho app password (NOT the web login password)
 *   ZOHO_FROM_EMAIL     (optional) the "From" header, e.g. "Vexim Bridge <notifications@yourdomain.com>"
 *                       Defaults to ZOHO_SMTP_USER if not set.
 *   ZOHO_SMTP_PORT      (optional) defaults to 465 (SSL). Use 587 for STARTTLS.
 *
 * The transporter is instantiated lazily and reused across invocations in the
 * same runtime (important for warm lambdas — avoids re-handshaking on every
 * email).
 */

let _transporter: Transporter | null = null

function getTransporter(): Transporter {
  if (_transporter) return _transporter

  const host = process.env.ZOHO_SMTP_HOST
  const user = process.env.ZOHO_SMTP_USER
  const pass = process.env.ZOHO_SMTP_PASSWORD

  if (!host || !user || !pass) {
    throw new Error(
      "Zoho SMTP is not configured — please set ZOHO_SMTP_HOST, ZOHO_SMTP_USER and ZOHO_SMTP_PASSWORD",
    )
  }

  const port = Number(process.env.ZOHO_SMTP_PORT ?? 465)
  // Zoho: 465 = implicit SSL, 587 = STARTTLS.
  const secure = port === 465

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  })

  return _transporter
}

export function getFromAddress(): string {
  return (
    process.env.ZOHO_FROM_EMAIL ??
    process.env.ZOHO_SMTP_USER ??
    "no-reply@localhost"
  )
}

export interface SendMailInput {
  from?: string
  to: string | string[]
  /**
   * Reply-To header. When set, recipients' "Reply" button targets this
   * address instead of `from`. We use plus-addressing here (e.g.
   * `notifications+opp-A3F9C2@vexim.com`) so inbound replies can be routed
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
 * Send an email via Zoho SMTP. Mirrors Resend's `{ data, error }` return shape
 * so call sites that previously used `resend.emails.send` don't need to change
 * their error-handling style.
 */
export async function sendMail(
  input: SendMailInput,
): Promise<SendMailResult> {
  try {
    const transporter = getTransporter()
    const info = await transporter.sendMail({
      from: input.from ?? getFromAddress(),
      to: Array.isArray(input.to) ? input.to.join(", ") : input.to,
      replyTo: input.replyTo,
      subject: input.subject,
      html: input.html,
      text: input.text,
      headers: input.headers,
    })
    return { data: { id: info.messageId ?? null }, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { data: null, error: { message } }
  }
}
