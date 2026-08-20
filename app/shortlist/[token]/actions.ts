"use server"

/**
 * Public, unauthenticated action invoked from the tokenized shortlist page.
 * The UUID token is the sole authorization bearer — same trust model as
 * `/share/[token]`. No admin session exists for a buyer visiting this page.
 */
import { createAdminClient } from "@/lib/supabase/admin"

type ActionResult = { ok: true } | { ok: false; error: string }

export async function markShortlistInterest(
  token: string,
  shortlistId: string,
  interested: boolean,
): Promise<ActionResult> {
  const admin = createAdminClient()

  const { data: link } = await admin
    .from("shortlist_share_links")
    .select("token, engagement_id, expires_at, revoked_at")
    .eq("token", token)
    .maybeSingle()

  if (!link) return { ok: false, error: "Invalid link." }
  if (link.revoked_at) return { ok: false, error: "This link has been revoked." }
  if (new Date(link.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "This link has expired." }
  }

  // Defence-in-depth: the shortlist row must actually belong to this token's
  // engagement, so a guessed shortlistId from another engagement can't be
  // flipped through this token.
  const { data: row } = await admin
    .from("buyer_engagement_shortlist")
    .select("id, engagement_id")
    .eq("id", shortlistId)
    .eq("engagement_id", link.engagement_id)
    .maybeSingle()

  if (!row) return { ok: false, error: "Supplier not found on this shortlist." }

  const { error: updateError } = await admin
    .from("buyer_engagement_shortlist")
    .update({ buyer_interested: interested, buyer_responded_at: new Date().toISOString() })
    .eq("id", shortlistId)

  if (updateError) return { ok: false, error: updateError.message }

  // Advance the engagement stage so the AE sees it needs attention. Never
  // downgrade a stage that's already past this point (e.g. already
  // converted to an opportunity).
  const { data: engagement } = await admin
    .from("buyer_engagements")
    .select("stage")
    .eq("id", link.engagement_id)
    .maybeSingle()

  if (engagement && !["converted", "dropped"].includes(engagement.stage)) {
    await admin
      .from("buyer_engagements")
      .update({ stage: "buyer_responded" })
      .eq("id", link.engagement_id)
  }

  return { ok: true }
}
