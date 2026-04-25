/**
 * Email reference code helpers.
 *
 * Format: VEX-{CLIENT}-{SHORT_ID}
 *   - VEX        : fixed brand prefix
 *   - CLIENT     : 2-3 letter initials of client/company name (uppercase)
 *   - SHORT_ID   : first 6 hex chars of opportunity UUID (uppercase)
 *
 * Example: VEX-LA-A3F9C2  (client "Long An", opportunity 'a3f9c2...')
 *
 * Used in:
 *   - Outbound email Subject prefix:  "[VEX-LA-A3F9C2] ..."
 *   - Outbound email Reply-To header: "notifications+opp-A3F9C2@vexim.com"
 *   - Admin search box on /admin/pipeline
 */

const REF_REGEX = /\b(VEX-[A-Z]{1,4}-[A-F0-9]{6})\b/i

/**
 * Build a 2-3 letter initials code from a company / client name.
 * - "Công Ty Long An"  -> "LA"
 * - "Coffee Co"        -> "CC"
 * - "VinaExport JSC"   -> "VEJ"
 * - ""                 -> "XX"
 */
export function buildClientInitials(name: string | null | undefined): string {
  if (!name) return "XX"
  // Strip Vietnamese diacritics + non-letters, keep words
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z\s]/g, " ")
    .trim()

  if (!normalized) return "XX"

  const words = normalized
    .split(/\s+/)
    .filter((w) => w.length > 0)
    // Skip common Vietnamese company prefixes
    .filter((w) => !/^(cong|ty|tnhh|cp|jsc|co|ltd|company|corp|llc)$/i.test(w))

  const source = words.length > 0 ? words : normalized.split(/\s+/)

  const initials = source
    .slice(0, 3)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")

  return initials || "XX"
}

/**
 * Get the 6-char short id from an opportunity UUID.
 */
export function buildShortId(opportunityId: string): string {
  return opportunityId.replace(/-/g, "").slice(0, 6).toUpperCase()
}

/**
 * Build the full reference code: VEX-LA-A3F9C2
 */
export function buildRefCode(opportunityId: string, clientName?: string | null): string {
  const initials = buildClientInitials(clientName)
  const short = buildShortId(opportunityId)
  return `VEX-${initials}-${short}`
}

/**
 * Build the plus-addressed Reply-To address.
 *
 * If the from address is "notifications@vexim.com" and short is "A3F9C2",
 * returns "notifications+opp-A3F9C2@vexim.com".
 *
 * Returns null if the input email cannot be parsed.
 */
export function buildReplyToAddress(fromEmail: string, opportunityId: string): string | null {
  const match = fromEmail.match(/^([^@]+)@(.+)$/)
  if (!match) return null
  const [, local, domain] = match
  // Strip any existing +tag from the local part to avoid +foo+opp-XXX
  const baseLocal = local.split("+")[0]
  const short = buildShortId(opportunityId)
  return `${baseLocal}+opp-${short}@${domain}`
}

/**
 * Prepend the ref code to a subject if not already present.
 * Handles "Re:" / "Fwd:" prefixes correctly so reply chains stay clean.
 */
export function prependRefToSubject(subject: string, refCode: string): string {
  const trimmed = (subject || "").trim()
  if (trimmed.toUpperCase().includes(refCode.toUpperCase())) {
    return trimmed
  }
  // Detect leading Re:/Fwd: chain so we keep them in front
  const prefixMatch = trimmed.match(/^((?:re|fwd?|fw)\s*:\s*)+/i)
  if (prefixMatch) {
    const prefix = prefixMatch[0]
    const rest = trimmed.slice(prefix.length)
    return `${prefix}[${refCode}] ${rest}`.trim()
  }
  return `[${refCode}] ${trimmed}`.trim()
}

/**
 * Extract a ref code from any string (subject, body, etc).
 * Returns the canonical uppercase form, or null if not found.
 */
export function extractRefCode(text: string | null | undefined): string | null {
  if (!text) return null
  const m = text.match(REF_REGEX)
  return m ? m[1].toUpperCase() : null
}

/**
 * Extract the 6-char short id from a full ref code.
 * "VEX-LA-A3F9C2" -> "A3F9C2"
 */
export function extractShortIdFromRef(refCode: string): string | null {
  const m = refCode.match(/^VEX-[A-Z]{1,4}-([A-F0-9]{6})$/i)
  return m ? m[1].toUpperCase() : null
}
