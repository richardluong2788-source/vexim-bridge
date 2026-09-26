const qa = require((process.argv[2] || '.') + '/email-qa.js')
const sup = require((process.argv[2] || '.') + '/suppression-pure.js')
const assert = require('assert')
let passed = 0, failed = 0
const t = (n, f) => { try { f(); passed++; console.log('  ✓', n) } catch (e) { failed++; console.log('  ✗', n, '—', e.message) } }

const ctx = (over = {}) => ({
  buyer: { company_name: 'Acme Foods', country: 'US', industry: 'Food & Beverage', website: null, contact_name: 'John', contact_email: 'j@acme.com', contact_title: null },
  import_data: { hs_codes: 'UNKNOWN', main_products: 'food', purchase_history: 'UNKNOWN', vietnam_supplier_exists: 'UNKNOWN', shipment_count: 'UNKNOWN', peak_months: 'UNKNOWN' },
  crm: { stage: 'waiting_reply', campaign_step: 2, step_objective: null, followup_count: 1, previous_emails: [{ step: 1, sent_at: '2026-09-01', subject: 'Vietnam sourcing — US compliance support', content: 'Hi John, I noticed Acme Foods has a strong presence in premium snacks...' }], replies: [] },
  business_rules: { max_words: 200, no_links: true, no_attachments: true, opt_out_line_required: true },
  ...over,
})

console.log('EMAIL QA TESTS')
t('email sạch → LOW, passed', () => {
  const r = qa.runEmailQA({
    email: { subjectEn: 'Following up on Vietnam sourcing', contentEn: 'Hi John,\n\nWanted to check if expanding your Vietnam supplier base is on the radar this quarter. We work with audited Vietnamese food factories exporting to the US.\n\nWould it be worth a short chat?\n\nIf this is not relevant right now, a simple "no thanks" is completely fine.\n\nBest regards,\nVexim\nVEXIM GLOBAL CO., LTD\n25/6, Lane 51, Ngoa Long Street, Tay Tuu Ward, Hanoi, Vietnam\nveximbridge.com' },
    recipient: 'j@acme.com', ctx: ctx(), optOutRequired: true,
  })
  assert.strictEqual(r.risk_level, 'LOW')
  assert.ok(r.passed)
})
t('có link → HIGH', () => {
  const r = qa.runEmailQA({ email: { subjectEn: 'Hi', contentEn: 'Check https://example.com now please' }, recipient: 'j@acme.com', ctx: ctx(), optOutRequired: false })
  assert.strictEqual(r.risk_level, 'HIGH')
})
t('claim FDA approved → HIGH', () => {
  const r = qa.runEmailQA({ email: { subjectEn: 'Hi', contentEn: 'Our factory is FDA approved and certified for exports.' }, recipient: 'j@acme.com', ctx: ctx(), optOutRequired: false })
  assert.strictEqual(r.risk_level, 'HIGH')
})
t('subject trùng email trước → HIGH', () => {
  const r = qa.runEmailQA({ email: { subjectEn: 'Vietnam sourcing — US compliance support', contentEn: 'Different body entirely.' }, recipient: 'j@acme.com', ctx: ctx(), optOutRequired: false })
  assert.ok(r.issues.some(i => i.check === 'duplicate_subject'))
})
t('body gần trùng email trước → HIGH', () => {
  const r = qa.runEmailQA({ email: { subjectEn: 'New subject here', contentEn: 'Hi John,\n\nI noticed Acme Foods has a strong presence in premium snacks for the US market. As we approach peak sourcing period securing capacity is likely top of mind.' }, recipient: 'j@acme.com', ctx: ctx(), optOutRequired: false })
  assert.ok(r.issues.some(i => i.check === 'duplicate_body'), JSON.stringify(r.issues))
})
t('follow-up thiếu opt-out line → MEDIUM', () => {
  const r = qa.runEmailQA({ email: { subjectEn: 'Quick follow up', contentEn: 'Hi John,\n\nJust checking in about Vietnam sourcing opportunities.\n\nBest regards,\nVexim' }, recipient: 'j@acme.com', ctx: ctx(), optOutRequired: true })
  assert.ok(r.issues.some(i => i.check === 'opt_out_line'))
})
t('email > 200 từ → MEDIUM length', () => {
  const words = Array(250).fill('word').join(' ')
  const r = qa.runEmailQA({ email: { subjectEn: 'Hi', contentEn: words }, recipient: 'j@acme.com', ctx: ctx(), optOutRequired: false })
  assert.ok(r.issues.some(i => i.check === 'length'))
})
t('recipient hỏng → HIGH', () => {
  const r = qa.runEmailQA({ email: { subjectEn: 'Hi', contentEn: 'Hello there friend.' }, recipient: 'not-an-email', ctx: ctx(), optOutRequired: false })
  assert.strictEqual(r.risk_level, 'HIGH')
})
t('signature thiếu địa chỉ → MEDIUM CAN-SPAM', () => {
  const r = qa.runEmailQA({ email: { subjectEn: 'Hi', contentEn: 'Hello John, quick note about Vietnam sourcing. Best regards, Vexim' }, recipient: 'j@acme.com', ctx: ctx(), optOutRequired: false })
  assert.ok(r.issues.some(i => i.check === 'signature_address'))
})
t('spam word "free" → MEDIUM', () => {
  const r = qa.runEmailQA({ email: { subjectEn: 'Hi', contentEn: 'Get a free sample of our premium cashews now!' }, recipient: 'j@acme.com', ctx: ctx(), optOutRequired: false })
  assert.ok(r.issues.some(i => i.check === 'spam_word'))
})

console.log('SUPPRESSION TESTS')
t('unsubscribed → suppressed', () => {
  const r = sup.getStopReason({ contact_email: 'a@b.com', email_unsubscribed: true, email_hard_bounced_at: null, email_complained_at: null })
  assert.strictEqual(r.state, 'suppressed')
})
t('hard bounce → suppressed', () => {
  const r = sup.getStopReason({ contact_email: 'a@b.com', email_unsubscribed: false, email_hard_bounced_at: '2026-01-01', email_complained_at: null })
  assert.strictEqual(r.state, 'suppressed')
})
t('complained → suppressed', () => {
  const r = sup.getStopReason({ contact_email: 'a@b.com', email_unsubscribed: false, email_hard_bounced_at: null, email_complained_at: '2026-01-01' })
  assert.strictEqual(r.state, 'suppressed')
})
t('missing email → invalid_contact', () => {
  const r = sup.getStopReason({ contact_email: null, email_unsubscribed: false, email_hard_bounced_at: null, email_complained_at: null })
  assert.strictEqual(r.state, 'invalid_contact')
})
t('lead sạch → ok', () => {
  const r = sup.getStopReason({ contact_email: 'a@b.com', email_unsubscribed: false, email_hard_bounced_at: null, email_complained_at: null })
  assert.ok(r.ok)
})

console.log('reply rules -> tested separately with mocked AI')
console.log(`\n${passed} passed, ${failed} failed`)
