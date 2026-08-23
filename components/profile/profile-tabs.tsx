"use client"

import type { ReactNode } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProfileProducts } from "./profile-products"
import { ProfileCertifications } from "./profile-certifications"
import type { PublicCapability } from "@/lib/assessment/actions"
import type { ClientProfileWithRelations } from "@/lib/supabase/types"

interface ProfileTabsProps {
  profile: ClientProfileWithRelations
  capability: PublicCapability | null
}

const QUALITY_SYSTEM_LABELS: Record<string, string> = {
  HACCP: "HACCP",
  GMP: "GMP",
  ISO22000: "ISO 22000",
  SOP: "Standard Operating Procedures (SOP)",
  QC: "Quality Control (QC) Process",
}

const TRACEABILITY_LABELS: Record<string, string> = {
  lot: "Lot-level Traceability",
  input: "Input Material Records",
  finished: "Finished Goods Records",
  recall: "Product Recall Procedure",
  "batch-lot": "Batch/Lot Coding",
}

const AUDIT_LABELS: Record<string, string> = {
  onsite: "On-site Factory Audits Accepted",
  online: "Online Audits Supported",
}

const MARKET_LABELS: Record<string, string> = {
  US: "United States",
  EU: "European Union",
  JP: "Japan",
  KR: "South Korea",
  CN: "China",
  ASEAN: "ASEAN",
  ME: "Middle East",
}

const NOT_SPECIFIED = "Not specified"

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

function InfoRow({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 py-3">
      <span className="text-sm text-muted-foreground sm:w-56 shrink-0">{label}</span>
      <span className="text-sm font-medium text-foreground">
        {value !== undefined && value !== null && value !== "" ? (
          value
        ) : (
          <span className="font-normal text-muted-foreground">{NOT_SPECIFIED}</span>
        )}
      </span>
    </div>
  )
}

/** Row for a tri-state boolean field: shows Yes / No / Not specified — always visible, never hidden. */
function BooleanRow({ label, value }: { label: string; value: boolean | null | undefined }) {
  return (
    <InfoRow
      label={label}
      value={
        value === null || value === undefined ? undefined : (
          <span className={value ? "text-foreground" : "text-muted-foreground"}>
            {value ? "Yes" : "No"}
          </span>
        )
      }
    />
  )
}

function ChipsRow({ label, items }: { label: string; items: string[] }) {
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
        <span className="text-sm font-medium text-muted-foreground">{NOT_SPECIFIED}</span>
      )}
    </div>
  )
}

/**
 * Tab "Company Profile" / "Products" — presented as a spec-sheet: every
 * field always shows its label on the left, even when there is no data or
 * a boolean is false, so buyers see the full picture rather than a partial
 * list of only the positive signals.
 */
export function ProfileTabs({ profile, capability }: ProfileTabsProps) {
  const quality = (capability?.quality_systems ?? [])
    .map((q) => QUALITY_SYSTEM_LABELS[q])
    .filter((label): label is string => Boolean(label))

  const traceability = (capability?.traceability ?? [])
    .filter((t) => t !== "none")
    .map((t) => TRACEABILITY_LABELS[t])
    .filter((label): label is string => Boolean(label))

  const audit = (capability?.audit_readiness ?? [])
    .filter((a) => a !== "not-ready")
    .map((a) => AUDIT_LABELS[a])
    .filter((label): label is string => Boolean(label))

  const markets = (capability?.export_markets ?? [])
    .map((m) => MARKET_LABELS[m] ?? m)
    .filter((m) => m !== "other")

  const incoterms = capability?.incoterms ?? []
  const oem = (capability?.oem_odm ?? []).filter((o) => o !== "none")

  const certifications = profile.certifications || []
  const uspPoints = profile.usp_points || []

  const exportExperience = (() => {
    const startYear = capability?.export_since_year || new Date(profile.created_at).getFullYear()
    const years = new Date().getFullYear() - startYear
    return years > 0 ? `${years} ${years === 1 ? "year" : "years"}` : undefined
  })()

  return (
    <section className="py-8 sm:py-12 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <Tabs defaultValue="company" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="company">Company Profile</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="space-y-8">
            <InfoGroup title="Overview">
              {profile.description && (
                <div className="py-3">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                    {profile.description}
                  </p>
                </div>
              )}
              <InfoRow label="Location" value={profile.profiles.country ?? undefined} />
              <InfoRow label="Exporting Since" value={capability?.export_since_year ?? undefined} />
              <InfoRow label="Export Experience" value={exportExperience} />
              <InfoRow label="Company Scale" value={capability?.company_scale ?? undefined} />
              <ChipsRow
                label="Highlights"
                items={uspPoints.map((p) => p.title).filter(Boolean)}
              />
            </InfoGroup>

            <InfoGroup title="Production Capacity">
              <InfoRow label="Production Capacity" value={profile.production_capacity ?? undefined} />
              <InfoRow label="Minimum Order Quantity (MOQ)" value={profile.moq ?? undefined} />
              <InfoRow label="Lead Time" value={profile.lead_time_days ?? undefined} />
            </InfoGroup>

            <InfoGroup title="Quality Control">
              <ChipsRow label="Quality Systems" items={quality} />
              <ChipsRow label="Traceability" items={traceability} />
              <ChipsRow label="Audit Readiness" items={audit} />
              <BooleanRow
                label="Regular Food Safety Training"
                value={capability?.food_safety_training_regular}
              />
              <BooleanRow
                label="Regular Equipment Calibration"
                value={capability?.equipment_calibration_regular}
              />
              <BooleanRow label="Regular Water Testing" value={capability?.water_testing} />
              <div className="py-3">
                <p className="text-sm text-muted-foreground mb-2">Certifications</p>
                {certifications.length > 0 ? (
                  <div className="-mx-4 sm:-mx-5">
                    <ProfileCertifications profile={profile} />
                  </div>
                ) : (
                  <span className="text-sm font-medium text-muted-foreground">{NOT_SPECIFIED}</span>
                )}
              </div>
            </InfoGroup>

            <InfoGroup title="Trade Experience">
              <ChipsRow label="Export Markets" items={markets} />
              <ChipsRow label="Incoterms" items={incoterms} />
              <ChipsRow label="OEM / ODM" items={oem} />
            </InfoGroup>
          </TabsContent>

          <TabsContent value="products">
            <ProfileProducts profile={profile} />
            {(!profile.products || profile.products.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-12">
                No products have been posted yet.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </section>
  )
}
