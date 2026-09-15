/**
 * Sprint D — Re-engagement cron.
 *
 * Runs daily. Finds every opportunity that:
 *   - stage = 'won'
 *   - last_updated is >= 90 days ago
 *   - reengagement_task_created_at IS NULL
 *
 * For each, it:
 *   1. Inserts an "reengagement_reminder" activity row on the opportunity.
 *   2. Dispatches a localised notification (vi/en, in-app + email/Telegram
 *      according to the client's preferences) nudging them to re-engage the
 *      buyer.
 *   3. Stamps opportunities.reengagement_task_created_at = now() so the next
 *      run doesn't duplicate.
 *
 * Security: the route is protected by the standard `CRON_SECRET` header
 * check (Vercel's cron + Authorization: Bearer pattern).
 */

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { dispatchNotification } from "@/lib/notifications/dispatcher"

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000
const MAX_BATCH = 200

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get("authorization") ?? ""
  return header === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()
  const threshold = new Date(Date.now() - NINETY_DAYS_MS).toISOString()

  // Candidate Won opps older than 90 days with no re-engagement task yet.
  const { data: candidates, error } = await supabase
    .from("opportunities")
    .select(
      `
        id,
        client_id,
        last_updated,
        leads:leads(company_name)
      `,
    )
    .eq("stage", "won")
    .is("reengagement_task_created_at", null)
    .lte("last_updated", threshold)
    .limit(MAX_BATCH)

  if (error) {
    console.error("[v0] reengage-won query failed", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const processed: string[] = []
  const failed: Array<{ id: string; reason: string }> = []

  for (const opp of candidates ?? []) {
    try {
      if (!opp.client_id) {
        failed.push({ id: opp.id, reason: "opportunity has no client owner" })
        continue
      }

      const buyerName =
        (opp.leads as { company_name?: string | null } | null)?.company_name ??
        "this buyer"

      // 1) Activity row on the opportunity timeline.
      await supabase.from("activities").insert({
        opportunity_id: opp.id,
        action_type: "reengagement_reminder",
        description: `90-day re-engagement task created — reach back out to ${buyerName} for repeat business.`,
      })

      // 2) Localised notification to the client owner. Going through the
      //    dispatcher gives the in-app row PLUS email/Telegram according to
      //    the client's action_required preferences (with dedup). Won deals
      //    are past price_agreed, so showing the real buyer name complies
      //    with the R-07 masking rule.
      await dispatchNotification({
        userId: opp.client_id,
        category: "action_required",
        opportunityId: opp.id,
        linkPath: `/client/leads#${opp.id}`,
        dedupKey: `reengage_won:${opp.id}`,
        title: {
          vi: "Liên hệ lại buyer — đã 90 ngày kể từ khi chốt đơn",
          en: "Re-engage buyer — 90 days since Won",
        },
        body: {
          vi: `Đã hơn 90 ngày kể từ khi quý doanh nghiệp chốt đơn với ${buyerName}. Hãy gửi email thăm hỏi để mở ra các đơn hàng lặp lại.`,
          en: `It's been 90+ days since you closed ${buyerName}. Send a check-in email to unlock repeat orders.`,
        },
        ctaLabel: {
          vi: "Xem cơ hội",
          en: "View opportunity",
        },
      })

      // 3) Stamp the marker so we don't duplicate.
      await supabase
        .from("opportunities")
        .update({ reengagement_task_created_at: new Date().toISOString() })
        .eq("id", opp.id)

      processed.push(opp.id)
    } catch (err) {
      failed.push({
        id: opp.id,
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({
    ok: true,
    considered: candidates?.length ?? 0,
    processed: processed.length,
    failed: failed.length,
    failures: failed,
  })
}
