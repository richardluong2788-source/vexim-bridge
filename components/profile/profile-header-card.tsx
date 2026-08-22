"use client"

import { useState } from "react"
import Image from "next/image"
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Factory,
  MapPin,
  Package,
  ShieldCheck,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { buildVerifiedCapabilityChecklist } from "@/lib/profile/capability-checklist"
import { ProfileMediaGallery } from "./profile-media-gallery"
import { ProfileQuoteButton } from "./profile-quote-button"
import type { PublicCapability } from "@/lib/assessment/actions"
import type { ClientProfileWithRelations } from "@/lib/supabase/types"

interface ProfileHeaderCardProps {
  profile: ClientProfileWithRelations
  capability: PublicCapability | null
}

const CHECKLIST_PREVIEW_COUNT = 5

/**
 * Card ho so cong ty (ten, badge Verified, meta, checklist nang luc, CTA)
 * chong len phia duoi anh cover, theo layout dang cac trang B2B marketplace.
 */
export function ProfileHeaderCard({ profile, capability }: ProfileHeaderCardProps) {
  const [showAllChecklist, setShowAllChecklist] = useState(false)

  const displayName = profile.display_name || profile.profiles.company_name || "Company"
  const logoUrl = profile.logo_url
  const isVerified = Boolean(profile.profiles.is_verified)
  const location = profile.profiles.country

  const yearsOnVexim = (() => {
    const startYear = capability?.export_since_year || new Date(profile.created_at).getFullYear()
    const years = new Date().getFullYear() - startYear
    return years > 0 ? years : null
  })()

  const companyScale = capability?.company_scale || null

  const mainProducts = (() => {
    const products = profile.products || []
    const categories = Array.from(
      new Set(products.map((p) => p.category).filter((c): c is string => Boolean(c)))
    )
    if (categories.length > 0) return categories.slice(0, 3)
    return products.slice(0, 3).map((p) => p.product_name)
  })()

  const checklist = buildVerifiedCapabilityChecklist(capability)
  const previewChecklist = checklist.slice(0, CHECKLIST_PREVIEW_COUNT)
  const hasMoreChecklist = checklist.length > CHECKLIST_PREVIEW_COUNT

  const hasMedia = Boolean(profile.video_url) || (profile.factory_image_urls?.length ?? 0) > 0

  return (
    <section className="relative z-10 -mt-10 sm:-mt-14">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-border bg-card shadow-md p-5 sm:p-6 lg:p-8">
          <div className={hasMedia ? "grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 lg:gap-8" : ""}>
            {/* Left: company info */}
            <div className="min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-start gap-5 sm:gap-6">
                {/* Logo */}
                <div className="relative shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg border border-border bg-background overflow-hidden">
                  {logoUrl ? (
                    <Image
                      src={logoUrl}
                      alt={`${displayName} logo`}
                      fill
                      className="object-contain p-1.5"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <Building2 className="w-7 h-7 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Name, badge, tagline, meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground text-balance">
                      {displayName}
                    </h1>
                    {isVerified && (
                      <Badge className="bg-accent text-accent-foreground border-0 gap-1 shrink-0">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Verified by Vexim
                      </Badge>
                    )}
                  </div>

                  {profile.tagline && (
                    <p className="mt-1 text-sm sm:text-base text-muted-foreground">
                      {profile.tagline}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                    {location && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="w-4 h-4" />
                        {location}
                      </span>
                    )}
                    {yearsOnVexim && (
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="w-4 h-4" />
                        {yearsOnVexim} {yearsOnVexim === 1 ? "year" : "years"} on Vexim
                      </span>
                    )}
                    {companyScale && (
                      <span className="inline-flex items-center gap-1.5">
                        <Factory className="w-4 h-4" />
                        {companyScale}
                      </span>
                    )}
                    {mainProducts.length > 0 && (
                      <span className="inline-flex items-center gap-1.5 min-w-0">
                        <Package className="w-4 h-4 shrink-0" />
                        <span className="truncate">{mainProducts.join(", ")}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* CTA */}
                <div className="w-full sm:w-auto shrink-0">
                  <ProfileQuoteButton profile={profile} size="lg" className="w-full sm:w-auto" />
                </div>
              </div>

              {/* Checklist */}
              {checklist.length > 0 && (
                <div className="mt-6 pt-6 border-t border-border">
                  <p className="text-sm font-semibold text-foreground mb-3">Verified Capabilities</p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                    {previewChecklist.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                        <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  {hasMoreChecklist && (
                    <button
                      type="button"
                      onClick={() => setShowAllChecklist(true)}
                      className="mt-3 text-sm font-medium text-accent hover:underline"
                    >
                      View all verified capabilities ({checklist.length})
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Right: factory video / photo gallery */}
            {hasMedia && (
              <div className="lg:pt-1">
                <ProfileMediaGallery profile={profile} isVerified={isVerified} />
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showAllChecklist} onOpenChange={setShowAllChecklist}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Verified Capabilities</DialogTitle>
          </DialogHeader>
          <ul className="space-y-2.5 mt-2">
            {checklist.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </section>
  )
}
