/**
 * Shared free-text country suggestion list.
 *
 * Both `leads.country` (buyer) and `profiles.country` (client/supplier) are
 * free-text fields — kept that way to avoid coupling to an ISO enum, per the
 * convention established in scripts/007_sprint_a_risk_swift.sql. This list
 * only powers the `<datalist>` autocomplete; any free text is still valid.
 *
 * lib/risk/country-risk.ts normalises common names/codes for risk
 * classification and lib/matching/scorer.ts does a simple case-insensitive
 * comparison for country matching — both tolerate free text just fine.
 */
export const COUNTRY_SUGGESTIONS = [
  "United States",
  "Canada",
  "United Kingdom",
  "Germany",
  "France",
  "Netherlands",
  "Japan",
  "South Korea",
  "Australia",
  "Singapore",
  "United Arab Emirates",
  "India",
  "Pakistan",
  "Nigeria",
  "Mexico",
  "Brazil",
  "Vietnam",
  "China",
  "Thailand",
  "Malaysia",
  "Indonesia",
  "Philippines",
] as const
