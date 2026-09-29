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

test('draft signature uses sender name/title placeholders and legal address', () => {
  const result = withCampaignSignature(oldCopy, null, { mode: 'draft' })
  assert.match(result, /\n\n\{\{sender_name\}\}\n\{\{sender_title\}\}, VEXIM GLOBAL CO\., LTD\n25\/6, Lane 51, Ngoa Long Street, Tay Tuu Ward, Hanoi, Vietnam$/)
  assert.doesNotMatch(result, /Best regards,\nVeximtrade\n/)
})

test('removes the website from the signature/body', () => {
  const result = withCampaignSignature(oldCopy, null, { mode: 'draft' })
  assert.doesNotMatch(result, /veximtrade\.com/i)
  assert.doesNotMatch(result, /https?:\/\//i)
})

test('send mode resolves the real authenticated sender and reviewed title', () => {
  const result = withCampaignSignature(oldCopy, 'Admin Person', { mode: 'send', senderTitle: 'Account Executive' })
  assert.match(result, /\n\nAdmin Person\nAccount Executive, VEXIM GLOBAL CO\., LTD/)
  assert.doesNotMatch(result, /Angela Divincenzo|Veximtrade|veximtrade\.com|\{\{sender_/)
})

test('never invents Veximtrade as a human sender when identity is unavailable', () => {
  const result = withCampaignSignature(oldCopy, null, { mode: 'draft' })
  assert.match(result, /\{\{sender_name\}\}/)
  assert.match(result, /\{\{sender_title\}\}/)
  assert.doesNotMatch(result, /Veximtrade/i)
  assert.doesNotMatch(result, /veximtrade\.com/i)
})

test('normalizes a model signature even when it omits its closing line', () => {
  const result = withCampaignSignature(
    'Hi buyer.\n\nVEXIM GLOBAL CO., LTD\nveximtrade.com',
    null,
    { mode: 'draft' },
  )
  assert.match(result, /\{\{sender_name\}\}\n\{\{sender_title\}\}, VEXIM GLOBAL CO\., LTD/)
  assert.doesNotMatch(result, /veximtrade\.com/i)
})
