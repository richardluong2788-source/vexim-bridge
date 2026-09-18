import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

/**
 * "Đang xử lý" is no longer a page of its own — it is the second tab of the
 * AE inbox, which shows the buyer's card in a detail pane beside the queue.
 *
 * This route survives because it is linked from places that are not the
 * sidebar and must keep working: notification CTAs (engagementFocusPath), the
 * inbound webhook's "buyer replied" notification, the delivery-event links and
 * the matching pipeline's manual-assignment message. All of them land on the
 * work tab with `?focus=` intact, which opens that buyer in the detail pane.
 */
export default async function EngagementsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>
}) {
  const sp = await searchParams
  const params = new URLSearchParams({ tab: "work" })
  if (typeof sp.focus === "string" && sp.focus) params.set("focus", sp.focus)

  redirect(`/admin/ae-inbox?${params.toString()}`)
}
