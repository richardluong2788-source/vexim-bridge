// Shared constants for buyer <-> client assignment.
//
// This lives outside app/admin/buyers/actions.ts because that file has the
// "use server" directive, which only allows async function exports — a
// plain `export const` there breaks the entire module (and every other
// export in it) at build time.
export const MAX_BULK_ASSIGN_CLIENTS = 7

// Max number of clients (Vietnamese factories/exporters) that can be
// assigned to a single AE/account manager at once. Keeps each AE's client
// portfolio manageable as the buyer/client base scales into the hundreds.
// Enforced in app/admin/clients/account-manager-actions.ts.
export const MAX_CLIENTS_PER_AE = 7

// Max number of ACTIVE (not won/lost) buyer opportunities a single client
// can have open at once. Once a client hits this cap, no new buyer can be
// assigned to them until one of their existing opportunities moves to
// won or lost. Enforced in app/admin/buyers/actions.ts (assignOneClient).
export const MAX_ACTIVE_BUYERS_PER_CLIENT = 30

// Per-AE workload guardrails for MANUAL buyer assignment (admin assign /
// AE-to-AE transfer). The AI scorer already penalises workload for
// automatic matching (see calculateWorkloadScore in lib/matching/scorer.ts:
// 11–15 in-progress opps = 40/100, 16–20 = 20, 20+ = 10); manual
// overrides must not silently pile more buyers onto an overloaded AE.
//
// Counting unit = active pre-opportunity engagements (buyer_engagements
// not in converted/dropped), which is what an AE actually has to work
// through before an opportunity exists.
//
// SOFT_WARN: the UI shows a warning but still allows the assign (the
// admin takes responsibility). HARD_CAP: the assign is blocked; only
// super_admin can tick "override capacity" to force it.
export const AE_WORKLOAD_SOFT_WARN = 12
export const AE_WORKLOAD_HARD_CAP = 15

// When an admin manually assigns a buyer to an AE whose AI score is more
// than this many points BELOW the top AI-recommended AE (or who has no AI
// score at all), a reason is mandatory — the override is exactly the
// decision worth auditing.
export const MANUAL_ASSIGN_REASON_SCORE_GAP = 15

// How long manually-returned / admin-assigned shared-inbox items stay
// claimable before they expire (mirrors the AI pipeline's 7 days).
export const MANUAL_INBOX_ITEM_TTL_DAYS = 7
