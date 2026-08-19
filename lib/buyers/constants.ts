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

// Vexim's shortlist rule: a single buyer should be introduced to a small
// slate of exactly 3 competing clients so the buyer has a real choice,
// instead of being locked to whichever AE/client claims it first. This is
// the hard ceiling on how many DISTINCT clients may have an active
// opportunity for the same lead_id at once. Enforced in
// lib/matching/orchestrator.ts (acceptInboxItem) and
// app/admin/buyers/actions.ts (assignBuyerToClients).
export const MAX_CLIENTS_PER_BUYER = 3
