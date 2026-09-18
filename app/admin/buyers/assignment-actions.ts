"use server"

/**
 * Manual buyer → AE assignment (admin override of AI matching).
 *
 * AI matching remains the default distribution channel; these actions are
 * the controlled exception for super_admin / admin:
 *   - listAssignmentCandidates: AEs with live workload + AI scores for a buyer
 *   - assignBuyerToAE:          pin a buyer to a specific AE (claims it on
 *                               their behalf or re-assigns an active buyer)
 *   - returnBuyerToInbox:       release a claimed buyer back to the shared
 *                               inbox (also available to the owning AE)
 *
 * Guardrails live in lib/matching/manual-assignment.ts (target role checks,
 * workload cap, mandatory reason when contradicting AI, assignment_source =
 * 'manual', activity audit, AE notifications).
 */

import { revalidatePath } from "next/cache"
import { requireCap } from "@/lib/auth/guard"
import { CAPS } from "@/lib/auth/permissions"
import {
  listAssignmentCandidates as coreListCandidates,
  executeBuyerAssignment,
  returnBuyerToSharedInbox,
  ManualAssignmentError,
  type AssignmentCandidate,
} from "@/lib/matching/manual-assignment"

export type AssignmentActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string }

// ---------------------------------------------------------------------------
// Candidate AEs for the assign dialog
// ---------------------------------------------------------------------------

export async function listAssignmentCandidates(
  buyerId: string,
): Promise<AssignmentActionResult<AssignmentCandidate[]>> {
  const guard = await requireCap(CAPS.BUYER_ASSIGN)
  if (!guard.ok) return { ok: false, error: guard.error }

  try {
    const data = await coreListCandidates(guard.admin, buyerId)
    return { ok: true, data }
  } catch (err) {
    console.error("[v0] listAssignmentCandidates error:", err)
    return { ok: false, error: err instanceof Error ? err.message : "fetch_failed" }
  }
}

// ---------------------------------------------------------------------------
// Assign / re-assign a buyer to an AE
// ---------------------------------------------------------------------------

export interface AssignBuyerInput {
  buyerId: string
  aeId: string
  reason: string
  /** Bypass the workload hard cap. Caller-side restricted to super_admin. */
  overrideCapacity?: boolean
}

export async function assignBuyerToAE(
  input: AssignBuyerInput,
): Promise<AssignmentActionResult<{ engagementId: string; wasNewClaim: boolean }>> {
  const guard = await requireCap(CAPS.BUYER_ASSIGN)
  if (!guard.ok) return { ok: false, error: guard.error }

  if (!input.buyerId || !input.aeId) {
    return { ok: false, error: "invalid_input" }
  }
  // Only the system owner can force an over-capacity assignment — admins
  // see the cap enforced like everyone else.
  const overrideCapacity =
    input.overrideCapacity === true && guard.role === "super_admin"

  try {
    // Need the actor's display name for the audit description.
    const { data: actor } = await guard.admin
      .from("profiles")
      .select("full_name")
      .eq("id", guard.userId)
      .maybeSingle()

    const result = await executeBuyerAssignment({
      admin: guard.admin,
      leadId: input.buyerId,
      targetAeId: input.aeId,
      reason: input.reason ?? "",
      performedBy: guard.userId,
      performedByName: actor?.full_name ?? null,
      overrideCapacity,
    })

    revalidatePath("/admin/ae-inbox")
    revalidatePath("/admin/buyers")
    revalidatePath(`/admin/buyers/${input.buyerId}`)
    revalidatePath("/admin/pipeline")

    return {
      ok: true,
      data: { engagementId: result.engagementId, wasNewClaim: result.wasNewClaim },
    }
  } catch (err) {
    if (err instanceof ManualAssignmentError) {
      return { ok: false, error: err.code }
    }
    console.error("[v0] assignBuyerToAE error:", err)
    return { ok: false, error: err instanceof Error ? err.message : "assign_failed" }
  }
}

// ---------------------------------------------------------------------------
// Return a claimed buyer to the shared inbox
// ---------------------------------------------------------------------------

export interface ReturnBuyerInput {
  engagementId: string
  reason: string
}

export async function returnBuyerToInbox(
  input: ReturnBuyerInput,
): Promise<AssignmentActionResult<{ success: true }>> {
  // Owning AEs (BUYER_WRITE) may return their own buyer; admins can return
  // any. Ownership for AEs is enforced below.
  const guard = await requireCap(CAPS.BUYER_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }

  if (!input.engagementId?.trim()) {
    return { ok: false, error: "invalid_input" }
  }
  if (!input.reason?.trim()) {
    return { ok: false, error: "reason_required" }
  }

  // AE ownership gate (mirrors claimBuyer / transferEngagement).
  if (guard.role === "account_executive") {
    const { data: engagement } = await guard.admin
      .from("buyer_engagements")
      .select("account_manager_id")
      .eq("id", input.engagementId)
      .maybeSingle()
    if (!engagement) return { ok: false, error: "engagement_not_found" }
    if (engagement.account_manager_id !== guard.userId) {
      return { ok: false, error: "not_your_engagement" }
    }
  }

  try {
    const result = await returnBuyerToSharedInbox({
      admin: guard.admin,
      engagementId: input.engagementId,
      reason: input.reason,
      performedBy: guard.userId,
    })

    revalidatePath("/admin/ae-inbox")
    revalidatePath("/admin/buyers")
    revalidatePath(`/admin/buyers/${result.leadId}`)

    return { ok: true, data: { success: true } }
  } catch (err) {
    if (err instanceof ManualAssignmentError) {
      return { ok: false, error: err.code }
    }
    console.error("[v0] returnBuyerToInbox error:", err)
    return { ok: false, error: err instanceof Error ? err.message : "return_failed" }
  }
}
