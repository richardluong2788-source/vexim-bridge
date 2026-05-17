/**
 * Convert a private Vercel Blob URL to a proxied URL that can be displayed
 * Private blobs require authentication, so we proxy them through our API
 */
export function getProxiedBlobUrl(blobUrl: string): string {
  if (!blobUrl) return ""
  
  // If it's already a proxied URL or not a blob URL, return as-is
  if (blobUrl.includes("/api/blob") || !blobUrl.includes("blob.vercel-storage.com")) {
    return blobUrl
  }
  
  // Proxy through our API route
  return `/api/blob?url=${encodeURIComponent(blobUrl)}`
}

/**
 * Check if URL is a Vercel Blob URL
 */
export function isBlobUrl(url: string): boolean {
  return url.includes("blob.vercel-storage.com")
}
