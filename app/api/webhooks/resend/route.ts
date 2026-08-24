import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { classifyBuyerReply } from "@/lib/ai/reply-classifier"
import { dispatchNotification } from "@/lib/notifications/dispatcher"
import { getEmailDomain, isPublicEmailDomain } from "@/lib/email/public-domains"

// Ensure this webhook route is never affected by middleware
export const runtime = "nodejs"
export const preferredRegion = "auto"
// Force dynamic rendering and prevent any caching/static optimization
export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

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
    // Inbound webhook may include body directly
    text?: string
    html?: string
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
 * Fetch full email content from Resend Receiving API.
 * Webhook only contains metadata - body must be fetched via the Receiving API.
 * 
 * IMPORTANT: Use /emails/receiving/:id (NOT /emails/:id which is for sent emails only)
 * See: https://resend.com/docs/api-reference/emails/retrieve-received-email
 */
async function fetchEmailContent(emailId: string): Promise<ResendEmailContent | null> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error("[v0] RESEND_API_KEY not set, cannot fetch email content")
    return null
  }

  console.log("[v0] Fetching received email content for ID:", emailId)
  console.log("[v0] Using API key:", apiKey ? `${apiKey.slice(0, 10)}...` : "NOT SET")

  try {
    // Use the Receiving API endpoint for inbound emails
    // /emails/receiving/:id returns the full email body, headers, and attachment metadata
    const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    console.log("[v0] Resend Receiving API response status:", res.status)
    const responseText = await res.text()
    console.log("[v0] Resend Receiving API response body:", responseText.slice(0, 500))

    if (!res.ok) {
      console.error("[v0] Failed to fetch received email content:", res.status, responseText)
      return null
    }

    return JSON.parse(responseText)
  } catch (err) {
    console.error("[v0] Error fetching received email content:", err)
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
 * 2. Buyer's email address (any contact in buyer_contacts for the lead, not
 *    just the single legacy leads.contact_email — a buyer company can have
 *    many contacts/departments/market reps).
 *
 * When matched via In-Reply-To but the sender email is NOT in buyer_contacts,
 * we still accept the match (the thread is what matters) but flag
 * `isUnrecognizedSender` so the AE gets prompted to add this person as a new
 * contact (e.g. they were referred/introduced by the original contact).
 */
