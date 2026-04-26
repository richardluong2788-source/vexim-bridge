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
    "Vexim Bridge là phòng kinh doanh xuất khẩu thuê ngoài cho doanh nghiệp Việt sang Mỹ. Chuyên sâu 4 ngành FDA: thực phẩm, thực phẩm chức năng, mỹ phẩm (MoCRA) và thiết bị y tế — từ đăng ký tuân thủ FDA, tìm buyer, đàm phán đến xác thực chuyển tiền SWIFT và thu USD.",
  descriptionEn:
    "Vexim Bridge is an outsourced export sales team for Vietnamese manufacturers selling to the US market. We specialize in four FDA-regulated industries — food, dietary supplements, cosmetics (MoCRA) and medical devices — handling FDA compliance, buyer outreach, negotiation, two-step SWIFT payment verification and USD collection.",
  keywords: [
    "phòng kinh doanh xuất khẩu thuê ngoài",
    "xuất khẩu Việt Nam sang Mỹ",
    "đăng ký FDA Việt Nam",
    "FDA Food Facility Registration",
    "FDA Cosmetic Listing MoCRA",
    "dietary supplement FDA DSHEA",
    "medical device FDA 510k",
    "U.S. Agent FDA",
    "SWIFT wire transfer verification",
    "tìm buyer Mỹ cho nhà máy Việt Nam",
    "Vexim Bridge",
    "outsourced export sales Vietnam USA",
    "tuân thủ FDA thực phẩm chức năng mỹ phẩm",
  ],
  ogImage: "/landing/hero-dashboard.jpg",
  contact: {
    email: "hello@veximbridge.com",
    support: "support@veximbridge.com",
    // Vietnamese hotline as displayed (also surfaced as tel: link).
    hotline: "0373 685 634",
    // E.164 form for `tel:` href and JSON-LD telephone field.
    phone: "+84373685634",
    // Single-line address kept for inline use (footer first column, JSON-LD).
    address:
      "Tòa The Wisteria Hinode, Khu đô thị Hinode Royal Park Kim Chung Di Trạch, Kim Chung, Hoài Đức, Hà Nội",
    // Structured fields for schema.org PostalAddress (JSON-LD).
    addressParts: {
      streetAddress:
        "Tòa The Wisteria Hinode, Khu đô thị Hinode Royal Park Kim Chung Di Trạch",
      addressLocality: "Kim Chung, Hoài Đức",
      addressRegion: "Hà Nội",
      addressCountry: "VN",
    },
  },
  social: {
    linkedin: "https://www.linkedin.com/company/vexim-bridge",
    facebook: "https://www.facebook.com/veximbridge",
  },
} as const

export type SiteConfig = typeof siteConfig
