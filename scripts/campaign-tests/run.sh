#!/usr/bin/env bash
# Compile các module pure của campaign engine rồi chạy test bằng node thuần.
# Usage: bash scripts/campaign-tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

OUT=$(mktemp -d)
pnpm exec tsc lib/campaign/constants.ts lib/campaign/state-machine.ts lib/campaign/types.ts \
  lib/campaign/email-qa.ts lib/campaign/reply-intent.ts lib/campaign/followup-gate.ts \
  lib/campaign/country-validation.ts \
  --outDir "$OUT" --module commonjs --target es2020 --moduleResolution node --skipLibCheck

# Signature normalization (owner name at generation, authenticated sender at send).
pnpm exec tsc lib/campaign/email-generator.ts lib/campaign/constants.ts lib/campaign/types.ts \
  --outDir "$OUT/signature" --module commonjs --target es2020 --moduleResolution node --skipLibCheck --esModuleInterop

# pitch-first helpers (093) — pure, không import gì. OUT/pitch để tránh
# rootDir lệch (file này ở lib/buyers, còn lại ở lib/campaign).
pnpm exec tsc lib/buyers/pitch-helpers.ts --outDir "$OUT/pitch" --module commonjs --target es2020 --moduleResolution node --skipLibCheck

# client match engine (095) — flat copy để né path alias "@/lib/fda/status".
# types.ts gốc không pure (zod + supabase) → stub chỉ chứa FactorBreakdown,
# thứ duy nhất client-scorer/client-types cần từ nó.
mkdir -p "$OUT/match"
cp lib/matching/client-scorer.ts lib/matching/client-types.ts "$OUT/match/"
cp lib/fda/status.ts "$OUT/match/fda-status.ts"
cat > "$OUT/match/types.ts" <<'TYPES'
interface FactorBreakdown {
  factor: string
  rawScore: number
  weight: number
  weightedScore: number
  details?: string
}
export { FactorBreakdown }
TYPES
sed -i 's|from "@/lib/fda/status"|from "./fda-status"|' "$OUT/match/client-scorer.ts"
sed -i '/import "server-only"/d' "$OUT/match/fda-status.ts"
pnpm exec tsc "$OUT"/match/client-scorer.ts --outDir "$OUT/match/out" --module commonjs --target es2020 --moduleResolution node --skipLibCheck --esModuleInterop

# Stub 'ai' module: rule-confident paths không gọi AI; AI path trả UNKNOWN.
mkdir -p "$OUT/node_modules/ai"
cat > "$OUT/node_modules/ai/package.json" <<PKG
{"name":"ai","version":"0.0.0","main":"index.js"}
PKG
cat > "$OUT/node_modules/ai/index.js" <<'STUB'
exports.Output = { object: ({ schema }) => schema }
exports.generateText = async (args) => {
  if (process.env.CAMPAIGN_TEST_GENERATOR === "1") {
    global.__campaignGenerationPrompt = `${args.system || ''}\n${args.prompt || ''}`
    return { experimental_output: {
      subject_en: "Vietnam sourcing for frozen mango",
      content_en: `Hi Angela,\n\nI came across Acme Foods while looking into companies in the Food & Beverage space. If you handle sourcing, you may already know that looking at a new source involves more than finding a manufacturer. Product specifications, available company information, export records, samples, quotations, and relevant import requirements all need consideration. The early work is often in screening, so the buyer can decide which conversations are worth pursuing.\n\nVeximtrade handles initial sourcing groundwork on the Vietnam side. We identify relevant manufacturers, review available evidence about capacity and export history, and consider product fit against relevant import requirements. We can also coordinate communication if both sides want to explore samples or quotations. The buyer stays in control of whether to continue, and no supplier is treated as a fit before review.\n\nAre you currently looking for additional supply of frozen mango?\n\nIf you'd rather not hear from me, just reply 'no thanks' and I won't contact you again.\n\nBest regards,\nAngela Divincenzo\nAccount Executive, VEXIM GLOBAL CO., LTD\n25/6, Lane 51, Ngoa Long Street, Tay Tuu Ward, Hanoi, Vietnam`,
      content_vi: "Bản dịch tiếng Việt dùng để AE duyệt.",
    } }
  }
  return { experimental_output: { intent: "UNKNOWN", confidence: 0, reasoning: "stub" } }
}
STUB
ln -sfn "$(pwd)/node_modules/zod" "$OUT/node_modules/zod"

# suppression.getStopReason: bỏ phần DB (server-only + admin client)
sed 's|import "server-only"||; s|import { createAdminClient } from "@/lib/supabase/admin"||' \
  lib/campaign/suppression.ts | sed '/DB wrapper/,$d' > "$OUT/suppression-pure.ts"
# sending-window: cut phần DB wrapper (từ dòng import createAdminClient trở xuống)
sed '/^import { createAdminClient } from "@\/lib\/supabase\/admin"$/,$d' \
  lib/campaign/sending-window.ts > "$OUT/sending-window-pure.ts"
pnpm exec tsc "$OUT/sending-window-pure.ts" --outDir "$OUT" --module commonjs --target es2020 --moduleResolution node --skipLibCheck
pnpm exec tsc "$OUT/suppression-pure.ts" --outDir "$OUT/pure" --module commonjs --target es2020 --moduleResolution node --skipLibCheck
cp "$OUT/pure/suppression-pure.js" "$OUT/suppression-pure.js"
sed -i '/require("server-only")/d; /require("@\/lib\/supabase\/admin")/d' "$OUT/suppression-pure.js" || true

fail=0
node scripts/campaign-tests/email-signature.test.js "$OUT/signature" || fail=1
node scripts/campaign-tests/email-generator.test.js "$OUT" || fail=1
node scripts/campaign-tests/country-validation.test.js "$OUT" || fail=1
node -e "
const sm = require('$OUT/state-machine.js'); const assert = require('assert');
// quick sanity — full suites below
assert(sm.onReplyClassified('waiting_reply', {intent:'OPT_OUT', confidence:0.98, requiresHuman:false}).to === 'suppressed');
" || fail=1
node scripts/campaign-tests/state-machine.test.js "$OUT" || fail=1
node scripts/campaign-tests/qa-suppression.test.js "$OUT" || fail=1
node scripts/campaign-tests/reply-rules.test.js "$OUT" || fail=1
node scripts/campaign-tests/followup-gate.test.js "$OUT" || fail=1
node scripts/campaign-tests/sending-window.test.js "$OUT" || fail=1
node scripts/campaign-tests/pitch.test.js "$OUT/pitch" || fail=1
node scripts/campaign-tests/client-match.test.js "$OUT/match/out" || fail=1
exit $fail
