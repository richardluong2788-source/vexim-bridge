const assert = require('assert')
const path = require('path')
const mod = require(path.join(process.argv[2] || '.', 'email-generator.js'))
const { withCampaignSignature } = mod

function test(name, fn) {
  fn()
  console.log(`  ✓ ${name}`)
}

console.log('CAMPAIGN SIGNATURE TESTS')
const oldCopy = [
  'Hi Angela,',
  '',
  'A short relevant message.',
  '',
  'Best regards,',
  'Veximtrade',
  'VEXIM GLOBAL CO., LTD',
  '25/6, Lane 51, Ngoa Long Street, Tay Tuu Ward, Hanoi, Vietnam',
  'veximtrade.com',
].join('\n')

test('replaces generic brand sign-off with actual sender', () => {
  const result = withCampaignSignature(oldCopy, 'Angela Divincenzo')
  assert.match(result, /Best regards,\nAngela Divincenzo\nVEXIM GLOBAL CO\., LTD/)
  assert.doesNotMatch(result, /Best regards,\nVeximtrade\n/)
})

test('removes the website from the signature/body', () => {
  const result = withCampaignSignature(oldCopy, 'Angela Divincenzo')
  assert.doesNotMatch(result, /veximtrade\.com/i)
  assert.doesNotMatch(result, /https?:\/\//i)
})

test('uses the authenticated sender name and no website at send time', () => {
  const result = withCampaignSignature(oldCopy, 'Admin Person')
  assert.match(result, /Best regards,\nAdmin Person\n/)
  assert.doesNotMatch(result, /Angela Divincenzo|Veximtrade|veximtrade\.com/)
})

test('never invents Veximtrade as a name when sender is unavailable', () => {
  const result = withCampaignSignature(oldCopy, null)
  assert.doesNotMatch(result, /Veximtrade/i)
  assert.doesNotMatch(result, /veximtrade\.com/i)
  assert.match(result, /Best regards,\nVEXIM GLOBAL CO\., LTD/)
})

test('normalizes a model signature even when it omits its closing line', () => {
  const result = withCampaignSignature(
    'Hi buyer.\n\nVEXIM GLOBAL CO., LTD\nveximtrade.com',
    'Angela Divincenzo',
  )
  assert.strictEqual((result.match(/Best regards,/g) || []).length, 1)
  assert.match(result, /Best regards,\nAngela Divincenzo/)
  assert.doesNotMatch(result, /veximtrade\.com/i)
})
