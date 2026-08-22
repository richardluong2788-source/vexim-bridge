"use client"

import Image from "next/image"
import type { ClientProfileWithRelations } from "@/lib/supabase/types"

interface ProfileHeroProps {
  profile: ClientProfileWithRelations
}

/**
 * Chi la anh cover phia tren. Ten cong ty, logo, badge va CTA duoc
 * hien thi trong ProfileHeaderCard (de tao layout dang "profile card"
 * chong len phan cover, giong cac trang B2B marketplace).
 */
export function ProfileHero({ profile }: ProfileHeroProps) {
  const coverUrl = profile.cover_image_url
  const displayName = profile.display_name || profile.profiles.company_name || "Company"

  return (
    <section className="relative w-full bg-white">
      <div className="relative w-full h-32 sm:h-44 lg:h-56 overflow-hidden">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={`${displayName} cover`}
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
