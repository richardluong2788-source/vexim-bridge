import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  getBankSnapshot,
  getIssuerSnapshot,
  loadFinanceSettings,
} from "@/lib/finance/settings"
import type {
  BillingPlan,
  Invoice,
  InvoiceKind,
  InvoiceStatus,
  RetainerCredit,
} from "@/lib/supabase/types"

type SupabaseAdmin = ReturnType<typeof createAdminClient>

/**
 * Compute the client's current retainer-credit balance from the ledger.
 * Positive balance = credit available to offset a future success fee.
 */
export async function getRetainerCreditBalance(
  admin: SupabaseAdmin,
  clientId: string,
): Promise<number> {
  const { data, error } = await admin
    .from("retainer_credits" as never)
    .select("amount_usd")
    .eq("client_id", clientId)

  if (error) {
    console.error("[v0] getRetainerCreditBalance failed", error)
    return 0
  }
  let total = 0
  for (const row of (data ?? []) as { amount_usd: number | string }[]) {
    total += Number(row.amount_usd) || 0
  }
  // Round to 2 decimals to avoid floating-point dust.
  return Math.round(total * 100) / 100
}

export interface CreateInvoiceInput {
  kind: InvoiceKind
  client_id: string
  billing_plan_id?: string | null
  deal_id?: string | null
  amount_usd: number
  fx_rate_vnd_per_usd?: number | null
  issue_date?: string | null
  due_date?: string | null
  period_start?: string | null
  period_end?: string | null
  memo?: string | null
  notes?: string | null
  status?: InvoiceStatus
  credit_applied_usd?: number
  created_by?: string | null
}

/**
 * Create an invoice with snapshots baked in so it stays legible
 * even after settings change. Invoice number + due_date defaults
 * are handled by the DB triggers.
 */
export async function createInvoice(
  admin: SupabaseAdmin,
  input: CreateInvoiceInput,
): Promise<{ ok: true; invoice: Invoice } | { ok: false; error: string }> {
  const settings = await loadFinanceSettings()
  const issuer = getIssuerSnapshot(settings)
  const bank = getBankSnapshot(settings)
  const fxRate =
    input.fx_rate_vnd_per_usd ??
    settings?.default_fx_rate_vnd_per_usd ??
    25000

  const payload = {
    kind: input.kind,
    client_id: input.client_id,
    billing_plan_id: input.billing_plan_id ?? null,
    deal_id: input.deal_id ?? null,
    amount_usd: input.amount_usd,
    credit_applied_usd: input.credit_applied_usd ?? 0,
    fx_rate_vnd_per_usd: fxRate,
    status: input.status ?? "draft",
    issue_date: input.issue_date ?? new Date().toISOString().slice(0, 10),
    due_date: input.due_date ?? null,
    period_start: input.period_start ?? null,
    period_end: input.period_end ?? null,
    memo: input.memo ?? null,
    notes: input.notes ?? null,
    issuer_snapshot: issuer,
    bank_snapshot: bank,
    created_by: input.created_by ?? null,
  }

  const { data, error } = await admin
    .from("invoices" as never)
    .insert(payload as never)
    .select("*")
    .single()

  if (error || !data) {
    console.error("[v0] createInvoice failed", error)
    return { ok: false, error: error?.message ?? "insert failed" }
  }
  return { ok: true, invoice: data as unknown as Invoice }
}

/**
 * Mark an invoice as paid. For retainers, also writes a positive
 * `earned` row into `retainer_credits` equal to
 * amount_usd * plan.retainer_credit_percent / 100.
 *
 * Idempotent: re-calling on an already-paid invoice is a no-op.
 */
export async function markInvoicePaid(
  admin: SupabaseAdmin,
  opts: {
    invoiceId: string
    paidAmountUsd?: number | null
    paymentReference?: string | null
    paidAt?: string | null
    actorId?: string | null
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: invoice, error: fetchErr } = await admin
    .from("invoices" as never)
    .select("*")
    .eq("id", opts.invoiceId)
    .single<Invoice>()

  if (fetchErr || !invoice) {
    return { ok: false, error: fetchErr?.message ?? "invoice not found" }
  }

  if (invoice.status === "paid") {
    return { ok: true }
  }

  const paidAt = opts.paidAt ?? new Date().toISOString()
  const paidAmount = opts.paidAmountUsd ?? invoice.net_amount_usd

  const { error: updErr } = await admin
    .from("invoices" as never)
    .update({
      status: "paid",
      paid_at: paidAt,
      paid_amount_usd: paidAmount,
      payment_reference: opts.paymentReference ?? invoice.payment_reference,
    } as never)
    .eq("id", invoice.id)

  if (updErr) return { ok: false, error: updErr.message }

  // Earn retainer credit when a retainer invoice gets paid.
  if (invoice.kind === "retainer") {
    let creditPercent = 50
    if (invoice.billing_plan_id) {
      const { data: plan } = await admin
        .from("billing_plans" as never)
        .select("retainer_credit_percent")
        .eq("id", invoice.billing_plan_id)
        .maybeSingle<Pick<BillingPlan, "retainer_credit_percent">>()
      if (plan?.retainer_credit_percent != null) {
        creditPercent = Number(plan.retainer_credit_percent)
      }
    }

    const creditAmount = Math.round(
      (Number(invoice.amount_usd) * creditPercent) / 100 * 100,
    ) / 100

    if (creditAmount > 0) {
      await admin.from("retainer_credits" as never).insert({
        client_id: invoice.client_id,
        kind: "earned",
        amount_usd: creditAmount,
        source_invoice_id: invoice.id,
        note: `Earned from retainer ${invoice.invoice_number}`,
        created_by: opts.actorId ?? null,
      } as never)
    }
  }

  return { ok: true }
}

