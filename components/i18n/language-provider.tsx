"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale, isLocale } from "@/lib/i18n/config"
import { getDictionarySync, type Dictionary } from "@/lib/i18n/dictionaries"

type LanguageContextValue = {
  locale: Locale
  t: Dictionary
  setLocale: (next: Locale) => void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale
  children: React.ReactNode
}) {
  const [locale, setLocaleState] = useState<Locale>(
    isLocale(initialLocale) ? initialLocale : DEFAULT_LOCALE,
  )

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    // Persist to cookie so server components pick it up on next navigation.
    // 1 year; Path=/ so every route reads it.
    if (typeof document !== "undefined") {
      document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`
      document.documentElement.lang = next
    }
  }, [])

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      t: getDictionarySync(locale),
      setLocale,
    }),
    [locale, setLocale],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useTranslation() {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    throw new Error("useTranslation must be used inside <LanguageProvider>")
  }
  return ctx
}
