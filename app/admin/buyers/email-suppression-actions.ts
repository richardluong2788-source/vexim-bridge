"use server"

/**
 * Admin actions for the automatic email suppression list.
 *
 * Hard bounces and spam complaints (received via the Resend outbound
 * webhook — see lib/email/delivery-events.ts) stamp suppression markers on
 * the lead, and lib/ai/email-sender.ts refuses to send while they are set.
 * When the issue was a false positive or the buyer gave a corrected email
 * address, an admin can lift the suppression here.
 */

import { getCurrentRole } from "@/lib/auth/guard"
import { createClient } from "@/lib/supabase/server"

export type ClearSuppressionResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "forbidden" | "serverError" }

export async function clearEmailSuppressionAction(
  leadId: string,
  note?: string,
): Promise<ClearSuppressionResult> {
  try {
    const current = await getCurrentRole()
    if (!current) return { ok: false, error: "unauthorized" }
    // Suppression is a legal/CAN-SPAM control — only admins may lift it.
    if (current.role !== "admin" && current.role !== "super_admin") {
      return { ok: false, error: "forbidden" }
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from("leads")
      .update({
        email_hard_bounced_at: null,
        email_complained_at: null,
        email_suppression_note:
          note?.trim()
            ? `Suppression lifted by ${current.userId}: ${note.trim()}`
            : `Suppression lifted by ${current.userId}`,
      })
      .eq("id", leadId)

    if (error) {
      console.error("[v0] clearEmailSuppressionAction error:", error)
      return { ok: false, error: "serverError" }
    }

    // Keep the audit trail on the affected drafts: their delivery_status
    // stays bounced/complained (it is a historical fact), but the lead is
    // sendable again.
    return { ok: true }
  } catch (err) {
    console.error("[v0] clearEmailSuppressionAction error:", err)
    return { ok: false, error: "serverError" }
  }
}
