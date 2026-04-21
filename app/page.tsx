import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { landingPathForRole, normaliseRole } from "@/lib/auth/permissions"
import { siteConfig } from "@/lib/site-config"
import { LandingHeader } from "@/components/landing/landing-header"
import { LandingHero } from "@/components/landing/landing-hero"
import { LandingTrustBar } from "@/components/landing/landing-trust-bar"
import { LandingProblem } from "@/components/landing/landing-problem"
import { LandingFeatures } from "@/components/landing/landing-features"
import { LandingHowItWorks } from "@/components/landing/landing-how-it-works"
import { LandingSecurity } from "@/components/landing/landing-security"
import { LandingAudiences } from "@/components/landing/landing-audiences"
import { LandingFaq } from "@/components/landing/landing-faq"
import { LandingCta } from "@/components/landing/landing-cta"
import { LandingFooter } from "@/components/landing/landing-footer"
import { LandingJsonLd } from "@/components/landing/landing-json-ld"

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [...siteConfig.keywords],
  applicationName: siteConfig.name,
  authors: [{ name: siteConfig.legalName }],
  creator: siteConfig.legalName,
  publisher: siteConfig.legalName,
  category: "business",
  alternates: {
    canonical: "/",
    languages: {
      "vi-VN": "/",
      "en-US": "/",
    },
  },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    alternateLocale: ["en_US"],
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1600,
        height: 1000,
        alt: `${siteConfig.name} dashboard preview`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
}

export default async function RootPage() {
  // Landing is public for guests and search engines. Logged-in users
  // skip straight to their portal — standard SaaS flow.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
    redirect(landingPathForRole(normaliseRole(profile?.role)))
  }

  return (
    <>
      <LandingJsonLd />
      <div className="flex min-h-screen flex-col bg-background">
        <LandingHeader isAuthed={false} dashboardHref="/auth/login" />
        <main id="main" className="flex-1">
          <LandingHero isAuthed={false} dashboardHref="/auth/login" />
          <LandingTrustBar />
          <LandingProblem />
          <LandingFeatures />
          <LandingHowItWorks />
          <LandingSecurity />
          <LandingAudiences />
          <LandingFaq />
          <LandingCta isAuthed={false} dashboardHref="/auth/login" />
        </main>
        <LandingFooter />
      </div>
    </>
  )
}
