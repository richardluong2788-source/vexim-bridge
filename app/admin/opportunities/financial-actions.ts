"use server"

/**
 * Server actions for deal financials (Sprint B / SOP §2.4).
 *
 * Fields in play:
 *   - cost_price_supplier       (Giá gốc VXB trả cho client)
 *   - suggested_selling_price   (Giá đề xuất bán cho buyer)
 *   - quantity_units            (số lượng)
 *   - unit_label                (kg, MT, container, ...)
 *
 * `profit_margin_usd` is a DB-generated column, so we never write it —
 * Postgres recalculates it automatically on every update.
 *
 * RBAC (R-06 partial):
 *   - Account Executives can update selling price / quantity / unit,
 *     but CANNOT change cost_price_supplier. Attempts are silently
 *     coerced to the existing value and a rejection audit entry is
 *     written to the activities log.
 *   - Admin / super_admin have full access.
 */
import { revalidatePath } from "next/cache"
import { requireAnyCap, requireCap } from "@/lib/auth/guard"
import { can, CAPS } from "@/lib/auth/permissions"

type ActionResult = { ok: true } | { ok: false; error: string }

export async function updateDealFinancialsAction(args: {
  opportunityId: string
  costPriceSupplier: number | null
  suggestedSellingPrice: number | null
  quantityUnits: number | null
  unitLabel: string | null
}): Promise<ActionResult> {
  // Writer must be able to edit AT LEAST one of the three write-caps.
  const guard = await requireAnyCap([
    CAPS.DEAL_COST_PRICE_WRITE,
    CAPS.DEAL_SELLING_PRICE_WRITE,
    CAPS.DEAL_QUANTITY_WRITE,
  ])
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin, userId, role } = guard

  const { opportunityId } = args
  if (!opportunityId) return { ok: false, error: "missingOpportunity" }

  // Load existing row (if any) so we can enforce R-06 without leaking data.
  const { data: existing } = await admin
    .from("deals")
    .select("id, cost_price_supplier")
    .eq("opportunity_id", opportunityId)
    .maybeSingle()

  // R-06: if the caller cannot write cost_price, coerce it to the existing
  // value. If they tried to change it, record a compliance rejection.
  let costPrice = args.costPriceSupplier
  if (!can(role, CAPS.DEAL_COST_PRICE_WRITE)) {
    const currentCost = existing?.cost_price_supplier ?? null
    const attempted = args.costPriceSupplier
    if (attempted !== null && attempted !== currentCost) {
      await admin.from("activities").insert({
        action_type: "deal_cost_price_denied",
        description: `Role "${role}" blocked from changing cost_price on opportunity ${opportunityId}`,
        performed_by: userId,
      })
    }
    costPrice = currentCost
  }

  const payload = {
    cost_price_supplier: costPrice,
    suggested_selling_price: args.suggestedSellingPrice,
    quantity_units: args.quantityUnits,
    unit_label: args.unitLabel,
  }

  if (existing?.id) {
    const { error } = await admin
      .from("deals")
      .update(payload)
      .eq("id", existing.id)
    if (error) {
      console.error("[v0] updateDealFinancials update failed", error)
      return { ok: false, error: "dbUpdateFailed" }
    }
  } else {
    const { error } = await admin.from("deals").insert({
      opportunity_id: opportunityId,
      ...payload,
      created_by: userId ?? null,
    })
    if (error) {
      console.error("[v0] updateDealFinancials insert failed", error)
      return { ok: false, error: "dbInsertFailed" }
    }
  }

  revalidatePath(`/admin/opportunities/${opportunityId}`)
  revalidatePath(`/admin/pipeline`)
  return { ok: true }
}

export async function getDealFinancials(opportunityId: string) {
  const guard = await requireCap(CAPS.DEAL_VIEW)
  if (!guard.ok) return null

  const { data } = await guard.admin
    .from("deals")
    .select(
      "id, cost_price_supplier, suggested_selling_price, quantity_units, unit_label, profit_margin_usd, commission_rate, commission_amount",
    )
    .eq("opportunity_id", opportunityId)
    .maybeSingle()

  if (!data) return null

  // R-06: hide cost_price + margin from roles without the write cap.
  // (Selling price remains visible so AE can still quote buyers.)
  if (!can(guard.role, CAPS.DEAL_COST_PRICE_WRITE)) {
    return {
      ...data,
      cost_price_supplier: null,
      profit_margin_usd: null,
    }
  }
  return data
}
