/**
 * Shared vocabulary for `public.marketing_leads.status` (migration 082).
 *
 * Lives in its own module on purpose: the values must match the DB CHECK
 * constraint, the admin page renders them as a picker, and the server actions
 * validate against them — but a file with "use server" may only export async
 * functions, so the constant cannot live next to the actions.
 */

export const MARKETING_LEAD_STATUSES = [
  "new",
  "in_review",
  "contacted",
  "converted",
  "junk",
  "archived",
] as const

export type MarketingLeadStatus = (typeof MARKETING_LEAD_STATUSES)[number]

export function isMarketingLeadStatus(value: unknown): value is MarketingLeadStatus {
  return typeof value === "string" && (MARKETING_LEAD_STATUSES as readonly string[]).includes(value)
}
