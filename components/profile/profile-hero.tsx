"use client"

import Image from "next/image"
import { Building2 } from "lucide-react"
import type { ClientProfileWithRelations } from "@/lib/supabase/types"

interface ProfileHeroProps {
  profile: ClientProfileWithRelations
}

export function ProfileHero({ profile }: ProfileHeroProps) {
  const displayName = profile.display_name || profile.profiles.company_name || "Company"
  const logoUrl = profile.logo_url
  const coverUrl = profile.cover_image_url

  return (
    <section className="relative w-full">
      {/* Cover Image */}
      <div className="relative w-full aspect-[3/1] min-h-[200px] max-h-[400px] bg-gradient-to-br from-primary/90 to-primary overflow-hidden">
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
        {/* Overlay gradient for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
      </div>

      {/* Logo and Company Name */}
      <div className="absolute bottom-0 left-0 right-0 translate-y-1/2">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end gap-4 sm:gap-6">
            {/* Logo */}
            <div className="relative shrink-0 w-24 h-24 sm:w-32 sm:h-32 rounded-xl border-4 border-background bg-background shadow-lg overflow-hidden">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt={`${displayName} logo`}
                  fill
                  className="object-contain p-2"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <Building2 className="w-10 h-10 sm:w-14 sm:h-14 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Company Info */}
            <div className="pb-2 sm:pb-4">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white drop-shadow-lg text-balance">
                {displayName}
              </h1>
              {profile.tagline && (
                <p className="mt-1 text-sm sm:text-base text-white/90 drop-shadow-md max-w-xl text-pretty">
                  {profile.tagline}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
