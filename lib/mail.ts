import "server-only"
import nodemailer from "nodemailer"

/**
 * Zoho SMTP configuration.
 *
 * Required env vars:
 *  - ZOHO_EMAIL           : Zoho mailbox address (e.g. bridge@veximglobal.com)
 *  - ZOHO_APP_PASSWORD    : Zoho App Password (NOT your regular login password)
 *  - ZOHO_SMTP_HOST       : defaults to smtp.zoho.com (use smtp.zoho.eu for EU accounts)
 *  - ZOHO_SMTP_PORT       : defaults to 465 (SSL). 587 also works with STARTTLS.
 *  - MAIL_FROM            : (optional) display From address, defaults to ZOHO_EMAIL
 *
 * For Zoho Mail you MUST use an "App Password" — create one at
 * https://accounts.zoho.com/home#security/app_password
 */

const DEFAULT_HOST = "smtp.zoho.com"
const DEFAULT_PORT = 465

function resolveConfig() {
  const user = process.env.ZOHO_EMAIL
  const pass = process.env.ZOHO_APP_PASSWORD
  const host = process.env.ZOHO_SMTP_HOST ?? DEFAULT_HOST
  const port = Number(process.env.ZOHO_SMTP_PORT ?? DEFAULT_PORT)
  const secure = port === 465 // true for 465 (SSL), false for 587 (STARTTLS)
  return { user, pass, host, port, secure }
}

let cachedTransporter: nodemailer.Transporter | null = null

function getTransporter() {
  if (cachedTransporter) return cachedTransporter

  const { user, pass, host, port, secure } = resolveConfig()

  if (!user || !pass) {
    throw new Error(
      "[mail] Missing ZOHO_EMAIL or ZOHO_APP_PASSWORD environment variables. " +
        "Configure them in the Vercel project before sending mail.",
    )
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  })

  return cachedTransporter
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
  /** Extra headers (e.g. List-Unsubscribe for one-click unsubscribe). */
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
  const email = process.env.ZOHO_EMAIL
  if (email) return `Vexim Bridge <${email}>`
  return "Vexim Bridge <no-reply@veximbridge.local>"
}

/**
 * Send an email via Zoho SMTP.
 *
 * Usage:
 *   await sendMail({
 *     to: "user@example.com",
 *     subject: "Hello",
 *     html: "<p>Hi</p>",
 *   })
 */
export async function sendMail(options: SendMailOptions): Promise<SendMailResult> {
  const transporter = getTransporter()
  const from = options.from ?? getDefaultFrom()

  const info = await transporter.sendMail({
    from,
    to: options.to,
    cc: options.cc,
    bcc: options.bcc,
    replyTo: options.replyTo,
    subject: options.subject,
    html: options.html,
    text: options.text,
    attachments: options.attachments,
    headers: options.headers,
  })

  return {
    id: info.messageId,
    accepted: info.accepted as SendMailResult["accepted"],
    rejected: info.rejected as SendMailResult["rejected"],
  }
}

/** Quick SMTP connection check (useful for debugging). */
export async function verifyMailConnection(): Promise<boolean> {
  const transporter = getTransporter()
  await transporter.verify()
  return true
}
