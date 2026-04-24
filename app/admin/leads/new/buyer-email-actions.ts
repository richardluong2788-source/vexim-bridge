"use server"

/**
 * Thin server action wrapper around `sendBuyerInquiryReceivedEmail` so that
 * client components (smart-lead-form.tsx, add-lead-form.tsx) can fire the
 * acknowledgement email right after a successful lead insert without
 * pulling SMTP credentials into the browser bundle.
 *
 * The underlying helper is non-throwing and fully self-logs, so this
 * wrapper just does the role check and passes through the outcome.
 */

import { createClient } from "@/lib/supabase/server"
import {
  sendBuyerInquiryReceivedEmail,
  type BuyerEmailOutcome,
} from "@/lib/buyers/confirmation-email"

const ALLOWED_ROLES = new Set([
  "admin",
  "super_admin",
  "staff",
  "account_executive",
  "lead_researcher",
])

export async function sendBuyerInquiryReceivedEmailAction(
  leadId: string,
): Promise<BuyerEmailOutcome | { status: "unauthorized" }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: "unauthorized" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || !ALLOWED_ROLES.has(profile.role)) {
    return { status: "unauthorized" }
  }

  return sendBuyerInquiryReceivedEmail(leadId, { sentBy: user.id })
}
