import "server-only"

import { getDefaultFrom, sendMail, type MailAttachment } from "@/lib/mail"

/**
 * Compatibility shim for the old Resend API.
 *
 * The project previously used Resend for transactional mail. We now route
 * everything through Zoho SMTP (see `lib/mail.ts`), but keep this module so
 * existing call-sites (`getResend().emails.send({ ... })`) continue to work
 * without being rewritten. Add new features to `lib/mail.ts` directly.
 */

type ResendSendInput = {
  from: string
  to: string | string[]
  subject: string
  html?: string
  text?: string
  replyTo?: string
  cc?: string | string[]
  bcc?: string | string[]
  headers?: Record<string, string>
  attachments?: MailAttachment[]
}

type ResendSendResult = {
  data: { id: string } | null
  error: { message: string; name?: string } | null
}

export type ResendLike = {
  emails: {
    send: (input: ResendSendInput) => Promise<ResendSendResult>
  }
}

let _client: ResendLike | null = null

export function getResend(): ResendLike {
  if (_client) return _client

  _client = {
    emails: {
      async send(input: ResendSendInput): Promise<ResendSendResult> {
        try {
          const result = await sendMail({
            from: input.from,
            to: input.to,
            subject: input.subject,
            html: input.html,
            text: input.text,
            replyTo: input.replyTo,
            cc: input.cc,
            bcc: input.bcc,
            attachments: input.attachments,
            headers: input.headers,
          })
          return {
            data: { id: result.id },
            error: null,
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          console.error("[v0] zoho send failed:", message)
          return {
            data: null,
            error: { message, name: "ZohoMailError" },
          }
        }
      },
    },
  }

  return _client
}

/**
 * From address used by transactional mail. Honors MAIL_FROM, otherwise falls
 * back to the Zoho mailbox. Kept named `getFromAddress` for backwards
 * compatibility with existing callers.
 */
export function getFromAddress(): string {
  return getDefaultFrom()
}
