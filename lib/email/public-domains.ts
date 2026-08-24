/**
 * Free/public webmail domains (Gmail, Yahoo, Outlook, iCloud, etc.).
 *
 * Domain-based sender matching (see app/api/webhooks/resend/route.ts) must
 * NEVER match on one of these — many unrelated buyers across many different
 * leads all use @gmail.com, @yahoo.com, etc. Matching by domain there would
 * attach a reply from buyer A to buyer B's opportunity just because they
 * both happen to use Gmail. Domain matching is only safe for a buyer's own
 * company domain (e.g. @acme-imports.com).
 */
const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.co.in",
  "ymail.com",
  "outlook.com",
  "hotmail.com",
  "hotmail.co.uk",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "zoho.com",
  "mail.com",
  "gmx.com",
  "gmx.de",
  "yandex.com",
  "yandex.ru",
  "qq.com",
  "163.com",
  "126.com",
  "sina.com",
  "naver.com",
  "rediffmail.com",
  "rocketmail.com",
])

/** Extracts the domain portion (lowercased) of an email address, or null. */
export function getEmailDomain(email: string): string | null {
  const at = email.lastIndexOf("@")
  if (at === -1) return null
  return email.slice(at + 1).toLowerCase() || null
}

/**
 * True when `domain` is a free/public webmail provider that must never be
 * used as a matching signal on its own.
 */
export function isPublicEmailDomain(domain: string): boolean {
  return PUBLIC_EMAIL_DOMAINS.has(domain.toLowerCase())
}
