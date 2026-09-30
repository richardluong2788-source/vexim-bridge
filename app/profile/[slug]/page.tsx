import type { Metadata } from "next"
import { cache } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { LanguageSwitcher } from "@/components/i18n/language-switcher"
import { ProfileCTA } from "@/components/profile/profile-cta"
import { ProfileHeaderCard } from "@/components/profile/profile-header-card"
import { ProfileHero } from "@/components/profile/profile-hero"
import { ProfileTabs } from "@/components/profile/profile-tabs"
import { getLocale } from "@/lib/i18n/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getProfileBySlug } from "@/lib/profile/actions"
import { getProfileCopy } from "@/lib/profile/translations"
import { localizedAlternates, INDEXABLE } from "@/lib/seo/alternates"
import { getPublicCapabilityByClientId } from "@/lib/assessment/actions"

interface ProfilePageProps {
  params: Promise<{ slug: string }>
}

// generateMetadata and the page body need the same published profile; share the
// read within a render so its non-blocking view-count update runs only once.
const loadProfileForRequest = cache((slug: string) => getProfileBySlug(slug))

// Locale is request-scoped, so the rendered English and Vietnamese variants
// must not share one cached HTML response. Keep the segment's data freshness
// window aligned with the public catalog.
export const revalidate = 300

/** Bound the list of published profile slugs queried during route generation. */
const PROFILE_PARAM_LIMIT = 200

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("client_profiles")
      .select("slug")
      .eq("is_published", true)
      .order("updated_at", { ascending: false })
      .limit(PROFILE_PARAM_LIMIT)
    if (error || !data) return []
    return (data as Array<{ slug: string | null }>)
      .map((row) => row.slug)
      .filter((slug): slug is string => Boolean(slug))
      .map((slug) => ({ slug }))
  } catch (cause) {
    // A build with no database access should not fail because profile slugs
    // cannot be collected for prerendering.
    console.error("[profile] prerender list unavailable:", cause)
    return []
  }
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, getLocale()])
  const copy = getProfileCopy(locale)
  const result = await loadProfileForRequest(slug)

  if (!result.success || !result.data) {
    return { title: copy.metadata.notFound }
  }

  const profile = result.data
  const displayName = profile.display_name || profile.profiles.company_name || copy.common.companyFallback
  const description = profile.tagline || copy.metadata.description(displayName)

  return {
    title: `${displayName} | ${copy.metadata.titleSuffix}`,
    description,
    alternates: localizedAlternates(`/profile/${slug}`, { bilingual: true, locale }),
    robots: INDEXABLE,
    openGraph: {
      title: displayName,
      description,
      locale: locale === "vi" ? "vi_VN" : "en_US",
      images: profile.cover_image_url ? [profile.cover_image_url] : [],
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title: displayName,
      description,
      images: profile.cover_image_url ? [profile.cover_image_url] : [],
    },
  }
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const [{ slug }, locale] = await Promise.all([params, getLocale()])
  const copy = getProfileCopy(locale)
  const result = await loadProfileForRequest(slug)

  if (!result.success || !result.data) notFound()

  const profile = result.data
  const capResult = await getPublicCapabilityByClientId(profile.client_id)
  const capability = capResult.success ? capResult.data ?? null : null

  return (
    <main lang={locale} className="min-h-screen bg-background">
      <ProfileHero profile={profile} locale={locale} />
      <ProfileHeaderCard profile={profile} capability={capability} locale={locale} />
      <ProfileTabs profile={profile} capability={capability} locale={locale} />
      <ProfileCTA profile={profile} locale={locale} />

      <footer className="py-8 bg-muted/30 border-t border-border">
        <div className="container mx-auto flex flex-col items-center justify-center gap-4 px-4 text-center sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          <p className="text-sm text-muted-foreground">
            {copy.footer.poweredBy}{" "}
            <Link
              href="https://veximtrade.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent hover:underline"
            >
              Vexim Trade
            </Link>
          </p>
          <LanguageSwitcher compact />
        </div>
      </footer>
    </main>
  )
}
