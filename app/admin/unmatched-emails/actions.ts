"use server"

/**
 * Server actions for /admin/unmatched-emails — the triage queue for inbound
 * replies the Resend webhook could not match to any opportunity or buyer
 * engagement (see app/api/webhooks/resend/route.ts, migration 063).
 */

import { revalidatePath } from "next/cache"
import { requireCap } from "@/lib/auth/guard"
import { CAPS } from "@/lib/auth/permissions"

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export async function markUnmatchedEmailReviewed(
  id: string,
  reviewNote: string,
): Promise<ActionResult<null>> {
  const guard = await requireCap(CAPS.ACTIVITY_LOG_VIEW)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin, userId } = guard

  if (!id || typeof id !== "string") {
    return { ok: false, error: "invalid_id" }
  }

  const { error } = await admin
    .from("unmatched_inbound_emails")
    .update({
      reviewed: true,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote?.trim() || null,
    })
    .eq("id", id)

  if (error) {
    console.error("[v0] markUnmatchedEmailReviewed error:", error)
    return { ok: false, error: "update_failed" }
  }

  revalidatePath("/admin/unmatched-emails")
  return { ok: true, data: null }
}

export async function reopenUnmatchedEmail(id: string): Promise<ActionResult<null>> {
  const guard = await requireCap(CAPS.ACTIVITY_LOG_VIEW)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin } = guard

  if (!id || typeof id !== "string") {
    return { ok: false, error: "invalid_id" }
  }

  const { error } = await admin
    .from("unmatched_inbound_emails")
    .update({
      reviewed: false,
      reviewed_by: null,
      reviewed_at: null,
    })
    .eq("id", id)

  if (error) {
    console.error("[v0] reopenUnmatchedEmail error:", error)
    return { ok: false, error: "update_failed" }
  }

  revalidatePath("/admin/unmatched-emails")
  return { ok: true, data: null }
}
