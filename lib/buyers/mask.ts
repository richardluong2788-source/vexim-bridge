/**
 * PII masking helpers for the Buyer directory.
 *
 * Background:
 * - `lead_researcher` is granted `BUYER_VIEW` but NOT `BUYER_PII_VIEW`
 *   (see lib/auth/permissions.ts). Researchers can find and edit buyers
 *   but must never see raw email/phone — they work from aggregate signals.
 * - All other admin-shell roles (super_admin, admin, account_executive,
 *   finance, staff) have PII view.
 *
 * These helpers are shared between server components (list/detail) and
 * client components (forms) so the masking is consistent across screens.
 */

export function maskEmail(email: string | null | undefined): string {
  if (!email) return "—"
  const trimmed = email.trim()
  const at = trimmed.indexOf("@")
  if (at <= 0) return "•••"
  const local = trimmed.slice(0, at)
  const domain = trimmed.slice(at + 1)
  const head = local.slice(0, Math.min(2, local.length))
  return `${head}${"•".repeat(Math.max(3, local.length - head.length))}@${domain}`
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "—"
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 4) return "•••"
  const last = digits.slice(-3)
  return `••• ${last}`
}
