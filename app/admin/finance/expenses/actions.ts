"use server"

import { revalidatePath } from "next/cache"
import { requireCap } from "@/lib/auth/guard"
import { CAPS } from "@/lib/auth/permissions"
import type { ExpenseCategory } from "@/lib/supabase/types"

type ActionResult = { ok: true; id?: string } | { ok: false; error: string }

// All operating-expense writes gate on CAPS.EXPENSE_WRITE
// (admin / super_admin / finance).

export interface ExpenseInput {
  expense_date: string
  category: ExpenseCategory
  vendor: string | null
  description: string | null
  amount_usd: number
  fx_rate_vnd_per_usd: number | null
  is_recurring: boolean
  recurring_frequency: "monthly" | "quarterly" | "yearly" | null
  notes: string | null
}

function validate(input: ExpenseInput): string | null {
  if (!input.expense_date) return "missing_date"
  if (!input.category) return "missing_category"
  if (!Number.isFinite(input.amount_usd) || input.amount_usd < 0) {
    return "invalid_amount"
  }
  if (input.is_recurring && !input.recurring_frequency) {
    return "missing_frequency"
  }
  return null
}

export async function createExpenseAction(
  input: ExpenseInput,
): Promise<ActionResult> {
  const guard = await requireCap(CAPS.EXPENSE_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin, userId } = guard

  const v = validate(input)
  if (v) return { ok: false, error: v }

  const { data, error } = await admin
    .from("operating_expenses" as never)
    .insert({
      expense_date: input.expense_date,
      category: input.category,
      vendor: input.vendor?.trim() || null,
      description: input.description?.trim() || null,
      amount_usd: input.amount_usd,
      fx_rate_vnd_per_usd: input.fx_rate_vnd_per_usd,
      is_recurring: input.is_recurring,
      recurring_frequency: input.is_recurring
        ? input.recurring_frequency
        : null,
      notes: input.notes?.trim() || null,
      created_by: userId,
    } as never)
    .select("id")
    .single<{ id: string }>()

  if (error) {
    console.error("[v0] createExpense failed", error)
    return { ok: false, error: "db_error" }
  }

  revalidatePath("/admin/finance/expenses")
  revalidatePath("/admin/finance")
  return { ok: true, id: data?.id }
}

export async function updateExpenseAction(
  id: string,
  input: ExpenseInput,
): Promise<ActionResult> {
  const guard = await requireCap(CAPS.EXPENSE_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin } = guard

  const v = validate(input)
  if (v) return { ok: false, error: v }

  const { error } = await admin
    .from("operating_expenses" as never)
    .update({
      expense_date: input.expense_date,
      category: input.category,
      vendor: input.vendor?.trim() || null,
      description: input.description?.trim() || null,
      amount_usd: input.amount_usd,
      fx_rate_vnd_per_usd: input.fx_rate_vnd_per_usd,
      is_recurring: input.is_recurring,
      recurring_frequency: input.is_recurring
        ? input.recurring_frequency
        : null,
      notes: input.notes?.trim() || null,
    } as never)
    .eq("id", id)

  if (error) return { ok: false, error: "db_error" }

  revalidatePath("/admin/finance/expenses")
  revalidatePath("/admin/finance")
  return { ok: true, id }
}

export async function deleteExpenseAction(
  id: string,
): Promise<ActionResult> {
  const guard = await requireCap(CAPS.EXPENSE_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin } = guard

  const { error } = await admin
    .from("operating_expenses" as never)
    .delete()
    .eq("id", id)

  if (error) return { ok: false, error: "db_error" }

  revalidatePath("/admin/finance/expenses")
  revalidatePath("/admin/finance")
  return { ok: true }
}
