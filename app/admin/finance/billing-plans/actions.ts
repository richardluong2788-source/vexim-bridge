"use server"

import { revalidatePath } from "next/cache"
import { requireCap } from "@/lib/auth/guard"
import { CAPS } from "@/lib/auth/permissions"
import type { BillingPlanStatus } from "@/lib/supabase/types"

type ActionResult = { ok: true; id?: string } | { ok: false; error: string }

// All billing-plan writes gate on CAPS.BILLING_PLAN_WRITE
// (admin / super_admin / finance).

export interface BillingPlanInput {
  client_id: string
  plan_name: string
  setup_fee_usd: number | null
  monthly_retainer_usd: number | null
  success_fee_percent: number | null
  retainer_credit_percent: number
  contract_start_date: string | null
  contract_end_date: string | null
  billing_anchor_day: number
  fx_rate_vnd_per_usd: number | null
  status: BillingPlanStatus
  notes: string | null
}

function validate(input: BillingPlanInput): string | null {
  if (!input.client_id) return "missing_client"
  if (!input.plan_name?.trim()) return "missing_plan_name"
  if (input.billing_anchor_day < 1 || input.billing_anchor_day > 28) {
    return "invalid_anchor_day"
  }
  if (input.retainer_credit_percent < 0 || input.retainer_credit_percent > 100) {
    return "invalid_credit_percent"
  }
  if (
    input.success_fee_percent != null &&
    (input.success_fee_percent < 0 || input.success_fee_percent > 100)
  ) {
    return "invalid_success_fee"
  }
  if (!["active", "paused", "terminated"].includes(input.status)) {
    return "invalid_status"
  }
  return null
}

export async function createBillingPlanAction(
  input: BillingPlanInput,
): Promise<ActionResult> {
  const guard = await requireCap(CAPS.BILLING_PLAN_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin, userId } = guard

  const v = validate(input)
  if (v) return { ok: false, error: v }

  const { data, error } = await admin
    .from("billing_plans" as never)
    .insert({
      client_id: input.client_id,
      plan_name: input.plan_name.trim(),
      setup_fee_usd: input.setup_fee_usd,
      monthly_retainer_usd: input.monthly_retainer_usd,
      success_fee_percent: input.success_fee_percent,
      retainer_credit_percent: input.retainer_credit_percent,
      contract_start_date: input.contract_start_date,
      contract_end_date: input.contract_end_date,
      billing_anchor_day: input.billing_anchor_day,
      fx_rate_vnd_per_usd: input.fx_rate_vnd_per_usd,
      status: input.status,
      notes: input.notes?.trim() || null,
      created_by: userId,
    } as never)
    .select("id")
    .single<{ id: string }>()

  if (error) {
    console.error("[v0] createBillingPlan failed", error)
    const msg = error.message.includes("ux_billing_plans_active_per_client")
      ? "active_plan_exists"
      : "db_error"
    return { ok: false, error: msg }
  }

  revalidatePath("/admin/finance/billing-plans")
  revalidatePath(`/admin/clients/${input.client_id}`)
  return { ok: true, id: data?.id }
}

export async function updateBillingPlanAction(
  id: string,
  input: BillingPlanInput,
): Promise<ActionResult> {
  const guard = await requireCap(CAPS.BILLING_PLAN_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin } = guard

  const v = validate(input)
  if (v) return { ok: false, error: v }

  const { error } = await admin
    .from("billing_plans" as never)
    .update({
      plan_name: input.plan_name.trim(),
      setup_fee_usd: input.setup_fee_usd,
      monthly_retainer_usd: input.monthly_retainer_usd,
      success_fee_percent: input.success_fee_percent,
      retainer_credit_percent: input.retainer_credit_percent,
      contract_start_date: input.contract_start_date,
      contract_end_date: input.contract_end_date,
      billing_anchor_day: input.billing_anchor_day,
      fx_rate_vnd_per_usd: input.fx_rate_vnd_per_usd,
      status: input.status,
      notes: input.notes?.trim() || null,
    } as never)
    .eq("id", id)

  if (error) {
    console.error("[v0] updateBillingPlan failed", error)
    const msg = error.message.includes("ux_billing_plans_active_per_client")
      ? "active_plan_exists"
      : "db_error"
    return { ok: false, error: msg }
  }

  revalidatePath("/admin/finance/billing-plans")
  revalidatePath(`/admin/finance/billing-plans/${id}`)
  revalidatePath(`/admin/clients/${input.client_id}`)
  return { ok: true, id }
}

export async function deleteBillingPlanAction(
  id: string,
): Promise<ActionResult> {
  const guard = await requireCap(CAPS.BILLING_PLAN_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin } = guard

  // Guard: only delete plans that have no invoices attached — safer to
  // set to 'terminated' otherwise (UI nudges toward that).
  const { count } = await admin
    .from("invoices" as never)
    .select("id", { count: "exact", head: true })
    .eq("billing_plan_id", id)

  if ((count ?? 0) > 0) {
    return { ok: false, error: "has_invoices" }
  }

  const { error } = await admin
    .from("billing_plans" as never)
    .delete()
    .eq("id", id)

  if (error) return { ok: false, error: "db_error" }

  revalidatePath("/admin/finance/billing-plans")
  return { ok: true }
}
