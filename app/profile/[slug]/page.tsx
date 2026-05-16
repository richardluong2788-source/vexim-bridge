import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getProfileBySlug } from "@/lib/profile/actions"
import { ProfileHero } from "@/components/profile/profile-hero"
import { ProfileDescription } from "@/components/profile/profile-description"
import { ProfileVideo } from "@/components/profile/profile-video"
import { ProfileUSP } from "@/components/profile/profile-usp"
import { ProfileCertifications } from "@/components/profile/profile-certifications"
import { ProfileProducts } from "@/components/profile/profile-products"
import { ProfileStats } from "@/components/profile/profile-stats"
import { ProfileCTA } from "@/components/profile/profile-cta"

interface ProfilePageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: ProfilePageProps): Promise<Metadata> {
  const { slug } = await params
  const result = await getProfileBySlug(slug)

  if (!result.success || !result.data) {
    return {
      title: "Profile Not Found",
    }
  }

  const profile = result.data
  const displayName =
    profile.display_name || profile.profiles.company_name || "Company"

  return {
    title: `${displayName} | Supplier Profile`,
    description:
      profile.tagline ||
      `Learn more about ${displayName} - a trusted supplier for US buyers.`,
    openGraph: {
      title: displayName,
      description:
        profile.tagline ||
        `Learn more about ${displayName} - a trusted supplier for US buyers.`,
      images: profile.cover_image_url ? [profile.cover_image_url] : [],
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title: displayName,
      description:
        profile.tagline ||
        `Learn more about ${displayName} - a trusted supplier for US buyers.`,
      images: profile.cover_image_url ? [profile.cover_image_url] : [],
    },
  }
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { slug } = await params
  const result = await getProfileBySlug(slug)

  if (!result.success || !result.data) {
    notFound()
  }

  const profile = result.data

  return (
    <main className="min-h-screen bg-background">
      {/* Block 1: Hero (Cover + Logo + Name) */}
      <ProfileHero profile={profile} />

      {/* Spacer for logo overlap */}
      <div className="h-16 sm:h-20" />

      {/* Block 2: Description */}
      <ProfileDescription profile={profile} />

      {/* Block 3: Video */}
      <ProfileVideo profile={profile} />

      {/* Block 4: USP Points */}
      <ProfileUSP profile={profile} />

      {/* Block 5: Certifications Gallery */}
      <ProfileCertifications profile={profile} />

      {/* Block 6: Products Showcase */}
      <ProfileProducts profile={profile} />

      {/* Block 7: Production Stats */}
      <ProfileStats profile={profile} />

      {/* Block 8: CTA */}
      <ProfileCTA profile={profile} />

      {/* Footer */}
      <footer className="py-8 bg-muted/30 border-t border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-muted-foreground">
            Powered by{" "}
            <a
              href="https://veximtrade.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent hover:underline"
            >
              Vexim Trade
            </a>
          </p>
        </div>
      </footer>
    </main>
  )
}
