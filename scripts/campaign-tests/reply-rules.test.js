const ri = require((process.argv[2] || '.') + '/reply-intent.js')
const assert = require('assert')
let passed = 0, failed = 0
;(async () => {
  const cases = [
    ['Please remove me from your list.', 'OPT_OUT'],
    ['Take me off this email list immediately', 'OPT_OUT'],
    ['I am out of office until Monday with limited access to email.', 'OUT_OF_OFFICE'],
    ['This is an automatic reply: I am on annual leave, returning on 5 Oct.', 'OUT_OF_OFFICE'],
    ['No thanks, we are all set with our current supplier.', 'NOT_INTERESTED'],
    ['We are not interested at this time.', 'NOT_INTERESTED'],
    ['I am not the right person for this, please contact john@acme.com', 'WRONG_CONTACT'],
    ['You have the wrong person — I am not responsible for purchasing.', 'WRONG_CONTACT'],
    ['Not at the moment, maybe later next quarter. Circle back then.', 'NOT_NOW'],
    ['We are not looking for new suppliers right now.', 'NOT_INTERESTED'],
  ]
  for (const [text, expect] of cases) {
    const r = await ri.classifyCampaignReply({ replyText: text })
    if (r.intent !== expect) { failed++; console.log('  ✗', JSON.stringify(text.slice(0, 40)), '→ got', r.intent, 'expect', expect, '|', r.reason) }
    else { passed++; console.log('  ✓', JSON.stringify(text.slice(0, 40)), '→', r.intent, `(source: ${r.source}, stops: ${r.stopsSequence}, pause: ${r.isPauseOnly})`) }
  }
  // Ambiguous → AI stub trả UNKNOWN → requiresHuman
  const r2 = await ri.classifyCampaignReply({ replyText: 'Thanks for reaching out.' })
  if (r2.intent === 'UNKNOWN' && r2.requiresHuman) { passed++; console.log('  ✓ ambiguous → UNKNOWN + human review') } else { failed++; console.log('  ✗ ambiguous handling:', r2) }
  // Empty
  const r3 = await ri.classifyCampaignReply({ replyText: '  ' })
  if (r3.intent === 'UNKNOWN' && r3.requiresHuman) { passed++; console.log('  ✓ empty → UNKNOWN + human review') } else { failed++; console.log('  ✗ empty handling:', r3) }
  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed ? 1 : 0)
})()
