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
