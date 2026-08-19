/** @type {import('next').NextConfig} */
const nextConfig = {
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
