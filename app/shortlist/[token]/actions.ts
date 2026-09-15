"use server"

/**
 * Public, unauthenticated action invoked from the tokenized shortlist page.
 * The UUID token is the sole authorization bearer — same trust model as
 * `/share/[token]`. No admin session exists for a buyer visiting this page.
 *
 * This action only ever writes to the mutable `buyer_action` /
 * `buyer_interested` / `buyer_responded_at` columns on
 * `buyer_engagement_shortlist_items`. Every other column on that row (the
 * score, factor breakdown, reasoning, risks, and the supplier profile
 * snapshot) is part of the immutable, already-sent snapshot and is never
 * touched here.
 *
 * Strong buyer signals (sample / meeting / order-discussion) also fan out
 * two notifications:
 *   - to the affected SUPPLIER/CLIENT: fully anonymous (no buyer identity),
 *     because pre-negotiation buyer identity is confidential — see
 *     lib/reports/pre-funnel.ts;
 *   - to the owning AE: with context, so they can coordinate with the
 *     supplier immediately.
 */
import { createAdminClient } from "@/lib/supabase/admin"
import { dispatchNotification } from "@/lib/notifications/dispatcher"
import { BUYER_SELECTABLE_ACTIONS, type BuyerActionValue } from "./types"

type ActionResult = { ok: true } | { ok: false; error: string }

/** Actions that need the supplier to DO something -> notify them. */
const STRONG_ACTIONS: ReadonlySet<BuyerActionValue> = new Set([
  "requested_sample",
  "requested_meeting",
  "requested_order_discussion",
])

const STRONG_COPY: Record<
  "requested_sample" | "requested_meeting" | "requested_order_discussion",
  {
    clientTitle: { vi: string; en: string }
    clientBody: { vi: string; en: string }
    aeTitle: { vi: string; en: string }
    aeBody: { vi: string; en: string }
  }
> = {
  requested_sample: {
    clientTitle: {
      vi: "Một buyer muốn nhận mẫu",
      en: "A buyer requested a sample",
    },
    clientBody: {
      vi: "Doanh nghiệp của bạn vừa được một buyer trên bản đề xuất nhà cung cấp của Vexim yêu cầu mẫu. AE phụ trách sẽ sớm liên hệ để phối hợp. Danh tính buyer được mở khi vào đàm phán chính thức.",
      en: "A buyer on a Vexim supplier shortlist just requested a sample from your company. Your account manager will contact you shortly to coordinate. The buyer's identity is shared once formal negotiations begin.",
    },
    aeTitle: {
      vi: "Buyer xin mẫu từ một supplier trên shortlist",
      en: "Buyer requested a sample from a shortlisted supplier",
    },
    aeBody: {
      vi: "Buyer đã bấm yêu cầu mẫu cho một nhà cung cấp trên shortlist bạn đã gửi. Hãy liên hệ supplier để chuẩn bị mẫu.",
      en: "The buyer clicked request-sample for a supplier on the shortlist you sent. Reach out to that supplier to arrange samples.",
    },
  },
  requested_meeting: {
    clientTitle: {
      vi: "Một buyer muốn đặt lịch họp",
      en: "A buyer requested a meeting",
    },
    clientBody: {
      vi: "Một buyer trên bản đề xuất nhà cung cấp của Vexim muốn đặt lịch họp với doanh nghiệp của bạn. AE phụ trách sẽ sớm liên hệ để sắp xếp. Danh tính buyer được mở khi vào đàm phán chính thức.",
      en: "A buyer on a Vexim supplier shortlist asked to schedule a meeting with your company. Your account manager will contact you shortly to arrange it. The buyer's identity is shared once formal negotiations begin.",
    },
    aeTitle: {
      vi: "Buyer muốn họp với một supplier trên shortlist",
      en: "Buyer requested a meeting with a shortlisted supplier",
    },
    aeBody: {
      vi: "Buyer đã bấm muốn họp với một nhà cung cấp trên shortlist bạn đã gửi. Hãy phối hợp đặt lịch.",
      en: "The buyer clicked request-meeting with a supplier on the shortlist you sent. Coordinate scheduling with that supplier.",
    },
  },
  requested_order_discussion: {
    clientTitle: {
      vi: "Một buyer muốn trao đổi đơn hàng",
      en: "A buyer wants to discuss an order",
    },
    clientBody: {
      vi: "Một buyer trên bản đề xuất nhà cung cấp của Vexim muốn trao đổi đơn hàng với doanh nghiệp của bạn. AE phụ trách sẽ sớm liên hệ để bắt đầu đàm phán. Danh tính buyer được mở khi vào đàm phán chính thức.",
      en: "A buyer on a Vexim supplier shortlist wants to discuss an order with your company. Your account manager will contact you shortly to start the conversation. The buyer's identity is shared once formal negotiations begin.",
    },
    aeTitle: {
      vi: "Buyer muốn bàn đơn hàng với một supplier trên shortlist",
      en: "Buyer wants to discuss an order with a shortlisted supplier",
    },
    aeBody: {
      vi: "Buyer đã bấm muốn trao đổi đơn hàng với một nhà cung cấp trên shortlist bạn đã gửi. Đây là tín hiệu đủ điều kiện convert — cân nhắc tạo cơ hội.",
      en: "The buyer clicked discuss-order with a supplier on the shortlist you sent. This qualifies for conversion — consider creating the opportunity.",
    },
  },
}

