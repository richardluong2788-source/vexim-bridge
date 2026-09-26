// Follow-up Gate tests — phần pure (defensive rules + decision mapping).
// AI path được stub qua node_modules/ai (run.sh) → trả output rác → code phải
// fail-safe (proceed=false) chứ không crash.
const assert = require('assert')

const path = require('path')
const OUT = process.argv[2] || '.'
const gate = require(OUT + '/followup-gate.js')
// QUAN TRỌNG: require ĐÚNG instance stub 'ai' mà gate dùng (resolve theo $OUT),
// không phải AI SDK thật của repo — nếu khác instance thì override stub vô hiệu.
const ai = require(path.join(OUT, 'node_modules', 'ai', 'index.js'))

let passed = 0, failed = 0
const tests = []
const t = (n, f) => { tests.push([n, f]) }

const ctx = (over = {}) => ({
  buyer: { company_name: 'Acme', country: 'US', industry: 'Food', website: null, contact_name: 'John', contact_email: 'j@acme.com', contact_title: null },
  import_data: { hs_codes: 'UNKNOWN', main_products: 'food', purchase_history: 'UNKNOWN', vietnam_supplier_exists: 'UNKNOWN', shipment_count: 'UNKNOWN', peak_months: 'UNKNOWN' },
  research: { buyer_analysis: 'UNKNOWN', buyer_strategy: 'UNKNOWN', analysis_age_days: 'UNKNOWN' },
  crm: { stage: 'waiting_reply', campaign_step: 2, step_objective: null, followup_count: 0, previous_emails: [{ step: 1, sent_at: '2026-09-20', subject: 'Intro', content: 'Hello...' }], replies: over.replies ?? [] },
  business_rules: { max_words: 200, no_links: true, no_attachments: true, opt_out_line_required: true },
})

;(async () => {
  console.log('FOLLOWUP GATE TESTS')

  const origGenerate = ai.generateText

  t('buyer đã reply → KHÔNG follow-up, không gọi AI', async () => {
    let called = false
    ai.generateText = async () => { called = true; throw new Error('must not call AI') }
    const r = await gate.assessFollowupJustification({ ctx: ctx({ replies: [{ received_at: 'x', content: 'yes', intent: 'INTERESTED' }] }), stepNumber: 2, stepType: 'follow_up', daysSinceLastContact: 4 })
    ai.generateText = origGenerate
    assert.strictEqual(called, false)
    assert.strictEqual(r.proceed, false)
    assert.strictEqual(r.source, 'rules')
  })

  t('chưa từng gửi email → KHÔNG follow-up', async () => {
    const c = ctx()
    c.crm.previous_emails = []
    const r = await gate.assessFollowupJustification({ ctx: c, stepNumber: 2, stepType: 'follow_up', daysSinceLastContact: 4 })
    assert.strictEqual(r.proceed, false)
    assert.strictEqual(r.source, 'rules')
  })

  t('AI stub fail (throw) → fail-safe KHÔNG gửi (không crash)', async () => {
    ai.generateText = async () => { throw new Error('gateway down') }
    const r = await gate.assessFollowupJustification({ ctx: ctx(), stepNumber: 2, stepType: 'follow_up', daysSinceLastContact: 4 })
    ai.generateText = origGenerate
    assert.strictEqual(r.proceed, false)
    assert.strictEqual(r.source, 'error')
  })

  t('AI stub trả output rác (không proceed) → fail-safe KHÔNG gửi', async () => {
    // Stub mặc định của run.sh trả object không có field proceed
    const r = await gate.assessFollowupJustification({ ctx: ctx(), stepNumber: 2, stepType: 'follow_up', daysSinceLastContact: 4 })
    assert.strictEqual(r.proceed, false)
    assert.strictEqual(gate.applyFollowupGateDecision(r), 'skip')
  })

  t('AI stub trả proceed=true conf cao → generate', async () => {
    ai.generateText = async () => ({ experimental_output: { proceed: true, reason_category: 'friction_reduction', reason_summary: 'ok', confidence: 0.9 } })
    const r = await gate.assessFollowupJustification({ ctx: ctx(), stepNumber: 2, stepType: 'follow_up', daysSinceLastContact: 4 })
    ai.generateText = origGenerate
    assert.strictEqual(r.proceed, true)
    assert.strictEqual(gate.applyFollowupGateDecision(r), 'generate')
  })

  t('AI proceed nhưng conf < 0.7 → human_review', () => {
    assert.strictEqual(gate.applyFollowupGateDecision({ proceed: true, reasonCategory: 'value_insight', reasonSummary: '', confidence: 0.55, source: 'ai' }), 'human_review')
  })
  t('proceed=false → skip', () => {
    assert.strictEqual(gate.applyFollowupGateDecision({ proceed: false, reasonCategory: 'no_valid_reason', reasonSummary: '', confidence: 0.9, source: 'ai' }), 'skip')
  })

  for (const [name, fn] of tests) {
    try {
      await fn()
      passed++
      console.log('  ✓', name)
    } catch (e) {
      failed++
      console.log('  ✗', name, '—', e.message)
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed) process.exit(1)
})()
