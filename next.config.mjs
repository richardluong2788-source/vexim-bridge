/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // The project only exposes SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY (no NEXT_PUBLIC_ prefix),
    // but lib/supabase/client.ts runs in the browser and needs a publicly inlined value.
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "",
  },
  typescript: {
    ignoreBuildErrors: true,
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
