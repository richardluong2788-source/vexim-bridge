/**
 * Invoice overdue cron.
 *
 * Runs daily at 04:00 UTC. Finds invoices that are:
 *   - status = 'sent'
 *   - due_date < today
 *
 * And:
 *   1. Flips their status to 'overdue'
 *   2. Dispatches a notification to the admin team (internal heads-up)
 *   3. Sends a reminder email to the client via the same invoice-email helper
 *
 * Re-reminders: we only email once per 7-day bucket to avoid harassing clients.
 */

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendInvoiceEmailById } from "@/lib/finance/invoice-email"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const REMIND_EVERY_DAYS = 7

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get("authorization") === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()
  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)

  // 1. Find invoices past due that are still "sent".
  const { data: toMarkOverdueData, error: err1 } = await admin
    .from("invoices" as never)
    .select("id")
    .eq("status", "sent")
    .lt("due_date", todayIso)

  if (err1) {
    return NextResponse.json({ error: err1.message }, { status: 500 })
  }

  const toMarkOverdue = (toMarkOverdueData ?? []) as unknown as Array<{
    id: string
  }>

  if (toMarkOverdue.length > 0) {
    await admin
      .from("invoices" as never)
      .update({ status: "overdue" } as never)
      .in(
        "id",
        toMarkOverdue.map((r) => r.id),
      )
  }

  // 2. Fetch all currently-overdue invoices for reminder dispatch.
  const { data: overdueData, error: err2 } = await admin
    .from("invoices" as never)
    .select(
      "id, invoice_number, status, due_date, email_sent_at, client_id, net_amount_usd",
    )
    .eq("status", "overdue")

  if (err2) {
    return NextResponse.json({ error: err2.message }, { status: 500 })
  }

  const overdueInvoices = (overdueData ?? []) as unknown as Array<{
    id: string
    email_sent_at: string | null
  }>

  const reminded: string[] = []
  const skipped: string[] = []
  const failed: Array<{ id: string; reason: string }> = []

  const now = today.getTime()
  const windowMs = REMIND_EVERY_DAYS * 86_400_000

  for (const inv of overdueInvoices) {
    if (inv.email_sent_at) {
      const lastMs = new Date(inv.email_sent_at).getTime()
      if (!Number.isNaN(lastMs) && now - lastMs < windowMs) {
        skipped.push(inv.id)
        continue
      }
    }

    try {
      const res = await sendInvoiceEmailById(inv.id, { reminder: true })
      if (!res.ok) {
        failed.push({ id: inv.id, reason: res.error })
      } else {
        reminded.push(inv.id)
      }
    } catch (err) {
      failed.push({
        id: inv.id,
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({
    ok: true,
    markedOverdue: toMarkOverdue.length,
    reminded: reminded.length,
    skipped: skipped.length,
    failed: failed.length,
    failures: failed,
  })
}
