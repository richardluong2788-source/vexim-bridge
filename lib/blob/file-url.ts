/**
 * Builds a URL for downloading / streaming a file stored in the
 * *private* Vercel Blob store via our own authenticated proxy route
 * (`/api/files`).
 *
 * Background: the Blob store is configured as `private`, which means
 * `blob.url` returned by `put()` is NOT publicly accessible. Files
 * MUST be served through a server route that calls `get()` and
 * enforces authorization. This helper produces the href for that
 * route from the stored pathname.
 *
 * Legacy rows that pre-date the private migration may still hold an
 * absolute `https://...vercel-storage.com/...` URL — we pass those
 * through untouched so existing data keeps working (the URL won't
 * actually load on a private store, but this avoids crashes in UI).
 */
export function privateFileHref(
  pathOrUrl: string | null | undefined,
  opts?: { token?: string },
): string | null {
  if (!pathOrUrl) return null

  // Legacy absolute URL — return as-is.
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl

  const qs = new URLSearchParams({ path: pathOrUrl })
  if (opts?.token) qs.set("token", opts.token)
  return `/api/files?${qs.toString()}`
}
