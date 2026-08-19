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
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY,
  },
  images: {
    unoptimized: true,
  },
  // Ensure consistent URL handling for webhooks
  // trailingSlash: false means /api/webhooks/resend (no trailing slash)
  trailingSlash: false,
  // Disable automatic trailing slash redirects to prevent 307 issues with webhooks
  // Webhooks (like Resend) send POST to exact URL and don't follow redirects properly
  skipTrailingSlashRedirect: true,
}

export default nextConfig
