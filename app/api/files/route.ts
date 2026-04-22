/**
 * Authenticated proxy for files stored in the *private* Vercel Blob store.
 *
 * Usage: GET /api/files?path=<pathname>[&token=<share-token>]
 *
 * Authorization rules:
 *
 *  1. If `token` is provided, validate it against `tokenized_share_links`:
 *       - link must exist, not be revoked, not be expired
 *       - the referenced `compliance_docs.url` must equal the requested
 *         pathname (stops a valid token from being pivoted to another file)
 *       - the doc kind must be in the publicly shareable whitelist
 *         (factory_video, factory_photo, price_floor). FDA cert / COA
 *         can never be surfaced through share links — they stay gated
 *         behind authenticated staff access only.
 *     This branch does NOT require a logged-in user.
 *
 *  2. Otherwise, require a Supabase session:
 *       - staff roles (admin, super_admin, staff, lead_researcher,
 *         account_executive) can read anything (they see every client
 *         and every deal in the UI)
 *       - `client` role can only read objects whose pathname is scoped
 *         to them: `clients/<their uuid>/...` OR pathnames belonging to
 *         a deal on an opportunity they own (checked via DB).
 *
 *  On success we stream the blob with an ETag + `Cache-Control: private,
 *  no-cache` — the browser caches bytes but always revalidates. When the
 *  client sends `If-None-Match`, we pass it through and respond 304 if
 *  the blob hasn't changed.
 */
import { type NextRequest, NextResponse } from "next/server"
import { get } from "@vercel/blob"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const STAFF_ROLES = new Set([
  "admin",
  "super_admin",
  "staff",
  "lead_researcher",
  "account_executive",
])

// Mirrors the whitelist in app/share/[token]/page.tsx.
const PUBLICLY_SHAREABLE_KINDS = new Set([
  "factory_video",
  "factory_photo",
  "price_floor",
])

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path")
  const token = request.nextUrl.searchParams.get("token")

  if (!path) {
    return NextResponse.json({ error: "missing path" }, { status: 400 })
  }

  // Refuse path traversal attempts — pathnames we produce are plain
  // relative strings like `clients/<uuid>/kind/<ts>-<name>`.
  if (path.startsWith("/") || path.includes("..")) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 })
  }

  const authorized = token
    ? await authorizeViaShareToken(token, path)
    : await authorizeViaSession(path)

  if (!authorized) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  try {
    const result = await get(path, {
      access: "private",
      ifNoneMatch: request.headers.get("if-none-match") ?? undefined,
    })

    if (!result) {
      return new NextResponse("Not found", { status: 404 })
    }

    if (result.statusCode === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: result.blob.etag,
          "Cache-Control": "private, no-cache",
        },
      })
    }

    // `Content-Disposition: inline` so browsers render PDFs/images/videos
    // in place; users can still right-click → download or use the
    // explicit download button (we don't force `attachment`).
    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType || "application/octet-stream",
        ETag: result.blob.etag,
        "Cache-Control": "private, no-cache",
        "Content-Disposition": "inline",
      },
    })
  } catch (err) {
    console.error("[v0] /api/files get failed", err)
    return NextResponse.json({ error: "failed" }, { status: 500 })
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Authorization helpers
// ────────────────────────────────────────────────────────────────────────────

async function authorizeViaShareToken(
  token: string,
  path: string,
): Promise<boolean> {
  const admin = createAdminClient()
  const { data: link } = await admin
    .from("tokenized_share_links")
    .select(
      "token, revoked_at, expires_at, compliance_docs:doc_id ( url, kind )",
    )
    .eq("token", token)
    .maybeSingle()

  if (!link) return false
  if (link.revoked_at) return false
  if (new Date(link.expires_at).getTime() < Date.now()) return false

  const doc = link.compliance_docs as
    | { url: string; kind: string }
    | { url: string; kind: string }[]
    | null
  // Supabase may return a single row OR an array depending on relation
  // cardinality — normalize.
  const docRow = Array.isArray(doc) ? doc[0] : doc
  if (!docRow) return false
  if (docRow.url !== path) return false
  if (!PUBLICLY_SHAREABLE_KINDS.has(docRow.kind)) return false

  return true
}

async function authorizeViaSession(path: string): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return false

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  const role = profile?.role

  // Staff can read any file — the UI already gates discovery.
  if (role && STAFF_ROLES.has(role)) return true

  // Clients can only read files under their own scope.
  if (role === "client") {
    // Compliance docs are always prefixed with `clients/<ownerId>/`.
    if (path.startsWith(`clients/${user.id}/`)) return true

    // Deal docs are prefixed with `deals/<dealId>/`. We need to verify
    // the deal belongs to an opportunity owned by this client.
    const match = path.match(/^deals\/([^/]+)\//)
    if (match) {
      const dealId = match[1]
      const admin = createAdminClient()
      const { data: deal } = await admin
        .from("deals")
        .select("opportunities:opportunity_id ( owner_id )")
        .eq("id", dealId)
        .maybeSingle()

      const opp = deal?.opportunities as
        | { owner_id: string }
        | { owner_id: string }[]
        | null
      const oppRow = Array.isArray(opp) ? opp[0] : opp
      if (oppRow?.owner_id === user.id) return true
    }
  }

  return false
}
