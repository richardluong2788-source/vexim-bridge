import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Personal "work email" generation for internal staff (AE / admin / lead
 * researcher).
 *
 * Why: sending every buyer-facing email from the same shared address
 * (trade@veximtrade.com) with a different display name each time confuses
 * Gmail/Outlook's sender-trust heuristics — they eventually strip the
 * display name and show only the raw address, which is exactly the bug
 * this module fixes. Giving each person their own address (e.g.
 * "linh@veximtrade.com") lets mail providers learn a stable
 * address <-> person mapping.
 *
 * Sending and receiving both go through Resend — there is no Zoho mailbox
 * anywhere in this stack, and no per-address setup is needed either way:
 * - Outbound: the domain (veximtrade.com) is already verified on Resend, so
 *   any local-part works as a `from` address immediately.
 * - Inbound: Resend receiving is domain-wide, not per-address — once a
 *   domain's MX record points to Resend (already true here, per the
 *   "ready to send and receive emails" status in the Resend dashboard),
 *   EVERY address at that domain automatically receives mail and triggers
 *   the `email.received` webhook (app/api/webhooks/resend/route.ts).
 *   There is no "Inbound Route" to configure per address in Resend.
 * So a freshly generated address like linh@veximtrade.com works for both
 * sending and receiving the moment it's saved to profiles.work_email —
 * nothing else to set up in Resend.
 */

const DEFAULT_DOMAIN = "veximtrade.com"

function toAscii(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
}

function slugifyWord(word: string): string {
  return toAscii(word).replace(/[^a-z0-9]/g, "")
}

/**
 * Vietnamese naming convention: the LAST word is the given name (the name
 * people actually go by), e.g. "Nguyễn Thùy Linh" -> given name "Linh".
 * Falls back gracefully for non-Vietnamese / single-word names.
 */
function splitName(fullName: string): { given: string; rest: string[] } {
  const words = fullName.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return { given: "user", rest: [] }
  const given = slugifyWord(words[words.length - 1]) || "user"
  const rest = words
    .slice(0, -1)
    .map(slugifyWord)
    .filter((w) => w.length > 0)
  return { given, rest }
}

/**
 * Ordered list of candidate local-parts (without @domain), most preferred
 * first: bare given name, then given name + initials of the rest of the
 * name, then given name + first other word.
 */
export function buildWorkEmailLocalPartCandidates(fullName: string): string[] {
  const { given, rest } = splitName(fullName)
  const initials = rest.map((w) => w[0]).join("")

  const candidates: string[] = [given]
  if (initials) candidates.push(`${given}${initials}`)
  if (rest.length > 0) candidates.push(`${given}.${rest[0]}`)

  return Array.from(new Set(candidates.filter((c) => c.length > 0)))
}

export function buildWorkEmailCandidates(
  fullName: string,
  domain: string = DEFAULT_DOMAIN,
): string[] {
  return buildWorkEmailLocalPartCandidates(fullName).map((local) => `${local}@${domain}`)
}

/**
 * Pick the first available (not already assigned) work email for a person,
 * checking against every `work_email` currently on `profiles`. Falls back to
 * a numeric suffix on the primary candidate if all name-based options are
 * taken (e.g. two people named "Linh" -> linh@ then linh2@).
 */
export async function reserveWorkEmail(
  fullName: string,
  domain: string = DEFAULT_DOMAIN,
): Promise<string> {
  const admin = createAdminClient()
  const candidates = buildWorkEmailCandidates(fullName, domain)

  const { data: existing } = await admin
    .from("profiles")
    .select("work_email")
    .not("work_email", "is", null)

  const taken = new Set(
    (existing ?? [])
      .map((r) => (r as { work_email: string | null }).work_email?.toLowerCase())
      .filter((v): v is string => !!v),
  )

  for (const candidate of candidates) {
    if (!taken.has(candidate.toLowerCase())) return candidate
  }

  const base = candidates[0].split("@")[0]
  for (let i = 2; i < 100; i++) {
    const candidate = `${base}${i}@${domain}`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }

  // Astronomically unlikely fallback — guarantees uniqueness regardless.
  return `${base}${Date.now()}@${domain}`
}
