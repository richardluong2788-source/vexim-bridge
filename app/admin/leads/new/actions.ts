"use server"

/**
 * Lead Researcher buyer entry — creates lead and triggers AI matching.
 *
 * LR no longer picks the client. Instead:
 *   1. Create the lead with buyer details + optional need signals.
 *   2. Immediately call runMatchingPipeline(leadId).
 *   3. AI ranks AEs, creates ae_match_scores, pushes buyer to best AE's inbox.
 */

import { createClient } from "@/lib/supabase/server"
import { runMatchingPipeline } from "@/lib/matching/orchestrator"
import { sendBuyerInquiryReceivedEmailAction } from "@/app/admin/leads/new/buyer-email-actions"

export interface CreateLeadWithAIMatchingInput {
  companyName: string
  contactPerson?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  linkedinUrl?: string | null
  country?: string | null
  website?: string | null
  notes?: string | null
  // Buyer need signals for AI matching
  industry?: string | null
  productKeyword?: string | null
  capacityNeeded?: number | null
  potentialValue?: number | null
}

export interface CreateLeadWithAIMatchingResult {
  success: boolean
  leadId?: string
  error?: string
}

export async function createLeadWithAIMatchingAction(
  input: CreateLeadWithAIMatchingInput,
): Promise<CreateLeadWithAIMatchingResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  // Verify caller is lead_researcher or admin/super_admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const role = profile?.role
  if (
    !role ||
    !["super_admin", "admin", "lead_researcher"].includes(role)
  ) {
    return { success: false, error: "Insufficient permissions" }
  }

  // 1. Create the lead
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert({
      company_name: input.companyName.trim(),
      contact_person: input.contactPerson?.trim() ?? null,
      contact_email: input.contactEmail?.trim() ?? null,
      contact_phone: input.contactPhone?.trim() ?? null,
      linkedin_url: input.linkedinUrl?.trim() ?? null,
      country: input.country?.trim() ?? null,
      website: input.website?.trim() ?? null,
      industry: input.industry ?? null,
      notes: input.notes?.trim() ?? null,
      created_by: user.id,
    })
    .select()
    .single()

  if (leadError || !lead) {
    console.error("[v0] createLeadWithAIMatchingAction lead insert failed:", leadError)
    return { success: false, error: leadError?.message ?? "Failed to create lead" }
  }

  // 2. Log activity: lead created
  await supabase.from("activities").insert([
    {
      lead_id: lead.id,
      action_type: "lead_created",
      description: lead.company_name,
      performed_by: user.id,
    },
  ])

  // 3. Trigger AI matching pipeline
  // This will create ae_match_scores, push to ae_match_inbox, etc.
  try {
    const matchingResult = await runMatchingPipeline(lead.id, {
      needsIndustry: input.industry,
      needsProduct: input.productKeyword,
      needsCapacity: input.capacityNeeded,
      potentialValue: input.potentialValue,
    })

    if (!matchingResult.success) {
      console.warn(
        "[v0] runMatchingPipeline partial failure for lead",
        lead.id,
        matchingResult.error,
      )
      // Non-fatal — lead was created, matching just had issues.
      // Log it so support can debug, but return success.
    }
  } catch (err) {
    console.error("[v0] runMatchingPipeline error for lead", lead.id, err)
    // Non-fatal — lead creation succeeded, matching pipeline had an exception.
    // The lead exists and will be manually matched if needed.
  }

  // 4. Send buyer acknowledgement email (fire-and-forget)
  if (input.contactEmail?.trim()) {
    try {
      await sendBuyerInquiryReceivedEmailAction(lead.id)
    } catch (err) {
      console.error("[v0] sendBuyerInquiryReceivedEmailAction failed for lead", lead.id, err)
    }
  }

  return { success: true, leadId: lead.id }
}

