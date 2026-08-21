"use server"

/**
 * Public, unauthenticated action invoked from the tokenized shortlist page.
 * The UUID token is the sole authorization bearer — same trust model as
 * `/share/[token]`. No admin session exists for a buyer visiting this page.
 *
 * This action only ever writes to the mutable `buyer_action` /
 * `buyer_interested` / `buyer_responded_at` columns on
 * `buyer_engagement_shortlist_items`. Every other column on that row (the
 * score, factor breakdown, reasoning, risks, and the supplier profile
 * snapshot) is part of the immutable, already-sent snapshot and is never
 * touched here.
 */
import { createAdminClient } from "@/lib/supabase/admin"

type ActionResult = { ok: true } | { ok: false; error: string }

export type BuyerActionValue =
  | "viewed_only"
  | "interested_no_details"
  | "requested_info"
  | "requested_sample"
  | "requested_meeting"
  | "selected_primary"
  | "sent_price_volume"
  | "sent_po"

export async function markShortlistInterest(
  token: string,
  shortlistItemId: string,
  action: BuyerActionValue = "interested_no_details",
): Promise<ActionResult> {
  const admin = createAdminClient()

  const { data: link } = await admin
    .from("shortlist_share_links")
    .select("token, engagement_id, version_id, expires_at, revoked_at")
    .eq("token", token)
    .maybeSingle()

  if (!link) return { ok: false, error: "Invalid link." }
  if (link.revoked_at) return { ok: false, error: "This link has been revoked." }
  if (new Date(link.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "This link has expired." }
  }

  // Defence-in-depth: the shortlist item must actually belong to THIS
  // token's specific version, so a guessed item id from a superseded
  // version or another engagement can't be flipped through this token.
  const { data: row } = await admin
    .from("buyer_engagement_shortlist_items")
    .select("id, version_id")
    .eq("id", shortlistItemId)
    .eq("version_id", link.version_id)
    .maybeSingle()

  if (!row) return { ok: false, error: "Supplier not found on this shortlist." }

  const { error: updateError } = await admin
    .from("buyer_engagement_shortlist_items")
    .update({
      buyer_action: action,
      buyer_interested: action !== "viewed_only",
      buyer_responded_at: new Date().toISOString(),
    })
    .eq("id", shortlistItemId)

  if (updateError) return { ok: false, error: updateError.message }

  // Advance the engagement stage so the AE sees it needs a decision. Never
  // downgrade a stage that's already past this point (e.g. already
  // converted to an opportunity or dropped).
  const { data: engagement } = await admin
    .from("buyer_engagements")
    .select("stage")
    .eq("id", link.engagement_id)
    .maybeSingle()

  if (engagement && !["converted", "dropped"].includes(engagement.stage)) {
    await admin
      .from("buyer_engagements")
      .update({ stage: "qualified_interest" })
      .eq("id", link.engagement_id)
  }

  return { ok: true }
}
