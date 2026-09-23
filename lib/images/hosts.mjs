/**
 * Which remote images may go through the Next.js image optimizer.
 *
 * `next.config.mjs` builds `images.remotePatterns` from this list and the
 * client/server components ask `isOptimizableImageSrc()` before rendering
 * `next/image`. Keeping both sides in one file is the point: a source that
 * the optimizer would reject (`images.remotePatterns` mismatch => 500 on the
 * image request) is never handed to it in the first place, so an unexpected
 * host degrades to a plain <img> instead of a broken image.
 *
 * Upload paths that matter today: Vercel Blob (product photos, via
 * `app/api/products/upload-images`) and Supabase Storage (profile media).
 */

/** Host suffixes served by the optimizer (matched as the host or any subdomain). */
export const OPTIMIZED_IMAGE_HOST_SUFFIXES = [
  // Vercel Blob stores (public + private store hostnames)
  "public.blob.vercel-storage.com",
  "private.blob.vercel-storage.com",
  // Supabase project hosts: storage buckets and the image/API endpoint
  "supabase.co",
  "supabase.in",
]

/** Patterns in the shape Next expects for `images.remotePatterns`. */
export function optimizedImageRemotePatterns() {
  return OPTIMIZED_IMAGE_HOST_SUFFIXES.map((hostname) => ({
    protocol: "https",
    hostname: `**.${hostname}`,
  }))
}

/** Formats the optimizer cannot round-trip without damaging the asset. */
const NOT_OPTIMIZED_EXT = /\.(svg|gif|ico|bmp)(\?|#|$)/i

function hostIsAllowed(hostname) {
  const host = String(hostname || "").toLowerCase()
  if (!host) return false
  return OPTIMIZED_IMAGE_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`)
  )
}

/**
 * True when `src` can safely be rendered with `next/image`.
 *
 * Rejects: data/protocol-relative URLs, our own authenticated file proxy
 * (`/api/files?...` needs the caller's cookies, which the optimizer fetch does
 * not carry), signed blob URLs carrying a `token` (the optimizer would cache a
 * URL past its expiry), and vector/animated formats.
 */
export function isOptimizableImageSrc(src, siteOrigin) {
  if (typeof src !== "string" || !src) return false
  if (src.startsWith("data:") || src.startsWith("blob:")) return false
  if (NOT_OPTIMIZED_EXT.test(src)) return false

  if (src.startsWith("//")) return false

  if (src.startsWith("/")) {
    return !src.startsWith("/api/")
  }

  let url
  try {
    url = new URL(src)
  } catch {
    return false
  }
  if (url.protocol !== "https:") return false
  if (url.searchParams.has("token")) return false
  if (siteOrigin && url.origin === siteOrigin) return true
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return false
  return hostIsAllowed(url.hostname)
}
