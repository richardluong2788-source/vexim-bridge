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

async function promptFor(step, stepType, stepGuidance = null, stepObjective = null) {
  const stepContext = {
    ...ctx,
    crm: { ...ctx.crm, campaign_step: step, step_objective: stepObjective },
  }
  await generateCampaignEmail(stepContext, stepType, stepGuidance, 'Angela Divincenzo')
  return global.__campaignGenerationPrompt || ''
}

async function main() {
  process.env.CAMPAIGN_TEST_GENERATOR = '1'

  const prompt1 = await promptFor(1, 'initial_outreach')
  assert.match(prompt1, /Acme Foods/)
  assert.match(prompt1, /frozen mango/)
  assert.match(prompt1, /industry-level research/i)
  assert.doesNotMatch(prompt1, /"source_of_personalization": "import records"/i)
  assert.match(prompt1, /"source_of_personalization": "Industry-level research/i)
  assert.match(prompt1, /Email 1 — the buyer is doing too much filtering themselves/)
  assert.doesNotMatch(prompt1, /Email 2 —|Email 3 —|Email 4 —/)
  assert.doesNotMatch(prompt1, /135-145|120-160|exactly one question|self-check|banned phrases/i)
  assert.doesNotMatch(prompt1, /max_words/i)

  const obsoleteGuidance = 'Write exactly 120 words, ask exactly one question, and use the old fixed opener.'
  const prompt2 = await promptFor(2, 'follow_up', obsoleteGuidance, obsoleteGuidance)
  assert.match(prompt2, /Email 2 — explain what Veximtrade actually does/)
  assert.doesNotMatch(prompt2, /Email 1 —|Email 3 —|Email 4 —/)
  assert.doesNotMatch(prompt2, /exactly 120 words|old fixed opener|ADDITIONAL GUIDANCE/i)

  const prompt3 = await promptFor(3, 'follow_up')
  assert.match(prompt3, /Email 3 — sourcing effort is also a cost/)
  assert.doesNotMatch(prompt3, /Email 1 —|Email 2 —|Email 4 —/)

  const prompt4 = await promptFor(4, 'close_loop')
  assert.match(prompt4, /Email 4 — close without pressure/)
  assert.doesNotMatch(prompt4, /Email 1 —|Email 2 —|Email 3 —/)
  assert.match(prompt4, /paragraph rhythm/i)
  assert.match(prompt4, /wording to copy/i)
  assert.match(prompt4, /exact opt-out sentence/i)

  const generated = await generateCampaignEmail(ctx, 'initial_outreach', null, 'Angela Divincenzo')
  assert.match(generated.contentEn, /Angela Divincenzo\nVexim Trade, VEXIM GLOBAL CO\., LTD/)
  assert.doesNotMatch(generated.contentEn, /veximtrade\.com/)
  const result = runEmailQA({
    email: { subjectEn: generated.subjectEn, contentEn: generated.contentEn },
    recipient: 'angela@acme.example', ctx, optOutRequired: true, stepType: 'initial_outreach',
  })
  assert.strictEqual(result.passed, true, JSON.stringify(result.issues))
  console.log('  ✓ per-step narrative references, context-only personalization, legacy guidance ignored, safety/signature retained')
}

main().catch((error) => {
  console.error('  ✗ generator writing references —', error)
  process.exitCode = 1
})
