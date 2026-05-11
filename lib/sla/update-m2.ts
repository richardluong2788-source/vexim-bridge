'use server'

import { updateM2Target } from '@/app/admin/sla/actions'

/**
 * Quick helper to update M2 (monthly_qualified_leads) target to 2
 * Run this from /admin/sla/targets page or call via API
 */
export async function quickUpdateM2() {
  const result = await updateM2Target(2)
  return result
}
