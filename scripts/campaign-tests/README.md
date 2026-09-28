# Campaign Engine B1 — Pure-function tests

Không cần DB, không cần AI key thật, không cần test framework. **150 assertions** across the pure campaign, copy QA, country-gate, scheduling, and supporting suites. Modules are compiled separately and run with Node.

## Chạy tất cả

```bash
bash scripts/campaign-tests/run.sh
```

## Có gì trong đây

| File | Phủ | Assertions |
|---|---|---:|
| `email-signature.test.js` | Signature dùng sender thật, bỏ website, không tự bịa sender | 5 |
| `country-validation.test.js` | Company country và importing country khớp/missing/conflict cho US pilot | 6 |
| `state-machine.test.js` | State transitions, hold/resume (including step-1 country review), STOP, weekend-skipping business-day schedule | 37 |
| `qa-suppression.test.js` | Banned copy, CTA/word count, exact opt-out placement, provenance, signature, and suppression rules | 38 |
| `reply-rules.test.js` | OPT_OUT / OUT_OF_OFFICE / NOT_INTERESTED / WRONG_CONTACT / NOT_NOW và human review | 12 |
| `followup-gate.test.js` | Defensive follow-up gate, AI fail/output errors, confidence hold | 7 |
| `sending-window.test.js` | Sending windows/timezone boundaries and auto-send gate | 19 |
| `pitch.test.js` | Pitch helper rules | 21 |
| `client-match.test.js` | Client matching from buyer inquiries | 5 |
