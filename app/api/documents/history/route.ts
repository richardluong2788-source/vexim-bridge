import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/documents/history?docId=xxx
 * Returns the history of changes for a compliance document
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const docId = searchParams.get("docId")

  if (!docId) {
    return NextResponse.json({ error: "Missing docId" }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()

  // Verify ownership or admin access
  const { data: doc, error: docErr } = await admin
    .from("compliance_docs")
    .select("id, owner_id")
    .eq("id", docId)
    .single()

  if (docErr || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  // Check if user is owner or admin
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single()

  const isAdmin = profile?.role && ["admin", "super_admin", "account_executive"].includes(profile.role)
  const isOwner = doc.owner_id === user.id

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Fetch history with changer profile
  const { data: history, error: historyErr } = await admin
    .from("compliance_doc_history")
    .select(`
      id,
      doc_id,
      action,
      changed_by,
      changes,
      old_values,
      new_values,
      notes,
      created_at,
      profiles!compliance_doc_history_changed_by_fkey (
        full_name
      )
    `)
    .eq("doc_id", docId)
    .order("created_at", { ascending: false })
    .limit(50)

  if (historyErr) {
    console.error("[v0] History fetch error:", historyErr)
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 })
  }

  // Transform to include changer name
  const transformedHistory = (history ?? []).map((entry) => ({
    id: entry.id,
    doc_id: entry.doc_id,
    action: entry.action,
    changed_by: entry.changed_by,
    changes: entry.changes,
    old_values: entry.old_values,
    new_values: entry.new_values,
    notes: entry.notes,
    created_at: entry.created_at,
    changer_name: (entry.profiles as { full_name: string | null } | null)?.full_name ?? null,
  }))

  return NextResponse.json({ history: transformedHistory })
}
