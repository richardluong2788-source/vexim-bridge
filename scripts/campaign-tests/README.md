# Campaign Engine B1 — Pure-function tests

Không cần DB, không cần AI key, không cần test framework. Các module pure
(state-machine, email-qa, getStopReason, reply-intent rules layer) được compile
riêng rồi chạy assertion bằng node thuần.

## Chạy tất cả

```bash
bash scripts/campaign-tests/run.sh
```

## Có gì trong đây

| File | Phủ | Số test |
|---|---|---|
| `state-machine.test.js` | 25 phép chuyển state (happy path, reply routing 7 intent, STOP, pause/resume, human-review hold, terminal không hồi sinh) | 25 |
| `qa-suppression.test.js` | Email QA (link/FDA claim/duplicate/length/opt-out/spam), suppression rules (unsub/bounce/complaint/missing email) | 14 |
| `reply-rules.test.js` | Rule layer của classifier: OPT_OUT / OUT_OF_OFFICE (pause) / NOT_INTERESTED / WRONG_CONTACT / NOT_NOW + ambiguous→UNKNOWN + empty→human review (AI được stub) | 12 |