export async function markShortlistInterest(
  token: string,
  shortlistItemId: string,
  action: BuyerActionValue = "interested_no_details",
): Promise<ActionResult> {
  if (!BUYER_SELECTABLE_ACTIONS.includes(action as any)) {
    // Defence-in-depth: even if a caller reaches this action with an
    // AE-only value (e.g. "sent_po"), reject it here too — not just in the
    // UI — since this is a public, unauthenticated server action.
    return { ok: false, error: "This action cannot be set from the shortlist page." }
  }

  const admin = createAdminClient()

  const { data: link } = await admin
    .from("shortlist_share_links")
    .select("token, engagement_id, version_id, expires_at, revoked_at")
    .eq("token", token)
    .maybeSingle()

  if (!link) return { ok: false, error: "Invalid link." }
  if (link.revoked_at) return { ok: false, error: "This link has been revoked." }
  if (new Date(link.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "This link has expired." }
  }

  // Defence-in-depth: the shortlist item must actually belong to THIS
  // token's specific version, so a guessed item id from a superseded
  // version or another engagement can't be flipped through this token.
  // client_id + previous buyer_action are needed for the notifications
  // (and for skipping duplicate dispatches on repeat clicks).
  const { data: row } = await admin
    .from("buyer_engagement_shortlist_items")
    .select("id, version_id, client_id, buyer_action")
    .eq("id", shortlistItemId)
    .eq("version_id", link.version_id)
    .maybeSingle()

  if (!row) return { ok: false, error: "Supplier not found on this shortlist." }

  const previousAction = row.buyer_action
  const { error: updateError } = await admin
    .from("buyer_engagement_shortlist_items")
    .update({
      buyer_action: action,
      buyer_interested: action !== "viewed_only",
      buyer_responded_at: new Date().toISOString(),
    })
    .eq("id", shortlistItemId)

  if (updateError) return { ok: false, error: updateError.message }

  // Advance the engagement stage so the AE sees it needs a decision. Never
  // downgrade a stage that's already past this point (e.g. already
  // converted to an opportunity or dropped).
  const { data: engagement } = await admin
    .from("buyer_engagements")
    .select("stage, account_manager_id, leads:lead_id(company_name)")
    .eq("id", link.engagement_id)
    .maybeSingle()

  if (engagement && !["converted", "dropped"].includes(engagement.stage)) {
    await admin
      .from("buyer_engagements")
      .update({ stage: "qualified_interest" })
      .eq("id", link.engagement_id)
  }

  // Strong signals: notify the supplier (anonymously) + owning AE. Fire and
  // forget — notifications must never break the buyer's click. Only fire
  // when the action actually changed, so a repeat/double click and the
  // dedup keys both keep delivery to exactly once.
  if (STRONG_ACTIONS.has(action) && previousAction !== action && row.client_id) {
    const copy = STRONG_COPY[action as keyof typeof STRONG_COPY]
    const buyerLabel =
      (
        engagement?.leads as
          | { company_name?: string | null }
          | null
      )?.company_name ?? "buyer"

    try {
      await dispatchNotification({
        userId: row.client_id as string,
        category: "action_required",
        linkPath: "/client/products",
        dedupKey: `shortlist_strong_supplier:${shortlistItemId}:${action}`,
        title: copy.clientTitle,
        body: copy.clientBody,
        ctaLabel: { vi: "Xem sản phẩm của bạn", en: "View your products" },
      })

      if (engagement?.account_manager_id) {
        await dispatchNotification({
          userId: engagement.account_manager_id as string,
          category: "action_required",
          linkPath: "/admin/ae-inbox",
          dedupKey: `shortlist_strong_ae:${shortlistItemId}:${action}`,
          title: copy.aeTitle,
          body: {
            vi: `${copy.aeBody.vi} (Buyer: ${buyerLabel})`,
            en: `${copy.aeBody.en} (Buyer: ${buyerLabel})`,
          },
          ctaLabel: { vi: "Mở AE inbox", en: "Open AE inbox" },
        })
      }
    } catch (err) {
      console.error("[shortlist] strong-action notification failed", err)
    }
  }

  return { ok: true }
}
