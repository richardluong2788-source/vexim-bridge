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
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAnyCap, requireCap } from "@/lib/auth/guard"
import { can, CAPS } from "@/lib/auth/permissions"
import { ownershipScopeFor, assertOpportunityOwned } from "@/lib/auth/scope"

type ActionResult = { ok: true } | { ok: false; error: string }

export async function updateDealFinancialsAction(args: {
  opportunityId: string
  costPriceSupplier: number | null
  suggestedSellingPrice: number | null
  quantityUnits: number | null
  unitLabel: string | null
  /**
   * Giá trị đơn hàng FOB (USD) + tỷ lệ hoa hồng (%) — cơ sở tính hoa hồng
   * thành công. KHÔNG hard-code: mặc định theo gói hợp đồng của client,
   * admin/AE chỉnh được theo thỏa thuận từng deal (mỗi ngành một mức).
   * commission_amount là GENERATED column (invoice_value × rate / 100).
   */
  invoiceValue?: number | null
  commissionRate?: number | null
}): Promise<ActionResult> {
  if (
    args.commissionRate != null &&
    (args.commissionRate < 0 || args.commissionRate > 100)
  ) {
    return { ok: false, error: "invalidCommissionRate" }
  }
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

  // Ownership gate (035): AE without OWNERSHIP_BYPASS can only touch deal
  // financials on opportunities snapshotted to them. Otherwise an AE could
  // edit selling-price on another AE's deal and indirectly affect the
  // commission attributed to the rightful owner.
  {
    const scope = ownershipScopeFor(role, userId)
    const own = await assertOpportunityOwned(scope, admin, opportunityId)
    if (!own.ok) return { ok: false, error: own.error }
  }

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

  // Hoa hồng KHÔNG hard-code: bỏ trống (% trống) → lấy % gói hợp đồng active
  // của client làm mặc định. commission_amount là GENERATED column
  // (invoice_value × commission_rate / 100) nên không bao giờ ghi trực tiếp.
  let commissionRate: number | null | undefined = args.commissionRate
  if (commissionRate === null) {
    commissionRate = await getDefaultCommissionRate(admin, opportunityId)
  }

  const payload = {
    cost_price_supplier: costPrice,
    suggested_selling_price: args.suggestedSellingPrice,
    quantity_units: args.quantityUnits,
    unit_label: args.unitLabel,
    ...(args.invoiceValue !== undefined ? { invoice_value: args.invoiceValue } : {}),
    ...(commissionRate != null ? { commission_rate: commissionRate } : {}),
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

export type DealFinancials = {
  id: string | null
  cost_price_supplier: number | null
  suggested_selling_price: number | null
  quantity_units: number | null
  unit_label: string | null
  profit_margin_usd: number | null
  invoice_value: number | null
  commission_rate: number | null
  commission_amount: number | null
  /** % hoa hồng mặc định từ billing plan ACTIVE của client (null = chưa có gói). */
  default_commission_rate: number | null
}

export async function getDealFinancials(
  opportunityId: string,
): Promise<DealFinancials | null> {
  const guard = await requireCap(CAPS.DEAL_VIEW)
  if (!guard.ok) return null
  const { admin, role } = guard

  // % mặc định theo gói hợp đồng active của client — để UI hiện placeholder.
  const defaultRate = await getDefaultCommissionRate(admin, opportunityId)

  const { data } = await admin
    .from("deals")
    .select(
      "id, cost_price_supplier, suggested_selling_price, quantity_units, unit_label, profit_margin_usd, invoice_value, commission_rate, commission_amount",
    )
    .eq("opportunity_id", opportunityId)
    .maybeSingle()

  // R-06: hide cost_price + margin from roles without the write cap.
  // (Selling price remains visible so AE can still quote buyers.)
  const hideCost = !can(role, CAPS.DEAL_COST_PRICE_WRITE)

  return {
    id: data?.id ?? null,
    cost_price_supplier: hideCost ? null : (data?.cost_price_supplier ?? null),
    suggested_selling_price: data?.suggested_selling_price ?? null,
    quantity_units: data?.quantity_units ?? null,
    unit_label: data?.unit_label ?? null,
    profit_margin_usd: hideCost ? null : (data?.profit_margin_usd ?? null),
    invoice_value: data?.invoice_value ?? null,
    commission_rate: data?.commission_rate ?? null,
    commission_amount: data?.commission_amount ?? null,
    default_commission_rate: defaultRate,
  }
}

/**
 * % hoa hồng mặc định cho một opportunity: đọc từ billing plan ACTIVE của
 * client sở hữu deal (success_fee_percent — mỗi hợp đồng một mức, thỏa thuận
 * riêng với từng client). Trả về null nếu client chưa có gói.
 */
async function getDefaultCommissionRate(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  opportunityId: string,
): Promise<number | null> {
  try {
    const { data: opp } = await admin
      .from("opportunities")
      .select("client_id")
      .eq("id", opportunityId)
      .maybeSingle()
    if (!opp?.client_id) return null
    const { data: plan } = await admin
      .from("billing_plans")
      .select("success_fee_percent")
      .eq("client_id", opp.client_id)
      .eq("status", "active")
      .maybeSingle()
    return plan?.success_fee_percent != null ? Number(plan.success_fee_percent) : null
  } catch {
    return null
  }
}
