// Client match tests — inquiry_products của buyer CHỦ ĐỘNG phải tham gia matching (095).
// Compile qua run.sh: client-scorer + client-types + types + fda-status (flat, không alias).
const assert = require('assert')

const OUT = process.argv[2] || '.'
const { scoreClientProduct, rankClientsForBuyer } = require(OUT + '/client-scorer.js')

let passed = 0, failed = 0
const t = (n, f) => { try { f(); passed++; console.log('  ✓', n) } catch (e) { failed++; console.log('  ✗', n, '—', e.message) } }

const buyerBase = {
  id: 'lead-1',
  hs_code: null,
  main_product: null,
  secondary_hs_codes: null,
  main_import_countries: 'United States',
  avg_teu_per_month: 3,
  origin_ports: null,
  destination_ports: 'Long Beach',
  container_types: '40HC Reefer',
  purchase_history: null,
  bol_description: null,
  priority_rating: 4,
}

const product = {
  id: 'prod-1',
  client_id: 'client-1',
  product_name: 'Frozen Monthong Durian Whole Peeled',
  category: 'Frozen Fruit',
  subcategory: 'Durian',
  description: 'Grade A Monthong durian IQF frozen whole peeled vacuum packed',
  hs_code: null,
  key_specifications: 'Grade A, IQF, BRIX 24 min',
  country_of_origin: 'Vietnam',
  min_unit_price: null, max_unit_price: null, currency: 'USD',
  monthly_capacity_units: 60000,
  moq_value: 1000, moq_unit: 'kg',
  lead_time: '2-4 weeks',
  incoterm: 'FOB',
  payment_terms: 'T/T 30/70',
  compliance_badges: ['HACCP'],
}

const trust = {
  client_id: 'client-1',
  company_name: 'Vina Fruits JSC',
  full_name: null,
  is_verified: true,
  fda_registration_number: '17234567890',
  fda_expires_at: '2027-06-30',
  fda_status: 'active',
  factoryScoreTotal: 82,
  dealsTotal: 4,
  dealsSwiftVerified: 3,
  hasCompanyProfile: true,
}

const specRaw = (buyer) =>
  scoreClientProduct(buyer, product, trust, { alreadyAttached: false }).matchBreakdown[1].rawScore

console.log('CLIENT MATCH — INQUIRY FEEDING (095)')
t('buyer không có text nào → spec = 0', () => {
  assert.strictEqual(specRaw({ ...buyerBase }), 0)
})
t('buyer CHỦ ĐỘNG: inquiry_products alone → spec > 0 (trước 095 là 0)', () => {
  const s = specRaw({ ...buyerBase, inquiry_products: 'frozen durian monthong pulp' })
  assert.ok(s > 0, 'spec=' + s)
})
t('inquiry KHÔNG liên quan → spec giữ nguyên', () => {
  const before = specRaw({ ...buyerBase, main_product: 'coffee beans' })
  const after = specRaw({ ...buyerBase, main_product: 'coffee beans', inquiry_products: 'office furniture' })
  assert.ok(after <= before, 'after=' + after + ' before=' + before)
})
t('HS fallback: không có HS cả hai phía → category match qua inquiry (cap 50)', () => {
  const buyer = { ...buyerBase, inquiry_products: 'cashew kernels w240' }
  const cashew = { ...product, product_name: 'Cashew Kernels W240', category: 'Nuts', subcategory: 'Cashew', description: 'W240 whole cashew kernels', key_specifications: 'W240' }
  const hs = scoreClientProduct(buyer, cashew, trust, { alreadyAttached: false }).matchBreakdown[0]
  assert.ok(hs.rawScore > 0 && hs.rawScore <= 50, 'hs=' + hs.rawScore)
})
t('ranking: client khớp inquiry xếp trên client không khớp (không có HS)', () => {
  const cashewClient = {
    ...product, id: 'prod-2', client_id: 'client-2',
    product_name: 'Office Chairs', category: 'Furniture', subcategory: 'Chairs',
    description: 'mesh office chairs bulk', key_specifications: 'mesh, adjustable',
  }
  const trust2 = { ...trust, client_id: 'client-2' }
  const buyer = { ...buyerBase, inquiry_products: 'frozen durian monthong' }
  const top = rankClientsForBuyer(buyer, [cashewClient, product], new Map([['client-1', trust], ['client-2', trust2]]), new Set())
  assert.strictEqual(top[0].clientId, 'client-1')
})

console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
