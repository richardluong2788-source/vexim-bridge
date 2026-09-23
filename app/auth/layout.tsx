import { LanguageProvider } from "@/components/i18n/language-provider"
import { getLocale } from "@/lib/i18n/server"

/**
 * Auth pages are the one part of the unauthenticated surface that must be
 * rendered per request, so they opt back in to a request-scoped locale.
 *
 * The root layout is deliberately static (that is what lets `/products/[id]`
 * and `/profile/[slug]` be cached by the CDN), which means it can no longer tell
 * `<LanguageProvider>` which language to render with — a client component cannot
 * read the locale cookie during prerendering. Every sign-in page shows localized
 * labels through `useTranslation()`, so a static document would flash English
 * at a Vietnamese supplier right where we ask them to log in. Marking the
 * subtree dynamic and handing it the cookie locale restores exactly what the
 * root layout used to provide, at no cost: a login form is not a page worth
 * caching.
 */
export const dynamic = "force-dynamic"

export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()

  return <LanguageProvider initialLocale={locale}>{children}</LanguageProvider>
}
