const assert = require('assert')
const path = require('path')
const { countriesMatch, getCampaignCountryMismatch } = require(path.join(process.argv[2] || '.', 'country-validation.js'))

const context = (buyerCountry, targetCountry) => ({
  buyer: { country: buyerCountry },
  campaign: { name: 'Pilot', target_country: targetCountry },
})

assert.strictEqual(countriesMatch('USA', 'United States'), true)
assert.strictEqual(countriesMatch('US', 'United States'), true)
assert.strictEqual(countriesMatch('Canada', 'United States'), false)
assert.strictEqual(countriesMatch(null, 'United States'), false)
assert.strictEqual(getCampaignCountryMismatch(context('USA', 'United States')), null)
assert.strictEqual(getCampaignCountryMismatch(context('United States', 'US')), null)
assert.match(getCampaignCountryMismatch(context('Canada', 'United States')), /does not match campaign target/)
assert.match(getCampaignCountryMismatch(context(null, 'United States')), /Buyer country is missing/)
assert.match(getCampaignCountryMismatch(context('United States', null)), /target country is not set/)
console.log('COUNTRY VALIDATION TESTS: 9 passed, 0 failed')
