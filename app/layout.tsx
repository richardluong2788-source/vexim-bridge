import type { Metadata } from "next"
import { Inter, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { LanguageProvider } from "@/components/i18n/language-provider"
import { DEFAULT_LOCALE } from "@/lib/i18n/config"
import { getDictionarySync } from "@/lib/i18n/dictionaries"
import { siteConfig } from "@/lib/site-config"
import { Toaster } from "sonner"

const _inter = Inter({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

const appCopy = getDictionarySync(DEFAULT_LOCALE)

/**
 * The document shell is static on purpose: it reads no cookies and no headers.
 *
 * That one rule is what makes CDN caching legal for the whole app. An
 * `await getLocale()` here (or a per-request `generateMetadata`) opted *every*
 * route out of static generation, including `/products/[id]` and
 * `/profile/[slug]` - the pages US buyers land on from shared links and from
 * search results, at 8-10 ms per hit even when nothing about them changes.
 *
 * Routes that genuinely need a request-scoped locale (the landing page, the
 * catalog index, the whole signed-in app) resolve it themselves via
 * `getDictionary()`/`getLocale()` and stay dynamic by choice. `<html lang>` is
 * therefore the default locale in the cached shell; LanguageProvider corrects it
 * on mount for a Vietnamese session, and the localized public routes pass their
 * locale to `<main lang>` so the language Google sees in the HTML is right.
 */
export const metadata: Metadata = {
  // Canonical origin for every relative URL in metadata (og:image, canonical,
  // sitemap refs). Set from NEXT_PUBLIC_SITE_URL so a preview deployment never
  // publishes localhost as a canonical URL.
  metadataBase: new URL(siteConfig.url),
  title: appCopy.app.name,
  description: appCopy.app.tagline,
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang={DEFAULT_LOCALE} className="bg-background">
      <body className="font-sans antialiased">
        <LanguageProvider>{children}</LanguageProvider>
        <Toaster position="top-right" richColors />
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
