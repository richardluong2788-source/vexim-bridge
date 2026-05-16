"use client"

import type { ClientProfileWithRelations } from "@/lib/supabase/types"

interface ProfileAboutProps {
  profile: ClientProfileWithRelations
}

export function ProfileAbout({ profile }: ProfileAboutProps) {
  // Only show if description exists
  if (!profile.description) {
    return null
  }

  const displayName = profile.display_name || profile.profiles.company_name || "Company"

  return (
    <section className="py-12 sm:py-16 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-8">
            About {displayName}
          </h2>
          
          <div className="bg-card border border-border rounded-xl p-6 sm:p-8 shadow-sm">
            <div className="prose prose-gray dark:prose-invert max-w-none">
              {profile.description.split('\n').map((paragraph, index) => (
                <p 
                  key={index} 
                  className="text-muted-foreground leading-relaxed mb-4 last:mb-0"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
