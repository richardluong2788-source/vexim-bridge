import type { Metadata } from "next"
import { Inter, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { LanguageProvider } from "@/components/i18n/language-provider"
import { getLocale } from "@/lib/i18n/server"
import { getDictionarySync } from "@/lib/i18n/dictionaries"
import { Toaster } from "sonner"

const _inter = Inter({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const t = getDictionarySync(locale)
  return {
    title: t.app.name,
    description: t.app.tagline,
    generator: "v0.app",
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()

  return (
    <html lang={locale} className="bg-background">
      <body className="font-sans antialiased">
        <LanguageProvider initialLocale={locale}>{children}</LanguageProvider>
        <Toaster position="top-right" richColors />
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
