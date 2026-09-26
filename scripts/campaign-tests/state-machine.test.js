const sm = require((process.argv[2] || '.') + '/state-machine.js')
const constants = require((process.argv[2] || '.') + '/constants.js')
const assert = require('assert')

let passed = 0, failed = 0
function t(name, fn) {
  try { fn(); passed++ ; console.log('  ✓', name) }
  catch (e) { failed++; console.log('  ✗', name, '—', e.message) }
}

console.log('STATE MACHINE TESTS')
// Happy path
t('step1 draft queued → CONTACT_PENDING + approval_overdue_check', () => {
  const r = sm.onStepDue('enrolled')
  assert.strictEqual(r.to, 'contact_pending')
  assert.strictEqual(r.nextActionType, 'approval_overdue_check')
})
t('email 1 gửi từ contact_pending → contacted', () => {
  const r = sm.onFirstEmailSent('contact_pending')
  assert.strictEqual(r.to, 'contacted')
})
t('draft reject → step_retry sau 1h, giữ contact_pending', () => {
  const r = sm.onDraftRejected('contact_pending')
  assert.strictEqual(r.to, null)
  assert.strictEqual(r.nextActionType, 'step_retry')
  assert.ok(r.nextActionAt > new Date())
})
t('email 1 sent → contacted + grace', () => {
  const r = sm.onFirstEmailSent('enrolled')
  assert.strictEqual(r.to, 'contacted')
  assert.strictEqual(r.nextActionType, 'contacted_grace')
  assert.ok(r.lastContactNow)
})
t('grace elapsed → waiting_reply + followup_due', () => {
  const r = sm.onContactedGraceElapsed('contacted', 4)
  assert.strictEqual(r.to, 'waiting_reply')
  assert.strictEqual(r.nextActionType, 'followup_due')
  assert.ok(r.nextActionAt > new Date())
})
t('followup sent step2 → followup_1, count+1', () => {
  const r = sm.onFollowupEmailSent('waiting_reply', 2, 7)
  assert.strictEqual(r.to, 'followup_1')
  assert.strictEqual(r.followupCountDelta, 1)
})
t('followup sent step3 → followup_2', () => {
  const r = sm.onFollowupEmailSent('followup_1', 3, 30)
  assert.strictEqual(r.to, 'followup_2')
})
t('followup sent cuối → nurture_due', () => {
  const r = sm.onFollowupEmailSent('followup_2', 4, null)
  assert.strictEqual(r.to, 'followup_2')
  assert.strictEqual(r.nextActionType, 'nurture_due')
})
t('nurture due → NURTURE terminal', () => {
  const r = sm.onNurtureDue('followup_2')
  assert.strictEqual(r.to, 'nurture')
})

// Reply routing
t('INTERESTED → replied_handoff', () => {
  const r = sm.onReplyClassified('waiting_reply', { intent: 'INTERESTED', confidence: 0.9, requiresHuman: false })
  assert.strictEqual(r.to, 'replied_handoff')
})
t('NOT_INTERESTED → stopped', () => {
  const r = sm.onReplyClassified('waiting_reply', { intent: 'NOT_INTERESTED', confidence: 0.92, requiresHuman: false })
  assert.strictEqual(r.to, 'stopped')
})
t('OPT_OUT → suppressed', () => {
  const r = sm.onReplyClassified('waiting_reply', { intent: 'OPT_OUT', confidence: 0.98, requiresHuman: false })
  assert.strictEqual(r.to, 'suppressed')
})
t('WRONG_CONTACT → invalid_contact', () => {
  const r = sm.onReplyClassified('waiting_reply', { intent: 'WRONG_CONTACT', confidence: 0.9, requiresHuman: false })
  assert.strictEqual(r.to, 'invalid_contact')
})
t('NOT_NOW → paused 30 ngày', () => {
  const r = sm.onReplyClassified('waiting_reply', { intent: 'NOT_NOW', confidence: 0.88, requiresHuman: false })
  assert.strictEqual(r.to, 'paused')
  assert.strictEqual(r.nextActionType, 'pause_expiry')
})
t('OUT_OF_OFFICE → paused 7 ngày, KHÔNG phải reply', () => {
  const r = sm.onReplyClassified('waiting_reply', { intent: 'OUT_OF_OFFICE', confidence: 0.95, requiresHuman: false })
  assert.strictEqual(r.to, 'paused')
})
t('low confidence → HOLD human review, giữ state', () => {
  const r = sm.onReplyClassified('waiting_reply', { intent: 'UNKNOWN', confidence: 0.4, requiresHuman: true })
  assert.strictEqual(r.to, null)
  assert.strictEqual(r.needsHumanReview, true)
  assert.strictEqual(r.nextActionAt, null)
})
t('terminal không hồi sinh', () => {
  const r = sm.onReplyClassified('stopped', { intent: 'INTERESTED', confidence: 0.99, requiresHuman: false })
  assert.strictEqual(r.to, null)
})
t('reply cho paused (OOO hết hạn trước khi reply) → vẫn nhận', () => {
  const r = sm.onReplyClassified('paused', { intent: 'INTERESTED', confidence: 0.9, requiresHuman: false })
  assert.strictEqual(r.to, 'replied_handoff')
})

