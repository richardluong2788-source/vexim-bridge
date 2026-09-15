/**
 * Staff login by username (super-admin-provisioned accounts).
 *
 * Internal staff accounts created after the username-login change do NOT
 * have a real email in Supabase Auth: the super admin creates them with a
 * username + password directly (no invite email, no self-set-password
 * step). Supabase Auth's email/password provider still needs an email
 * under the hood, so each staff identity gets a deterministic, synthetic
 * address on the reserved `staff.veximtrade.com` subdomain. That domain
 * deliberately has no mailbox — nobody ever sends mail to it and staff
 * password recovery goes through the super-admin "reset password" action
 * instead of the email reset flow.
 *
 * Clients (Vietnamese suppliers) keep using their real email + password,
 * so the login screen accepts BOTH identifiers: anything containing "@"
 * is treated as an email, everything else as a staff username.
 */

// Reserved, non-routable subdomain of the organisation's own domain.
// Must never change once accounts exist — it is the auth.users.email key
// for every username-based staff account.
export const STAFF_EMAIL_DOMAIN = "staff.veximtrade.com"

/**
 * Usernames are lowercase, 3–30 chars, must start and end with a letter
 * or number, middle chars may include dot / underscore / hyphen.
 * Keep this in sync with the CHECK constraint in migration 076.
 */
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$/

/** Minimum password length for staff accounts created by an admin. */
export const STAFF_PASSWORD_MIN_LENGTH = 8

/** Normalise user input the same way everywhere (create + login). */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase()
}

export function isValidUsername(raw: string): boolean {
  return USERNAME_PATTERN.test(normalizeUsername(raw))
}

/**
 * Build the deterministic synthetic auth email for a staff username.
 * Callers MUST pass an already-normalised username (or normalise first).
 */
export function staffAuthEmail(username: string): string {
  return `${normalizeUsername(username)}@${STAFF_EMAIL_DOMAIN}`
}

/**
 * Resolve whatever the user typed into the login identifier field to the
 * email Supabase Auth expects:
 *   - contains "@" → real email (client accounts + legacy staff invites)
 *   - otherwise    → synthetic staff email
 * Returns null when the identifier shape is invalid.
 */
export function resolveLoginIdentifier(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null
  if (value.includes("@")) {
    // Light-weight email shape check: local@domain.tld
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value.toLowerCase() : null
  }
  const username = normalizeUsername(value)
  return USERNAME_PATTERN.test(username) ? staffAuthEmail(username) : null
}
