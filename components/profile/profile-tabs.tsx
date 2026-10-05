"use client"

import type { ReactNode } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProfileProducts } from "./profile-products"
import { ProfileCertifications } from "./profile-certifications"
import type { Locale } from "@/lib/i18n/config"
import { getProfileCopy } from "@/lib/profile/translations"
import type { PublicCapability } from "@/lib/assessment/actions"
import type { ClientProfileWithRelations } from "@/lib/supabase/types"

interface ProfileTabsProps {
  profile: ClientProfileWithRelations
  capability: PublicCapability | null
  locale: Locale
}

function InfoGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-foreground mb-3">{title}</h3>
      <div className="rounded-lg border border-border bg-card divide-y divide-border/60 px-4 sm:px-5">
        {children}
      </div>
    </div>
  )
}

function InfoRow({
  label,
  value,
  notSpecified,
}: {
  label: string
  value?: ReactNode
  notSpecified: string
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 py-3">
      <span className="text-sm text-muted-foreground sm:w-56 shrink-0">{label}</span>
      <span className="text-sm font-medium text-foreground">
        {value !== undefined && value !== null && value !== "" ? (
          value
        ) : (
          <span className="font-normal text-muted-foreground">{notSpecified}</span>
        )}
      </span>
    </div>
  )
}

function ChipsRow({
  label,
  items,
  notSpecified,
}: {
  label: string
  items: string[]
  notSpecified: string
}) {
  return (
    <div className="py-3">
      <p className="text-sm text-muted-foreground mb-2">{label}</p>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item}
              className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border"
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-sm font-medium text-muted-foreground">{notSpecified}</span>
      )}
    </div>
  )
}

/**
 * Company details and featured products. Each field remains visible even when
 * its value is missing or false, so buyers see the full picture rather than
 * a partial list of only positive signals.
 */
export function ProfileTabs({ profile, capability, locale }: ProfileTabsProps) {
  const copy = getProfileCopy(locale)
  const notSpecified = copy.common.notSpecified

  const quality = (capability?.quality_systems ?? [])
    .map((value) => copy.capabilityLabels.qualitySystems[value])
    .filter((label): label is string => Boolean(label))

  const traceability = (capability?.traceability ?? [])
    .filter((value) => value !== "none")
    .map((value) => copy.capabilityLabels.traceability[value])
    .filter((label): label is string => Boolean(label))

  const audit = (capability?.audit_readiness ?? [])
    .filter((value) => value !== "not-ready")
    .map((value) => copy.capabilityLabels.auditReadiness[value])
    .filter((label): label is string => Boolean(label))

  const markets = (capability?.export_markets ?? [])
    .map((value) => copy.capabilityLabels.markets[value] ?? value)
    .filter((value) => value !== "other")

  const incoterms = capability?.incoterms ?? []
  const oem = (capability?.oem_odm ?? [])
    .filter((value) => value !== "none")
    .map((value) => copy.capabilityLabels.oemOdm[value] ?? value)

  const certifications = profile.certifications || []
  const uspPoints = profile.usp_points || []

  const exportExperience = (() => {
    const startYear = capability?.export_since_year || new Date(profile.created_at).getFullYear()
    const years = new Date().getFullYear() - startYear
    return years > 0 ? copy.common.yearCount(years) : undefined
  })()

  return (
    <section className="py-8 sm:py-12 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <Tabs defaultValue="company" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="company">{copy.tabs.companyProfile}</TabsTrigger>
            <TabsTrigger value="products">{copy.tabs.products}</TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="space-y-8">
            <InfoGroup title={copy.tabs.overview}>
              {profile.description && (
                <div className="py-3">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                    {profile.description}
                  </p>
                </div>
              )}
              <InfoRow
                label={copy.tabs.location}
                value={profile.profiles.country ?? undefined}
                notSpecified={notSpecified}
              />
              <InfoRow
                label={copy.tabs.exportingSince}
                value={capability?.export_since_year ?? undefined}
                notSpecified={notSpecified}
              />
              <InfoRow
                label={copy.tabs.exportExperience}
                value={exportExperience}
                notSpecified={notSpecified}
              />
              <InfoRow
                label={copy.tabs.companyScale}
                value={capability?.company_scale ?? undefined}
                notSpecified={notSpecified}
              />
              <ChipsRow
                label={copy.tabs.highlights}
                items={uspPoints.map((point) => point.title).filter(Boolean)}
                notSpecified={notSpecified}
              />
            </InfoGroup>

            <InfoGroup title={copy.tabs.productionCapacity}>
              <InfoRow
                label={copy.tabs.productionCapacity}
                value={profile.production_capacity ?? undefined}
                notSpecified={notSpecified}
              />
              <InfoRow
                label={copy.tabs.minimumOrderQuantity}
                value={profile.moq ?? undefined}
                notSpecified={notSpecified}
              />
              <InfoRow
                label={copy.tabs.leadTime}
                value={profile.lead_time_days ?? undefined}
                notSpecified={notSpecified}
              />
            </InfoGroup>

            <InfoGroup title={copy.tabs.qualityControl}>
              <ChipsRow
                label={copy.tabs.qualitySystems}
                items={quality}
                notSpecified={notSpecified}
              />
              <ChipsRow
                label={copy.tabs.traceability}
                items={traceability}
                notSpecified={notSpecified}
              />
              <ChipsRow
                label={copy.tabs.auditReadiness}
                items={audit}
                notSpecified={notSpecified}
              />
              <div className="py-3">
                <p className="text-sm text-muted-foreground mb-2">{copy.tabs.certifications}</p>
                {certifications.length > 0 ? (
                  <div className="-mx-4 sm:-mx-5">
                    <ProfileCertifications profile={profile} locale={locale} />
                  </div>
                ) : (
                  <span className="text-sm font-medium text-muted-foreground">{notSpecified}</span>
                )}
              </div>
            </InfoGroup>

            <InfoGroup title={copy.tabs.tradeExperience}>
              <ChipsRow
                label={copy.tabs.exportMarkets}
                items={markets}
                notSpecified={notSpecified}
              />
              <ChipsRow
                label={copy.tabs.incoterms}
                items={incoterms}
                notSpecified={notSpecified}
              />
              <ChipsRow
                label={copy.tabs.oemOdm}
                items={oem}
                notSpecified={notSpecified}
              />
            </InfoGroup>
          </TabsContent>

          <TabsContent value="products">
            <ProfileProducts profile={profile} locale={locale} />
            {(!profile.products || profile.products.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-12">
                {copy.tabs.noProducts}
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </section>
  )
}
