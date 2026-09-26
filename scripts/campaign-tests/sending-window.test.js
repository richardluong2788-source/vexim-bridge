// Sending window tests — Mon–Fri 08:00–11:30 / 13:00–16:30 local buyer.
// Chạy 2 lần trong run.sh: OUT (sending-window-pure.js) và OUT/pure
// (trường hợp compile cả file — phần DB bị strip bởi sed).
const assert = require('assert')

const OUT = process.argv[2] || '.'
let mod
try { mod = require(OUT + '/sending-window-pure.js') } catch { mod = require(OUT + '/sending-window.js') }
const { resolveBuyerTimezone, isWithinSendingWindow, msUntilNextWindowStart, checkSendingWindow, checkAutoSendWindow } = mod

let passed = 0, failed = 0
const t = (n, f) => { try { f(); passed++; console.log('  ✓', n) } catch (e) { failed++; console.log('  ✗', n, '—', e.message) } }

// Mốc giờ ET chuẩn (EDT = UTC-4):
const wed = (h, m) => new Date(`2026-09-23T${String(h + 4).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}:00Z`) // Wed
const fri = (h, m) => new Date(`2026-09-25T${String(h + 4).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}:00Z`) // Fri
const sat = (h, m) => new Date(`2026-09-26T${String(h + 4).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}:00Z`) // Sat

console.log('SENDING WINDOW TESTS')
t('Wed 10:00 ET → trong window', () => {
  assert.ok(isWithinSendingWindow(wed(10, 0), 'America/New_York'))
})
t('Wed 11:00 ET → trong window (giới hạn dưới 11:30)', () => {
  assert.ok(isWithinSendingWindow(wed(11, 0), 'America/New_York'))
})
t('Wed 11:30 ET → NGOÀI window (kết thúc mở)', () => {
  assert.ok(!isWithinSendingWindow(wed(11, 30), 'America/New_York'))
})
t('Wed 12:00 ET → ngoài (nghỉ trưa), window kế = 13:00 cùng ngày', () => {
  assert.ok(!isWithinSendingWindow(wed(12, 0), 'America/New_York'))
  const ms = msUntilNextWindowStart(wed(12, 0), 'America/New_York')
  assert.ok(ms > 0 && ms <= 61 * 60_000, `ms=${ms}`)
})
t('Wed 07:00 ET → window kế = 08:00 hôm đó (~1h)', () => {
  const ms = msUntilNextWindowStart(wed(7, 0), 'America/New_York')
  assert.ok(ms > 0 && ms <= 61 * 60_000, `ms=${ms}`)
})
t('Wed 15:00 ET → trong window chiều', () => {
  assert.ok(isWithinSendingWindow(wed(15, 0), 'America/New_York'))
})
t('Wed 16:30 ET → ngoài (hết window chiều)', () => {
  assert.ok(!isWithinSendingWindow(wed(16, 30), 'America/New_York'))
})
t('Fri 17:00 ET → window kế = Mon 08:00 (~63h)', () => {
  const ms = msUntilNextWindowStart(fri(17, 0), 'America/New_York')
  assert.ok(ms > 62 * 3600_000 && ms <= 64 * 3600_000, `ms=${ms / 3600_000}h`)
})
t('Sat 10:00 ET → window kế = Mon 08:00 (~46h)', () => {
  const ms = msUntilNextWindowStart(sat(10, 0), 'America/New_York')
  assert.ok(ms > 45 * 3600_000 && ms <= 47 * 3600_000, `ms=${ms / 3600_000}h`)
})
t('tz hỏng → null', () => {
  assert.strictEqual(msUntilNextWindowStart(wed(10, 0), 'Not/AZone'), null)
})

console.log('TIMEZONE RESOLUTION TESTS')
t('manual override → confident', () => {
  const r = resolveBuyerTimezone({ buyer_timezone: 'America/Chicago', country: 'United States' })
  assert.strictEqual(r.tz, 'America/Chicago')
  assert.ok(r.confident)
  assert.strictEqual(r.source, 'manual')
})
t('US + state trong địa chỉ → tz theo state, confident', () => {
  const r = resolveBuyerTimezone({ country: 'United States', import_address: '2810 Waterford Lake Dr, Midland, GA 31820' })
  assert.strictEqual(r.tz, 'America/New_York') // GA → ET
  assert.ok(r.confident)
  const r2 = resolveBuyerTimezone({ country: 'US', import_address: 'Houston, TX 77002' })
  assert.strictEqual(r2.tz, 'America/Chicago')
  assert.ok(r2.confident)
})
t('US không state → ET approximate, KHÔNG confident', () => {
  const r = resolveBuyerTimezone({ country: 'United States' })
  assert.strictEqual(r.tz, 'America/New_York')
  assert.ok(!r.confident)
  assert.strictEqual(r.source, 'country_approx')
})
t('UK/Germany/Japan → country tz, confident', () => {
  assert.strictEqual(resolveBuyerTimezone({ country: 'United Kingdom' }).tz, 'Europe/London')
  assert.ok(resolveBuyerTimezone({ country: 'Germany' }).confident)
  assert.strictEqual(resolveBuyerTimezone({ country: 'Japan' }).tz, 'Asia/Tokyo')
})
t('country lạ → none', () => {
  const r = resolveBuyerTimezone({ country: 'Atlantis' })
  assert.strictEqual(r.tz, null)
  assert.ok(!r.confident)
})

console.log('WINDOW DECISION TESTS')
t('shadow check: ngoài window → nextAt; tz null → cho qua', () => {
  const out = checkSendingWindow(wed(12, 0), { tz: 'America/New_York', source: 'us_state', confident: true })
  assert.ok(!out.ok && !!out.nextAt)
  const noTz = checkSendingWindow(wed(12, 0), { tz: null, source: 'none', confident: false })
  assert.ok(noTz.ok && noTz.reason === 'no_timezone')
})
t('AUTO-SEND check: tz không confident → CHẶN kể cả trong window', () => {
  const r = checkAutoSendWindow(wed(10, 0), { tz: 'America/New_York', source: 'country_approx', confident: false })
  assert.ok(!r.ok && r.reason === 'no_timezone')
})
t('AUTO-SEND check: confident + trong window → ok', () => {
  const r = checkAutoSendWindow(wed(10, 0), { tz: 'America/New_York', source: 'us_state', confident: true })
  assert.ok(r.ok)
})
t('AUTO-SEND check: confident + ngoài window → chặn kèm nextAt', () => {
  const r = checkAutoSendWindow(wed(12, 0), { tz: 'America/New_York', source: 'us_state', confident: true })
  assert.ok(!r.ok && r.reason === 'outside_window' && !!r.nextAt)
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
