/**
 * Public, unauthenticated beacon endpoint for the tokenized shortlist page.
 * The UUID token is the sole authorization bearer, same trust model as
 * `markShortlistInterest` in `../actions.ts`.
 *
 * Called by <DwellTracker> (client component) via `navigator.sendBeacon`
 * (falling back to `fetch(..., { keepalive: true })`) to report how many
 * milliseconds each supplier card was actually visible in the buyer's
 * viewport, so the AE can see which option is winning the buyer's
 * attention — not just that the link was opened.
 *
 * This route never blocks or errors the page itself: it always returns
 * 200 on validation failure too, since a rejected beacon has no UI to
 * surface an error on and must not throw noisy console errors on every
 * page for a buyer who already left.
 */
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

interface DwellEntry {
  itemId: string
  ms: number
}

function isValidEntry(e: unknown): e is DwellEntry {
  if (!e || typeof e !== "object") return false
  const entry = e as Record<string, unknown>
  return typeof entry.itemId === "string" && typeof entry.ms === "number" && Number.isFinite(entry.ms)
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  let body: { entries?: unknown[] }
  try {
    body = await request.json()
  } catch {
    return new Response(null, { status: 204 })
  }

  const entries = (body.entries ?? []).filter(isValidEntry).slice(0, 10)
  if (entries.length === 0) {
    return new Response(null, { status: 204 })
  }

  const admin = createAdminClient()

  const { data: link } = await admin
    .from("shortlist_share_links")
    .select("token, version_id, expires_at, revoked_at")
    .eq("token", token)
    .maybeSingle()

  if (!link || link.revoked_at || new Date(link.expires_at).getTime() < Date.now() || !link.version_id) {
    return new Response(null, { status: 204 })
  }

  // Best-effort, fire-and-forget: run all increments in parallel, never
  // surface partial failures to the buyer's page.
  await Promise.all(
    entries.map((entry) =>
      admin.rpc("increment_shortlist_item_dwell", {
        p_item_id: entry.itemId,
        p_version_id: link.version_id,
        p_delta_ms: Math.round(entry.ms),
      }),
    ),
  )

  return new Response(null, { status: 204 })
}
