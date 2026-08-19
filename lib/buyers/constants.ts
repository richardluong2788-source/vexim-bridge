// Shared constants for buyer <-> client assignment.
//
// This lives outside app/admin/buyers/actions.ts because that file has the
// "use server" directive, which only allows async function exports — a
// plain `export const` there breaks the entire module (and every other
// export in it) at build time.
export const MAX_BULK_ASSIGN_CLIENTS = 7
