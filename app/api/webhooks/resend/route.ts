import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { classifyBuyerReply } from "@/lib/ai/reply-classifier"

// Ensure this webhook route is never affected by middleware
export const runtime = "nodejs"
export const preferredRegion = "auto"

/**
 * Resend Inbound Email Webhook Handler
 *
 * Flow:
 * 1. Resend sends email.received event when buyer replies to trade@veximtrade.com
 * 2. Webhook contains metadata only (no body) - we fetch body via Resend API
 * 3. Match email to opportunity via:
 *    - In-Reply-To header (matches our sent email's Message-ID)
 *    - OR sender email (matches lead's contact_email)
 * 4. Auto-create buyer_reply record with AI classification
 *
 * Setup in Resend Dashboard:
 * - Webhook URL: https://veximtrade.com/api/webhooks/resend
 * - Events: email.received
 * - Signing secret: RESEND_WEBHOOK_SECRET env var
 */

type ResendWebhookPayload = {
  type: "email.received"
  created_at: string
  data: {
    email_id: string
    from: string
    to: string[]
    cc?: string[]
    bcc?: string[]
    subject: string
    message_id: string
    in_reply_to?: string
    created_at: string
  }
}

type ResendEmailContent = {
  id: string
  from: string
  to: string[]
  subject: string
  text?: string
  html?: string
}

/**
 * Fetch full email content from Resend API.
 * Webhook only contains metadata - body must be fetched separately.
 */
