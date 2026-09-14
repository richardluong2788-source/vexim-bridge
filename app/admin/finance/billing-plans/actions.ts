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
  if (!["draft", "active", "paused", "terminated"].includes(input.status)) {
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

/**
 * SR: propose the client's service contract as a DRAFT. SR is the person who
 * negotiates setup fee / monthly retainer / success fee % with the supplier,
 * but only Finance can activate a plan (which starts the auto monthly
 * retainer billing). The proposed plan is forced to status 'draft' and SR can
 * only propose for clients they sourced (`profiles.sourced_by = caller`).
 */
export async function proposeBillingPlanAction(
  input: BillingPlanInput,
): Promise<ActionResult> {
  const guard = await requireCap(CAPS.BILLING_PLAN_PROPOSE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin, userId } = guard

  const v = validate(input)
  if (v) return { ok: false, error: v }

  // SR scope: only clients the caller actually sourced.
  const { data: client } = await admin
    .from("profiles")
    .select("id, sourced_by")
    .eq("id", input.client_id)
    .eq("role", "client")
    .maybeSingle<{ id: string; sourced_by: string | null }>()

  if (!client) return { ok: false, error: "missing_client" }
  if (client.sourced_by !== userId) return { ok: false, error: "not_your_client" }

  // One open proposal per client — avoids stacking drafts for Finance.
  const { data: existingDraft } = await admin
    .from("billing_plans" as never)
    .select("id")
    .eq("client_id", input.client_id)
    .eq("status", "draft")
    .maybeSingle<{ id: string }>()

  if (existingDraft) return { ok: false, error: "draft_exists" }

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
      status: "draft",
      notes: input.notes?.trim() || null,
      created_by: userId,
    } as never)
    .select("id")
    .single<{ id: string }>()

  if (error) {
    console.error("[v0] proposeBillingPlan failed", error)
    return { ok: false, error: "db_error" }
  }

  revalidatePath("/admin/sourcing/billing")
  revalidatePath("/admin/finance/billing-plans")
  revalidatePath(`/admin/clients/${input.client_id}`)
  return { ok: true, id: data?.id }
}

/**
 * Finance/Admin: approve a draft billing plan → active. From this moment the
 * monthly-retainer cron starts generating invoices for the client.
 */
export async function approveBillingPlanAction(
  planId: string,
): Promise<ActionResult> {
  const guard = await requireCap(CAPS.BILLING_PLAN_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin, userId } = guard

  if (!planId) return { ok: false, error: "missing_plan" }

  const { data: plan } = await admin
    .from("billing_plans" as never)
    .select("id, status")
    .eq("id", planId)
    .maybeSingle<{ id: string; status: string }>()

  if (!plan) return { ok: false, error: "missing_plan" }
  if (plan.status !== "draft") return { ok: false, error: "not_draft" }

  const { error } = await admin
    .from("billing_plans" as never)
    .update({
      status: "active",
      approved_by: userId,
      approved_at: new Date().toISOString(),
    } as never)
    .eq("id", planId)

  if (error) {
    console.error("[v0] approveBillingPlan failed", error)
    const msg = error.message.includes("ux_billing_plans_active_per_client")
      ? "active_plan_exists"
      : "db_error"
    return { ok: false, error: msg }
  }

  revalidatePath("/admin/finance/billing-plans")
  revalidatePath("/admin/finance")
  revalidatePath("/admin/sourcing/billing")
  return { ok: true, id: planId }
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
