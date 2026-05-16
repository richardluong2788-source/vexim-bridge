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
    <section className="relative w-full bg-white">
      {/* Cover Image with reduced height */}
      <div className="relative w-full aspect-video min-h-[150px] max-h-[300px] bg-gradient-to-br from-primary/90 to-primary overflow-hidden">
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
        {/* Light overlay for background only, not for text */}
        <div className="absolute inset-0 bg-black/10" />
      </div>

      {/* Logo and Company Name - Facebook Style */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 -mt-16 sm:-mt-20">
          {/* Logo */}
          <div className="relative shrink-0 w-24 h-24 sm:w-32 sm:h-32 rounded-lg border-4 border-background bg-background shadow-lg overflow-hidden">
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

          {/* Company Info - Right aligned */}
          <div className="flex-1 flex flex-col justify-end sm:pt-6">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black">
              {displayName}
            </h1>
            {profile.tagline && (
              <p className="mt-1 text-sm sm:text-base text-gray-600 max-w-xl">
                {profile.tagline}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
