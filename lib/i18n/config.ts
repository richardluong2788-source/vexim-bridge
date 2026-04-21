export const LOCALES = ["en", "vi"] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = "en"

export const LOCALE_COOKIE = "esh_locale"

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  vi: "Tiếng Việt",
}

export const LOCALE_SHORT: Record<Locale, string> = {
  en: "EN",
  vi: "VI",
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value)
}
