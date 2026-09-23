import { revalidateTag, updateTag } from "next/cache"

/**
 * Cache tag for every read that feeds the public buyer catalog
 * (`/products`, `/products/[id]` and their metadata).
 */
export const CATALOG_CACHE_TAG = "catalog"

/**
 * Bust the catalog's cached reads after anything a buyer can see changed:
 * product create/update/delete, or a supplier publishing/unpublishing their
 * profile.
 *
 * Without this, a supplier saving a product would wait out the 5-minute
 * `revalidate` window and conclude the form did not work.
 *
 * Deliberately non-fatal: `revalidateTag` throws when it runs outside a
 * render/mutation context (a cron job, a script, a build). Those callers are
 * already covered by the revalidation window, and a save must never fail
 * because cache bookkeeping was impossible.
 */
export function revalidateCatalog(): void {
  try {
    // Preferred inside a Server Action: `updateTag` expires the tagged entries
    // immediately, so the redirect that follows the save already renders fresh
    // data (read-your-own-writes).
    updateTag(CATALOG_CACHE_TAG)
  } catch {
    try {
      // `updateTag` throws outside an action (route handlers, cron). "max" keeps
      // serving the stale entry while it is revalidated instead of failing.
      revalidateTag(CATALOG_CACHE_TAG, "max")
    } catch {
      // no-op on purpose
    }
  }
}