/**
 * Create a success-fee invoice for a deal, automatically applying
 * the client's available retainer credit balance up to the fee amount.
 *
 * Inserts a matching negative "applied" row into retainer_credits
 * to keep the ledger balanced.
 */
export async function createSuccessFeeInvoice(
  admin: SupabaseAdmin,
  opts: {
    dealId: string
    clientId: string
    amountUsd: number
    createdBy?: string | null
  },
): Promise<{ ok: true; invoice: Invoice } | { ok: false; error: string }> {
  // Do we already have one for this deal? The unique index enforces
  // the same rule but this gives a friendlier error path.
  const { data: existing } = await admin
    .from("invoices" as never)
    .select("id")
    .eq("deal_id", opts.dealId)
    .eq("kind", "success_fee")
    .not("status", "in", "(cancelled,void)")
    .maybeSingle<{ id: string }>()

  if (existing?.id) {
    return { ok: false, error: "success_fee_already_exists" }
  }

  const balance = await getRetainerCreditBalance(admin, opts.clientId)
  const creditApplied = Math.min(Math.max(balance, 0), opts.amountUsd)

  const created = await createInvoice(admin, {
    kind: "success_fee",
    client_id: opts.clientId,
    deal_id: opts.dealId,
    amount_usd: opts.amountUsd,
    credit_applied_usd: creditApplied,
    status: "draft",
    memo: `Success fee — deal ${opts.dealId.slice(0, 8)}`,
    created_by: opts.createdBy ?? null,
  })

  if (!created.ok) return created

  // Write the offsetting ledger entry so the balance reflects reality.
  if (creditApplied > 0) {
    await admin.from("retainer_credits" as never).insert({
      client_id: opts.clientId,
      kind: "applied",
      amount_usd: -creditApplied,
      applied_to_invoice_id: created.invoice.id,
      note: `Applied to success fee ${created.invoice.invoice_number}`,
      created_by: opts.createdBy ?? null,
    } as never)
  }

  return created
}

/**
 * Monthly period helpers — used by the retainer cron.
 * Given a JS date, returns YYYY-MM-01 and last-day-of-month.
 */
export function getRetainerPeriodForMonth(monthAnchor: Date) {
  const y = monthAnchor.getUTCFullYear()
  const m = monthAnchor.getUTCMonth() // 0-indexed
  const start = new Date(Date.UTC(y, m, 1))
  const end = new Date(Date.UTC(y, m + 1, 0))
  return {
    period_start: start.toISOString().slice(0, 10),
    period_end: end.toISOString().slice(0, 10),
  }
}

/**
 * Cron-friendly period helper. Returns `periodStart` and `periodEnd`
 * in YYYY-MM-DD strings for the calendar month containing `today`.
 * Used by the monthly-retainer cron.
 */
export function issuePeriodForAnchorDay(today: Date): {
  periodStart: string
  periodEnd: string
} {
  const { period_start, period_end } = getRetainerPeriodForMonth(today)
  return { periodStart: period_start, periodEnd: period_end }
}

export interface CreateDraftInvoiceInput {
  kind: InvoiceKind
  clientId: string
  billingPlanId?: string | null
  dealId?: string | null
  amountUsd: number
  issueDate?: string | null
  dueDate?: string | null
  periodStart?: string | null
  periodEnd?: string | null
  fxRateVndPerUsd?: number | null
  memo?: string | null
  notes?: string | null
  /**
   * - "none": ignore retainer credits (used for retainer invoices themselves).
   * - "auto": compute current credit balance for the client and apply up to
   *   the invoice amount (used for success-fee invoices).
   */
  creditApplyMode?: "none" | "auto"
  createdBy?: string | null
}

/**
 * Cron-friendly wrapper around `createInvoice`. Creates the admin client
 * internally and accepts camelCase fields. Throws on failure so callers can
 * catch-and-record errors per-row.
 */
export async function createDraftInvoice(
  input: CreateDraftInvoiceInput,
): Promise<Invoice> {
  const admin = createAdminClient()

  let creditApplied = 0
  if (input.creditApplyMode === "auto") {
    const balance = await getRetainerCreditBalance(admin, input.clientId)
    creditApplied = Math.min(Math.max(balance, 0), input.amountUsd)
  }

  const result = await createInvoice(admin, {
    kind: input.kind,
    client_id: input.clientId,
    billing_plan_id: input.billingPlanId ?? null,
    deal_id: input.dealId ?? null,
    amount_usd: input.amountUsd,
    fx_rate_vnd_per_usd: input.fxRateVndPerUsd ?? null,
    issue_date: input.issueDate ?? null,
    due_date: input.dueDate ?? null,
    period_start: input.periodStart ?? null,
    period_end: input.periodEnd ?? null,
    memo: input.memo ?? null,
    notes: input.notes ?? null,
    status: "draft",
    credit_applied_usd: creditApplied,
    created_by: input.createdBy ?? null,
  })

  if (!result.ok) {
    throw new Error(result.error)
  }

  // Write offsetting ledger entry when credit was applied.
  if (creditApplied > 0) {
    await admin.from("retainer_credits" as never).insert({
      client_id: input.clientId,
      kind: "applied",
      amount_usd: -creditApplied,
      applied_to_invoice_id: result.invoice.id,
      note: `Applied to ${result.invoice.invoice_number}`,
      created_by: input.createdBy ?? null,
    } as never)
  }

  return result.invoice
}

export type InvoiceWithClient = Invoice & {
  profiles: { id: string; full_name: string | null; company_name: string | null; email: string | null } | null
}

export type RetainerCreditRow = RetainerCredit
