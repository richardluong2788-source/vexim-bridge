import { ShieldCheck, Globe2, ClipboardCheck, BadgeCheck, Boxes } from "lucide-react"
import type { PublicCapability } from "@/lib/assessment/actions"

interface ProfileCapabilitiesProps {
  capability: PublicCapability | null
}

const QS_LABELS: Record<string, string> = {
  HACCP: "HACCP",
  GMP: "GMP",
  ISO22000: "ISO 22000",
  SOP: "Internal SOP",
  QC: "QC Process",
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

const AUDIT_LABELS: Record<string, string> = {
  onsite: "Factory audit visits welcome",
  online: "Online audit available",
}

export function ProfileCapabilities({ capability }: ProfileCapabilitiesProps) {
  if (!capability) return null

  const quality = (capability.quality_systems ?? [])
    .filter((q) => q !== "other" && QS_LABELS[q])
    .map((q) => QS_LABELS[q])
  const oem = (capability.oem_odm ?? []).filter((o) => o !== "none")
  const markets = (capability.export_markets ?? [])
    .filter((m) => m !== "other" && MARKET_LABELS[m])
    .map((m) => MARKET_LABELS[m])
  const audit = (capability.audit_readiness ?? [])
    .filter((a) => a !== "not-ready" && AUDIT_LABELS[a])
    .map((a) => AUDIT_LABELS[a])
  const incoterms = capability.incoterms ?? []

  const hasAny =
    quality.length > 0 || oem.length > 0 || markets.length > 0 || audit.length > 0 || incoterms.length > 0
  if (!hasAny) return null

  return (
    <section className="py-12 sm:py-16 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-2">
            <BadgeCheck className="w-5 h-5 text-accent" />
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground text-center">
              Verified Capabilities
            </h2>
          </div>
          <p className="text-sm text-muted-foreground text-center mb-10">
            Assessed and verified by Vexim Trade
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {quality.length > 0 && (
              <CapabilityCard icon={ShieldCheck} title="Quality Systems" items={quality} />
            )}
            {oem.length > 0 && (
              <CapabilityCard icon={Boxes} title="OEM / ODM" items={oem} />
            )}
            {markets.length > 0 && (
              <CapabilityCard icon={Globe2} title="Export Markets" items={markets} />
            )}
            {incoterms.length > 0 && (
              <CapabilityCard icon={ClipboardCheck} title="Incoterms" items={incoterms} />
            )}
            {audit.length > 0 && (
              <CapabilityCard icon={BadgeCheck} title="Buyer Audit" items={audit} />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function CapabilityCard({
  icon: Icon,
  title,
  items,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  items: string[]
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-accent" />
        </div>
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li
            key={item}
            className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
