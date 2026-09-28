import type { BuyerContext } from "./types"

function normalizeCountry(value: string | null | undefined): "US" | "CA" | "UNKNOWN" | string {
  const normalized = value?.trim().toLowerCase().replace(/[._]/g, " ").replace(/\s+/g, " ")
  if (!normalized) return "UNKNOWN"
  if (["us", "usa", "u s", "united states", "united states of america", "america"].includes(normalized)) return "US"
  if (["ca", "can", "canada"].includes(normalized)) return "CA"
  return normalized
}

/**
 * Deterministic safety gate for the US Food Buyer pilot. Company location and
 * explicitly parsed importing market are independent facts. Missing, unclear,
 * non-US, or conflicting values are held for human review before generation.
 */
export function getCampaignCountryReviewReason(ctx: BuyerContext): string | null {
  const target = `${ctx.campaign.target_segment ?? ""} ${ctx.campaign.name}`
  const isUsFoodPilot = /(?:^|[^a-z])us(?:_|\s|-|$)|united states/i.test(target)
  if (!isUsFoodPilot) return null

  const companyCountry = normalizeCountry(ctx.buyer.country)
  const importingCountry = normalizeCountry(ctx.buyer.importing_country)
  if (companyCountry === "UNKNOWN") {
    return "Buyer company country is missing; verify company location and importing market before outreach."
  }
  if (companyCountry !== "US") {
    const label = companyCountry === "CA" ? "Canada" : ctx.buyer.country?.trim() || "unclear"
    return `US Food Buyer campaign conflicts with the buyer company's recorded country (${label}); verify both company location and importing market before outreach.`
  }
  if (importingCountry === "UNKNOWN") {
    return "Importing country is not explicitly confirmed; verify the destination market before outreach."
  }
  if (importingCountry !== "US") {
    const label = importingCountry === "CA" ? "Canada" : ctx.buyer.importing_country?.trim() || "unclear"
    return `US Food Buyer campaign conflicts with the explicitly parsed importing country (${label}); verify both countries before outreach.`
  }
  if (companyCountry !== importingCountry) {
    return "Buyer company country and importing country conflict; verify both before outreach."
  }
  return null
}
