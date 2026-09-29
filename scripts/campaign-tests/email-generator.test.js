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
  assert.match(prompt, /industry-level research/i)
  assert.doesNotMatch(prompt, /"source_of_personalization": "import records"/i)
  assert.match(prompt, /"source_of_personalization": "Industry-level research/i)
  assert.doesNotMatch(prompt, /135-145|120-160|exactly one question|self-check|banned phrases/i)
  assert.doesNotMatch(prompt, /max_words/i)
  assert.match(prompt, /opt-out sentence/i)
  assert.match(generated.contentEn, /Angela Divincenzo\nVexim Trade, VEXIM GLOBAL CO\., LTD/)
  assert.doesNotMatch(generated.contentEn, /veximtrade\.com/)

  const result = runEmailQA({
    email: { subjectEn: generated.subjectEn, contentEn: generated.contentEn },
    recipient: 'angela@acme.example', ctx, optOutRequired: true, stepType: 'initial_outreach',
  })
  assert.strictEqual(result.passed, true, JSON.stringify(result.issues))
  console.log('  ✓ context-led generator, private source context, required opt-out and sender signature')
}

main().catch((error) => {
  console.error('  ✗ generator basics —', error)
  process.exitCode = 1
})
