"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { sendBuyerInquiryReceivedEmail } from "@/lib/buyers/confirmation-email"
import { dispatchNotification } from "@/lib/notifications/dispatcher"

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
  /** Existing opportunity ID from tracking link (to link buyer response with existing opportunity) */
  opportunity_ref?: string
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

  // Check if we should link to an existing opportunity (from tracking link)
  let opportunity: { id: string } | null = null
  let isExistingOpportunity = false

  if (request.opportunity_ref) {
    // Verify the opportunity exists and belongs to the same client
    const { data: existingOpp } = await adminSupabase
      .from("opportunities")
      .select("id, client_id, account_manager_id")
      .eq("id", request.opportunity_ref)
      .single()

    if (existingOpp && existingOpp.client_id === request.client_id) {
      // Link lead to existing opportunity
      await adminSupabase
        .from("opportunities")
        .update({
          lead_id: lead.id,
          notes: `${existingOpp.id ? "Updated: " : ""}Buyer responded via product page.\n\nProduct: ${request.product_name}\nQuantity/Volume: ${request.quantity_volume || "Not specified"}\n\nNotes: ${request.notes || "None"}`,
        })
        .eq("id", existingOpp.id)

      opportunity = { id: existingOpp.id }
      isExistingOpportunity = true

      // Notify the assigned AE specifically using dispatchNotification for email + in-app
      if (existingOpp.account_manager_id) {
        dispatchNotification({
          userId: existingOpp.account_manager_id,
          category: "new_assignment",
          opportunityId: existingOpp.id,
          linkPath: `/admin/opportunities/${existingOpp.id}`,
          dedupKey: `buyer_responded:${existingOpp.id}:${Date.now()}`,
          title: {
            vi: "Buyer phản hồi qua link sản phẩm",
            en: "Buyer Responded to Product Link",
          },
          body: {
            vi: `${request.company_name} đã gửi yêu cầu báo giá cho ${request.product_name}`,
            en: `${request.company_name} submitted a quote request for ${request.product_name}`,
          },
          ctaLabel: {
            vi: "Xem chi tiết",
            en: "View details",
          },
        }).catch((err) => {
          console.error("[product] notification dispatch failed", err)
        })
      }
    }
  }

  // Create new opportunity only if not linking to existing one
  if (!isExistingOpportunity) {
    const { data: newOpp, error: oppError } = await adminSupabase
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
    opportunity = newOpp
  }

  // Create notification for account manager; if none assigned AND it's a new opportunity, notify all admins
  if (!isExistingOpportunity) {
    const notifyUserId = client?.account_manager_id
    if (notifyUserId) {
      // Use dispatchNotification for proper email + in-app delivery
      dispatchNotification({
        userId: notifyUserId,
        category: "new_assignment",
        opportunityId: opportunity?.id || undefined,
        linkPath: opportunity ? `/admin/opportunities/${opportunity.id}` : `/admin/leads`,
        dedupKey: `new_quote_request:${lead.id}`,
        title: {
          vi: "Yêu cầu báo giá mới",
          en: "New Quote Request",
        },
        body: {
          vi: `${request.company_name} yêu cầu báo giá cho ${request.product_name}`,
          en: `${request.company_name} requested a quote for ${request.product_name}`,
        },
        ctaLabel: {
          vi: "Xem chi tiết",
          en: "View details",
        },
      }).catch((err) => {
        console.error("[product] notification dispatch failed", err)
      })
    } else {
      // No account manager assigned — broadcast to all admins and super_admins
      const { data: admins } = await adminSupabase
        .from("profiles")
        .select("id")
        .in("role", ["admin", "super_admin"])

      if (admins && admins.length > 0) {
        // Notify each admin using dispatchNotification for proper email delivery
        await Promise.all(
          admins.map((admin) =>
            dispatchNotification({
              userId: admin.id,
              category: "new_assignment",
              opportunityId: opportunity?.id || undefined,
              linkPath: opportunity ? `/admin/opportunities/${opportunity.id}` : `/admin/leads`,
              dedupKey: `new_quote_request:${lead.id}:${admin.id}`,
              title: {
                vi: "Yêu cầu báo giá mới",
                en: "New Quote Request",
              },
              body: {
                vi: `${request.company_name} yêu cầu báo giá cho ${request.product_name}`,
                en: `${request.company_name} requested a quote for ${request.product_name}`,
              },
              ctaLabel: {
                vi: "Xem chi tiết",
                en: "View details",
              },
            }).catch((err) => {
              console.error("[product] notification dispatch failed for admin", admin.id, err)
            })
          )
        )
      }
    }
  }

  // Send confirmation email to the buyer
  try {
    await sendBuyerInquiryReceivedEmail(lead.id)
  } catch (emailError) {
    // Don't fail the request if email fails - it's not critical
    console.error("[v0] Failed to send buyer confirmation email:", emailError)
  }

  // Generate reference number
  const reference = `PQR-${Date.now().toString(36).toUpperCase()}`

  return { success: true, reference }
}
