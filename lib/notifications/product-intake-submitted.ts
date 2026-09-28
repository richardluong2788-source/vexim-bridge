import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { dispatchNotification } from "@/lib/notifications/dispatcher"

/**
 * Notify AE and SR when supplier submits product via /product-intake/[token]
 * - In-app notification + email to registration email (profiles.email)
 * - Best-effort, never blocks product insert
 */

export async function notifyAeAndSrOfProductIntake(token: string, productName: string) {
  try {
    const admin = createAdminClient()

    const { data: link, error: linkErr } = await admin
      .from("product_intake_links")
      .select("id, client_id, created_by")
      .eq("token", token)
      .maybeSingle()

    if (linkErr || !link) return

    const clientId = link.client_id
    const creatorId = link.created_by as string | null

    // Get client company name
    const { data: client } = await admin
      .from("profiles")
      .select("company_name, sourced_by, account_manager_id")
      .eq("id", clientId)
      .maybeSingle()

    const companyName = client?.company_name?.trim() || "Nhà cung cấp"

    const userIds = new Set<string>()
    if (creatorId) userIds.add(creatorId)
    if (client?.account_manager_id) userIds.add(client.account_manager_id as string)
    if (client?.sourced_by) userIds.add(client.sourced_by as string)

    // Also notify all admins? No, only AE/SR directly related

    for (const userId of userIds) {
      try {
        await dispatchNotification({
          userId,
          category: "new_assignment",
          opportunityId: null,
          linkPath: `/admin/clients/${clientId}?tab=products`,
          dedupKey: `product_intake:${link.id}:${productName}:${userId}:${Date.now()}`,
          title: {
            vi: `Sản phẩm mới — ${productName}`,
            en: `New product — ${productName}`,
          },
          body: {
            vi: `${companyName} vừa gửi sản phẩm "${productName}" qua link intake. Sản phẩm đang ở trạng thái chờ duyệt (inactive).`,
            en: `${companyName} just submitted product "${productName}" via intake link. Status is inactive pending review.`,
          },
          ctaLabel: {
            vi: "Xem sản phẩm",
            en: "View product",
          },
          subject: {
            vi: `Sản phẩm mới từ ${companyName} — ${productName}`,
            en: `New product from ${companyName} — ${productName}`,
          },
        })
      } catch (e) {
        console.error("[notify product intake] dispatch failed", userId, e)
      }
    }
  } catch (err) {
    console.error("[notify product intake] unexpected error", err)
  }
}
