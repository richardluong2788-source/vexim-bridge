// Pitch-first flow (migration 093) — pure helper tests
const assert = require('assert')
const {
  validatePitchSelection,
  filterRepitchEligible,
  buildPitchNote,
  isBuyerFacingItem,
  isInterestedAction,
} = require((process.argv[2] || '.') + '/pitch-helpers.js')

let passed = 0, failed = 0
function t(name, fn) {
  try { fn(); passed++; console.log('  ✓', name) }
  catch (e) { failed++; console.log('  ✗', name, '—', e.message) }
}

console.log('PITCH-FIRST HELPERS')
t('pitch hợp lệ: 1 primary + 2 bench → ordered đúng thứ tự', () => {
  const r = validatePitchSelection('a', ['b', 'c'])
  assert.deepStrictEqual(r, { ok: true, ordered: ['a', 'b', 'c'] })
})
t('thiếu primary → lỗi', () => {
  assert.strictEqual(validatePitchSelection(null, []).ok, false)
  assert.strictEqual(validatePitchSelection('', []).error, 'pitch_primary_required')
})
t('bench chứa primary → lỗi', () => {
  const r = validatePitchSelection('a', ['a', 'b'])
  assert.strictEqual(r.ok, false)
  assert.strictEqual(r.error, 'pitch_bench_contains_primary')
})
t('bench > 2 → lỗi (tổng cộng tối đa 3 như cũ)', () => {
  const r = validatePitchSelection('a', ['b', 'c', 'd'])
  assert.strictEqual(r.ok, false)
  assert.strictEqual(r.error, 'pitch_bench_max_2')
})
t('bench trùng nhau → lỗi', () => {
  assert.strictEqual(validatePitchSelection('a', ['b', 'b']).error, 'pitch_bench_duplicate')
})
t('re-pitch gate: supplier đã declined bị chặn, còn lại eligible', () => {
  const cands = [{ clientId: 'a' }, { clientId: 'b' }, { clientId: 'c' }]
  const r = filterRepitchEligible(cands, new Set(['b']))
  assert.deepStrictEqual(r.eligible.map(x => x.clientId), ['a', 'c'])
  assert.deepStrictEqual(r.blocked.map(x => x.clientId), ['b'])
})
t('re-pitch gate: không ai declined → tất cả eligible', () => {
  const r = filterRepitchEligible([{ clientId: 'a' }], new Set())
  assert.strictEqual(r.eligible.length, 1)
  assert.strictEqual(r.blocked.length, 0)
})
t('pitch note: có highlights → nêu lý do; có sản phẩm → mở đầu theo nhu cầu', () => {
  const note = buildPitchNote({
    supplierName: 'Factory A',
    highlights: ['HACCP documented', 'MOQ flexible'],
    requirements: { products: 'dried mango' },
  })
  assert.ok(note.includes('dried mango'))
  assert.ok(note.includes('Factory A'))
  assert.ok(note.includes('HACCP documented'))
})
t('pitch note: không có dữ liệu AI → vẫn đọc được, không crash', () => {
  const note = buildPitchNote({ supplierName: 'Factory B' })
  assert.ok(note.includes('Factory B'))
})
t('isBuyerFacingItem: primary/option hiện, bench KHÔNG, null coi như option (dữ liệu cũ)', () => {
  assert.strictEqual(isBuyerFacingItem('primary'), true)
  assert.strictEqual(isBuyerFacingItem('option'), true)
  assert.strictEqual(isBuyerFacingItem('bench'), false)
  assert.strictEqual(isBuyerFacingItem(null), true)
})
t('isInterestedAction: declined=false, viewed_only=null, còn lại=true', () => {
  assert.strictEqual(isInterestedAction('declined'), false)
  assert.strictEqual(isInterestedAction('viewed_only'), null)
  assert.strictEqual(isInterestedAction(null), null)
  assert.strictEqual(isInterestedAction('requested_sample'), true)
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
