"use server"

import { revalidatePath } from "next/cache"
import { requireCap } from "@/lib/auth/guard"
import { CAPS } from "@/lib/auth/permissions"

export interface SaveSettingsInput {
  invoice_prefix: string
  default_fx_rate_vnd_per_usd: number
  default_payment_terms_days: number
  company_name: string
  company_address: string
  company_tax_id: string
  company_email: string
  company_phone: string
  bank_name: string
  bank_account_no: string
  bank_account_name: string
  bank_bin: string
  bank_swift_code: string
}

export interface SaveSettingsResult {
  ok: boolean
  error?: string
}

/**
 * Save the singleton finance_settings row (id = 1).
 * Admin-only.
 */
export async function saveFinanceSettings(
  input: SaveSettingsInput,
): Promise<SaveSettingsResult> {
  const guard = await requireCap(CAPS.FINANCE_SETTINGS_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin, userId } = guard

  // Validate numbers
  const fx = Number(input.default_fx_rate_vnd_per_usd)
  const terms = Number(input.default_payment_terms_days)
  if (!Number.isFinite(fx) || fx < 1000 || fx > 1_000_000) {
    return { ok: false, error: "invalidFxRate" }
  }
  if (!Number.isFinite(terms) || terms < 0 || terms > 365) {
    return { ok: false, error: "invalidTerms" }
  }

  const normalize = (s: string | null | undefined) => {
    if (!s) return null
    const t = s.trim()
    return t.length === 0 ? null : t
  }

  const { error } = await admin
    .from("finance_settings" as never)
    .update({
      invoice_prefix: normalize(input.invoice_prefix) ?? "VXB",
      default_fx_rate_vnd_per_usd: fx,
      default_payment_terms_days: terms,
      company_name: normalize(input.company_name),
      company_address: normalize(input.company_address),
      company_tax_id: normalize(input.company_tax_id),
      company_email: normalize(input.company_email),
      company_phone: normalize(input.company_phone),
      bank_name: normalize(input.bank_name),
      bank_account_no: normalize(input.bank_account_no),
      bank_account_name: normalize(input.bank_account_name),
      bank_bin: normalize(input.bank_bin),
      bank_swift_code: normalize(input.bank_swift_code),
      updated_by: userId,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", 1)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath("/admin/finance")
  revalidatePath("/admin/finance/settings")
  return { ok: true }
}
