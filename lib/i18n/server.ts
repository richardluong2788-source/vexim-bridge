import { cookies } from "next/headers"
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config"
import { getDictionarySync } from "./dictionaries"

/**
 * Read the current locale from cookies in server components / route handlers.
 */
export async function getLocale(): Promise<Locale> {
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
