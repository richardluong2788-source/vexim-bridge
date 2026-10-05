// Deterministic LR product/category/industry matching — product text is primary;
// industry is held for discovery review; HS is reinforcement only.
const assert = require('assert')
const path = require('path')
const base = process.argv[2] || '.'
const { matchBuyerToCampaign, normalizeCampaignHsCodes } = require(path.join(base, 'product-industry-matcher.js'))

let passed = 0
let failed = 0
function test(name, fn) {
  try {
    fn()
    passed += 1
    console.log('  ✓', name)
  } catch (error) {
    failed += 1
    console.log('  ✗', name, '—', error.message)
  }
}

const campaign = (overrides = {}) => ({
  target_product_name: 'frozen mango',
  product_category: 'Food & Beverage',
  target_industries: ['Food & Beverage'],
  target_hs_codes: [],
  ...overrides,
})
const buyer = (overrides = {}) => ({
  industry: 'Food & Beverage',
  main_product: null,
  product_keywords: [],
  hs_code: null,
  hs_codes: [],
  secondary_hs_codes: null,
  bol_description: null,
  ...overrides,
})

test('specific product phrase in LR main_product → strong product match', () => {
  const result = matchBuyerToCampaign(campaign(), buyer({ main_product: 'Frozen Mango Chunks IQF' }))
  assert.strictEqual(result.status, 'matched')
  assert.strictEqual(result.level, 'product')
  assert.ok(result.confidence >= 90)
  assert.strictEqual(result.requiresHumanReview, false)
  assert.match(result.reason, /main_product/)
})

test('known product synonym can match a specific product without using industry', () => {
  const result = matchBuyerToCampaign(
    campaign({ target_product_name: 'prawns', product_category: null, target_industries: ['Seafood'] }),
    buyer({ industry: 'Seafood', product_keywords: ['Frozen shrimp'] }),
  )
  assert.strictEqual(result.level, 'product')
  assert.strictEqual(result.requiresHumanReview, false)
})

test('category evidence yields category-level match, not specific product', () => {
  const result = matchBuyerToCampaign(
    campaign({ target_product_name: 'pangasius', product_category: 'seafood', target_industries: ['Seafood'] }),
    buyer({ industry: 'Seafood', product_keywords: ['Frozen shrimp'] }),
  )
  assert.strictEqual(result.level, 'category')
  assert.match(result.reason, /cấp danh mục/)
  assert.strictEqual(result.requiresHumanReview, false)
})

test('inconsistent product/category campaign target is rejected rather than guessed', () => {
  const result = matchBuyerToCampaign(
    campaign({ target_product_name: 'frozen mango', product_category: 'seafood' }),
    buyer({ main_product: 'Frozen mango' }),
  )
  assert.strictEqual(result.status, 'no_match')
  assert.match(result.reason, /target is inconsistent/i)
})

test('product match outranks a broad category hit', () => {
  const result = matchBuyerToCampaign(
    campaign(),
    buyer({ main_product: 'Frozen mango', product_keywords: ['Frozen seafood', 'rice'] }),
  )
  assert.strictEqual(result.level, 'product')
})

test('industry-only match is held for AE review and explicitly is not product-demand evidence', () => {
  const result = matchBuyerToCampaign(
    campaign({ target_product_name: 'frozen mango', product_category: 'food', target_industries: ['Food & Beverage'] }),
    buyer({ main_product: null, product_keywords: [], hs_codes: [] }),
  )
  assert.strictEqual(result.status, 'matched')
  assert.strictEqual(result.level, 'industry')
  assert.strictEqual(result.confidence, 45)
  assert.strictEqual(result.requiresHumanReview, true)
  assert.match(result.reason, /không được kết luận buyer có nhu cầu sản phẩm mục tiêu/)
})

test('unrelated LR products are not rescued by a matching industry', () => {
  const result = matchBuyerToCampaign(
    campaign({ target_product_name: 'frozen mango', product_category: null, target_industries: ['Food & Beverage'] }),
    buyer({ product_keywords: ['coffee beans', 'cashew kernels'] }),
  )
  assert.strictEqual(result.status, 'no_match')
  assert.strictEqual(result.level, null)
  assert.match(result.reason, /industry đơn lẻ không đủ/)
})

test('HS code alone never produces product/category match', () => {
  const result = matchBuyerToCampaign(
    campaign({ target_product_name: 'frozen mango', product_category: 'fruit', target_hs_codes: ['080450'] }),
    buyer({ main_product: null, product_keywords: [], hs_codes: ['080450'] }),
  )
  assert.strictEqual(result.status, 'matched')
  assert.strictEqual(result.level, 'industry')
  assert.strictEqual(result.requiresHumanReview, true)
  assert.doesNotMatch(result.reason, /product match|category match/i)
})

test('HS code only reinforces matching LR product text', () => {
  const baseBuyer = buyer({ main_product: 'Frozen mango chunks', hs_codes: [] })
  const withoutHs = matchBuyerToCampaign(campaign({ target_hs_codes: ['080450'] }), baseBuyer)
  const withHs = matchBuyerToCampaign(campaign({ target_hs_codes: ['080450'] }), buyer({ ...baseBuyer, hs_codes: ['080450'] }))
  assert.strictEqual(withHs.level, 'product')
  assert.ok(withHs.confidence > withoutHs.confidence)
  assert.match(withHs.reason, /củng cố/)
})

test('HS chapter conflict preserves the text match but holds it for AE review', () => {
  const result = matchBuyerToCampaign(
    campaign({ target_hs_codes: ['080450'] }),
    buyer({ main_product: 'Frozen mango chunks', hs_codes: ['090111'] }),
  )
  assert.strictEqual(result.level, 'product')
  assert.strictEqual(result.requiresHumanReview, true)
  assert.match(result.reason, /khác chương/)
})

test('industry mismatch cannot silently override an otherwise strong product match', () => {
  const result = matchBuyerToCampaign(
    campaign({ target_industries: ['Food & Beverage'] }),
    buyer({ industry: 'Pharmaceuticals', main_product: 'Frozen mango' }),
  )
  assert.strictEqual(result.level, 'product')
  assert.strictEqual(result.requiresHumanReview, true)
  assert.match(result.reason, /không khớp industry mục tiêu/)
})

test('industry-only campaign remains discovery-only even when LR lists other products', () => {
  const result = matchBuyerToCampaign(
    campaign({ target_product_name: null, product_category: null, target_industries: ['Food & Beverage'] }),
    buyer({ product_keywords: ['office furniture'] }),
  )
  assert.strictEqual(result.level, 'industry')
  assert.strictEqual(result.requiresHumanReview, true)
})

test('HS parser strips punctuation, deduplicates, and reports malformed codes', () => {
  const result = normalizeCampaignHsCodes(['03.06.17', '030617', 'x', '12345678901'])
  assert.deepStrictEqual(result.codes, ['030617'])
  assert.deepStrictEqual(result.invalid, ['x', '12345678901'])
})

test('legacy industry labels normalize to the canonical campaign industry', () => {
  const result = matchBuyerToCampaign(
    campaign({ target_product_name: null, product_category: null, target_industries: ['Textiles & Garments'] }),
    buyer({ industry: 'Textiles', main_product: null, product_keywords: [] }),
  )
  assert.strictEqual(result.level, 'industry')
  assert.strictEqual(result.requiresHumanReview, true)
})

test('no product or industry evidence → no match', () => {
  const result = matchBuyerToCampaign(campaign({ target_industries: ['Seafood'] }), buyer({ industry: 'Other' }))
  assert.strictEqual(result.status, 'no_match')
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
