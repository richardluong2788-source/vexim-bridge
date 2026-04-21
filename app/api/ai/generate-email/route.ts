import { NextResponse } from "next/server"
import {
  generateEmailDraft,
  EmailGeneratorAuthError,
  type GenerateEmailInput,
} from "@/lib/ai/email-generator"
import type { EmailType } from "@/lib/supabase/types"

const VALID_TYPES: EmailType[] = ["introduction", "follow_up", "quotation", "custom"]

export async function POST(req: Request) {
  let body: Partial<GenerateEmailInput>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (
    !body.opportunityId ||
    typeof body.opportunityId !== "string" ||
    !body.emailType ||
    !VALID_TYPES.includes(body.emailType) ||
    !body.viPrompt ||
    typeof body.viPrompt !== "string" ||
    body.viPrompt.trim().length < 5
  ) {
    return NextResponse.json(
      { error: "Missing or invalid fields: opportunityId, emailType, viPrompt" },
      { status: 400 },
    )
  }

  try {
    const result = await generateEmailDraft({
      opportunityId: body.opportunityId,
      emailType: body.emailType,
      viPrompt: body.viPrompt.trim(),
    })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof EmailGeneratorAuthError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[v0] generate-email failed:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
