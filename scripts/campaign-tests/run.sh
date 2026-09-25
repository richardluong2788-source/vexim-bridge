#!/usr/bin/env bash
# Compile các module pure của campaign engine rồi chạy test bằng node thuần.
# Usage: bash scripts/campaign-tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

OUT=$(mktemp -d)
pnpm exec tsc lib/campaign/constants.ts lib/campaign/state-machine.ts lib/campaign/types.ts \
  lib/campaign/email-qa.ts lib/campaign/reply-intent.ts lib/campaign/followup-gate.ts \
  --outDir "$OUT" --module commonjs --target es2020 --moduleResolution node --skipLibCheck

# Stub 'ai' module: rule-confident paths không gọi AI; AI path trả UNKNOWN.
mkdir -p "$OUT/node_modules/ai"
cat > "$OUT/node_modules/ai/package.json" <<PKG
{"name":"ai","version":"0.0.0","main":"index.js"}
PKG
cat > "$OUT/node_modules/ai/index.js" <<STUB
exports.Output = { object: ({ schema }) => schema }
exports.generateText = async () => ({ experimental_output: { intent: "UNKNOWN", confidence: 0, reasoning: "stub" } })
STUB
ln -sfn "$(pwd)/node_modules/zod" "$OUT/node_modules/zod"

# suppression.getStopReason: bỏ phần DB (server-only + admin client)
sed 's|import "server-only"||; s|import { createAdminClient } from "@/lib/supabase/admin"||' \
  lib/campaign/suppression.ts | sed '/DB wrapper/,$d' > "$OUT/suppression-pure.ts"
# sending-window: cut phần DB wrapper (từ dòng import createAdminClient trở xuống)
sed '/^import { createAdminClient } from "@\/lib\/supabase\/admin"$/,$d' \
  lib/campaign/sending-window.ts > "$OUT/sending-window-pure.ts"
pnpm exec tsc "$OUT/suppression-pure.ts" --outDir "$OUT/pure" --module commonjs --target es2020 --moduleResolution node --skipLibCheck
cp "$OUT/pure/suppression-pure.js" "$OUT/suppression-pure.js"
sed -i '/require("server-only")/d; /require("@\/lib\/supabase\/admin")/d' "$OUT/suppression-pure.js" || true

fail=0
node -e "
const sm = require('$OUT/state-machine.js'); const assert = require('assert');
// quick sanity — full suites below
assert(sm.onReplyClassified('waiting_reply', {intent:'OPT_OUT', confidence:0.98, requiresHuman:false}).to === 'suppressed');
" || fail=1
node scripts/campaign-tests/state-machine.test.js "$OUT" || fail=1
node scripts/campaign-tests/qa-suppression.test.js "$OUT" || fail=1
node scripts/campaign-tests/reply-rules.test.js "$OUT" || fail=1
node scripts/campaign-tests/followup-gate.test.js "$OUT" || fail=1
node scripts/campaign-tests/sending-window.test.js "$OUT/pure" || fail=1
node scripts/campaign-tests/sending-window.test.js "$OUT" || fail=1
exit $fail
