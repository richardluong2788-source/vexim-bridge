import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

const BATCH_SIZE = 500

/** Remove unused client intake links after their expiry date. */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const now = new Date().toISOString()
    const { data: expired, error: findError } = await admin
      .from("client_intake_submissions")
      .select("id")
      .eq("status", "pending")
      .lte("expires_at", now)
      .limit(BATCH_SIZE)

    if (findError) {
      console.error("[v0] client-intake-expiry: query failed:", findError.message)
      return NextResponse.json({ error: findError.message }, { status: 500 })
    }

    if (!expired || expired.length === 0) {
      return NextResponse.json({ ok: true, deleted: 0 })
    }

    const ids = expired.map(({ id }) => id)
    const { error: deleteError } = await admin
      .from("client_intake_submissions")
      .delete()
      .in("id", ids)
      .eq("status", "pending")

    if (deleteError) {
      console.error("[v0] client-intake-expiry: delete failed:", deleteError.message)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, deleted: ids.length })
  } catch (error) {
    console.error("[v0] client-intake-expiry: unexpected failure:", error)
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 })
  }
}
