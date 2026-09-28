import type { BuyerContext } from "./types"

export function normalizeCampaignCountry(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase().replace(/[._]/g, " ").replace(/\s+/g, " ")
  if (!normalized) return null
  if (["us", "usa", "u s", "united states", "united states of america", "america"].includes(normalized)) return "US"
  if (["ca", "can", "canada"].includes(normalized)) return "CA"
  if (["uk", "u k", "great britain", "britain", "united kingdom"].includes(normalized)) return "GB"
  if (["kr", "korea", "south korea", "republic of korea"].includes(normalized)) return "KR"
  return normalized
}

export function countriesMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = normalizeCampaignCountry(left)
  const b = normalizeCampaignCountry(right)
  return !!a && !!b && a === b
}

/** Enrollment/send eligibility uses the same existing lead country LR records for Swift risk. */
export function getCampaignCountryMismatch(ctx: BuyerContext): string | null {
  const target = ctx.campaign.target_country
  const buyerCountry = ctx.buyer.country
  if (!normalizeCampaignCountry(target)) return "Campaign target country is not set."
  if (!normalizeCampaignCountry(buyerCountry)) return "Buyer country is missing."
  if (!countriesMatch(target, buyerCountry)) {
    return `Buyer country (${buyerCountry}) does not match campaign target (${target}).`
  }
  return null
}
