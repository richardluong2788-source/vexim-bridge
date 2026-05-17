"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { sendBuyerInquiryReceivedEmail } from "@/lib/buyers/confirmation-email"

export interface ProductQuoteRequest {
  product_id: string
  product_name: string
  client_id: string
  company_name: string
  contact_name: string
  email: string
  phone?: string
  quantity_volume?: string
  notes?: string
}

/**
 * Submit a quote request from the product page.
 * Creates a lead and opportunity in the system.
 */
export async function submitProductQuoteRequest(
  request: ProductQuoteRequest
): Promise<{ success: boolean; reference?: string; error?: string }> {
  const adminSupabase = createAdminClient()

  // Get client info
  const { data: client } = await adminSupabase
    .from("profiles")
    .select("account_manager_id")
    .eq("id", request.client_id)
    .single()

  // Create lead
  const { data: lead, error: leadError } = await adminSupabase
    .from("leads")
    .insert({
      company_name: request.company_name,
      contact_person: request.contact_name,
      contact_email: request.email,
      contact_phone: request.phone || null,
      region: "North America",
      country: "United States",
      source: "product_page",
      notes: `Quote request from product page.\n\nProduct: ${request.product_name}\nQuantity/Volume: ${request.quantity_volume || "Not specified"}\n\nNotes: ${request.notes || "None"}`,
    })
    .select()
    .single()

  if (leadError || !lead) {
    console.error("[v0] submitProductQuoteRequest lead error:", leadError)
    return { success: false, error: "Failed to create lead" }
  }

  // Create opportunity
  const { data: opportunity, error: oppError } = await adminSupabase
    .from("opportunities")
    .insert({
      client_id: request.client_id,
      lead_id: lead.id,
      stage: "new",
      products_interested: request.product_name,
      quantity_required: request.quantity_volume || null,
      notes: `Inquiry via product page for: ${request.product_name}`,
    })
    .select()
    .single()

  if (oppError) {
    console.error("[v0] submitProductQuoteRequest opportunity error:", oppError)
    // Don't fail - lead was still created
  }

  // Create notification for account manager or admins
  const notifyUserId = client?.account_manager_id
  if (notifyUserId) {
    await adminSupabase.from("notifications").insert({
      user_id: notifyUserId,
      category: "new_assignment",
      title: "New Quote Request",
      body: `${request.company_name} requested a quote for ${request.product_name}`,
      link_path: opportunity ? `/admin/opportunities/${opportunity.id}` : `/admin/leads`,
      opportunity_id: opportunity?.id || null,
    })
  }

  // Send confirmation email to the buyer
  try {
    const emailResult = await sendBuyerInquiryReceivedEmail(lead.id)
    console.log("[v0] Buyer confirmation email result:", emailResult)
  } catch (emailError) {
    // Don't fail the request if email fails - it's not critical
    console.error("[v0] Failed to send buyer confirmation email:", emailError)
  }

  // Generate reference number
  const reference = `PQR-${Date.now().toString(36).toUpperCase()}`

  return { success: true, reference }
}
