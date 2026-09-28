import type { BuyerContext } from "./types"

/**
 * Resolve only explicitly labeled destination fields. Shipment-origin aggregates
 * such as `main_import_countries` are intentionally not accepted here.
 */
export function resolveExplicitImportingCountry(
  importingCountry: string | null | undefined,
  ...sources: unknown[]
): string | null {
  if (importingCountry?.trim()) return importingCountry.trim()
  const keys = ["importing_country", "import_country", "destination_country", "import_market_country"]
  for (const source of sources) {
    if (!source || typeof source !== "object" || Array.isArray(source)) continue
    const record = source as Record<string, unknown>
    for (const key of keys) {
      const value = record[key]
      if (typeof value === "string" && value.trim()) return value.trim()
    }
  }
  return null
}

function normalizeCountry(value: string | null | undefined): "US" | "CA" | "UNKNOWN" | string {
  const normalized = value?.trim().toLowerCase().replace(/[._]/g, " ").replace(/\s+/g, " ")
  if (!normalized) return "UNKNOWN"
  if (["us", "usa", "u s", "united states", "united states of america", "america"].includes(normalized)) return "US"
  if (["ca", "can", "canada"].includes(normalized)) return "CA"
  return normalized
}

/**
 * Deterministic safety gate for US-based buyer campaigns. Lead Researcher's
 * `country` is the buyer/company location already used by country-risk/SWIFT;
 * it is sufficient for this audience criterion. If a separate importing
 * destination is explicitly recorded and contradicts the campaign market, hold
 * for review. Never infer that destination from shipment-origin aggregates.
 */
export function getCampaignCountryReviewReason(ctx: BuyerContext): string | null {
  const target = `${ctx.campaign.target_segment ?? ""} ${ctx.campaign.name}`
  const isUsFoodPilot = /(?:^|[^a-z])us(?:_|\s|-|$)|united states/i.test(target)
  if (!isUsFoodPilot) return null

  const companyCountry = normalizeCountry(ctx.buyer.country)
  const importingCountry = normalizeCountry(ctx.buyer.importing_country)
  if (companyCountry === "UNKNOWN") {
    return "Buyer company country is missing; verify company location before outreach."
  }
  if (companyCountry !== "US") {
    const label = companyCountry === "CA" ? "Canada" : ctx.buyer.country?.trim() || "unclear"
    return `US Food Buyer campaign conflicts with the buyer company's recorded country (${label}); verify company location before outreach.`
  }
  // The US buyer location already qualifies this audience. Do not require a
  // duplicate destination field unless an explicit destination contradicts it.
  if (importingCountry !== "UNKNOWN" && importingCountry !== "US") {
    const label = importingCountry === "CA" ? "Canada" : ctx.buyer.importing_country?.trim() || "unclear"
    return `US Food Buyer campaign conflicts with the explicitly recorded importing country (${label}); verify before outreach.`
  }
  return null
}
