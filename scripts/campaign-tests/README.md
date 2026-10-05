# Campaign Engine B1 — Pure-function tests

Không cần DB, không cần AI key thật, không cần test framework. **202 assertions** across the pure campaign, buyer-matching, copy QA, country-gate, scheduling, and supporting suites. Modules are compiled separately and run with Node.

## Chạy tất cả

```bash
bash scripts/campaign-tests/run.sh
```

## Có gì trong đây

| File | Phủ | Assertions |
|---|---|---:|
| `email-signature.test.js` | Signature dùng sender thật, bỏ website, không tự bịa sender | 5 |
| `email-generator.test.js` | Match-level copy boundaries, HS/research redaction, and per-step narrative references | 7 |
| `country-validation.test.js` | Matches the LR buyer-country field against the campaign's selected target country | 9 |
| `product-industry-match.test.js` | Product/category-first matching, industry-only AE review, HS reinforcement/conflict, target consistency, and no-match cases | 41 |
| `state-machine.test.js` | State transitions, human reply hold/resume, STOP, weekend-skipping business-day schedule | 37 |
| `qa-suppression.test.js` | Banned copy, CTA/word count, exact opt-out placement, provenance, signature, natural wording, and suppression rules | 39 |
| `reply-rules.test.js` | OPT_OUT / OUT_OF_OFFICE / NOT_INTERESTED / WRONG_CONTACT / NOT_NOW và human review | 12 |
| `followup-gate.test.js` | Defensive follow-up gate, AI fail/output errors, confidence hold | 7 |
| `sending-window.test.js` | Sending windows/timezone boundaries and auto-send gate | 19 |
| `pitch.test.js` | Pitch helper rules | 21 |
| `client-match.test.js` | Client matching from buyer inquiries | 5 |
