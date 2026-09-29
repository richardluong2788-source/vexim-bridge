const qa = require((process.argv[2] || '.') + '/email-qa.js')
const sup = require((process.argv[2] || '.') + '/suppression-pure.js')
const assert = require('assert')
let passed = 0, failed = 0
const t = (name, fn) => {
  try { fn(); passed++; console.log('  ✓', name) }
  catch (error) { failed++; console.log('  ✗', name, '—', error.message) }
}

const ctx = {
  buyer: { company_name: 'Acme Foods', country: 'US', industry: 'Food & Beverage', website: null, contact_name: 'John', contact_email: 'j@acme.com', contact_title: null, source_of_personalization: 'UNKNOWN' },
  import_data: { hs_codes: 'UNKNOWN', main_products: 'frozen mango', purchase_history: 'UNKNOWN', vietnam_supplier_exists: 'UNKNOWN', shipment_count: 'UNKNOWN', peak_months: 'UNKNOWN' },
  crm: { stage: 'waiting_reply', campaign_step: 2, step_objective: null, followup_count: 1, previous_emails: [], replies: [] },
  business_rules: { max_words: 200, no_links: true, no_attachments: true, opt_out_line_required: true },
}
const optOut = "If you'd rather not hear from me, just reply 'no thanks' and I won't contact you again."
const signature = 'Angela Divincenzo\nAccount Executive, VEXIM GLOBAL CO., LTD\n25/6, Lane 51, Ngoa Long Street, Tay Tuu Ward, Hanoi, Vietnam'
const validBody = `Hi John,\n\nI came across Acme Foods while looking into the frozen mango category. We can help coordinate early sourcing conversations in Vietnam, while you decide whether any supplier is a fit. Would exploring that be useful? Feel free to tell me what would be more relevant.\n\n${optOut}\n\n${signature}`
const run = (body = validBody, subject = 'Vietnam sourcing process', recipient = 'j@acme.com', optOutRequired = true) => qa.runEmailQA({
  email: { subjectEn: subject, contentEn: body }, recipient, ctx, optOutRequired,
})

console.log('EMAIL QA TESTS')
t('normal, context-grounded email with required footer passes', () => {
  const result = run()
  assert.strictEqual(result.risk_level, 'LOW', JSON.stringify(result.issues))
  assert.strictEqual(result.passed, true)
})
t('ordinary conversational style, multiple questions, and long copy are not editorial blocks', () => {
  const naturalCopy = `Hello John,\n\n${'A contextual sentence about the buyer and this campaign. '.repeat(55)}Could this be useful? Or would another topic be more relevant?\n\n${optOut}\n\n${signature}`
  const result = run(naturalCopy)
  assert.deepStrictEqual(result.issues, [])
  assert.strictEqual(result.passed, true)
})
t('missing or malformed recipient blocks', () => {
  const result = run(validBody, 'Vietnam sourcing process', 'not-an-email')
  assert.ok(result.issues.some(issue => issue.check === 'recipient' && issue.severity === 'HIGH'))
  assert.strictEqual(result.passed, false)
})
t('links and bare domains are blocked', () => {
  for (const link of ['https://example.com/path', 'example.vn']) {
    const result = run(validBody.replace('Would exploring that be useful?', `Would exploring that be useful? More information: ${link}`))
    assert.ok(result.issues.some(issue => issue.check === 'links' && issue.severity === 'HIGH'), JSON.stringify(result.issues))
    assert.strictEqual(result.passed, false)
  }
})
t('deceptive Re/Fwd subject is blocked', () => {
  const result = run(validBody, 'Re: sourcing options')
  assert.ok(result.issues.some(issue => issue.check === 'misleading_subject' && issue.severity === 'HIGH'))
})
t('direct import/customs/shipment/trade record disclosure is blocked', () => {
  for (const phrase of ['import records', 'customs data', 'shipment database', 'trade records']) {
    const result = run(validBody.replace('I came across Acme Foods while looking into the frozen mango category.', `I came across Acme Foods after reviewing ${phrase}.`))
    assert.ok(result.issues.some(issue => issue.check === 'research_source_disclosure' && issue.severity === 'HIGH'), JSON.stringify(result.issues))
  }
})
t('obvious promotional spam wording is flagged but is not a copy-style hard block', () => {
  const result = run(validBody.replace('Would exploring that be useful?', 'We can offer a free sample. Would exploring that be useful?'))
  assert.ok(result.issues.some(issue => issue.check === 'spam_word' && issue.severity === 'MEDIUM'))
  assert.strictEqual(result.passed, true)
})
t('required exact opt-out sentence cannot be omitted', () => {
  const result = run(validBody.replace(`${optOut}\n\n`, ''))
  assert.ok(result.issues.some(issue => issue.check === 'opt_out_line' && issue.severity === 'HIGH'))
  assert.strictEqual(result.passed, false)
})
t('required opt-out sentence must immediately precede signature', () => {
  const result = run(validBody.replace(`${optOut}\n\n${signature}`, `${optOut}\n\nP.S. One more thought.\n\n${signature}`))
  assert.ok(result.issues.some(issue => issue.check === 'opt_out_position' && issue.severity === 'HIGH'))
})
t('missing human sender, title, legal entity, or postal address blocks', () => {
  const invalid = [
    validBody.replace('Angela Divincenzo\n', ''),
    validBody.replace('Account Executive, VEXIM GLOBAL CO., LTD', 'VEXIM GLOBAL CO., LTD'),
    validBody.replace('VEXIM GLOBAL CO., LTD', 'Vexim'),
    validBody.replace('\n25/6, Lane 51, Ngoa Long Street, Tay Tuu Ward, Hanoi, Vietnam', ''),
  ]
  for (const body of invalid) {
    const result = run(body)
    assert.ok(result.issues.some(issue => issue.check === 'signature_missing_sender' && issue.severity === 'HIGH'), JSON.stringify(result.issues))
    assert.strictEqual(result.passed, false)
  }
})

console.log('SUPPRESSION TESTS')
t('unsubscribed → suppressed', () => {
  const result = sup.getStopReason({ contact_email: 'a@b.com', email_unsubscribed: true, email_hard_bounced_at: null, email_complained_at: null })
  assert.strictEqual(result.state, 'suppressed')
})
t('hard bounce → suppressed', () => {
  const result = sup.getStopReason({ contact_email: 'a@b.com', email_unsubscribed: false, email_hard_bounced_at: '2026-01-01', email_complained_at: null })
  assert.strictEqual(result.state, 'suppressed')
})
t('complained → suppressed', () => {
  const result = sup.getStopReason({ contact_email: 'a@b.com', email_unsubscribed: false, email_hard_bounced_at: null, email_complained_at: '2026-01-01' })
  assert.strictEqual(result.state, 'suppressed')
})
t('missing email → invalid_contact', () => {
  const result = sup.getStopReason({ contact_email: null, email_unsubscribed: false, email_hard_bounced_at: null, email_complained_at: null })
  assert.strictEqual(result.state, 'invalid_contact')
})
t('valid lead → ok', () => {
  const result = sup.getStopReason({ contact_email: 'a@b.com', email_unsubscribed: false, email_hard_bounced_at: null, email_complained_at: null })
  assert.ok(result.ok)
})

console.log(`\nQA + suppression: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exitCode = 1
