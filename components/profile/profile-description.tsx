"use client"

import { ClientProfile } from "@/lib/supabase/types"
import { useLanguage } from "@/components/i18n/language-provider"
import { getDictionary } from "@/lib/i18n/get-dictionary"

interface ProfileDescriptionProps {
  profile: ClientProfile
}

export function ProfileDescription({ profile }: ProfileDescriptionProps) {
  const { locale } = useLanguage()
  const dict = getDictionary(locale as any)

  if (!profile.description) {
    return null
  }

  return (
    <section className="py-12 sm:py-16 lg:py-20 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <div className="prose prose-sm sm:prose max-w-none">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-6">
            {dict.admin.profile.public?.aboutUs || "About Us"}
          </h2>
          <div className="text-base sm:text-lg text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {profile.description}
          </div>
        </div>
      </div>
    </section>
  )
}