// Manual controls
t('manual stop', () => {
  assert.strictEqual(sm.onManualStop('waiting_reply', 'x').to, 'stopped')
  assert.strictEqual(sm.onManualStop('nurture', 'x').to, null)
})
t('review resolved resume → clear flag + action now', () => {
  const r = sm.onReviewResolved('waiting_reply', 'resume')
  assert.strictEqual(r.clearHumanReview, true)
  assert.strictEqual(r.to, 'waiting_reply')
  assert.ok(r.nextActionAt)
})
t('review resolved stop → stopped terminal', () => {
  assert.strictEqual(sm.onReviewResolved('waiting_reply', 'stop').to, 'stopped')
})
t('manual pause', () => {
  const r = sm.onManualPause('followup_1', new Date())
  assert.strictEqual(r.to, 'paused')
  assert.strictEqual(r.nextActionType, 'pause_expiry')
})
t('resume sau pause → waiting_reply', () => {
  assert.strictEqual(sm.onResumeAfterPause('paused').to, 'waiting_reply')
  assert.strictEqual(sm.onResumeAfterPause('waiting_reply').to, null)
})

// Suppression / invalid
t('suppression từ stop-check', () => {
  assert.strictEqual(sm.onSuppression('contacted', 'lead_hard_bounced').to, 'suppressed')
})
t('invalid contact', () => {
  assert.strictEqual(sm.onInvalidContact('enrolled', 'missing_contact_email').to, 'invalid_contact')
})

// --- Re-enroll cooldown (26/09/2026) ---
t('cooldown: terminal quá gần → blocked, ngày mở đúng', () => {
  const now = new Date('2026-09-26T00:00:00Z')
  const opens = constants.reenrollBlockedUntil('2026-09-10T00:00:00Z', 60, now)
  assert.ok(opens instanceof Date)
  assert.strictEqual(opens.toISOString().slice(0, 10), '2026-11-09')
})
t('cooldown: đã quá hạn → null (được phép)', () => {
  const now = new Date('2026-12-15T00:00:00Z')
  assert.strictEqual(constants.reenrollBlockedUntil('2026-09-10T00:00:00Z', 60, now), null)
})
t('cooldown: 0 ngày → tắt guard', () => {
  assert.strictEqual(constants.reenrollBlockedUntil('2026-09-25T00:00:00Z', 0, new Date('2026-09-26T00:00:00Z')), null)
})
t('cooldown: updated_at hỏng/thiếu → null (fail-open)', () => {
  assert.strictEqual(constants.reenrollBlockedUntil(null, 60), null)
  assert.strictEqual(constants.reenrollBlockedUntil('not-a-date', 60), null)
})

// --- Resume-from-pause bugfix (27/09/2026) ---
t('resume từ paused khi CHƯA từng liên hệ → enrolled/step1_due (không rơi waiting_reply)', () => {
  const r = sm.onReviewResolved('paused', 'resume', new Date('2026-09-26T12:00:00Z'), { neverContacted: true })
  assert.strictEqual(r.to, 'enrolled')
  assert.strictEqual(r.nextActionType, 'step1_due')
  assert.strictEqual(r.note, 'review_resumed_never_contacted')
})
t('resume từ paused khi ĐÃ gửi email 1 → waiting_reply/followup_due như cũ', () => {
  const r = sm.onReviewResolved('paused', 'resume', new Date('2026-09-26T12:00:00Z'), { neverContacted: false })
  assert.strictEqual(r.to, 'waiting_reply')
  assert.strictEqual(r.nextActionType, 'followup_due')
})
t('resume từ paused mặc định (không truyền hint) → giữ hành vi cũ', () => {
  const r = sm.onReviewResolved('paused', 'resume')
  assert.strictEqual(r.to, 'waiting_reply')
})
t('resume state không phải paused → giữ nguyên state', () => {
  const r = sm.onReviewResolved('contacted', 'resume')
  assert.strictEqual(r.to, 'contacted')
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
