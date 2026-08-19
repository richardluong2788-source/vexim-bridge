"use server"

/**
 * Sprint D — Buyer-reply server actions.
 *
 * Flow:
 *   1. Admin pastes buyer's English email into the "Add Buyer Reply" dialog.
 *   2. addBuyerReplyAction validates auth, calls the AI classifier, and
 *      inserts a buyer_replies row.
 *   3. An activity row is appended so the opportunity timeline reflects it.
 */

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { classifyBuyerReply } from "@/lib/ai/reply-classifier"
import type { BuyerReply } from "@/lib/supabase/types"

const ALLOWED_ROLES = new Set([
  "admin",
  "staff",
  "super_admin",
  "account_executive",
])

type AddReplyInput = {
  opportunityId: string
  rawContentEn: string
  receivedAt?: string | null
}

type AddReplyResult =
  | { ok: true; reply: BuyerReply }
  | { ok: false; error: "unauthorized" | "notFound" | "empty" | "aiFailed" | "dbFailed" }

export async function addBuyerReplyAction(
  input: AddReplyInput,
): Promise<AddReplyResult> {
  const trimmed = input.rawContentEn.trim()
  if (!trimmed) return { ok: false, error: "empty" }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "unauthorized" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  if (!profile || !ALLOWED_ROLES.has(profile.role)) {
    return { ok: false, error: "unauthorized" }
  }

  // Load opportunity context for the classifier (buyer company / industry /
  // current stage). We use the admin client to bypass RLS for the join — we
  // already role-gated above.
  const admin = createAdminClient()
  const { data: opp } = await admin
    .from("opportunities")
    .select(
      "id, stage, leads:lead_id ( company_name, industry )",
    )
    .eq("id", input.opportunityId)
    .single()
  if (!opp) return { ok: false, error: "notFound" }

  const leadData =
    (opp.leads as {
      company_name?: string | null
      industry?: string | null
    } | null) ?? null

  // Call AI classifier. If this fails we still store the raw reply so the
  // admin's work isn't lost — they can retry classification later.
  let classification: Awaited<ReturnType<typeof classifyBuyerReply>> | null = null
  try {
    classification = await classifyBuyerReply(trimmed, {
      buyerCompany: leadData?.company_name ?? null,
      buyerIndustry: leadData?.industry ?? null,
      opportunityStage: (opp as { stage: string | null }).stage,
    })
  } catch (err) {
    console.error("[v0] classifyBuyerReply failed", err)
    // Fall through — we'll persist without AI fields.
  }

  const insertPayload = {
    opportunity_id: input.opportunityId,
    raw_content: trimmed,
    raw_language: "en",
    translated_vi: classification?.translatedVi ?? null,
    ai_intent: classification?.intent ?? null,
    ai_summary: classification?.summaryVi ?? null,
    ai_confidence: classification?.confidence ?? null,
    ai_suggested_next_step: classification?.suggestedNextStepVi ?? null,
    ai_model: classification?.model ?? null,
    received_at: input.receivedAt ?? new Date().toISOString(),
    created_by: user.id,
  }

  const { data: reply, error: insertErr } = await admin
    .from("buyer_replies")
    .insert(insertPayload)
    .select("*")
    .single()

  if (insertErr || !reply) {
    console.error("[v0] buyer_replies insert failed", insertErr)
    return { ok: false, error: "dbFailed" }
  }

  // Append activity row so the timeline shows it.
  await admin.from("activities").insert({
    opportunity_id: input.opportunityId,
    action_type: "buyer_reply_logged",
    description:
      classification
        ? `AI intent: ${classification.intent} · ${classification.summaryVi}`
        : "Buyer reply logged (AI classification skipped).",
    performed_by: user.id,
  })

  // If the AI suggests a next step and the opp has no active one, seed it.
  if (classification?.suggestedNextStepVi) {
    await admin
      .from("opportunities")
      .update({
        next_step: classification.suggestedNextStepVi,
        last_updated: new Date().toISOString(),
      })
      .eq("id", input.opportunityId)
      .is("next_step", null)
  }

  revalidatePath("/admin/pipeline")
  revalidatePath(`/admin/opportunities/${input.opportunityId}`)

  return { ok: true, reply: reply as BuyerReply }
}

