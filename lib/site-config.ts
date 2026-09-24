/**
 * Centralised site-wide constants. Imported by landing page, SEO
 * metadata, JSON-LD, sitemap, robots, and email templates.
 */

function resolveBaseUrl(): string {
  // Prefer an explicit canonical URL. Fall back to Vercel's stable
  // production domain (VERCEL_PROJECT_PRODUCTION_URL) so previews and
  // emails work, then localhost for dev.
  //
  // Never fall back to VERCEL_URL / NEXT_PUBLIC_VERCEL_URL — that's the
  // per-deployment hash URL (e.g. my-app-ixygy95f1-team.vercel.app), which
  // sits behind Vercel's Deployment Protection SSO wall for anyone outside
  // the team and breaks links sent to end users (emails, etc.).
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/$/, "")

  const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (productionUrl) return `https://${productionUrl.replace(/\/$/, "")}`

  return "http://localhost:3000"
}

export const siteConfig = {
  name: "Vexim Trade",
  shortName: "VXT",
  legalName: "Vexim Trade JSC",
  domain: "veximtrade.com",
  url: resolveBaseUrl(),
  tagline: "Dữ liệu thật - Giá trị thật",
  description:
    "Vexim Trade là phòng kinh doanh xuất khẩu thuê ngoài cho doanh nghiệp Việt sang Mỹ. Chuyên sâu 4 ngành FDA: thực phẩm, thực phẩm chức năng, mỹ phẩm (MoCRA) và thiết bị y tế — từ đăng ký tuân thủ FDA, tìm buyer, đàm phán đến xác thực chuyển tiền SWIFT và thu USD.",
  descriptionEn:
    "Vexim Trade is an outsourced export sales team for Vietnamese manufacturers selling to the US market. We specialize in four FDA-regulated industries — food, dietary supplements, cosmetics (MoCRA) and medical devices — handling FDA compliance, buyer outreach, negotiation, two-step SWIFT payment verification and USD collection.",
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
    "Vexim Trade",
    "outsourced export sales Vietnam USA",
    "tuân thủ FDA thực phẩm chức năng mỹ phẩm",
  ],
  ogImage: "/landing/hero-dashboard.jpg",
  contact: {
    email: "contact@veximglobal.com",
    support: "contact@veximglobal.com",
    hotline: "0373 685 634",
    phone: "+84373685634",
    // Primary address for JSON-LD / SEO - Vietnam office
    address: "Số 25/6 Ngõ 51 Phố Ngọa Long, Phường Tây Tựu, TP Hà Nội, Việt Nam",
    addressParts: {
      streetAddress: "Số 25/6 Ngõ 51 Phố Ngọa Long",
      addressLocality: "Phường Tây Tựu",
      addressRegion: "TP Hà Nội",
      addressCountry: "VN",
    },
    // Full structured addresses for footer
    vietnamOffice: {
      label: "Văn phòng Việt Nam",
      labelEn: "Vietnam Office",
      street: "Số 25/6 Ngõ 51 Phố Ngọa Long",
      ward: "Phường Tây Tựu, TP Hà Nội, Việt Nam",
      taxId: "0111040294",
      full: "Số 25/6 Ngõ 51 Phố Ngọa Long, Phường Tây Tựu, TP Hà Nội, Việt Nam",
    },
    usAgent: {
      label: "U.S. Legal Entity",
      labelEn: "U.S. Legal Entity",
      company: "Vexim Global LLC",
      street: "30 N Gould St, Ste R",
      city: "Sheridan, WY 82801, United States",
      ein: "35-2957758",
      full: "Vexim Global LLC, 30 N Gould St, Ste R, Sheridan, WY 82801, United States",
    },
  },
  social: {
    linkedin: "https://www.linkedin.com/company/vexim-trade",
    facebook: "https://www.facebook.com/veximtrade",
  },
} as const

export type SiteConfig = typeof siteConfig
