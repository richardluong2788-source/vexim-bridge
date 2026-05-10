"use server"

/**
 * AI Matching System - Server Actions
 *
 * Server actions for the AE matching system:
 * - runAIMatching: Trigger matching pipeline for a buyer
 * - acceptMatchInbox: AE accepts a match from their inbox
 * - rejectMatchInbox: AE rejects a match from their inbox
 * - getMatchResults: Fetch match scores for a buyer
 * - getAEInbox: Fetch pending inbox items for an AE
 */

import { revalidatePath } from "next/cache"
import { requireCap, requireAllCaps, getCurrentRole } from "@/lib/auth/guard"
import { CAPS } from "@/lib/auth/permissions"
import { createClient } from "@/lib/supabase/server"
import {
  runMatchingPipeline,
  acceptInboxItem,
  rejectInboxItem,
  getMatchScoresForBuyer,
  getInboxItemsForAE,
  getBuyerPoolWithScores,
} from "@/lib/matching"
import type { MatchingResult } from "@/lib/matching/types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string }

// ---------------------------------------------------------------------------
// Run AI Matching for a Buyer
// ---------------------------------------------------------------------------

export async function runAIMatching(
  buyerId: string
): Promise<ActionResult<MatchingResult>> {
  // Lead Researcher or higher can trigger matching
  const guard = await requireCap(CAPS.BUYER_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { userId } = guard

  if (!buyerId || typeof buyerId !== "string") {
    return { ok: false, error: "invalid_buyer_id" }
  }

  try {
    const result = await runMatchingPipeline({
      leadId: buyerId,
      triggeredBy: userId,
      useLLMAugmentation: false, // Can be enabled later
    })

    revalidatePath("/admin/buyers")
    revalidatePath(`/admin/buyers/${buyerId}`)
    revalidatePath("/admin/ae-inbox")

    return { ok: true, data: result }
  } catch (error) {
    console.error("[v0] runAIMatching error:", error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : "matching_failed",
    }
  }
}

// ---------------------------------------------------------------------------
// Get Match Scores for a Buyer
// ---------------------------------------------------------------------------

export async function getMatchScores(
  buyerId: string
): Promise<ActionResult<Awaited<ReturnType<typeof getMatchScoresForBuyer>>>> {
  const guard = await requireCap(CAPS.BUYER_VIEW)
  if (!guard.ok) return { ok: false, error: guard.error }

  if (!buyerId || typeof buyerId !== "string") {
    return { ok: false, error: "invalid_buyer_id" }
  }

  try {
    const scores = await getMatchScoresForBuyer(buyerId)
    return { ok: true, data: scores }
  } catch (error) {
    console.error("[v0] getMatchScores error:", error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : "fetch_failed",
    }
  }
}

// ---------------------------------------------------------------------------
// Get AE Inbox Items
// ---------------------------------------------------------------------------

export async function getAEInbox(): Promise<
  ActionResult<Awaited<ReturnType<typeof getInboxItemsForAE>>>
> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "unauthorized" }

  // AEs see their own inbox, admins see all
  const supabase = await createClient()

  try {
    if (
      user.role === "admin" ||
      user.role === "super_admin" ||
      user.role === "lead_researcher"
    ) {
      // Admins/LRs see all pending inbox items
      const { data, error } = await supabase
        .from("ae_match_inbox")
        .select(
          `
          *,
          leads (*),
          profiles:account_manager_id (
            id,
            full_name,
            email,
            avatar_url
          )
        `
        )
        .eq("status", "pending")
        .order("priority", { ascending: true })
        .order("created_at", { ascending: false })

      if (error) throw error
      return { ok: true, data: data || [] }
    } else if (user.role === "account_executive") {
      // AEs see only their own inbox
      const items = await getInboxItemsForAE(user.id)
      return { ok: true, data: items }
    } else {
      return { ok: false, error: "forbidden" }
    }
  } catch (error) {
    console.error("[v0] getAEInbox error:", error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : "fetch_failed",
    }
  }
}

// ---------------------------------------------------------------------------
// Accept Match from Inbox
// ---------------------------------------------------------------------------

export interface AcceptMatchInput {
  inboxItemId: string
  clientId: string
}

export async function acceptMatch(
  input: AcceptMatchInput
): Promise<ActionResult<{ opportunityId: string }>> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "unauthorized" }

  // AEs can accept their own matches; admins can accept any.
  // Lead Researcher has read-only access to the inbox (monitoring) and
  // MUST NOT be able to claim a buyer — they have no client portfolio
  // and would bypass the AI-driven assignment workflow.
  const supabase = await createClient()

  if (user.role === "account_executive") {
    // Verify the AE owns the inbox item.
    const { data: inbox } = await supabase
      .from("ae_match_inbox")
      .select("account_manager_id")
      .eq("id", input.inboxItemId)
      .single()

    if (!inbox || inbox.account_manager_id !== user.id) {
      return { ok: false, error: "not_your_inbox_item" }
    }
  } else if (user.role !== "admin" && user.role !== "super_admin") {
    return { ok: false, error: "forbidden" }
  }

  try {
    const result = await acceptInboxItem(
      input.inboxItemId,
      input.clientId,
      user.id
    )

    if (result.error) {
      return { ok: false, error: result.error }
    }

    revalidatePath("/admin/ae-inbox")
    revalidatePath("/admin/buyers")
    revalidatePath("/admin/pipeline")

    return { ok: true, data: { opportunityId: result.opportunityId! } }
  } catch (error) {
    console.error("[v0] acceptMatch error:", error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : "accept_failed",
    }
  }
}

