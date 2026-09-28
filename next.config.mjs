import { optimizedImageRemotePatterns } from "./lib/images/hosts.mjs"

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // The connected Supabase project only exposes SUPABASE_ANON_KEY /
  // SUPABASE_PUBLISHABLE_KEY (server-only). App code (lib/supabase/client.ts,
  // server.ts, middleware.ts) expects NEXT_PUBLIC_SUPABASE_ANON_KEY so the
  // anon key is inlined into the browser bundle. Re-expose it here instead
  // of duplicating the fallback logic in every file.
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY,
  },
  images: {
    // Remote images used to be passed through untouched (`unoptimized: true`),
    // so a 4 MB supplier photo reached a US buyer's laptop at full size.
    // `lib/images/hosts.mjs` is the allow-list: only hosts listed there are
    // fetched + resized + re-encoded (AVIF/WebP), and every component guards
    // its <Image> with isOptimizableImageSrc(), so an unknown host degrades to
    // a plain <img> instead of a failed optimizer request.
    remotePatterns: optimizedImageRemotePatterns(),
    formats: ["image/avif", "image/webp"],
    // How long the optimizer may reuse its own copy of a source image. Supplier
    // photos are replaceable in place (the uploader does not add random
    // suffixes), so keep this short instead of the year-long default.
    minimumCacheTTL: 60 * 60,
  },
  // Ensure consistent URL handling for webhooks
  // trailingSlash: false means /api/webhooks/resend (no trailing slash)
  trailingSlash: false,
  // Disable automatic trailing slash redirects to prevent 307 issues with webhooks
  // Webhooks (like Resend) send POST to exact URL and don't follow redirects properly
  skipTrailingSlashRedirect: true,
}

export default nextConfig
