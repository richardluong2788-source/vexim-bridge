/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Prevent trailing slash redirects for API routes (307 redirect breaks webhooks)
  skipTrailingSlashRedirect: true,
  // Skip URL normalization in middleware so webhook routes are not modified
  skipMiddlewareUrlNormalize: true,
}

export default nextConfig
