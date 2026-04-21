"use server"

import { revalidatePath } from "next/cache"
import { requireCap } from "@/lib/auth/guard"
import { CAPS } from "@/lib/auth/permissions"
import { createInvoice, markInvoicePaid } from "@/lib/finance/invoices"
import { loadFinanceSettings } from "@/lib/finance/settings"
import { sendInvoiceEmail } from "@/lib/finance/invoice-email"
import type { InvoiceKind, InvoiceStatus } from "@/lib/supabase/types"

type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string }

// All invoice writes gate on CAPS.INVOICE_WRITE (admin / super_admin / finance).

export interface ManualInvoiceInput {
  kind: InvoiceKind
  client_id: string
  billing_plan_id?: string | null
  deal_id?: string | null
  amount_usd: number
  fx_rate_vnd_per_usd?: number | null
  issue_date?: string
  due_date?: string
  period_start?: string | null
  period_end?: string | null
  memo?: string | null
  notes?: string | null
  status?: InvoiceStatus
}

export async function createManualInvoiceAction(
  input: ManualInvoiceInput,
): Promise<ActionResult> {
  const guard = await requireCap(CAPS.INVOICE_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin, userId } = guard

  if (!input.client_id) return { ok: false, error: "missing_client" }
  if (!(Number.isFinite(input.amount_usd) && input.amount_usd > 0)) {
    return { ok: false, error: "invalid_amount" }
  }

  const result = await createInvoice(admin, {
    ...input,
    created_by: userId,
    status: input.status ?? "draft",
  })

  if (!result.ok) return { ok: false, error: result.error }

  revalidatePath("/admin/finance/invoices")
  revalidatePath(`/admin/finance/invoices/${result.invoice.id}`)
  return { ok: true, id: result.invoice.id }
}

export async function markInvoicePaidAction(args: {
  invoiceId: string
  paidAmountUsd?: number | null
  paymentReference?: string | null
  paidAt?: string | null
}): Promise<ActionResult> {
  const guard = await requireCap(CAPS.INVOICE_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin, userId } = guard

  const result = await markInvoicePaid(admin, {
    invoiceId: args.invoiceId,
    paidAmountUsd: args.paidAmountUsd,
    paymentReference: args.paymentReference,
    paidAt: args.paidAt,
    actorId: userId,
  })
  if (!result.ok) return { ok: false, error: result.error }

  revalidatePath("/admin/finance/invoices")
  revalidatePath(`/admin/finance/invoices/${args.invoiceId}`)
  revalidatePath("/admin/finance")
  return { ok: true }
}

export async function updateInvoiceStatusAction(args: {
  invoiceId: string
  status: InvoiceStatus
}): Promise<ActionResult> {
  const guard = await requireCap(CAPS.INVOICE_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin } = guard

  if (args.status === "paid") {
    return markInvoicePaidAction({ invoiceId: args.invoiceId })
  }

  const { error } = await admin
    .from("invoices" as never)
    .update({ status: args.status } as never)
    .eq("id", args.invoiceId)

  if (error) return { ok: false, error: error.message }

  revalidatePath("/admin/finance/invoices")
  revalidatePath(`/admin/finance/invoices/${args.invoiceId}`)
  return { ok: true }
}

export async function sendInvoiceEmailAction(
  invoiceId: string,
): Promise<ActionResult> {
  const guard = await requireCap(CAPS.INVOICE_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin } = guard

  const { data: invoice, error: fetchErr } = await admin
    .from("invoices" as never)
    .select(
      "*, profiles:client_id (id, full_name, company_name, email, preferred_language)",
    )
    .eq("id", invoiceId)
    .single()

  if (fetchErr || !invoice) {
    return { ok: false, error: "invoice_not_found" }
  }

  const settings = await loadFinanceSettings()
  const result = await sendInvoiceEmail({
    // deno-lint-ignore no-explicit-any
    invoice: invoice as any,
    settings,
  })
  if (!result.ok) return { ok: false, error: result.error }

  // Flip status: draft -> sent (unless already paid/beyond).
  // deno-lint-ignore no-explicit-any
  const inv = invoice as any
  const nextStatus =
    inv.status === "draft" ? "sent" : (inv.status as InvoiceStatus)
  await admin
    .from("invoices" as never)
    .update({
      status: nextStatus,
      email_sent_at: new Date().toISOString(),
    } as never)
    .eq("id", invoiceId)

  revalidatePath(`/admin/finance/invoices/${invoiceId}`)
  revalidatePath("/admin/finance/invoices")
  return { ok: true }
}

export async function deleteInvoiceAction(
  invoiceId: string,
): Promise<ActionResult> {
  const guard = await requireCap(CAPS.INVOICE_VOID)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin } = guard

  // Guard: can only delete drafts. Paid/sent invoices should be voided.
  const { data: invoice } = await admin
    .from("invoices" as never)
    .select("status")
    .eq("id", invoiceId)
    .single<{ status: InvoiceStatus }>()

  if (!invoice) return { ok: false, error: "invoice_not_found" }
  if (invoice.status !== "draft") {
    return { ok: false, error: "only_draft_deletable" }
  }

  const { error } = await admin
    .from("invoices" as never)
    .delete()
    .eq("id", invoiceId)
  if (error) return { ok: false, error: "db_error" }

  revalidatePath("/admin/finance/invoices")
  return { ok: true }
}
