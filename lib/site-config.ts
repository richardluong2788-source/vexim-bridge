/**
 * Centralised site-wide constants. Imported by landing page, SEO
 * metadata, JSON-LD, sitemap, robots, and email templates.
 */

function resolveBaseUrl(): string {
  // Prefer an explicit canonical URL. Fall back to Vercel's runtime URL
  // so previews work, then localhost for dev.
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/$/, "")

  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL ?? process.env.VERCEL_URL
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`

  return "http://localhost:3000"
}

export const siteConfig = {
  name: "Vexim Bridge",
  shortName: "VXB",
  legalName: "Vexim Bridge JSC",
  domain: "veximbridge.com",
  url: resolveBaseUrl(),
  tagline: "Cầu nối xuất khẩu Việt – Mỹ",
  description:
    "Vexim Bridge là sàn B2B kết nối nhà sản xuất Việt Nam với người mua Mỹ. Tự động kiểm tra giấy phép FDA, xác thực chuyển tiền quốc tế hai lớp, và theo dõi đơn hàng minh bạch từ chào giá đến khi nhận tiền USD.",
  descriptionEn:
    "Vexim Bridge is a B2B platform connecting Vietnamese manufacturers with US buyers. Automatic FDA license checks, two-step international payment verification, and transparent order tracking from quote to USD payout.",
  keywords: [
    "xuất khẩu Việt Nam sang Mỹ",
    "nền tảng B2B xuất khẩu",
    "FDA compliance Việt Nam",
    "SWIFT wire transfer verification",
    "Vexim Bridge",
    "export platform Vietnam USA",
    "nhà sản xuất Việt Nam",
    "người mua Mỹ",
    "pipeline xuất khẩu",
    "tuân thủ FDA",
  ],
  ogImage: "/landing/hero-dashboard.jpg",
  contact: {
    email: "hello@veximbridge.com",
    support: "support@veximbridge.com",
    phone: "+84 28 0000 0000",
    address: "TP. Hồ Chí Minh, Việt Nam",
  },
  social: {
    linkedin: "https://www.linkedin.com/company/vexim-bridge",
    facebook: "https://www.facebook.com/veximbridge",
  },
} as const

export type SiteConfig = typeof siteConfig
