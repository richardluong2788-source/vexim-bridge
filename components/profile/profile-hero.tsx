"use client"

import { SmartImage } from "@/components/ui/smart-image"
import type { Locale } from "@/lib/i18n/config"
import { getProfileCopy } from "@/lib/profile/translations"
import type { ClientProfileWithRelations } from "@/lib/supabase/types"

interface ProfileHeroProps {
  profile: ClientProfileWithRelations
  locale: Locale
}

/**
 * Chi la anh cover phia tren. Ten cong ty, logo, badge va CTA duoc
 * hien thi trong ProfileHeaderCard (de tao layout dang "profile card"
 * chong len phan cover, giong cac trang B2B marketplace).
 */
export function ProfileHero({ profile, locale }: ProfileHeroProps) {
  const copy = getProfileCopy(locale)
  const coverUrl = profile.cover_image_url
  const displayName = profile.display_name || profile.profiles.company_name || copy.common.companyFallback

  return (
    <section className="relative w-full bg-white">
      <div className="relative w-full h-32 sm:h-44 lg:h-56 overflow-hidden">
        {coverUrl ? (
          <SmartImage
            src={coverUrl}
            alt={`${displayName} ${copy.common.coverImage}`}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/95 to-accent/30" />
        )}
        <div className="absolute inset-0 bg-black/10" />
      </div>
    </section>
  )
}