async function findOpportunityByEmail(
  fromEmail: string,
  inReplyTo?: string,
): Promise<{
  opportunityId: string
  leadId: string | null
  leadCompany: string | null
  leadIndustry: string | null
  oppStage: string | null
  matchSource: "in_reply_to" | "sender_email"
  matchConfidence: number
  matchedContactId: string | null
  isUnrecognizedSender: boolean
} | null> {
  const admin = createAdminClient()

  /** Tim contact trong buyer_contacts cua lead nay khop voi fromEmail. */
  async function findContactForLead(leadId: string) {
    const { data } = await admin
      .from("buyer_contacts")
      .select("id, email")
      .eq("lead_id", leadId)
    const contacts = (data ?? []) as { id: string; email: string | null }[]
    return contacts.find((c) => c.email?.toLowerCase() === fromEmail) ?? null
  }

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
        .select("id, stage, lead_id, leads:lead_id ( company_name, industry )")
        .eq("id", draft.opportunity_id)
        .single()

      if (opp) {
        const lead = opp.leads as { company_name?: string; industry?: string } | null
        const leadId = (opp as { lead_id: string | null }).lead_id
        const matchedContact = leadId ? await findContactForLead(leadId) : null

        return {
          opportunityId: opp.id,
          leadId,
          leadCompany: lead?.company_name ?? null,
          leadIndustry: lead?.industry ?? null,
          oppStage: opp.stage,
          matchSource: "in_reply_to",
          matchConfidence: 0.95,
          matchedContactId: matchedContact?.id ?? null,
          // Thread matched, but this specific person isn't in our directory
          // yet — likely introduced/referred by the original contact.
          isUnrecognizedSender: !matchedContact,
        }
      }
    }
  }

  // Method 2: Match by sender email against ANY contact in buyer_contacts
  // (medium confidence) — supports multi-contact companies where different
  // departments/market reps email in independently, not just the primary.
  const { data: matchingContacts } = await admin
    .from("buyer_contacts")
    .select("id, lead_id")
    .eq("status", "active")
    .ilike("email", fromEmail)

  const contactMatches = (matchingContacts ?? []) as { id: string; lead_id: string }[]

  for (const contactMatch of contactMatches) {
    const { data: opp } = await admin
      .from("opportunities")
      .select("id, stage, lead_id, leads:lead_id ( company_name, industry )")
      .eq("lead_id", contactMatch.lead_id)
      .not("stage", "in", '("won","lost")')
      .order("last_updated", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (opp) {
      const lead = opp.leads as { company_name?: string; industry?: string } | null
      return {
        opportunityId: opp.id,
        leadId: contactMatch.lead_id,
        leadCompany: lead?.company_name ?? null,
        leadIndustry: lead?.industry ?? null,
        oppStage: opp.stage,
        matchSource: "sender_email",
        matchConfidence: 0.75,
        matchedContactId: contactMatch.id,
        isUnrecognizedSender: false,
      }
    }
  }

  // Method 3: Match by the recipient address of a SENT email_drafts row
  // tied to an opportunity. Mirrors findEngagementByEmail's Method 3 below
  // — catches replies from the exact address we emailed (e.g.
  // leads.contact_email) even when that address was never added to
  // buyer_contacts. Without this, an opportunity-stage reply from an
  // address not yet in the contact directory silently fell through to
  // "no_match", even though we know EXACTLY who we sent it to.
  const { data: matchingDrafts } = await admin
    .from("email_drafts")
    .select("opportunity_id")
    .eq("status", "sent")
    .not("opportunity_id", "is", null)
    .ilike("recipient_email", fromEmail)
    .order("created_at", { ascending: false })

  const draftOpportunityIds = Array.from(
    new Set((matchingDrafts ?? []).map((d) => d.opportunity_id as string)),
  )

  for (const oppId of draftOpportunityIds) {
    const { data: opp } = await admin
      .from("opportunities")
      .select("id, stage, lead_id, leads:lead_id ( company_name, industry )")
      .eq("id", oppId)
      .not("stage", "in", '("won","lost")')
      .maybeSingle()

    if (opp) {
      const lead = opp.leads as { company_name?: string; industry?: string } | null
      const leadId = (opp as { lead_id: string | null }).lead_id
      const matchedContact = leadId ? await findContactForLead(leadId) : null

      return {
        opportunityId: opp.id,
        leadId,
        leadCompany: lead?.company_name ?? null,
        leadIndustry: lead?.industry ?? null,
        oppStage: opp.stage,
        matchSource: "sender_email",
        matchConfidence: 0.8,
        matchedContactId: matchedContact?.id ?? null,
        // Not "unrecognized" — we deliberately emailed this exact address,
        // it's just missing from the structured contact directory.
        isUnrecognizedSender: false,
      }
    }
  }

  // Method 4: Loosened domain match (low confidence, last resort). Covers a
  // buyer replying from a colleague's mailbox at the SAME company domain
  // (e.g. a contact is jane@acme-imports.com, reply comes from
  // procurement@acme-imports.com). Never applied to free webmail domains
  // (gmail.com, yahoo.com, ...) — matching those by domain would attach
  // replies from unrelated buyers to the wrong opportunity.
  const fromDomain = getEmailDomain(fromEmail)
  if (fromDomain && !isPublicEmailDomain(fromDomain)) {
    const { data: domainContacts } = await admin
      .from("buyer_contacts")
      .select("id, lead_id, email")
      .eq("status", "active")
      .ilike("email", `%@${fromDomain}`)

    const domainMatches = (domainContacts ?? []) as {
      id: string
      lead_id: string
      email: string | null
    }[]

    for (const contactMatch of domainMatches) {
      const { data: opp } = await admin
        .from("opportunities")
        .select("id, stage, lead_id, leads:lead_id ( company_name, industry )")
        .eq("lead_id", contactMatch.lead_id)
        .not("stage", "in", '("won","lost")')
        .order("last_updated", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (opp) {
        const lead = opp.leads as { company_name?: string; industry?: string } | null
        return {
          opportunityId: opp.id,
          leadId: contactMatch.lead_id,
          leadCompany: lead?.company_name ?? null,
          leadIndustry: lead?.industry ?? null,
          oppStage: opp.stage,
          matchSource: "sender_email",
          matchConfidence: 0.5,
          matchedContactId: null,
          // Different mailbox than the one on file — flag for AE review.
          isUnrecognizedSender: true,
        }
      }
    }
  }

  return null
}

/**
 * Find a pre-opportunity buyer_engagement by matching:
 * 1. Our sent email's Message-ID (email_drafts.engagement_id, set when the
 *    AE sends a "requirement inquiry" email before any client is picked).
 * 2. Buyer's email address against buyer_contacts for a lead that still has
 *    an ACTIVE engagement (stage not in converted/dropped).
 * 3. Buyer's email address against email_drafts.recipient_email for a SENT
 *    requirement-inquiry email tied to an engagement. This covers buyers
 *    who reply from the address the email was actually sent to (often
 *    leads.contact_email) even when that address hasn't been added to
 *    buyer_contacts yet — which otherwise silently drops the reply.
 *
 * Only called when findOpportunityByEmail() found nothing — an opportunity
 * match always wins since it's more specific.
 */
async function findEngagementByEmail(
  fromEmail: string,
  inReplyTo?: string,
): Promise<{
  engagementId: string
  leadId: string
  leadCompany: string | null
  leadIndustry: string | null
  accountManagerId: string
  matchSource: "in_reply_to" | "sender_email" | "sent_draft_recipient"
  matchConfidence: number
  matchedContactId: string | null
  isUnrecognizedSender: boolean
} | null> {
  const admin = createAdminClient()

  async function findContactForLead(leadId: string) {
    const { data } = await admin
      .from("buyer_contacts")
      .select("id, email")
      .eq("lead_id", leadId)
    const contacts = (data ?? []) as { id: string; email: string | null }[]
    return contacts.find((c) => c.email?.toLowerCase() === fromEmail) ?? null
  }

  // Method 1: Match by In-Reply-To header (high confidence)
  if (inReplyTo) {
    const cleanMessageId = inReplyTo.replace(/^<|>$/g, "")

    const { data: draft } = await admin
      .from("email_drafts")
      .select("engagement_id")
      .or(`smtp_message_id.eq.${cleanMessageId},resend_message_id.eq.${cleanMessageId}`)
      .single()

    if (draft?.engagement_id) {
      const { data: eng } = await admin
        .from("buyer_engagements")
        .select("id, lead_id, account_manager_id, leads:lead_id ( company_name, industry )")
        .eq("id", draft.engagement_id)
        .single()

      if (eng) {
        const lead = eng.leads as { company_name?: string; industry?: string } | null
        const matchedContact = await findContactForLead(eng.lead_id)

        return {
          engagementId: eng.id,
          leadId: eng.lead_id,
          leadCompany: lead?.company_name ?? null,
          leadIndustry: lead?.industry ?? null,
          accountManagerId: eng.account_manager_id,
          matchSource: "in_reply_to",
          matchConfidence: 0.95,
          matchedContactId: matchedContact?.id ?? null,
          isUnrecognizedSender: !matchedContact,
        }
      }
    }
  }

  // Method 2: Match by sender email against buyer_contacts, scoped to a
  // lead that still has an active (not converted/dropped) engagement.
  const { data: matchingContacts } = await admin
    .from("buyer_contacts")
    .select("id, lead_id")
    .eq("status", "active")
    .ilike("email", fromEmail)

  const contactMatches = (matchingContacts ?? []) as { id: string; lead_id: string }[]

  for (const contactMatch of contactMatches) {
    const { data: eng } = await admin
      .from("buyer_engagements")
      .select("id, lead_id, account_manager_id, leads:lead_id ( company_name, industry )")
      .eq("lead_id", contactMatch.lead_id)
      .not("stage", "in", '("converted","dropped")')
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (eng) {
      const lead = eng.leads as { company_name?: string; industry?: string } | null
      return {
        engagementId: eng.id,
        leadId: contactMatch.lead_id,
        leadCompany: lead?.company_name ?? null,
        leadIndustry: lead?.industry ?? null,
        accountManagerId: eng.account_manager_id,
        matchSource: "sender_email",
        matchConfidence: 0.75,
        matchedContactId: contactMatch.id,
        isUnrecognizedSender: false,
      }
    }
  }

  // Method 3: Match by the recipient address of a sent requirement-inquiry
  // draft. Catches replies from an address that was actually emailed (e.g.
  // leads.contact_email) but hasn't been added to buyer_contacts yet.
  const { data: matchingDrafts } = await admin
    .from("email_drafts")
    .select("engagement_id")
    .eq("email_type", "requirement_inquiry")
    .eq("status", "sent")
    .not("engagement_id", "is", null)
    .ilike("recipient_email", fromEmail)
    .order("created_at", { ascending: false })

  const draftEngagementIds = Array.from(
    new Set((matchingDrafts ?? []).map((d) => d.engagement_id as string)),
  )

  for (const engId of draftEngagementIds) {
    const { data: eng } = await admin
      .from("buyer_engagements")
      .select("id, lead_id, account_manager_id, stage, leads:lead_id ( company_name, industry )")
      .eq("id", engId)
      .not("stage", "in", '("converted","dropped")')
      .maybeSingle()

    if (eng) {
      const lead = eng.leads as { company_name?: string; industry?: string } | null
      const matchedContact = await findContactForLead(eng.lead_id)

      return {
        engagementId: eng.id,
        leadId: eng.lead_id,
        leadCompany: lead?.company_name ?? null,
        leadIndustry: lead?.industry ?? null,
        accountManagerId: eng.account_manager_id,
        matchSource: "sent_draft_recipient",
        matchConfidence: 0.8,
        matchedContactId: matchedContact?.id ?? null,
        // Not "unrecognized" — we deliberately emailed this address, it's
        // just missing from the structured contact directory.
        isUnrecognizedSender: false,
      }
    }
  }

  // Method 4: Loosened domain match (low confidence, last resort) — same
  // rationale as findOpportunityByEmail's Method 4 above. Never applied to
  // free webmail domains.
  const fromDomain = getEmailDomain(fromEmail)
  if (fromDomain && !isPublicEmailDomain(fromDomain)) {
    const { data: domainContacts } = await admin
      .from("buyer_contacts")
      .select("id, lead_id, email")
      .eq("status", "active")
      .ilike("email", `%@${fromDomain}`)

    const domainMatches = (domainContacts ?? []) as {
      id: string
      lead_id: string
      email: string | null
    }[]

    for (const contactMatch of domainMatches) {
      const { data: eng } = await admin
        .from("buyer_engagements")
        .select("id, lead_id, account_manager_id, leads:lead_id ( company_name, industry )")
        .eq("lead_id", contactMatch.lead_id)
        .not("stage", "in", '("converted","dropped")')
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (eng) {
        const lead = eng.leads as { company_name?: string; industry?: string } | null
        return {
          engagementId: eng.id,
          leadId: contactMatch.lead_id,
          leadCompany: lead?.company_name ?? null,
          leadIndustry: lead?.industry ?? null,
          accountManagerId: eng.account_manager_id,
          matchSource: "sender_email",
          matchConfidence: 0.5,
          matchedContactId: null,
          isUnrecognizedSender: true,
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
  // Created once up-front — the unmatched-email persistence branch below
  // runs BEFORE the opportunity/engagement match is resolved, so `admin`
  // must exist before that branch, not after it (a `const admin` declared
  // further down throws "Cannot access 'admin' before initialization" the
  // moment an unmatched email comes in, which was silently turning the
  // "persist it instead of dropping it" fix into a 500 that dropped it
  // anyway).
  const admin = createAdminClient()

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

    // Find matching opportunity — an opportunity has already been created
    // for this buyer, so this reply is mid-pipeline.
    const match = await findOpportunityByEmail(fromEmail, data.in_reply_to)

    // If no opportunity yet, this buyer may still be in the pre-opportunity
    // "requirement gathering" stage (AE claimed them, asked about their
    // needs, no client/supplier picked yet) — check buyer_engagements too.
    const engagementMatch = match
      ? null
      : await findEngagementByEmail(fromEmail, data.in_reply_to)

    if (!match && !engagementMatch) {
      console.log("[v0] No matching opportunity or engagement found for:", fromEmail)

      // Previously this email was silently dropped here — accepted with
      // 200 OK (so Resend never retries) but never written anywhere, which
      // is how a real buyer reply disappears with zero trace even though
      // Resend's Receiving log shows it arrived. Persist it instead so an
      // admin can triage and manually attach it (see /admin/unmatched-emails).
      let bodyForLog = data.text || ""
      if (!bodyForLog && data.html) {
        bodyForLog = data.html
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/p>/gi, "\n\n")
          .replace(/<[^>]+>/g, "")
          .trim()
      }

      const { error: unmatchedErr } = await admin.from("unmatched_inbound_emails").insert({
        resend_email_id: data.email_id,
        message_id: data.message_id,
        from_email: fromEmail,
        to_emails: data.to ?? [],
        subject: data.subject,
        in_reply_to: data.in_reply_to ?? null,
        raw_content: extractReplyBody(bodyForLog) || bodyForLog || null,
        match_attempt_note:
          "No buyer_contacts entry, no email_drafts.recipient_email match, and no In-Reply-To match against a sent draft.",
        received_at: data.created_at,
      })
      if (unmatchedErr) {
        // Ignore unique-violation on message_id (Resend re-delivery) — anything
        // else is worth logging since this is our last line of defense.
        console.error("[v0] Failed to store unmatched inbound email:", unmatchedErr)
      }

      return NextResponse.json({ ok: true, skipped: "no_match", stored: !unmatchedErr })
    }

    if (match) {
      console.log("[v0] Matched opportunity:", match.opportunityId, "via", match.matchSource)
    } else if (engagementMatch) {
      console.log("[v0] Matched buyer engagement:", engagementMatch.engagementId, "via", engagementMatch.matchSource)
    }

    // Get email body - first check if it's in the webhook payload (Resend inbound)
    // If not, try to fetch from API (only works for outbound emails)
    let emailBody = data.text || ""
    
    // Log what we have in the payload
    console.log("[v0] Payload has text:", !!data.text, "length:", data.text?.length || 0)
    console.log("[v0] Payload has html:", !!data.html, "length:", data.html?.length || 0)
    
    // If no body in payload, try API (may not work for inbound)
    if (!emailBody && !data.html) {
      console.log("[v0] No body in payload, trying API fetch...")
      const emailContent = await fetchEmailContent(data.email_id)
      if (emailContent) {
        emailBody = emailContent.text || ""
      }
    }
    
    // If still no text, try extracting from HTML
    if (!emailBody && data.html) {
      console.log("[v0] Using HTML body, stripping tags...")
      // Simple HTML to text conversion
      emailBody = data.html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .trim()
    }
    const cleanBody = extractReplyBody(emailBody)

    if (!cleanBody) {
      console.log("[v0] Empty email body after cleanup - using subject as fallback content")
      // For test webhooks or empty emails, use subject as content
      // This allows test webhooks from Resend Dashboard to work
    }

    // Use subject as fallback if body is empty
    const finalBody = cleanBody || `[No body - Subject: ${data.subject}]`

    // Run AI classification
    let classification: Awaited<ReturnType<typeof classifyBuyerReply>> | null = null
    try {
      // Only classify if we have actual body content (not just subject fallback)
      if (cleanBody) {
        classification = await classifyBuyerReply(cleanBody, {
          buyerCompany: match?.leadCompany ?? engagementMatch?.leadCompany ?? null,
          buyerIndustry: match?.leadIndustry ?? engagementMatch?.leadIndustry ?? null,
          opportunityStage: match?.oppStage ?? null,
        })
      } else {
        console.log("[v0] Skipping AI classification for empty/test body")
      }
    } catch (err) {
      console.error("[v0] AI classification failed:", err)
      // Continue without AI - still save the raw reply
    }

    // Insert buyer reply — either against an opportunity (mid-pipeline) or
    // a pre-opportunity buyer_engagement (still gathering requirements).
    const { data: reply, error: insertErr } = await admin
      .from("buyer_replies")
      .insert({
        opportunity_id: match?.opportunityId ?? null,
        lead_id: match?.leadId ?? engagementMatch?.leadId ?? null,
        engagement_id: engagementMatch?.engagementId ?? null,
        from_email: fromEmail,
        subject: data.subject,
        message_id: data.message_id,
        in_reply_to: data.in_reply_to ?? null,
        raw_content: finalBody,
        raw_language: "en",
        translated_vi: classification?.translatedVi ?? null,
        ai_intent: classification?.intent ?? null,
        ai_summary: classification?.summaryVi ?? null,
        ai_confidence: classification?.confidence ?? null,
        ai_suggested_next_step: classification?.suggestedNextStepVi ?? null,
        ai_model: classification?.model ?? null,
        match_source: match?.matchSource ?? engagementMatch?.matchSource ?? null,
        match_confidence: match?.matchConfidence ?? engagementMatch?.matchConfidence ?? null,
        matched_contact_id: match?.matchedContactId ?? engagementMatch?.matchedContactId ?? null,
        is_unrecognized_sender: match?.isUnrecognizedSender ?? engagementMatch?.isUnrecognizedSender ?? false,
        received_at: data.created_at,
        created_by: null, // System-created, not by a user
      })
      .select("id")
      .single()

    if (insertErr) {
      console.error("[v0] Failed to insert buyer reply:", insertErr)
      return NextResponse.json({ ok: false, error: "db_insert_failed" }, { status: 500 })
    }

    console.log("[v0] Buyer reply saved with ID:", reply?.id)

    // Dispatch notification to whichever AE owns this buyer right now —
    // the opportunity owner if a client/supplier has been picked, or the
    // engagement's account manager if the AE is still gathering requirements.
    try {
      const isUnrecognizedSender = match?.isUnrecognizedSender ?? engagementMatch?.isUnrecognizedSender ?? false
      let notifyUserId: string | null = null
      let notifyOpportunityId: string | null = null
      let notifyLinkPath = ""

      if (match) {
        // NOTE: opportunities has no "owner_id" column — the AE assigned to
        // an opportunity is tracked in "account_manager_id". Querying the
        // wrong column silently 400s here (RLS/PostgREST returns an error,
        // not a throw), which was making notifyUserId stay null forever —
        // no in-app notification AND no email ever reached the AE for any
        // opportunity-stage buyer reply.
        const { data: opp, error: oppErr } = await admin
          .from("opportunities")
          .select("account_manager_id")
          .eq("id", match.opportunityId)
          .single()
        if (oppErr) {
          console.error("[v0] Failed to load opportunity account_manager_id for notification:", oppErr)
        }
        if (!oppErr && opp?.account_manager_id) {
          notifyUserId = opp.account_manager_id
          notifyOpportunityId = match.opportunityId
          notifyLinkPath = `/admin/opportunities/${match.opportunityId}?tab=replies`
        }
      } else if (engagementMatch) {
        notifyUserId = engagementMatch.accountManagerId
        notifyLinkPath = `/admin/engagements?focus=${engagementMatch.engagementId}`
      }

      if (notifyUserId) {
        await dispatchNotification({
          userId: notifyUserId,
          category: "action_required",
          opportunityId: notifyOpportunityId,
          linkPath: notifyLinkPath,
          dedupKey: `buyer_reply:${reply?.id}`,
          title: isUnrecognizedSender
            ? {
                vi: `Người lạ trả lời (chưa có trong danh bạ): ${fromEmail}`,
                en: `Unrecognized sender replied (not in contact directory): ${fromEmail}`,
              }
            : engagementMatch
              ? {
                  vi: `Buyer đã phản hồi yêu cầu nhu cầu: ${fromEmail}`,
                  en: `Buyer replied to your requirement request: ${fromEmail}`,
                }
              : {
                  vi: `Có phản hồi từ ${fromEmail}`,
                  en: `New reply from ${fromEmail}`,
                },
          body: isUnrecognizedSender
            ? {
                vi: `Có thể buyer đã giới thiệu sang người khác. Hãy vào Danh bạ để thêm liên hệ mới. ${data.subject.slice(0, 60)}...`,
                en: `Buyer may have introduced a different contact. Add them to the contact directory. ${data.subject.slice(0, 60)}...`,
              }
            : {
                vi: `${data.subject.slice(0, 60)}...`,
                en: `${data.subject.slice(0, 60)}...`,
              },
          ctaLabel: {
            vi: "Xem phản hồi",
            en: "View reply",
          },
        })
      }
    } catch (err) {
      console.error("[v0] Failed to dispatch notification:", err)
      // Don't fail the webhook - notification is nice-to-have
    }

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
