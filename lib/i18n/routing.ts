import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, isLocale, type Locale } from "./config"

/**
 * Locale routing helpers shared by middleware (Edge runtime), server components
 * and the language switcher.
 *
 * Prefixes are "as-needed", the same rule Next's built-in i18n routing uses for
 * `localePrefix: "as-needed"`: the default locale (`en`) lives at the
 * UNPREFIXED path, and every other locale gets `/<locale>` (`/vi/products`).
 *
 * That choice is deliberate and it is what keeps this whole change additive:
 *   - no existing link, email template or QR code has to move — `/products`,
 *     `/profile/<slug>`, `/share/<token>` all keep working untouched;
 *   - the Vietnamese flow keeps its own crawlable URL space (`/vi/...`) instead
 *     of living behind a cookie that crawlers never see;
 *   - nothing duplicates: `/en/products` is normalized back to `/products` by
 *     the middleware, so exactly one URL serves each language.
 *
 * Flipping to always-prefixed URLs later is a one-line change here
 * (`LOCALE_PREFIXES[DEFAULT_LOCALE] = "/en"`) plus a redirect for the old root.
 */

/** Header middleware uses to hand the resolved locale to the render pass. */
export const LOCALE_HEADER = "x-vx-locale"

export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export const LOCALE_PREFIXES = Object.fromEntries(
  LOCALES.map((locale) => [locale, locale === DEFAULT_LOCALE ? "" : `/${locale}`]),
) as Record<Locale, string>

/** Every prefix that is a locale, e.g. ["/en", "/vi"]. */
const KNOWN_PREFIXES = LOCALES.map((locale) => `/${locale}`)

/**
 * Paths that are reachable without a session. The middleware skips its
 * `getUser()` round-trip for these (a ~100-200ms auth hop per page view) and
 * renders the public view even for a signed-in visitor.
 *
 * `/auth` is NOT here on purpose: `updateSession` still bounces a logged-in
 * user away from the sign-in page.
 *
 * Keep this list in sync with the `PUBLIC_PATHS` note in the middleware and
 * with `app/robots.ts` (which mirrors the inverse: the private prefixes).
 */
const PUBLIC_SEGMENTS = [
  "products",
  "product", // legacy alias, redirects to /products
  "profile",
  "share",
  "shortlist",
  "legal",
  "client-intake",
  "unsubscribe",
  "invoice",
]

/**
 * Token-addressed public paths: reachable without a session, but the URL itself
 * is the only thing keeping them private. `app/robots.ts` disallows them and the
 * pages emit <meta robots noindex> — both lists come from here so they cannot
 * drift apart.
 */
export const NOINDEX_SEGMENTS = ["share", "shortlist", "unsubscribe", "invoice"]

/** Session-only surfaces; also excluded from crawling, and from the middleware's public fast path. */
export const PRIVATE_SEGMENTS = ["admin", "client", "settings", "notifications", "api", "auth"]

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true
  const [head = ""] = pathname.replace(/^\//, "").split("/")
  return PUBLIC_SEGMENTS.includes(head)
}

export function isNoIndexPath(pathname: string): boolean {
  const [head = ""] = pathname.replace(/^\//, "").split("/")
  return NOINDEX_SEGMENTS.includes(head)
}

/**
 * Split a locale prefix off a pathname.
 *
 * `/vi/products/9`   -> { locale: "vi", pathname: "/products/9" }
 * `/en`              -> { locale: "en", pathname: "/" }
 * `/products`        -> { locale: null, pathname: "/products" }
 * `/vi/admin/users`  -> { locale: "vi", pathname: "/admin/users" } (caller decides)
 */
export function splitLocalePrefix(pathname: string): { locale: Locale | null; pathname: string } {
  for (const prefix of KNOWN_PREFIXES) {
    if (pathname === prefix) return { locale: prefix.slice(1) as Locale, pathname: "/" }
    if (pathname.startsWith(`${prefix}/`)) {
      const locale = prefix.slice(1)
      return {
        locale: isLocale(locale) ? locale : null,
        pathname: pathname.slice(prefix.length) || "/",
      }
    }
  }
  return { locale: null, pathname }
}

/** Add the locale prefix, honouring the as-needed rule. */
export function localizePath(pathname: string, locale: Locale): string {
  const prefix = LOCALE_PREFIXES[locale]
  if (!prefix) return pathname || "/"
  const rest = pathname.startsWith("/") ? pathname : `/${pathname}`
  return `${prefix}${rest === "/" ? "" : rest}` || prefix
}

export { DEFAULT_LOCALE, LOCALE_COOKIE }
