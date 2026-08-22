import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getProfileBySlug } from "@/lib/profile/actions"
import { getPublicCapabilityByClientId } from "@/lib/assessment/actions"
import { ProfileHero } from "@/components/profile/profile-hero"
import { ProfileHeaderCard } from "@/components/profile/profile-header-card"
import { ProfileTabs } from "@/components/profile/profile-tabs"
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

  // Lay phan nang luc AN TOAN de hien thi cong khai (khong diem so/nhan su/cam ket)
  const capResult = await getPublicCapabilityByClientId(profile.client_id)
  const capability = capResult.success ? capResult.data ?? null : null

  return (
    <main className="min-h-screen bg-background">
      {/* Block 1: Cover image */}
      <ProfileHero profile={profile} />

      {/* Block 2: Header card — logo, name, verified badge, meta, checklist, CTA, factory media */}
      <ProfileHeaderCard profile={profile} capability={capability} />

      {/* Block 3: Tabs — "Ho So cong ty" (overview/production/quality/trade) + "San pham" */}
      <ProfileTabs profile={profile} capability={capability} />

      {/* Block 5: CTA */}
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
