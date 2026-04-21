/**
 * Auto Success-Fee cron.
 *
 * Runs daily at 02:30 UTC. Scans deals that are:
 *   - stage = 'shipped' OR 'won'
 *   - payment_status IN ('pending', 'partial', 'paid')
 *   - have a positive commission_amount
 *   - do NOT already have a success_fee invoice
 *
 * For each match, creates a DRAFT success_fee invoice with the standard
 * retainer credit applied (50% of paid retainer invoices, up to the commission
 * total). The admin then reviews and sends it from the invoice list.
 *
 * We intentionally create drafts rather than auto-send to preserve admin
 * oversight of the invoice, especially the exact amount and the chosen
 * retainer credits to burn.
 */

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createDraftInvoice } from "@/lib/finance/invoices"
import { loadFinanceSettings } from "@/lib/finance/settings"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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
  const settings = await loadFinanceSettings()
  const defaultFx = settings?.default_fx_rate_vnd_per_usd ?? 25000
  const today = new Date().toISOString().slice(0, 10)

  type DealRow = {
    id: string
    opportunity_id: string
    commission_amount: number | string
    payment_status: string | null
    opportunities:
      | { id: string; stage: string | null; client_id: string | null }
      | null
  }

  // Pull candidate deals. We join opportunities to get client_id + stage,
  // and filter out deals that already have a success_fee invoice via a
  // LEFT JOIN emulation (second query).
  const { data: dealsData, error } = await admin
    .from("deals")
    .select(
      `
        id,
        opportunity_id,
        commission_amount,
        payment_status,
        opportunities:opportunity_id (
          id,
          stage,
          client_id
        )
      `,
    )
    .gt("commission_amount", 0)
    .in("payment_status", ["pending", "partial", "paid"])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const deals = (dealsData ?? []) as unknown as DealRow[]

  // Which deals already have a success_fee invoice?
  const dealIds = deals.map((d) => d.id)
  let alreadyInvoiced = new Set<string>()
  if (dealIds.length > 0) {
    const { data: existing } = await admin
      .from("invoices" as never)
      .select("deal_id")
      .eq("kind", "success_fee")
      .in("deal_id", dealIds)
    const rows = (existing ?? []) as unknown as Array<{
      deal_id: string | null
    }>
    alreadyInvoiced = new Set(
      rows
        .map((r) => r.deal_id)
        .filter((x): x is string => typeof x === "string"),
    )
  }

  const created: string[] = []
  const skipped: Array<{ dealId: string; reason: string }> = []
  const failed: Array<{ dealId: string; reason: string }> = []

  for (const deal of deals) {
    try {
      const opp = deal.opportunities

      if (!opp?.client_id) {
        skipped.push({ dealId: deal.id, reason: "no client" })
        continue
      }
      if (opp.stage !== "shipped" && opp.stage !== "won") {
        skipped.push({ dealId: deal.id, reason: "stage not shipped/won" })
        continue
      }
      if (alreadyInvoiced.has(deal.id)) {
        skipped.push({ dealId: deal.id, reason: "already invoiced" })
        continue
      }

      const inv = await createDraftInvoice({
        kind: "success_fee",
        clientId: opp.client_id,
        dealId: deal.id,
        amountUsd: Number(deal.commission_amount),
        issueDate: today,
        fxRateVndPerUsd: defaultFx,
        memo: `Success fee — deal ${deal.id.slice(0, 8)}`,
        creditApplyMode: "auto",
      })

      created.push(inv.id)
    } catch (err) {
      failed.push({
        dealId: deal.id,
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: deals.length,
    created: created.length,
    skipped: skipped.length,
    failed: failed.length,
    failures: failed,
  })
}
