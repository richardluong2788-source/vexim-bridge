const qa = require((process.argv[2] || '.') + '/email-qa.js')
const sup = require((process.argv[2] || '.') + '/suppression-pure.js')
const assert = require('assert')
let passed = 0, failed = 0
const t = (n, f) => { try { f(); passed++; console.log('  ✓', n) } catch (e) { failed++; console.log('  ✗', n, '—', e.message) } }

const ctx = (over = {}) => ({
  buyer: { company_name: 'Acme Foods', country: 'US', industry: 'Food & Beverage', website: null, contact_name: 'John', contact_email: 'j@acme.com', contact_title: null, source_of_personalization: 'UNKNOWN' },
  import_data: { hs_codes: 'UNKNOWN', main_products: 'food', purchase_history: 'UNKNOWN', vietnam_supplier_exists: 'UNKNOWN', shipment_count: 'UNKNOWN', peak_months: 'UNKNOWN' },
  crm: { stage: 'waiting_reply', campaign_step: 2, step_objective: null, followup_count: 1, previous_emails: [{ step: 1, sent_at: '2026-09-01', subject: 'Vietnam sourcing — US compliance support', content: 'Hi John, I noticed Acme Foods has a strong presence in premium snacks...' }], replies: [] },
  business_rules: { max_words: 200, no_links: true, no_attachments: true, opt_out_line_required: true },
  ...over,
})

