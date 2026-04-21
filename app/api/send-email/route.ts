import { NextResponse } from "next/server"
import { z } from "zod"
import { sendMail } from "@/lib/mail"

export const runtime = "nodejs"

const bodySchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email()).min(1)]),
  subject: z.string().min(1),
  html: z.string().optional(),
  text: z.string().optional(),
  replyTo: z.string().email().optional(),
})

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const parsed = bodySchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { to, subject, html, text, replyTo } = parsed.data

    if (!html && !text) {
      return NextResponse.json(
        { error: "Cần cung cấp ít nhất một trong hai trường: `html` hoặc `text`." },
        { status: 400 },
      )
    }

    const result = await sendMail({ to, subject, html, text, replyTo })

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("[v0] send-email error:", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
