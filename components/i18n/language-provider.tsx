"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE, type Locale, isLocale } from "@/lib/i18n/config"
import { getDictionarySync, type Dictionary } from "@/lib/i18n/dictionaries"

/**
 * The locale the server most likely rendered this document with.
 *
 * The root layout has to stay free of per-request APIs (cookies/headers) or no
 * public page can be prerendered, so it can no longer hand the provider a
 * locale. Reading it here in the same order the server does keeps hydration in
 * agreement: a `/vi/...` URL is Vietnamese by construction (the middleware also
 * mirrors that choice into the cookie), otherwise the cookie decides.
 *
 * Layouts that are dynamic anyway and render localized client components pass
 * `initialLocale` explicitly (see app/auth/layout.tsx); a server-rendered value
 * always wins over this fallback so nothing has to be corrected after mount.
 */
function readLocaleOnClient(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE

  const firstSegment = window.location.pathname.split("/")[1]?.toLowerCase()
  const fromPath = LOCALES.find((locale) => locale === firstSegment)
  if (fromPath) return fromPath

  const cookie = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${LOCALE_COOKIE}=`))
    ?.slice(LOCALE_COOKIE.length + 1)
  return isLocale(cookie) ? cookie : DEFAULT_LOCALE
}

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
  /** Pass it only when the locale is known per request (a dynamic route). */
  initialLocale?: Locale
  children: React.ReactNode
}) {
  const [locale, setLocaleState] = useState<Locale>(() =>
    isLocale(initialLocale) ? initialLocale : readLocaleOnClient(),
  )

  // <html lang> is a static attribute in the shell (that is what lets the
  // public pages be cached), so align it with the locale the provider settled
  // on before anything reads it for accessibility or translation hints.
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

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
