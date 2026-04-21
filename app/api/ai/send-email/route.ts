import { NextResponse } from "next/server"
import {
  sendEmailDraft,
  rejectEmailDraft,
  EmailSenderAuthError,
} from "@/lib/ai/email-sender"

export async function POST(req: Request) {
  let body: {
    draftId?: string
    action?: "send" | "reject"
    overrideSubject?: string
    overrideContent?: string
    overrideRecipient?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.draftId || typeof body.draftId !== "string") {
    return NextResponse.json({ error: "draftId is required" }, { status: 400 })
  }

  try {
    if (body.action === "reject") {
      await rejectEmailDraft(body.draftId)
      return NextResponse.json({ status: "rejected" })
    }

    const result = await sendEmailDraft(body.draftId, {
      overrideSubject: body.overrideSubject,
      overrideContent: body.overrideContent,
      overrideRecipient: body.overrideRecipient,
    })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof EmailSenderAuthError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[v0] send-email failed:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
