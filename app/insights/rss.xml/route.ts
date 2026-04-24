import { siteConfig } from "@/lib/site-config"
import { listPublishedPosts } from "@/lib/insights/queries"
import { getLocale } from "@/lib/i18n/server"
import type { PostLocale } from "@/lib/insights/types"

export const revalidate = 1800 // 30 minutes

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export async function GET() {
  const locale = (await getLocale()) as PostLocale
  const { posts } = await listPublishedPosts({ locale, limit: 30 })
  const base = siteConfig.url

  const title =
    locale === "vi"
      ? `${siteConfig.name} — Insights`
      : `${siteConfig.name} — Insights`
  const description =
    locale === "vi"
      ? "Cẩm nang FDA, tìm buyer Mỹ, SWIFT và case study xuất khẩu."
      : "FDA playbooks, US buyer outreach, SWIFT and export case studies."

  const items = posts
    .map((p) => {
      const url = `${base}/insights/${p.slug}`
      const pubDate = p.published_at
        ? new Date(p.published_at).toUTCString()
        : new Date().toUTCString()
      return `
    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeXml(p.category)}</category>
      ${p.excerpt ? `<description>${escapeXml(p.excerpt)}</description>` : ""}
    </item>`
    })
    .join("")

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${base}/insights</link>
    <description>${escapeXml(description)}</description>
    <language>${locale === "vi" ? "vi-VN" : "en-US"}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${base}/insights/rss.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=1800, s-maxage=1800",
    },
  })
}
