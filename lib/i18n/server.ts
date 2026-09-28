import { cookies, headers } from "next/headers"
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config"
import { LOCALE_HEADER } from "./routing"
import { getDictionarySync } from "./dictionaries"

/**
 * Read the active locale on the server.
 *
 * Resolution order:
 *  1. `x-vx-locale`, the header the middleware stamps from the URL prefix
 *     (`/vi/products`) or, for unprefixed paths, from the locale cookie. The URL
 *     wins so a shared `/vi/...` link renders Vietnamese for a reader whose own
 *     cookie says English — that is the whole point of having locale URLs.
 *  2. The `esh_locale` cookie, for calls that never went through the middleware
 *     (route handlers invoked directly, unit harnesses, background jobs).
 *  3. `DEFAULT_LOCALE`.
 */
export async function getLocale(): Promise<Locale> {
  try {
    const headerValue = (await headers()).get(LOCALE_HEADER)
    if (isLocale(headerValue)) return headerValue
  } catch {
    // Outside a request (build-time prerender, a script invoking a page helper)
    // there is no header store. Falling through to the cookie is what keeps
    // `getLocale()` total — an i18n lookup must never be the reason a render
    // fails.
  }

  const store = await cookies()
  const value = store.get(LOCALE_COOKIE)?.value
  return isLocale(value) ? value : DEFAULT_LOCALE
}

/**
 * Get the active dictionary on the server.
 */
export async function getDictionary() {
  const locale = await getLocale()
  return { locale, t: getDictionarySync(locale) }
}
