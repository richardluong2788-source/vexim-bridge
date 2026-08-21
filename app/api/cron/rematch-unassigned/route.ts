/**
 * Daily safety-net sweep: re-run AI matching for every buyer still sitting
 * unclaimed in the shared inbox (i.e. no AE covered their industry at the
 * time they were first matched — see `routeToSharedInbox` in
 * lib/matching/orchestrator.ts).
 *
 * The primary path is instant: `rematchOpenSharedInboxLeads()` is also
 * called synchronously right after a new client is onboarded or an AE's
 * industry changes (app/admin/clients/new/actions.ts,
 * app/admin/users/actions.ts), scoped to just that industry. This cron
 * exists as a fallback for any other route that changes AE↔industry
 * coverage, and to catch anything the synchronous calls missed.
 *
 * Security: protected by the standard `CRON_SECRET` bearer-token check,
 * same pattern as every other cron route in this project.
 */

import { NextResponse } from "next/server"
import { rematchOpenSharedInboxLeads } from "@/lib/matching/rematch-shared-inbox"

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

  try {
    const summary = await rematchOpenSharedInboxLeads({
      triggeredBy: "cron:rematch-unassigned",
    })

    if (summary.scanned > 0) {
      console.log(
        `[v0] rematch-unassigned: scanned=${summary.scanned} auto-assigned=${summary.autoAssigned} moved-to-per-ae-inbox=${summary.movedToPerAeInbox} still-unmatched=${summary.stillUnmatched} errors=${summary.errors.length}`,
      )
    }

    return NextResponse.json({ ok: true, ...summary })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[v0] rematch-unassigned cron failed", err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
