import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { dispatchNotification } from "@/lib/notifications/dispatcher"

/**
 * Daily cron: warn an AE when a buyer they're waiting on has gone silent.
 *
 * Business rule (confirmed with the user):
 * - Applies ONLY to engagements in "requirement_email_sent" or
 *   "shortlist_sent" — the two stages where the AE has sent something and
 *   is waiting on the buyer to reply.
 * - Threshold: 14 days since the engagement last moved (buyer_engagements
 *   auto-updates `updated_at` on every write, and every stage-entry point
 *   resets `stale_reminder_sent_at` to NULL — see markRequirementEmailSent /
 *   approveAndSendShortlist in app/admin/ae-inbox/engagement-actions.ts).
 * - Action: WARN the assigned AE only (in-app + email notification). Do
 *   NOT auto-return the buyer to the shared inbox and do NOT auto-reassign
 *   to another AE — the AE stays the owner and decides (follow up again,
 *   or drop the buyer via the existing "Hủy buyer" action).
 * - Sent at most once per stall: `stale_reminder_sent_at` is stamped after
 *   sending, so the same silence doesn't re-notify every day. The 055
 *   migration resets it back to NULL whenever the engagement re-enters
 *   one of the two waiting stages, so a later stall in a later stage (or
 *   after a new email is sent) warns again.
 */

const STALE_DAYS = 14

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: candidates, error } = await admin
    .from("buyer_engagements")
    .select(
      "id, stage, updated_at, account_manager_id, lead_id, leads:lead_id ( company_name )",
    )
    .in("stage", ["requirement_email_sent", "shortlist_sent"])
    .is("stale_reminder_sent_at", null)
    .lte("updated_at", cutoff)

  if (error) {
    console.error("[v0] engagement-stale-check: query failed:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ ok: true, warned: 0 })
  }

  let warned = 0
  const skippedRepliedIds: string[] = []

  for (const engagement of candidates) {
    // Guard: if the buyer actually replied after this stage started, the
    // premise ("silent") is false — skip warning even though updated_at is
    // old (e.g. no other field was touched since the reply landed).
    const { data: reply } = await admin
      .from("buyer_replies")
      .select("id")
      .eq("engagement_id", engagement.id)
      .gt("created_at", engagement.updated_at as string)
      .limit(1)
      .maybeSingle()

    if (reply) {
      skippedRepliedIds.push(engagement.id)
      continue
    }

    if (!engagement.account_manager_id) continue

    const companyName =
      (engagement.leads as { company_name?: string } | null)?.company_name ?? "buyer"
    const days = Math.floor(
      (Date.now() - new Date(engagement.updated_at as string).getTime()) / (24 * 60 * 60 * 1000),
    )

    await dispatchNotification({
      userId: engagement.account_manager_id,
      category: "action_required",
      linkPath: "/admin/engagements",
      dedupKey: `engagement_stale:${engagement.id}:${engagement.updated_at}`,
      title: {
        vi: `${companyName} chưa phản hồi sau ${days} ngày`,
        en: `${companyName} has not replied in ${days} days`,
      },
      body: {
        vi: `Buyer "${companyName}" đang ở giai đoạn "${engagement.stage === "shortlist_sent" ? "Đã gửi shortlist" : "Đã gửi email hỏi nhu cầu"}" nhưng chưa có phản hồi. Hãy chủ động theo dõi lại hoặc hủy buyer nếu cần.`,
        en: `Buyer "${companyName}" is in stage "${engagement.stage}" with no reply yet. Consider following up again or dropping the buyer if appropriate.`,
      },
      ctaLabel: { vi: "Xem Đang xử lý", en: "View In progress" },
    })

    await admin
      .from("buyer_engagements")
      .update({ stale_reminder_sent_at: new Date().toISOString() })
      .eq("id", engagement.id)

    warned++
  }

  // Reset skipped-but-replied rows too, so we don't re-check them every day
  // — the reply already answers the "did the buyer respond" question, and
  // any FUTURE re-stall (new email sent, stage re-entered) resets this
  // column anyway via the stage-transition actions.
  if (skippedRepliedIds.length > 0) {
    await admin
      .from("buyer_engagements")
      .update({ stale_reminder_sent_at: new Date().toISOString() })
      .in("id", skippedRepliedIds)
  }

  return NextResponse.json({
    ok: true,
    warned,
    skippedAlreadyReplied: skippedRepliedIds.length,
  })
}