// ---------------------------------------------------------------------------
// Reject Match from Inbox
// ---------------------------------------------------------------------------

export interface RejectMatchInput {
  inboxItemId: string
  reason?: string
}

export async function rejectMatch(
  input: RejectMatchInput
): Promise<ActionResult<{ success: boolean }>> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "unauthorized" }

  // AEs can reject their own matches; admins can reject any.
  // Lead Researcher is read-only on the inbox: rejecting matches would
  // skew AI feedback signal since LR has no context on the AE/client fit.
  const supabase = await createClient()

  if (user.role === "account_executive") {
    const { data: inbox } = await supabase
      .from("ae_match_inbox")
      .select("account_manager_id")
      .eq("id", input.inboxItemId)
      .single()

    if (!inbox || inbox.account_manager_id !== user.id) {
      return { ok: false, error: "not_your_inbox_item" }
    }
  } else if (user.role !== "admin" && user.role !== "super_admin") {
    return { ok: false, error: "forbidden" }
  }

  try {
    const result = await rejectInboxItem(
      input.inboxItemId,
      user.id,
      input.reason
    )

    if (result.error) {
      return { ok: false, error: result.error }
    }

    revalidatePath("/admin/ae-inbox")

    return { ok: true, data: { success: true } }
  } catch (error) {
    console.error("[v0] rejectMatch error:", error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : "reject_failed",
    }
  }
}

// ---------------------------------------------------------------------------
// Get Buyer Pool with Match Scores
// ---------------------------------------------------------------------------

export async function getBuyerPool(): Promise<
  ActionResult<Awaited<ReturnType<typeof getBuyerPoolWithScores>>>
> {
  const guard = await requireCap(CAPS.BUYER_VIEW)
  if (!guard.ok) return { ok: false, error: guard.error }

  try {
    const buyers = await getBuyerPoolWithScores()
    return { ok: true, data: buyers }
  } catch (error) {
    console.error("[v0] getBuyerPool error:", error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : "fetch_failed",
    }
  }
}

// ---------------------------------------------------------------------------
// Get Matching Configuration
// ---------------------------------------------------------------------------

export async function getMatchingConfig(): Promise<
  ActionResult<{
    weights: Record<string, number>
    thresholds: Record<string, number>
  }>
> {
  const guard = await requireCap(CAPS.BUYER_VIEW)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin } = guard

  try {
    const { data: configs, error } = await admin
      .from("matching_config")
      .select("config_key, config_value")

    if (error) throw error

    const weights =
      (configs?.find((c) => c.config_key === "scoring_weights")
        ?.config_value as Record<string, number>) || {}
    const thresholds =
      (configs?.find((c) => c.config_key === "thresholds")
        ?.config_value as Record<string, number>) || {}

    return { ok: true, data: { weights, thresholds } }
  } catch (error) {
    console.error("[v0] getMatchingConfig error:", error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : "fetch_failed",
    }
  }
}

// ---------------------------------------------------------------------------
// Update Matching Configuration (Admin only)
// ---------------------------------------------------------------------------

export interface UpdateMatchingConfigInput {
  weights?: Record<string, number>
  thresholds?: Record<string, number>
}

export async function updateMatchingConfig(
  input: UpdateMatchingConfigInput
): Promise<ActionResult<{ success: boolean }>> {
  // Only admins can update config
  const guard = await requireAllCaps([CAPS.BUYER_WRITE, CAPS.OWNERSHIP_BYPASS])
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin, userId } = guard

  try {
    if (input.weights) {
      // Validate weights sum to 100
      const sum = Object.values(input.weights).reduce((a, b) => a + b, 0)
      if (sum !== 100) {
        return { ok: false, error: "weights_must_sum_to_100" }
      }

      await admin
        .from("matching_config")
        .update({
          config_value: input.weights,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq("config_key", "scoring_weights")
    }

    if (input.thresholds) {
      // Validate thresholds
      if (
        input.thresholds.auto_assign <= input.thresholds.inbox_max ||
        input.thresholds.inbox_max <= input.thresholds.inbox_min
      ) {
        return { ok: false, error: "invalid_thresholds" }
      }

      await admin
        .from("matching_config")
        .update({
          config_value: input.thresholds,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq("config_key", "thresholds")
    }

    return { ok: true, data: { success: true } }
  } catch (error) {
    console.error("[v0] updateMatchingConfig error:", error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : "update_failed",
    }
  }
}
