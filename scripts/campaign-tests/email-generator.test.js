const assert = require('assert')
const path = require('path')
const base = process.argv[2] || '.'
const { generateCampaignEmail } = require(path.join(base, 'signature', 'email-generator.js'))
const { runEmailQA } = require(path.join(base, 'email-qa.js'))

const ctx = {
  buyer: {
    company_name: 'Acme Foods', country: 'US', industry: 'Food & Beverage', website: null,
    contact_name: 'Angela', contact_email: 'angela@acme.example', contact_title: null,
    source_of_personalization: 'import records',
  },
  import_data: {
    hs_codes: 'UNKNOWN', main_products: 'frozen mango', purchase_history: 'UNKNOWN',
    vietnam_supplier_exists: 'UNKNOWN', shipment_count: 'UNKNOWN', peak_months: 'UNKNOWN',
  },
  campaign: { name: 'Frozen mango sourcing', description: null, target_segment: null, target_country: 'US', product_category: 'frozen mango' },
  research: { buyer_analysis: 'UNKNOWN', buyer_strategy: 'UNKNOWN', analysis_age_days: 'UNKNOWN' },
  crm: { stage: 'waiting_reply', campaign_step: 1, step_objective: null, followup_count: 0, previous_emails: [], replies: [] },
  business_rules: { max_words: 200, no_links: true, no_attachments: true, opt_out_line_required: true },
}

async function main() {
  process.env.CAMPAIGN_TEST_GENERATOR = '1'
  const generated = await generateCampaignEmail(ctx, 'initial_outreach', null, 'Angela Divincenzo')
  const prompt = global.__campaignGenerationPrompt || ''

  assert.match(prompt, /Acme Foods/)
  assert.match(prompt, /frozen mango/)
  assert.match(prompt, /exactly ONE low-pressure question/i)
  assert.match(prompt, /CAMPAIGN_BANNED|hope this email finds you well|verified suppliers/i)
  assert.match(prompt, /never reveal that source type|never tell the buyer you reviewed/i)
  assert.match(generated.contentEn, /Are you currently looking for additional supply of frozen mango\?/)
  assert.match(generated.contentEn, /Angela Divincenzo\nVexim Trade, VEXIM GLOBAL CO\., LTD/)
  assert.doesNotMatch(generated.contentEn, /veximtrade\.com|Best regards,\nAngela Divincenzo/)

  const result = runEmailQA({
    email: { subjectEn: generated.subjectEn, contentEn: generated.contentEn },
    recipient: 'angela@acme.example', ctx, optOutRequired: true, stepType: 'initial_outreach',
  })
  assert.strictEqual(result.passed, true, JSON.stringify(result.issues))
  assert.strictEqual(result.issues.some((issue) => issue.check === 'cta_multiple_questions'), false)
  assert.strictEqual(result.issues.some((issue) => issue.check === 'personalization_missing_company'), false)
  assert.strictEqual(result.issues.some((issue) => issue.check === 'personalization_missing_product'), false)
  console.log('  ✓ generator prompt, mocked output, draft signature, and Email 1 QA constraints')
}

main().catch((error) => {
  console.error('  ✗ generator constraints —', error)
  process.exitCode = 1
})