console.log('EMAIL QA TESTS')
t('email sạch → LOW, passed', () => {
  const r = qa.runEmailQA({
    email: { subjectEn: 'Vietnam sourcing process', contentEn: `Hi John,\n\nWanted to check whether Vietnam sourcing remains relevant for Acme Foods. Veximtrade handles early groundwork by identifying relevant manufacturers, reviewing available information about capacity and export history, and checking product fit against the importing country's relevant requirements. We also coordinate communication toward samples or quotations when both sides want to continue. You decide whether a supplier is suitable and whether to proceed. If this is not timely, just reply no and I will stop following up.\n\nIf you'd rather not hear from me, just reply 'no thanks' and I won't contact you again.\n\nBest regards,\nAngela Divincenzo\nVEXIM GLOBAL CO., LTD\n25/6, Lane 51, Ngoa Long Street, Tay Tuu Ward, Hanoi, Vietnam` },
    recipient: 'j@acme.com', ctx: ctx(), optOutRequired: true,
  })
  assert.strictEqual(r.risk_level, 'LOW', JSON.stringify(r.issues))
  assert.ok(r.passed)
})
t('có link → HIGH', () => {
  const r = qa.runEmailQA({ email: { subjectEn: 'Hi', contentEn: 'Check https://example.com now please' }, recipient: 'j@acme.com', ctx: ctx(), optOutRequired: false })
  assert.strictEqual(r.risk_level, 'HIGH')
})
t('bare domain trong email body → HIGH', () => {
  const r = qa.runEmailQA({ email: { subjectEn: 'Hi', contentEn: 'More information is at veximtrade.com' }, recipient: 'j@acme.com', ctx: ctx(), optOutRequired: false })
  assert.ok(r.issues.some(i => i.check === 'links'), JSON.stringify(r.issues))
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
t('follow-up thiếu exact opt-out line → HIGH', () => {
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
t('feedback 26/09: trend claim không điều kiện → HIGH', () => {
  const r = qa.runEmailQA({ email: { subjectEn: 'Hi', contentEn: "Vietnam's robusta exports are growing fast. We can help." }, recipient: 'j@acme.com', ctx: ctx(), optOutRequired: false })
  assert.ok(r.issues.some(i => i.check === 'trend_claim' && i.severity === 'HIGH'), JSON.stringify(r.issues))
})
t('feedback 26/09: trend trong khung điều kiện → vẫn sạch', () => {
  const r = qa.runEmailQA({ email: { subjectEn: 'Hi', contentEn: 'If growing your supplier base is on the radar, we can help. Would a short chat be worth it?\n\nBest regards,\nAngela Divincenzo\nVEXIM GLOBAL CO., LTD\n25/6, Lane 51, Ngoa Long Street, Tay Tuu Ward, Hanoi, Vietnam' }, recipient: 'j@acme.com', ctx: ctx(), optOutRequired: true })
  assert.ok(!r.issues.some(i => i.check === 'trend_claim'), JSON.stringify(r.issues))
})
t('feedback 26/09: superlative về Vexim → HIGH vexim_claim', () => {
  const r = qa.runEmailQA({ email: { subjectEn: 'Hi', contentEn: 'We are the largest compliance partner in Vietnam for food exporters.' }, recipient: 'j@acme.com', ctx: ctx(), optOutRequired: false })
  assert.ok(r.issues.some(i => i.check === 'vexim_claim' && i.severity === 'HIGH'), JSON.stringify(r.issues))
})
t('feedback 26/09: số liệu bịa (40 factories, 12 years) → HIGH', () => {
  const r = qa.runEmailQA({ email: { subjectEn: 'Hi', contentEn: 'We work with 40 factories and bring 12 years of experience.' }, recipient: 'j@acme.com', ctx: ctx(), optOutRequired: false })
  assert.ok(r.issues.some(i => i.check === 'vexim_claim' && /Specific count/.test(i.message)), JSON.stringify(r.issues))
})
t('feedback 26/09: chứng nhận ngoài whitelist (ISO) → HIGH', () => {
  const r = qa.runEmailQA({ email: { subjectEn: 'Hi', contentEn: 'Our partner runs an ISO 22000 certified facility.' }, recipient: 'j@acme.com', ctx: ctx(), optOutRequired: false })
  assert.ok(r.issues.some(i => i.check === 'vexim_claim'), JSON.stringify(r.issues))
})
t('feedback 26/09: close-loop ép chọn phương án → MEDIUM', () => {
  const r = qa.runEmailQA({ email: { subjectEn: 'Hi', contentEn: 'Closing the file for now. Which would you prefer: a call later or nothing?' }, recipient: 'j@acme.com', ctx: ctx(), optOutRequired: true, stepType: 'close_loop' })
  assert.ok(r.issues.some(i => i.check === 'close_loop_pressure'), JSON.stringify(r.issues))
})
t('feedback 26/09: close_loop không cần dấu "?" (bỏ cta_missing)', () => {
  const body = 'Hi John,\n\nThis will be my last note for a while. If Vietnam sourcing isn\'t a priority, a simple "no thanks" is completely fine and I\'ll close the file.\n\nBest regards,\nAngela Divincenzo\nVEXIM GLOBAL CO., LTD\n25/6, Lane 51, Ngoa Long Street, Tay Tuu Ward, Hanoi, Vietnam'
  const rClose = qa.runEmailQA({ email: { subjectEn: 'Closing the file', contentEn: body }, recipient: 'j@acme.com', ctx: ctx(), optOutRequired: true, stepType: 'close_loop' })
  assert.ok(!rClose.issues.some(i => i.check === 'cta_missing'), JSON.stringify(rClose.issues))
  const rOther = qa.runEmailQA({ email: { subjectEn: 'Closing the file', contentEn: body }, recipient: 'j@acme.com', ctx: ctx(), optOutRequired: true, stepType: 'follow_up' })
  assert.ok(rOther.issues.some(i => i.check === 'cta_missing'), JSON.stringify(rOther.issues))
})

const firstEmailBody = `Hi Angela,\n\nIt can take time to sort through manufacturers, product specifications, and import requirements before a useful introduction is clear. Veximtrade handles that early groundwork in Vietnam by identifying relevant manufacturers, reviewing available information about their capacity and export history, and checking product fit alongside the importing country's relevant requirements. We also coordinate communication toward samples or quotations when both sides want to continue. You decide whether a supplier is a fit and whether to proceed. This can leave your existing supply relationships unchanged while you consider another source. Is Vietnam an additional source you are currently considering for this product category?\n\nIf you'd rather not hear from me, just reply 'no thanks' and I won't contact you again.\n\nBest regards,\nAngela Divincenzo\nVEXIM GLOBAL CO., LTD\n25/6, Lane 51, Ngoa Long Street, Tay Tuu Ward, Hanoi, Vietnam`
t('first email compliant 90-130 words and one sourcing question', () => {
  const firstCtx = ctx({ crm: { ...ctx().crm, campaign_step: 1 } })
  const r = qa.runEmailQA({ email: { subjectEn: 'Vietnam sourcing process', contentEn: firstEmailBody }, recipient: 'j@acme.com', ctx: firstCtx, optOutRequired: true })
  assert.ok(!r.issues.some(i => ['first_email_word_count', 'first_email_question_count', 'first_email_situation_question', 'first_email_meeting_ask', 'brand_wording', 'opt_out_line'].includes(i.check)), JSON.stringify(r.issues))
})
t('first email outside 90-130 words is blocked', () => {
  const firstCtx = ctx({ crm: { ...ctx().crm, campaign_step: 1 } })
  const tooShort = firstEmailBody.replace(/It can take time[\s\S]*?category\?/, 'Vietnam sourcing can involve early screening. Is Vietnam an additional source for this product category?')
  const r = qa.runEmailQA({ email: { subjectEn: 'Vietnam sourcing process', contentEn: tooShort }, recipient: 'j@acme.com', ctx: firstCtx, optOutRequired: true })
  assert.ok(r.issues.some(i => i.check === 'first_email_word_count' && i.severity === 'HIGH'), JSON.stringify(r.issues))
})
t('opt-out must be immediately before the signature', () => {
  const firstCtx = ctx({ crm: { ...ctx().crm, campaign_step: 1 } })
  const misplaced = firstEmailBody.replace("If you'd rather not hear from me, just reply 'no thanks' and I won't contact you again.\n\nBest regards", "If you'd rather not hear from me, just reply 'no thanks' and I won't contact you again.\n\nOne additional note.\n\nBest regards")
  const r = qa.runEmailQA({ email: { subjectEn: 'Vietnam sourcing process', contentEn: misplaced }, recipient: 'j@acme.com', ctx: firstCtx, optOutRequired: true })
  assert.ok(r.issues.some(i => i.check === 'opt_out_position' && i.severity === 'HIGH'), JSON.stringify(r.issues))
})
t('first email question must ask about sourcing situation', () => {
  const firstCtx = ctx({ crm: { ...ctx().crm, campaign_step: 1 } })
  const vague = firstEmailBody.replace('Is Vietnam an additional source you are currently considering for this product category?', 'Does Vietnam sound interesting?')
  const r = qa.runEmailQA({ email: { subjectEn: 'Vietnam sourcing process', contentEn: vague }, recipient: 'j@acme.com', ctx: firstCtx, optOutRequired: true })
  assert.ok(r.issues.some(i => i.check === 'first_email_situation_question' && i.severity === 'HIGH'), JSON.stringify(r.issues))
})
t('first email meeting request is a hard block', () => {
  const firstCtx = ctx({ crm: { ...ctx().crm, campaign_step: 1 } })
  const r = qa.runEmailQA({ email: { subjectEn: 'Vietnam sourcing process', contentEn: firstEmailBody.replace('Is Vietnam an additional source you are currently considering for this product category?', 'Would you be open to a meeting?') }, recipient: 'j@acme.com', ctx: firstCtx, optOutRequired: true })
  assert.ok(r.issues.some(i => i.check === 'first_email_meeting_ask' && i.severity === 'HIGH'), JSON.stringify(r.issues))
})
t('banned supplier claim is a hard block', () => {
  const r = qa.runEmailQA({ email: { subjectEn: 'Vietnam sourcing process', contentEn: 'Veximtrade only introduces verified suppliers.' }, recipient: 'j@acme.com', ctx: ctx(), optOutRequired: false })
  assert.ok(r.issues.some(i => i.check === 'campaign_banned_copy' && i.severity === 'HIGH'), JSON.stringify(r.issues))
})
t('unsupported research personalization is blocked without provenance', () => {
  const r = qa.runEmailQA({ email: { subjectEn: 'Vietnam sourcing process', contentEn: 'I came across Acme Foods while researching your market.' }, recipient: 'j@acme.com', ctx: ctx(), optOutRequired: false })
  assert.ok(r.issues.some(i => i.check === 'unsupported_personalization_source' && i.severity === 'HIGH'), JSON.stringify(r.issues))
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

t('follow-up thiếu exact opt-out line → HIGH', () => {
  const r = qa.runEmailQA({
    email: { subjectEn: 'Quick follow up', contentEn: 'Hi John,\n\nChecking in on my earlier note. We work with audited Vietnamese food factories exporting to the US.\n\nBest regards,\nAngela Divincenzo\nVEXIM GLOBAL CO., LTD\n25/6, Lane 51, Ngoa Long Street, Tay Tuu Ward, Hanoi, Vietnam' },
    recipient: 'j@acme.com', ctx: ctx(), optOutRequired: true,
  })
  assert.ok(r.issues.some(i => i.check === 'opt_out_line'), JSON.stringify(r.issues))
})
t('legacy soft opt-out is rejected; exact sentence is required' , () => {
  const r = qa.runEmailQA({
    email: { subjectEn: 'Quick follow up', contentEn: 'Hi John,\n\nChecking in on my earlier note about Vietnam sourcing.\n\nIf this isn\'t relevant right now, just reply no and I won\'t follow up.\n\nBest regards,\nAngela Divincenzo\nVEXIM GLOBAL CO., LTD\n25/6, Lane 51, Ngoa Long Street, Tay Tuu Ward, Hanoi, Vietnam' },
    recipient: 'j@acme.com', ctx: ctx(), optOutRequired: true,
  })
  assert.ok(r.issues.some(i => i.check === 'opt_out_line' && i.severity === 'HIGH'), JSON.stringify(r.issues))
})
t('em dash trong body → punctuation MEDIUM', () => {
  const r = qa.runEmailQA({
    email: { subjectEn: 'Quick follow up', contentEn: 'Hi John,\n\nWe work with Vietnamese factories — direct relationships only.\n\nIf this isn\'t relevant right now, just reply no and I won\'t follow up.\n\nBest regards,\nAngela Divincenzo\nVEXIM GLOBAL CO., LTD\n25/6, Lane 51, Ngoa Long Street, Tay Tuu Ward, Hanoi, Vietnam' },
    recipient: 'j@acme.com', ctx: ctx(), optOutRequired: true,
  })
  assert.ok(r.issues.some(i => i.check === 'punctuation'), JSON.stringify(r.issues))
})
t('"feel free to" → ai_phrasing MEDIUM', () => {
  const r = qa.runEmailQA({
    email: { subjectEn: 'Quick follow up', contentEn: 'Hi John,\n\nFeel free to reply if you want more info about Vietnam sourcing.\n\nIf this isn\'t relevant right now, just reply no and I won\'t follow up.\n\nBest regards,\nAngela Divincenzo\nVEXIM GLOBAL CO., LTD\n25/6, Lane 51, Ngoa Long Street, Tay Tuu Ward, Hanoi, Vietnam' },
    recipient: 'j@acme.com', ctx: ctx(), optOutRequired: true,
  })
  assert.ok(r.issues.some(i => i.check === 'ai_phrasing'), JSON.stringify(r.issues))
})
t('body brand Veximtrade + pháp nhân chỉ ở signature → sạch', () => {
  const r = qa.runEmailQA({
    email: { subjectEn: 'Vietnam sourcing for Acme', contentEn: 'Hi John,\n\nI\'m with Veximtrade in Vietnam. We work with Vietnamese manufacturers on U.S. regulatory compliance and sourcing.\n\nWould a short intro call be worth your time?\n\nIf you\'d rather not hear from me, just reply \'no thanks\' and I won\'t contact you again.\n\nBest regards,\nVu Le Hong\nVEXIM GLOBAL CO., LTD\n25/6, Lane 51, Ngoa Long Street, Tay Tuu Ward, Hanoi, Vietnam' },
    recipient: 'j@acme.com', ctx: ctx(), optOutRequired: true,
  })
  assert.strictEqual(r.risk_level, 'LOW', JSON.stringify(r.issues))
})

t('subject có dấu "—" (marketing separator) → subject_punctuation MEDIUM', () => {
  const r = qa.runEmailQA({
    email: { subjectEn: 'Vietnam sourcing — supplier option', contentEn: 'Hi John,\n\nChecking in about Vietnam sourcing.\n\nIf this isn\'t relevant right now, just reply no and I won\'t follow up.\n\nBest regards,\nAngela Divincenzo\nVEXIM GLOBAL CO., LTD\n25/6, Lane 51, Ngoa Long Street, Tay Tuu Ward, Hanoi, Vietnam' },
    recipient: 'j@acme.com', ctx: ctx(), optOutRequired: true,
  })
  assert.ok(r.issues.some(i => i.check === 'subject_punctuation'), JSON.stringify(r.issues))
})
t('subject có dấu ":" → subject_punctuation MEDIUM', () => {
  const r = qa.runEmailQA({
    email: { subjectEn: 'Vietnam sourcing: a quick note', contentEn: 'Hi John,\n\nChecking in about Vietnam sourcing.\n\nIf this isn\'t relevant right now, just reply no and I won\'t follow up.\n\nBest regards,\nAngela Divincenzo\nVEXIM GLOBAL CO., LTD\n25/6, Lane 51, Ngoa Long Street, Tay Tuu Ward, Hanoi, Vietnam' },
    recipient: 'j@acme.com', ctx: ctx(), optOutRequired: true,
  })
  assert.ok(r.issues.some(i => i.check === 'subject_punctuation'), JSON.stringify(r.issues))
})
t('subject trần "Vietnam agriculture sourcing" → sạch', () => {
  const r = qa.runEmailQA({
    email: { subjectEn: 'Vietnam agriculture sourcing', contentEn: 'Hi John,\n\nChecking in about Vietnam sourcing for your category.\n\nIf this isn\'t relevant right now, just reply no and I won\'t follow up.\n\nBest regards,\nAngela Divincenzo\nVEXIM GLOBAL CO., LTD\n25/6, Lane 51, Ngoa Long Street, Tay Tuu Ward, Hanoi, Vietnam' },
    recipient: 'j@acme.com', ctx: ctx(), optOutRequired: true,
  })
  assert.ok(!r.issues.some(i => i.check === 'subject_punctuation'), JSON.stringify(r.issues))
})

console.log('reply rules -> tested separately with mocked AI')
console.log(`\n${passed} passed, ${failed} failed`)