export async function listBuyerRepliesAction(opportunityId: string): Promise<{
  ok: true
  replies: BuyerReply[]
}> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("buyer_replies")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .order("received_at", { ascending: false })
    .limit(50)

  return { ok: true, replies: (data ?? []) as BuyerReply[] }
}

/**
 * Mark all unread buyer replies for the given opportunity as read.
 * Called when an AE opens the opportunity detail sheet so the kanban
 * badge clears after they've seen the replies.
 */
export async function markBuyerRepliesReadAction(
  opportunityId: string,
): Promise<{ ok: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false }

  const admin = createAdminClient()
  await admin
    .from("buyer_replies")
    .update({ read_at: new Date().toISOString() })
    .eq("opportunity_id", opportunityId)
    .is("read_at", null)

  revalidatePath("/admin/pipeline")
  return { ok: true }
}

type ConfirmReplyOwnerResult =
  | { ok: true }
  | {
      ok: false
      error: "unauthorized" | "notFound" | "notCandidate" | "notYourOpportunity" | "dbFailed"
    }

/**
 * Claim an ambiguous buyer reply (needs_ae_confirmation = true) for a
 * specific opportunity. Used when the sender-email fallback match found 2+
 * competing clients/AEs with an open opportunity for the same buyer and
 * couldn't tell which one the reply was actually meant for.
 *
 * `opportunityId` MUST be one of the reply's candidate_opportunity_ids AND
 * owned by the calling user (admins/super_admins can confirm on behalf of
 * any candidate). Confirming:
 *   - Reassigns the reply to `opportunityId` if it wasn't already the
 *     provisional pick (so it shows up under the RIGHT AE's opportunity).
 *   - Clears needs_ae_confirmation so other candidate AEs stop seeing the
 *     "please confirm" prompt for this reply.
 *
 * This is a first-come-first-served claim — whichever candidate AE actually
 * recognizes the buyer's message clicks confirm first. It does not attempt
 * to resolve conflicting claims after the fact (out of scope for now).
 */
export async function confirmBuyerReplyOwnerAction(
  replyId: string,
  opportunityId: string,
): Promise<ConfirmReplyOwnerResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "unauthorized" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  if (!profile || !ALLOWED_ROLES.has(profile.role)) {
    return { ok: false, error: "unauthorized" }
  }

  const admin = createAdminClient()

  const { data: reply } = await admin
    .from("buyer_replies")
    .select("id, candidate_opportunity_ids, needs_ae_confirmation")
    .eq("id", replyId)
    .single()
  if (!reply) return { ok: false, error: "notFound" }

  const candidates = (reply.candidate_opportunity_ids ?? []) as string[]
  if (!candidates.includes(opportunityId)) {
    return { ok: false, error: "notCandidate" }
  }

  // Admins/super_admins can confirm on behalf of any candidate opportunity.
  // AEs (and lead_researcher, who has no client portfolio) must own the
  // opportunity they're claiming the reply for.
  if (profile.role !== "admin" && profile.role !== "super_admin") {
    const { data: opp } = await admin
      .from("opportunities")
      .select("owner_id")
      .eq("id", opportunityId)
      .single()
    if (!opp || opp.owner_id !== user.id) {
      return { ok: false, error: "notYourOpportunity" }
    }
  }

  const { error: updateErr } = await admin
    .from("buyer_replies")
    .update({
      opportunity_id: opportunityId,
      needs_ae_confirmation: false,
      confirmed_by: user.id,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", replyId)

  if (updateErr) {
    console.error("[v0] confirmBuyerReplyOwnerAction update failed", updateErr)
    return { ok: false, error: "dbFailed" }
  }

  revalidatePath("/admin/pipeline")
  revalidatePath(`/admin/opportunities/${opportunityId}`)

  return { ok: true }
}