async function fetchEmailContent(emailId: string): Promise<ResendEmailContent | null> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error("[v0] RESEND_API_KEY not set, cannot fetch email content")
    return null
  }

  try {
    const res = await fetch(`https://api.resend.com/emails/${emailId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!res.ok) {
      console.error("[v0] Failed to fetch email content:", res.status, await res.text())
      return null
    }

    return await res.json()
  } catch (err) {
    console.error("[v0] Error fetching email content:", err)
    return null
  }
}

/**
 * Extract plain email address from "Name <email@domain.com>" format
 */
function extractEmailAddress(from: string): string {
  const match = from.match(/<([^>]+)>/)
  return match ? match[1].toLowerCase() : from.toLowerCase()
}

/**
 * Strip email signature and quoted reply text to get clean reply body
 */
function extractReplyBody(text: string): string {
  // Common signature/quote markers
  const markers = [
    /^--\s*$/m,                          // -- signature marker
    /^___+$/m,                           // ___ divider
    /^On .+ wrote:$/m,                   // On [date] [name] wrote:
    /^From: /m,                          // Forwarded email header
    /^Sent from my /m,                   // Mobile signature
    /^Get Outlook for /m,                // Outlook mobile
    /^>+ /m,                             // Quoted text
  ]

  let cleaned = text
  for (const marker of markers) {
    const match = cleaned.match(marker)
    if (match && match.index !== undefined) {
      cleaned = cleaned.slice(0, match.index)
    }
  }

  return cleaned.trim()
}

/**
 * Find opportunity by matching:
 * 1. Our sent email's Message-ID (stored in email_drafts.smtp_message_id or resend_message_id)
 * 2. Buyer's email address (from leads.contact_email via opportunities)
 */
async function findOpportunityByEmail(
  fromEmail: string,
  inReplyTo?: string,
): Promise<{
  opportunityId: string
  leadCompany: string | null
  leadIndustry: string | null
  oppStage: string | null
  matchSource: "in_reply_to" | "sender_email"
  matchConfidence: number
} | null> {
  const admin = createAdminClient()

  // Method 1: Match by In-Reply-To header (high confidence)
  if (inReplyTo) {
    // Clean the message ID (remove < > brackets if present)
    const cleanMessageId = inReplyTo.replace(/^<|>$/g, "")

    const { data: draft } = await admin
      .from("email_drafts")
      .select("opportunity_id")
      .or(`smtp_message_id.eq.${cleanMessageId},resend_message_id.eq.${cleanMessageId}`)
      .single()

    if (draft?.opportunity_id) {
      // Get opportunity context
      const { data: opp } = await admin
        .from("opportunities")
        .select("id, stage, leads:lead_id ( company_name, industry )")
        .eq("id", draft.opportunity_id)
        .single()

      if (opp) {
        const lead = opp.leads as { company_name?: string; industry?: string } | null
        return {
          opportunityId: opp.id,
          leadCompany: lead?.company_name ?? null,
          leadIndustry: lead?.industry ?? null,
          oppStage: opp.stage,
          matchSource: "in_reply_to",
          matchConfidence: 0.95,
        }
      }
    }
  }

  // Method 2: Match by sender email address (medium confidence)
  const { data: opps } = await admin
    .from("opportunities")
    .select("id, stage, leads:lead_id ( company_name, industry, contact_email )")
    .not("stage", "in", '("won","lost")')
    .order("last_updated", { ascending: false })
    .limit(100)

  if (opps) {
    for (const opp of opps) {
      const lead = opp.leads as { company_name?: string; industry?: string; contact_email?: string } | null
      if (lead?.contact_email?.toLowerCase() === fromEmail) {
        return {
          opportunityId: opp.id,
          leadCompany: lead.company_name ?? null,
          leadIndustry: lead.industry ?? null,
          oppStage: opp.stage,
          matchSource: "sender_email",
          matchConfidence: 0.75,
        }
      }
    }
  }

  return null
}

/**
 * Check if this email was already processed (deduplication)
 */
async function isDuplicate(messageId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("buyer_replies")
    .select("id")
    .eq("message_id", messageId)
    .single()

  return !!data
}

export async function POST(req: NextRequest) {
  console.log("[v0] Resend webhook POST received at", new Date().toISOString())
  console.log("[v0] Request URL:", req.url)
  console.log("[v0] Request method:", req.method)
  console.log("[v0] Request headers:", Object.fromEntries(req.headers))
  
  // Early return for health check
  const url = new URL(req.url)
  if (url.searchParams.get("test") === "1") {
    console.log("[v0] Test endpoint called - returning success")
    return NextResponse.json({ ok: true, test: true }, { status: 200 })
  }
  
  try {
    const rawBody = await req.text()
    console.log("[v0] Webhook raw body length:", rawBody.length)
    console.log("[v0] Webhook raw body preview:", rawBody.slice(0, 500))
    
    const payload: ResendWebhookPayload = JSON.parse(rawBody)
    console.log("[v0] Parsed webhook payload type:", payload.type)

    // Only process email.received events
    if (payload.type !== "email.received") {
      console.log("[v0] Skipping non-email.received event:", payload.type)
      return NextResponse.json({ ok: true, skipped: "not email.received" })
    }

    const { data } = payload
    console.log("[v0] Resend webhook email.received:", {
      type: payload.type,
      from: data.from,
      to: data.to,
      subject: data.subject,
      message_id: data.message_id,
      in_reply_to: data.in_reply_to,
      email_id: data.email_id,
    })

    // Check for duplicates
    if (await isDuplicate(data.message_id)) {
      console.log("[v0] Duplicate email, skipping:", data.message_id)
      return NextResponse.json({ ok: true, skipped: "duplicate" })
    }

    // Extract sender email
    const fromEmail = extractEmailAddress(data.from)

    // Find matching opportunity
    const match = await findOpportunityByEmail(fromEmail, data.in_reply_to)
    if (!match) {
      console.log("[v0] No matching opportunity found for:", fromEmail)
      // Could store in a "unmatched_emails" table for manual review
      return NextResponse.json({ ok: true, skipped: "no_match" })
    }

    console.log("[v0] Matched opportunity:", match.opportunityId, "via", match.matchSource)

    // Fetch full email content
    const emailContent = await fetchEmailContent(data.email_id)
    if (!emailContent) {
      return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 500 })
    }

    // Extract clean reply body (prefer text over HTML)
    const emailBody = emailContent.text || ""
    const cleanBody = extractReplyBody(emailBody)

    if (!cleanBody) {
      console.log("[v0] Empty email body after cleanup")
      return NextResponse.json({ ok: true, skipped: "empty_body" })
    }

    // Run AI classification
    let classification: Awaited<ReturnType<typeof classifyBuyerReply>> | null = null
    try {
      classification = await classifyBuyerReply(cleanBody, {
        buyerCompany: match.leadCompany,
        buyerIndustry: match.leadIndustry,
        opportunityStage: match.oppStage,
      })
    } catch (err) {
      console.error("[v0] AI classification failed:", err)
      // Continue without AI - still save the raw reply
    }

    // Insert buyer reply
    const admin = createAdminClient()
    const { data: reply, error: insertErr } = await admin
      .from("buyer_replies")
      .insert({
        opportunity_id: match.opportunityId,
        from_email: fromEmail,
        subject: data.subject,
        message_id: data.message_id,
        in_reply_to: data.in_reply_to ?? null,
        raw_content: cleanBody,
        raw_language: "en",
        translated_vi: classification?.translatedVi ?? null,
        ai_intent: classification?.intent ?? null,
        ai_summary: classification?.summaryVi ?? null,
        ai_confidence: classification?.confidence ?? null,
        ai_suggested_next_step: classification?.suggestedNextStepVi ?? null,
        ai_model: classification?.model ?? null,
        match_source: match.matchSource,
        match_confidence: match.matchConfidence,
        received_at: data.created_at,
        created_by: null, // System-created, not by a user
      })
      .select("id")
      .single()

    if (insertErr) {
      console.error("[v0] Failed to insert buyer reply:", insertErr)
      return NextResponse.json({ ok: false, error: "db_insert_failed" }, { status: 500 })
    }

    // Add activity log
    await admin.from("activities").insert({
      opportunity_id: match.opportunityId,
      action_type: "buyer_reply_received",
      description: classification
        ? `[Auto] Email từ ${fromEmail} · Intent: ${classification.intent} · ${classification.summaryVi}`
        : `[Auto] Email từ ${fromEmail} · Subject: ${data.subject}`,
      performed_by: null,
    })

    // Mark opportunity as having unread reply
    await admin
      .from("opportunities")
      .update({
        has_unread_reply: true,
        last_updated: new Date().toISOString(),
      })
      .eq("id", match.opportunityId)

    // If AI suggests next step and opp has none, seed it
    if (classification?.suggestedNextStepVi) {
      await admin
        .from("opportunities")
        .update({ next_step: classification.suggestedNextStepVi })
        .eq("id", match.opportunityId)
        .is("next_step", null)
    }

    console.log("[v0] Buyer reply saved:", reply?.id)
    return NextResponse.json({ ok: true, replyId: reply?.id })
  } catch (err) {
    console.error("[v0] Webhook error:", err)
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 },
    )
  }
}

// Resend may send GET to verify webhook endpoint
export async function GET() {
  return NextResponse.json({ status: "ok", service: "resend-inbound-webhook" })
}
