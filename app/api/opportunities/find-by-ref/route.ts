import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { extractRefCode, extractShortIdFromRef } from "@/lib/email/ref-code"

/**
 * Resolve an email reference code (e.g. `VEX-LA-A3F9C2` or just `A3F9C2`)
 * back to an opportunity id.
 *
 * Used by the search box on /admin/pipeline so a staff member who sees a
 * buyer reply in their Zoho inbox can paste the [VEX-XX-XXXXXX] tag from
 * the subject line and jump straight to the right card.
 *
 * GET /api/opportunities/find-by-ref?q=VEX-LA-A3F9C2
 *  -> { ok: true, opportunity: { id, client_name, lead_company, ref } }
 *  -> { ok: false, reason: "not_found" | "invalid" | "unauthorized" }
 */
export async function GET(request: Request) {
  const supabase = await createClient()

  // Auth: only admin/staff/AE can use this lookup
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 })
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  const allowed = new Set(["admin", "staff", "super_admin", "account_executive"])
  if (!profile || !allowed.has(profile.role)) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 403 })
  }

  const url = new URL(request.url)
  const raw = (url.searchParams.get("q") ?? "").trim()
  if (!raw) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 })
  }

  // Accept either a full ref ("VEX-LA-A3F9C2") or a bare 6-char short id ("A3F9C2")
  let shortId: string | null = null
  const fullRef = extractRefCode(raw)
  if (fullRef) {
    shortId = extractShortIdFromRef(fullRef)
  } else if (/^[A-F0-9]{6}$/i.test(raw)) {
    shortId = raw.toUpperCase()
  }

  if (!shortId) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 })
  }

  // Use the SQL function created in migration 027 — it does the prefix
  // match against opportunities.id::text safely.
  const { data, error } = await supabase.rpc("find_opportunity_by_ref", {
    short_id: shortId,
  })

  if (error || !data || data.length === 0) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 })
  }

  // Multiple matches on a 6-char prefix is astronomically unlikely but we
  // still return the first one and flag ambiguity for the UI.
  const row = data[0]
  return NextResponse.json({
    ok: true,
    ambiguous: data.length > 1,
    opportunity: {
      id: row.id,
      client_name: row.client_name,
      lead_company: row.lead_company,
      stage: row.stage,
      ref: fullRef ?? `VEX-XX-${shortId}`,
    },
  })
}
