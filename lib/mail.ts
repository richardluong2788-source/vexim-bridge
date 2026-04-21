import "server-only"
import nodemailer from "nodemailer"

/**
 * Zoho SMTP configuration.
 *
 * Environment variables required:
 *  - ZOHO_EMAIL           : địa chỉ email Zoho (vd: bridge@veximglobal.com)
 *  - ZOHO_APP_PASSWORD    : app password tạo trong Zoho (KHÔNG phải mật khẩu đăng nhập web)
 *  - ZOHO_SMTP_HOST       : mặc định smtp.zoho.com (dùng smtp.zoho.eu nếu tài khoản đăng ký ở EU)
 *  - ZOHO_SMTP_PORT       : mặc định 465 (SSL). Có thể dùng 587 (STARTTLS).
 *  - MAIL_FROM            : (tuỳ chọn) địa chỉ hiển thị người gửi, mặc định = ZOHO_EMAIL
 *
 * Lưu ý: Với Zoho Mail, bạn PHẢI dùng "App Password" chứ không dùng mật khẩu đăng nhập thường.
 * Tạo app password tại: https://accounts.zoho.com/home#security/app_password
 */

const host = process.env.ZOHO_SMTP_HOST ?? "smtp.zoho.com"
const port = Number(process.env.ZOHO_SMTP_PORT ?? 465)
const secure = port === 465 // true cho 465 (SSL), false cho 587 (STARTTLS)

let cachedTransporter: nodemailer.Transporter | null = null

function getTransporter() {
  if (cachedTransporter) return cachedTransporter

  const user = process.env.ZOHO_EMAIL
  const pass = process.env.ZOHO_APP_PASSWORD

  if (!user || !pass) {
    throw new Error(
      "[mail] Thiếu biến môi trường ZOHO_EMAIL hoặc ZOHO_APP_PASSWORD. Vui lòng cấu hình trước khi gửi mail.",
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

export type SendMailOptions = {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  from?: string
  replyTo?: string
  cc?: string | string[]
  bcc?: string | string[]
  attachments?: {
    filename: string
    content?: string | Buffer
    path?: string
    contentType?: string
  }[]
}

export type SendMailResult = {
  id: string
  accepted: (string | { address: string; name: string })[]
  rejected: (string | { address: string; name: string })[]
}

/**
 * Gửi email qua Zoho SMTP.
 *
 * Ví dụ:
 *   await sendMail({
 *     to: "user@example.com",
 *     subject: "Xin chào",
 *     html: "<p>Nội dung...</p>",
 *   })
 */
export async function sendMail(options: SendMailOptions): Promise<SendMailResult> {
  const transporter = getTransporter()
  const from = options.from ?? process.env.MAIL_FROM ?? process.env.ZOHO_EMAIL!

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
  })

  return {
    id: info.messageId,
    accepted: info.accepted as SendMailResult["accepted"],
    rejected: info.rejected as SendMailResult["rejected"],
  }
}

/**
 * Kiểm tra nhanh kết nối SMTP (dùng khi debug).
 */
export async function verifyMailConnection(): Promise<boolean> {
  const transporter = getTransporter()
  await transporter.verify()
  return true
}
