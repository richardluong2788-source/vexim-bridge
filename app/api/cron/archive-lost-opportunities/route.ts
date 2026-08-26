import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

const BATCH_SIZE = 500
const ARCHIVE_AFTER_DAYS = 7

/**
 * Auto-archive opportunities that have sat in the "lost" (Thất bại) Kanban
 * column for 7+ days.
 *
 * "Archive" here means setting `opportunities.archived_at` — it hides the
 * card from the Pipeline Kanban board (see app/admin/pipeline/page.tsx)
 * but never deletes the row. All history (stage_transitions, activities,
 * buyer_replies, deals, etc.) and analytics stay fully intact and queryable
 * — this is intentionally NOT a destructive delete.
 *
 * The 7-day clock starts from the moment the card entered "lost", which is
 * the `transitioned_at` of its most recent `stage_transitions` row with
 * `to_stage = 'lost'` (migration 029 logs every stage change via trigger),
 * not from `opportunities.last_updated` — that column can move for
 * unrelated reasons (a note, a price edit) without the card ever leaving
 * the lost column.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const admin = createAdminClient()

    // 1. Candidates: opportunities currently in "lost" and not yet archived.
    const { data: candidates, error: candidatesError } = await admin
      .from("opportunities")
      .select("id")
      .eq("stage", "lost")
      .is("archived_at", null)
      .limit(BATCH_SIZE)

    if (candidatesError) {
      console.error(
        "[v0] archive-lost-opportunities: candidates query failed:",
        candidatesError.message,
      )
      return NextResponse.json({ error: candidatesError.message }, { status: 500 })
    }

    if (!candidates || candidates.length === 0) {
      return NextResponse.json({ ok: true, archived: 0 })
    }

    const candidateIds = candidates.map(({ id }) => id)

    // 2. For each candidate, find when it most recently transitioned INTO
    // "lost". A card can flip in/out of "lost" over its lifetime, so we
    // need the latest such transition, not the first.
    const { data: transitions, error: transitionsError } = await admin
      .from("stage_transitions")
      .select("opportunity_id, transitioned_at")
      .in("opportunity_id", candidateIds)
      .eq("to_stage", "lost")
      .order("transitioned_at", { ascending: false })

    if (transitionsError) {
      console.error(
        "[v0] archive-lost-opportunities: transitions query failed:",
        transitionsError.message,
      )
      return NextResponse.json({ error: transitionsError.message }, { status: 500 })
    }

    // Rows are ordered newest-first, so the first time we see a given
    // opportunity_id is its most recent transition into "lost".
    const lastEnteredLostAt = new Map<string, string>()
    for (const row of (transitions ?? []) as Array<{
      opportunity_id: string
      transitioned_at: string
    }>) {
      if (!lastEnteredLostAt.has(row.opportunity_id)) {
        lastEnteredLostAt.set(row.opportunity_id, row.transitioned_at)
      }
    }

    const cutoff = Date.now() - ARCHIVE_AFTER_DAYS * 24 * 60 * 60 * 1000
    const idsToArchive = candidateIds.filter((id) => {
      const enteredAt = lastEnteredLostAt.get(id)
      if (!enteredAt) return false
      return new Date(enteredAt).getTime() <= cutoff
    })

    if (idsToArchive.length === 0) {
      return NextResponse.json({ ok: true, archived: 0 })
    }

    // 3. Archive. Re-check stage = 'lost' so a card dragged out of "lost"
    // in the split second before this write cannot be archived by mistake.
    const now = new Date().toISOString()
    const { error: archiveError } = await admin
      .from("opportunities")
      .update({ archived_at: now })
      .in("id", idsToArchive)
      .eq("stage", "lost")
      .is("archived_at", null)

    if (archiveError) {
      console.error(
        "[v0] archive-lost-opportunities: archive update failed:",
        archiveError.message,
      )
      return NextResponse.json({ error: archiveError.message }, { status: 500 })
    }

    console.log(
      `[v0] archive-lost-opportunities: archived ${idsToArchive.length} opportunit${
        idsToArchive.length === 1 ? "y" : "ies"
      } (lost 7+ days)`,
    )

    return NextResponse.json({ ok: true, archived: idsToArchive.length })
  } catch (error) {
    console.error("[v0] archive-lost-opportunities: unexpected failure:", error)
    return NextResponse.json({ error: "Archive sweep failed" }, { status: 500 })
  }
}
