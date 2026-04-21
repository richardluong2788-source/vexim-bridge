import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import type {
  BankSnapshot,
  FinanceSettings,
  IssuerSnapshot,
} from "@/lib/supabase/types"

/**
 * Load the singleton `finance_settings` row. Tolerates the (rare) case
 * where migration 016 hasn't been applied yet — callers get null back
 * and can render a "not configured" UI instead of crashing.
 */
export async function loadFinanceSettings(): Promise<FinanceSettings | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("finance_settings" as never)
    .select("*")
    .eq("id", 1)
    .maybeSingle()

  if (error) {
    console.error("[v0] loadFinanceSettings failed", error)
    return null
  }
  return (data as unknown as FinanceSettings) ?? null
}

export function getIssuerSnapshot(s: FinanceSettings | null): IssuerSnapshot {
  return {
    company_name: s?.company_name ?? null,
    company_address: s?.company_address ?? null,
    company_tax_id: s?.company_tax_id ?? null,
    company_email: s?.company_email ?? null,
    company_phone: s?.company_phone ?? null,
  }
}

export function getBankSnapshot(s: FinanceSettings | null): BankSnapshot {
  return {
    bank_name: s?.bank_name ?? null,
    bank_account_no: s?.bank_account_no ?? null,
    bank_account_name: s?.bank_account_name ?? null,
    bank_bin: s?.bank_bin ?? null,
    bank_swift_code: s?.bank_swift_code ?? null,
  }
}
