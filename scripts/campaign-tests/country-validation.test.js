const assert = require('assert')
const path = require('path')
const { getCampaignCountryReviewReason, resolveExplicitImportingCountry } = require(path.join(process.argv[2] || '.', 'country-validation.js'))

const context = (country, importing_country) => ({
  buyer: { country, importing_country },
  campaign: { name: 'US Food Buyer – Vietnam Sourcing – Pilot', target_segment: 'us_food_importer_vietnam_sourced' },
})

assert.strictEqual(getCampaignCountryReviewReason(context('United States', 'US')), null)
assert.strictEqual(getCampaignCountryReviewReason(context('USA', 'United States')), null)
assert.match(getCampaignCountryReviewReason(context('Canada', 'US')), /company's recorded country \(Canada\)/)
assert.match(getCampaignCountryReviewReason(context('United States', null)), /Importing country is not explicitly confirmed/)
assert.match(getCampaignCountryReviewReason(context('United States', 'Canada')), /parsed importing country \(Canada\)/)
assert.match(getCampaignCountryReviewReason(context(null, 'US')), /company country is missing/)
assert.strictEqual(resolveExplicitImportingCountry('United States'), 'United States')
assert.strictEqual(resolveExplicitImportingCountry(null, { destination_country: 'US' }), 'US')
assert.strictEqual(resolveExplicitImportingCountry(null, { main_import_countries: '99.8% Asia: Thailand, China, Vietnam' }), null)
console.log('COUNTRY VALIDATION TESTS: 9 passed, 0 failed')
