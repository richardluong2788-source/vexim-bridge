import type { BuyerContext } from "./types"

export function normalizeCampaignCountry(value: string | null | undefined): string | null {
  const normalized = value
    ?.normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[._]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!normalized) return null

  // Country is deliberately free text in leads/campaigns. Compare a compact
  // punctuation-insensitive key as well as the readable form so inputs like
  // "U.S.A.", "U.S." and "US (United States)" resolve to the same country.
  const compact = normalized.replace(/[^a-z0-9]/g, "")
  const aliases: Record<string, string> = {
    us: "US",
    usa: "US",
    unitedstates: "US",
    unitedstatesofamerica: "US",
    america: "US",
    usofamerica: "US",
    unitedstatesusa: "US",
    unitedstatesofamericausa: "US",
    unitedstatesus: "US",
    unitedstatesofamericaus: "US",
    usunitedstates: "US",
    usunitedstatesofamerica: "US",
    usaunitedstates: "US",
    usausa: "US",
    ca: "CA",
    can: "CA",
    canada: "CA",
    uk: "GB",
    greatbritain: "GB",
    britain: "GB",
    unitedkingdom: "GB",
    kr: "KR",
    korea: "KR",
    southkorea: "KR",
    republicofkorea: "KR",
  }
  return aliases[compact] ?? normalized
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
