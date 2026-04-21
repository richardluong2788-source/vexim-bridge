/**
 * Monthly Retainer cron.
 *
 * Runs every day at 01:00 UTC. For every active billing plan that has a
 * `monthly_retainer_usd` set, it checks whether today is the plan's
 * `billing_anchor_day` (clamped to the last day of short months) and if so,
 * creates a draft "retainer" invoice for the current calendar month — unless
 * one already exists.
 *
 * The invoice is created in `draft` status so the admin can review before
 * sending. This matches the flow described in the SOP:
 *   1. System prepares invoice automatically
 *   2. Admin opens /admin/finance/invoices, reviews, clicks "Send"
 *   3. Client receives email with VietQR
 *
 * Security: standard Authorization: Bearer ${CRON_SECRET} guard.
 */

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  createDraftInvoice,
  issuePeriodForAnchorDay,
} from "@/lib/finance/invoices"
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
  const today = new Date()
  // Work in UTC to match stored DATE columns from Vercel Cron (which runs UTC).
  const todayDay = today.getUTCDate()
  const daysInMonth = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0),
  ).getUTCDate()

  type PlanRow = {
    id: string
    client_id: string
    plan_name: string
    monthly_retainer_usd: number | null
    billing_anchor_day: number | null
    fx_rate_vnd_per_usd: number | null
    contract_start_date: string | null
    contract_end_date: string | null
    status: string
  }

  const { data: plansData, error } = await admin
    .from("billing_plans" as never)
    .select(
      "id, client_id, plan_name, monthly_retainer_usd, billing_anchor_day, fx_rate_vnd_per_usd, contract_start_date, contract_end_date, status",
    )
    .eq("status", "active")
    .not("monthly_retainer_usd", "is", null)
    .gt("monthly_retainer_usd", 0)

  if (error) {
    console.error("[v0] monthly-retainer: failed to load plans", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const plans = (plansData ?? []) as unknown as PlanRow[]

  const created: string[] = []
  const skipped: Array<{ planId: string; reason: string }> = []
  const failed: Array<{ planId: string; reason: string }> = []

  for (const plan of plans) {
    try {
      // Clamp anchor day to month length (e.g. anchor=31 in February → 28/29).
      const anchor = Math.min(
        Math.max(plan.billing_anchor_day ?? 1, 1),
        daysInMonth,
      )
      if (anchor !== todayDay) {
        skipped.push({ planId: plan.id, reason: "not anchor day" })
        continue
      }

      // Contract window guard.
      if (plan.contract_start_date) {
        const startMs = new Date(plan.contract_start_date).getTime()
        if (startMs > today.getTime()) {
          skipped.push({ planId: plan.id, reason: "contract not started" })
          continue
        }
      }
      if (plan.contract_end_date) {
        const endMs = new Date(plan.contract_end_date).getTime()
        if (endMs < today.getTime()) {
          skipped.push({ planId: plan.id, reason: "contract ended" })
          continue
        }
      }

      const { periodStart, periodEnd } = issuePeriodForAnchorDay(today)

      // Dedup: an invoice already exists for this plan + period.
      const { data: existing } = await admin
        .from("invoices" as never)
        .select("id")
        .eq("billing_plan_id", plan.id)
        .eq("kind", "retainer")
        .eq("period_start", periodStart)
        .maybeSingle<{ id: string }>()

      if (existing) {
        skipped.push({ planId: plan.id, reason: "already invoiced" })
        continue
      }

      const inv = await createDraftInvoice({
        kind: "retainer",
        clientId: plan.client_id,
        billingPlanId: plan.id,
        amountUsd: Number(plan.monthly_retainer_usd),
        issueDate: today.toISOString().slice(0, 10),
        periodStart,
        periodEnd,
        fxRateVndPerUsd: plan.fx_rate_vnd_per_usd ?? defaultFx,
        memo: `${plan.plan_name} — retainer ${periodStart.slice(0, 7)}`,
        creditApplyMode: "none",
      })

      created.push(inv.id)
    } catch (err) {
      failed.push({
        planId: plan.id,
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: plans.length,
    created: created.length,
    skipped: skipped.length,
    failed: failed.length,
    failures: failed,
  })
}
