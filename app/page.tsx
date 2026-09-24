import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Factory,
  FileCheck,
  Globe,
  Menu,
  Search,
  ShieldCheck,
  TrendingUp,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { landingPathForRole, normaliseRole } from "@/lib/auth/permissions"
import { getLocale } from "@/lib/i18n/server"
import { LanguageSwitcher } from "@/components/i18n/language-switcher"
import { BuyerRfqForm } from "@/components/landing/buyer-rfq-form"
import { Button } from "@/components/ui/button"
import { siteConfig } from "@/lib/site-config"
import { localizePath } from "@/lib/i18n/routing"
import { localizedAlternates } from "@/lib/seo/alternates"
import { JsonLd } from "@/components/seo/json-ld"
import type { Metadata } from "next"

/**
 * Buyer-first homepage.
 * 
 * Positioning: VERIFICATION - COMPLIANCE - EXECUTION
 * Principle: Bold on process, conservative on claims.
 * 
 * This page is for U.S. B2B procurement audiences evaluating overseas suppliers.
 * We prioritize clear information, documented process, commercial transparency
 * and evidence over broad marketing claims.
 */

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const title =
    locale === "vi"
      ? "Vexim Trade — Tìm nguồn hàng từ nhà máy Việt Nam đã sàng lọc | Hỗ trợ FDA & MoCRA"
      : "Vexim Trade — Source from Screened Vietnamese Factories | FDA & MoCRA Review"
  const description =
    locale === "vi"
      ? "Tìm nguồn hàng từ nhà máy Việt Nam đã được sàng lọc với hỗ trợ kiểm tra nhà cung cấp, rà soát tuân thủ FDA & MoCRA và điều phối QC. Không thu phí sourcing upfront cho buyer Mỹ."
      : "Source from screened Vietnamese factories with on-the-ground support for supplier verification, U.S. FDA compliance and quality coordination. No upfront sourcing fee for U.S. buyers."

  return {
    title,
    description,
    alternates: localizedAlternates("/", { bilingual: true, locale }),
    openGraph: {
      title,
      description,
      url: `${siteConfig.url}/`,
      type: "website",
      locale: locale === "vi" ? "vi_VN" : "en_US",
      images: [{ url: siteConfig.ogImage, width: 1600, height: 1000, alt: title }],
    },
  }
}

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: siteConfig.legalName,
      alternateName: siteConfig.name,
      description:
        "Vexim Trade helps U.S. buyers source from screened Vietnamese factories with verification, U.S. FDA and MoCRA review, and QC coordination. No upfront sourcing fee for buyers.",
      url: siteConfig.url,
      email: siteConfig.contact.email,
      telephone: siteConfig.contact.phone,
      address: { "@type": "PostalAddress", ...siteConfig.contact.addressParts },
    },
    {
      "@type": "WebSite",
      name: siteConfig.name,
      url: `${siteConfig.url}/`,
      inLanguage: ["vi-VN", "en-US"],
    },
  ],
}

const content = {
  vi: {
    nav: {
      verify: "Cách chúng tôi sàng lọc",
      catalog: "NCC đã sàng lọc",
      suppliers: "Dành cho NCC",
      howItWorks: "Quy trình",
      faq: "FAQ",
    },
    signIn: "Đăng nhập",
    ctaPrimary: "Gửi yêu cầu sourcing",
    ctaSecondary: "Xem NCC đã sàng lọc",
    eyebrow: "VERIFIED VIETNAM SOURCING - KHÔNG PHÍ UPFRONT CHO BUYER",
    heroTitle: "Tìm nguồn hàng từ Việt Nam mà không cần phải đoán mò.",
    heroSub:
      "Tìm nguồn từ các nhà máy Việt Nam đã được sàng lọc với đội ngũ tại chỗ hỗ trợ kiểm tra nhà cung cấp, rà soát tuân thủ FDA & MoCRA và điều phối chất lượng. Không thu phí sourcing upfront cho buyer Mỹ.",
    heroTrust: "Kiểm tra nhà máy · Lịch sử xuất khẩu · Rà soát FDA/Quy định · Điều phối QC",
    heroNote: "Tham gia thương mại không quyết định việc NCC có vượt qua sàng lọc hay không. Sàng lọc thương mại không thay thế kiểm tra NCC.",
    stat1: "Quy trình sàng lọc 7 bước",
    stat2: "Rà soát FDA & MoCRA",
    stat3: "Kiểm tra lịch sử xuất khẩu",
    stat4: "Hỗ trợ thị trường Mỹ",
    problemEyebrow: "THỰC TRẠNG TÌM NGUỒN",
    problemTitle: "Tìm nguồn từ Việt Nam không nên đòi hỏi bạn phải bay sang Việt Nam.",
    problemText:
      "Nhiều buyer gặp khó khăn khi tự mình xác minh thông tin NCC. Mức độ kiểm tra, hỗ trợ tuân thủ và điều khoản thương mại có thể khác nhau rất nhiều tùy theo trung gian.",
    problemCols: [
      {
        title: "Thư mục NCC chung chung",
        desc: "Thông tin NCC có thể khó xác minh. Bạn vẫn cần tự thực hiện due diligence của mình.",
      },
      {
        title: "Trung gian sourcing truyền thống",
        desc: "Mức độ kiểm tra, hỗ trợ tuân thủ và điều khoản thương mại có thể khác nhau tùy trung gian.",
      },
      {
        title: "Vexim Trade",
        desc: "Sàng lọc NCC có cấu trúc, rà soát quy định thị trường Mỹ và điều phối tại chỗ.",
        highlight: true,
      },
    ],
    verifyEyebrow: "QUY TRÌNH SÀNG LỌC",
    verifyTitle: "Mọi NCC đều trải qua quy trình kiểm tra của chúng tôi.",
    verifyText:
      "Tham gia thương mại không quyết định việc nhà máy có vượt qua sàng lọc hay không. Sàng lọc thương mại không thay thế việc kiểm tra NCC.",
    verifySteps: [
      ["01", "Định danh nhà máy", "Pháp nhân, giấy phép kinh doanh, địa chỉ, xác minh chủ sở hữu/liên hệ"],
      ["02", "Năng lực sản xuất", "Sản phẩm, công suất, MOQ, thiết bị"],
      ["03", "Lịch sử xuất khẩu", "Hồ sơ lô hàng/xuất khẩu được kiểm tra qua dữ liệu hiện có"],
      ["04", "Chứng chỉ", "ISO, HACCP, GMP/cGMP và các chứng chỉ liên quan được rà soát khi có sẵn"],
      ["05", "Sẵn sàng tuân thủ Mỹ", "Đăng ký cơ sở FDA, MoCRA, yêu cầu nhãn mác được rà soát"],
      ["06", "Rà soát sản phẩm & mẫu", "Thông số, bao bì và đánh giá mẫu"],
      ["07", "Giao tiếp & phù hợp thương mại", "Mức độ phản hồi và sẵn sàng xuất khẩu"],
    ],
    verifyNote: "Mức độ kiểm tra khác nhau tùy NCC. Chúng tôi hiển thị những gì đã kiểm tra và khi nào.",
    verifyLevels: ["Đã sàng lọc", "Đã rà soát dữ liệu", "Đã rà soát tuân thủ", "Đã xác minh tại chỗ"],
    categoriesEyebrow: "CHUYÊN MÔN NGÀNH",
    categoriesTitle: "Xây dựng cho yêu cầu quy định của Mỹ",
    categoriesText: "Chúng tôi tập trung vào các danh mục mà việc đánh giá NCC và mức độ sẵn sàng tuân thủ là quan trọng.",
    categories: [
      {
        title: "Thực phẩm & Đồ uống",
        desc: "Kiểm tra đăng ký cơ sở FDA · rà soát nhãn · cân nhắc tuân thủ nhập khẩu",
      },
      {
        title: "Thực phẩm bổ sung",
        desc: "Rà soát nhãn · cân nhắc thành phần · rà soát tài liệu cGMP",
      },
      {
        title: "Mỹ phẩm / Làm đẹp",
        desc: "Rà soát đăng ký/listing liên quan MoCRA · điều phối Responsible Person",
      },
    ],
    categoriesOther: "Sản phẩm khác thuộc FDA? Hỏi đội ngũ tuân thủ của chúng tôi →",
    vietnamEyebrow: "TẠI SAO VIỆT NAM",
    vietnamTitle: "Tại sao buyer Mỹ đang khám phá Việt Nam",
    vietnamText:
      "Đa dạng hóa vượt ra ngoài Trung Quốc có thể tạo ra các lựa chọn mới về chi phí, công suất, thời gian giao hàng và khả năng phục hồi chuỗi cung ứng. Việt Nam đã trở thành một lựa chọn thay thế quan trọng cho nhiều danh mục sản phẩm.",
    vietnamPoints: ["Chi phí & công suất", "Thời gian giao hàng", "Khả năng phục hồi chuỗi cung ứng", "Đa dạng hóa nguồn hàng"],
    howEyebrow: "QUY TRÌNH",
    howTitle: "Lựa chọn NCC ban đầu trong ít nhất 48 giờ*",
    howNote: "*Thời gian phụ thuộc danh mục sản phẩm, thông số kỹ thuật, tình trạng NCC và thông tin bạn cung cấp.",
    howSteps: [
      ["01", "Gửi yêu cầu sourcing", "Cho chúng tôi biết sản phẩm, quy cách, số lượng, khoảng giá mục tiêu (không bắt buộc)"],
      ["02", "Nhận danh sách phù hợp", "Chúng tôi chia sẻ 2-3 nhà máy đã sàng lọc phù hợp với yêu cầu của bạn"],
      ["03", "Mẫu & Rà soát", "Mẫu, báo giá và rà soát video nhà máy hoặc xác minh tại chỗ khi có sẵn"],
      ["04", "Đặt hàng có hỗ trợ", "Chúng tôi hỗ trợ điều phối QC và tài liệu vận chuyển"],
    ],
    transparencyEyebrow: "MINH BẠCH",
    transparencyTitle: "Để rõ ràng về những gì chúng tôi không làm:",
    transparencyItems: [
      "Chúng tôi không thu phí sourcing upfront từ buyer",
      "Chúng tôi không cộng thêm một dòng phí Vexim riêng vào đơn hàng của bạn",
      "Chúng tôi không đảm bảo FDA phê duyệt hoặc rằng đăng ký đồng nghĩa với phê duyệt (không ai có thể - FDA làm rõ đăng ký không phải là phê duyệt)",
      "Chúng tôi không liệt kê nhà máy mà không qua sàng lọc",
      "Chúng tôi không gọi video do NCC cung cấp là audit trừ khi chúng tôi thực hiện xác minh tại chỗ",
    ],
    catalogEyebrow: "BẰNG CHỨNG",
    catalogTitle: "Xem các NCC & sản phẩm đã được sàng lọc",
    catalogText:
      "Mỗi hồ sơ cho thấy những gì đã được rà soát và khi nào. Mức độ xác minh khác nhau tùy NCC.",
    catalogCta: "Xem tất cả sản phẩm",
    compEyebrow: "CHI PHÍ",
    compTitle: "Cách chúng tôi được trả phí",
    compText1: "Không có phí sourcing upfront cho buyer.",
    compText2:
      "Vexim được NCC trả phí khi giao dịch hoàn tất thành công. Chúng tôi không thu phí sourcing riêng từ buyer hoặc cộng thêm dòng phí Vexim vào đơn hàng.",
    compNote:
      "Giá của NCC có thể phản ánh các điều khoản thương mại riêng của họ, bao gồm bất kỳ chi phí dịch vụ phía NCC nào. Chúng tôi khuyến khích báo giá minh bạch.",
    faqEyebrow: "FAQ",
    faqTitle: "Câu hỏi buyer Mỹ thường hỏi",
    faqs: [
      [
        "Dịch vụ của bạn có thực sự miễn phí cho buyer không?",
        "Không có phí sourcing upfront cho buyer. Vexim được NCC trả phí khi giao dịch hoàn tất thành công. Chúng tôi không thu phí riêng hoặc cộng markup riêng của Vexim vào đơn hàng của bạn. Giá của NCC có thể phản ánh điều khoản thương mại riêng của họ.",
      ],
      [
        "Bạn có cộng markup vào giá nhà máy không?",
        "Chúng tôi không cộng thêm dòng phí Vexim riêng vào đơn hàng. Giá NCC có thể phản ánh điều khoản thương mại riêng của họ, bao gồm chi phí dịch vụ phía NCC. Chúng tôi khuyến khích báo giá minh bạch.",
      ],
      [
        "Bạn có cung cấp tư vấn pháp lý FDA không?",
        "Chúng tôi cung cấp rà soát tuân thủ và điều phối, không phải tư vấn pháp lý. Khi cần, chúng tôi làm việc với cố vấn tuân thủ tại Mỹ. FDA làm rõ rằng đăng ký/listing cơ sở không phải là sự phê duyệt của FDA.",
      ],
      [
        "Nếu chất lượng không đạt thì sao?",
        "Chúng tôi hỗ trợ điều phối QC và kiểm tra trước khi giao hàng khi có sẵn, và giúp làm rõ thông số và yêu cầu trước khi đặt hàng. Chúng tôi không thể đảm bảo zero rủi ro - mục tiêu của chúng tôi là giảm uncertainty giữa bạn và NCC.",
      ],
      [
        "Còn về thanh toán? Bạn có bảo vệ thanh toán không?",
        "Chúng tôi không vận hành dịch vụ ký quỹ (escrow) hoặc bảo đảm thanh toán kiểu marketplace. Chúng tôi giúp xác minh danh tính NCC, chi tiết ngân hàng và điều khoản thanh toán trước khi bạn đặt hàng, và hướng dẫn về các điều khoản thanh toán an toàn.",
      ],
      [
        "Mức độ xác minh nghĩa là gì?",
        "Mỗi hồ sơ NCC hiển thị những gì đã được kiểm tra: thông tin công ty, lịch sử xuất khẩu, năng lực sản xuất, chứng chỉ, rà soát yêu cầu quy định Mỹ, và liệu việc xác minh tại chỗ đã được thực hiện hay chưa, kèm ngày rà soát gần nhất.",
      ],
    ],
    formEyebrow: "GỬI YÊU CẦU",
    formTitle: "Nhận danh sách nhà máy đã sàng lọc",
    formText:
      "Chia sẻ sản phẩm bạn cần. Chúng tôi sẽ xem xét yêu cầu và chia sẻ các lựa chọn NCC ban đầu đã được sàng lọc trong thời gian sớm nhất, thường trong vòng 48 giờ làm việc tùy danh mục.",
    footerNote: "Sàng lọc · Tuân thủ · Thực thi",
  },
  en: {
    nav: {
      verify: "How we verify",
      catalog: "Screened suppliers",
      suppliers: "For suppliers",
      howItWorks: "How it works",
      faq: "FAQ",
    },
    signIn: "Sign in",
    ctaPrimary: "Submit Sourcing Request",
    ctaSecondary: "Browse Screened Suppliers",
    eyebrow: "SCREENED VIETNAM SOURCING — NO UPFRONT FEE FOR BUYERS",
    heroTitle: "Source from Vietnam Without the Guesswork.",
    heroSub:
      "Source from screened Vietnamese factories with on-the-ground support for supplier verification, U.S. FDA compliance and quality coordination. No upfront sourcing fee for U.S. buyers.",
    heroTrust: "Factory Verification · Export History · FDA/Regulatory Review · QC Coordination",
    heroNote: "Commercial participation does not replace supplier screening. Supplier participation does not determine whether a factory passes our screening.",
    stat1: "7-point screening process",
    stat2: "FDA & MoCRA review",
    stat3: "Export history checked",
    stat4: "U.S. market support",
    problemEyebrow: "THE SOURCING CHALLENGE",
    problemTitle: "Sourcing from Vietnam shouldn't require flying to Vietnam.",
    problemText:
      "Supplier information can be difficult to verify on your own. Verification, compliance support, and commercial terms can vary widely depending on the intermediary.",
    problemCols: [
      {
        title: "Generic Supplier Directories",
        desc: "Supplier information can be difficult to verify. You still need to conduct your own due diligence.",
      },
      {
        title: "Traditional Sourcing Intermediaries",
        desc: "Verification, compliance support and commercial terms can vary by intermediary.",
      },
      {
        title: "Vexim Trade",
        desc: "Structured supplier screening, U.S. regulatory review and on-the-ground coordination.",
        highlight: true,
      },
    ],
    verifyEyebrow: "VERIFICATION PROCESS",
    verifyTitle: "Every Supplier Goes Through Our Verification Process.",
    verifyText: "Commercial participation does not replace supplier screening.",
    verifySteps: [
      ["01", "Factory Identity", "Legal entity, business license, address, ownership and contact verification"],
      ["02", "Production Capability", "Products, capacity, MOQ, equipment"],
      ["03", "Export History", "Shipment and export track record checked via available data"],
      ["04", "Certifications", "ISO, HACCP, GMP/cGMP and other certificates reviewed where available"],
      ["05", "U.S. Compliance Readiness", "FDA facility registration, MoCRA, labeling requirements reviewed"],
      ["06", "Product & Sample Review", "Specs, packaging, and sample evaluation"],
      ["07", "Communication & Commercial Fit", "Responsiveness and export readiness"],
    ],
    verifyNote: "Verification levels vary by supplier. We show what was checked and when.",
    verifyLevels: ["Screened", "Data Reviewed", "Compliance Reviewed", "On-site Verified"],
    categoriesEyebrow: "CORE CATEGORIES",
    categoriesTitle: "Built for U.S. Regulatory Requirements.",
    categoriesText: "We focus on categories where supplier qualification and regulatory readiness matter.",
    categories: [
      {
        title: "Food & Beverage",
        desc: "FDA facility registration · labeling review · import compliance considerations",
      },
      {
        title: "Dietary Supplements",
        desc: "Label review · ingredient considerations · cGMP documentation review",
      },
      {
        title: "Cosmetics / Beauty",
        desc: "MoCRA-related registration/listing review · Responsible Person coordination",
      },
    ],
    categoriesOther: "Other FDA-regulated products? Ask our compliance team →",
    vietnamEyebrow: "WHY VIETNAM",
    vietnamTitle: "Why U.S. Buyers Are Exploring Vietnam.",
    vietnamText:
      "Diversifying beyond China can create new options for cost, capacity, lead times, and supply chain resilience. Vietnam has become a key alternative for many product categories.",
    vietnamPoints: ["Cost & capacity", "Lead times", "Supply chain resilience", "Sourcing diversification"],
    howEyebrow: "HOW IT WORKS",
    howTitle: "Initial Supplier Matches in as Little as 48 Hours*",
    howNote: "*Timing depends on product category, specifications, supplier availability and information provided.",
    howSteps: [
      ["01", "Submit Sourcing Request", "Tell us product, specs, quantity, target price range (optional)"],
      ["02", "Get Matched", "We share 2-3 screened factories that fit your requirements"],
      ["03", "Samples & Review", "Samples, pricing, and factory video review or on-site verification where available"],
      ["04", "Order with Support", "We help coordinate QC and shipment documentation"],
    ],
    transparencyEyebrow: "TRANSPARENCY",
    transparencyTitle: "To be clear about what we don't do:",
    transparencyItems: [
      "We don't charge buyers an upfront sourcing fee",
      "We don't add a separate Vexim line-item markup to your order",
      "We don't guarantee FDA approval or that registration equals approval (no one can — FDA clarifies registration is not approval)",
      "We don't list a factory without screening",
      "We don't call supplier-provided video an audit unless we conduct on-site verification",
    ],
    catalogEyebrow: "EVIDENCE",
    catalogTitle: "Browse Screened Vietnamese Suppliers & Products.",
    catalogText: "Each profile shows what was reviewed and when. Verification levels vary by supplier.",
    catalogCta: "Browse all products",
    compEyebrow: "COMPENSATION",
    compTitle: "How We Are Compensated.",
    compText1: "No upfront sourcing fee for buyers.",
    compText2:
      "Vexim is compensated by suppliers when a transaction is successfully completed. We do not charge buyers a separate sourcing fee or add a Vexim line-item markup to the order.",
    compNote:
      "Supplier pricing may reflect its own commercial terms, including any supplier-side service costs. We encourage transparent quotations.",
    faqEyebrow: "FAQ",
    faqTitle: "What U.S. Buyers Usually Ask.",
    faqs: [
      [
        "Is your service really free for buyers?",
        "No upfront sourcing fee for buyers. Vexim is compensated by suppliers when a transaction is successfully completed. We do not charge buyers a separate sourcing fee or add a Vexim line-item markup to the order. Supplier pricing may reflect its own commercial terms.",
      ],
      [
        "Do you add markup to the factory price?",
        "We do not add a separate Vexim line-item markup to your order. Supplier pricing may reflect its own commercial terms, including any supplier-side service costs. We encourage transparent quotations.",
      ],
      [
        "Do you provide FDA legal advice?",
        "We provide compliance review and coordination, not legal advice. Where needed, we work with U.S. compliance counsel. FDA clarifies that facility registration/listing is not FDA approval, and FDA does not issue certificates to verify compliance for registration/listing.",
      ],
      [
        "What if quality fails?",
        "We help coordinate QC and pre-shipment inspection where available, and help clarify specs and requirements before you order. We cannot guarantee zero risk — our goal is to reduce the uncertainty between you and your Vietnamese supplier.",
      ],
      [
        "What about payment? Do you offer payment protection?",
        "We do not operate an escrow or marketplace payment guarantee. We help verify supplier identity, banking details and payment terms before you order, and provide guidance on secure payment terms.",
      ],
      [
        "What does verification level mean?",
        "Each supplier profile shows what was checked: company information, export history, production capability, certifications, U.S. regulatory requirements review, and whether on-site verification was conducted, with the last reviewed date.",
      ],
    ],
    formEyebrow: "START SOURCING",
    formTitle: "Get Your Screened Factory Matches.",
    formText:
      "Share what you need. We'll review your request and share initial screened supplier options as soon as possible, typically within 48 business hours depending on category and specs.",
    footerNote: "Verification · Compliance · Execution",
  },
} as const

export default async function RootPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    redirect(landingPathForRole(normaliseRole(profile?.role)))
  }

  const locale = await getLocale()
  const t = content[locale]

  return (
    <main lang={locale} className="min-h-screen overflow-hidden bg-background text-foreground">
      <JsonLd data={organizationJsonLd} id="organization-json-ld" />
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-5 px-5 sm:px-8 lg:px-10">
          <Link href="/" className="group flex items-center gap-3" aria-label="Vexim Trade home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform group-hover:-rotate-3">
              <TrendingUp className="h-5 w-5" />
            </span>
            <span className="text-base font-bold tracking-tight text-primary">Vexim Trade</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground lg:flex" aria-label="Primary navigation">
            <a href="#how-we-verify" className="transition-colors hover:text-primary">
              {t.nav.verify}
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-primary">
              {t.nav.howItWorks}
            </a>
            <Link href={localizePath("/products", locale)} className="transition-colors hover:text-primary">
              {t.nav.catalog}
            </Link>
            <Link href={localizePath("/for-suppliers", locale)} className="text-muted-foreground/70 hover:text-primary">
              {t.nav.suppliers}
            </Link>
            <a href="#faq" className="transition-colors hover:text-primary">
              {t.nav.faq}
            </a>
          </nav>
          <details className="relative lg:hidden">
            <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border border-border text-primary hover:bg-muted [&::-webkit-details-marker]:hidden">
              <Menu className="h-4 w-4" />
            </summary>
            <div className="absolute right-0 top-11 z-50 w-56 rounded-xl border border-border bg-card p-2 shadow-xl">
              <a href="#how-we-verify" className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-primary">
                {t.nav.verify}
              </a>
              <a href="#how-it-works" className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-primary">
                {t.nav.howItWorks}
              </a>
              <Link href={localizePath("/products", locale)} className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-primary">
                {t.nav.catalog}
              </Link>
              <Link href={localizePath("/for-suppliers", locale)} className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-primary">
                {t.nav.suppliers}
              </Link>
              <a href="#faq" className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-primary">
                {t.nav.faq}
              </a>
            </div>
          </details>
          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <Button asChild variant="outline" className="hidden border-primary/20 text-primary hover:bg-primary/5 sm:inline-flex">
              <Link href="/auth/login">{t.signIn}</Link>
            </Button>
            <Button asChild className="bg-cta text-cta-foreground shadow-sm hover:bg-cta/90">
              <a href="#sourcing-request">{t.ctaPrimary}</a>
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative isolate overflow-hidden bg-primary text-primary-foreground">
        <div className="pointer-events-none absolute -left-32 -top-40 h-[32rem] w-[32rem] rounded-full bg-accent/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 right-0 h-[30rem] w-[30rem] rounded-full bg-cta/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12 lg:px-10 lg:py-24">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-[11px] font-semibold tracking-[0.16em] text-sky-100">
              <span className="h-1.5 w-1.5 rounded-full bg-cta" />
              {t.eyebrow}
            </div>
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-balance sm:text-5xl lg:text-[3.6rem]">
              {t.heroTitle}
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-slate-200 sm:text-lg">{t.heroSub}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg" className="h-12 bg-cta px-6 text-cta-foreground shadow-lg shadow-amber-950/20 hover:bg-cta/90">
                <a href="#sourcing-request">
                  {t.ctaPrimary}
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
              <Button asChild size="lg" variant="ghost" className="h-12 text-slate-100 hover:bg-white/10 hover:text-white">
                <Link href={localizePath("/products", locale)}>{t.ctaSecondary}</Link>
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {t.heroTrust.split("·").map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium tracking-wide text-slate-200">
                  <CheckCircle2 className="h-3 w-3 text-accent" />
                  {item.trim()}
                </span>
              ))}
            </div>
            <p className="mt-6 max-w-xl text-xs leading-5 text-slate-400">{t.heroNote}</p>
          </div>
          <div className="relative mx-auto w-full max-w-lg lg:ml-auto lg:justify-self-end">
            <div className="absolute -inset-4 rounded-[2rem] bg-accent/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-[1.4rem] border border-white/20 bg-white/10 p-2 shadow-2xl shadow-slate-950/30 backdrop-blur-sm">
              <div className="relative aspect-[1.18/1] overflow-hidden rounded-[1rem]">
                <Image src="/landing/hero-dashboard.jpg" alt="Screened Vietnamese factory" fill priority sizes="(max-width: 1024px) 90vw, 48vw" className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/85 via-transparent to-transparent" />
                <div className="absolute bottom-5 left-5 right-5">
                  <div className="rounded-xl bg-white/95 p-4 shadow-xl backdrop-blur">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Example verification</p>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Screened</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-primary">ABC Vietnam Food Co., Ltd.</p>
                    <div className="mt-3 space-y-1.5 text-xs">
                      <div className="flex items-center gap-2 text-emerald-700"><Check className="h-3 w-3" /> Company information reviewed</div>
                      <div className="flex items-center gap-2 text-emerald-700"><Check className="h-3 w-3" /> Export history reviewed</div>
                      <div className="flex items-center gap-2 text-emerald-700"><Check className="h-3 w-3" /> FDA registration reviewed</div>
                      <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-3 w-3" /> On-site verification — pending</div>
                    </div>
                    <p className="mt-3 text-[10px] text-muted-foreground">Last reviewed: Sep 2026</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-5 -left-4 hidden rounded-xl border border-white/20 bg-slate-950/80 px-4 py-3 shadow-xl backdrop-blur-md sm:block">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20 text-accent">
                  <FileCheck className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">Compliance review</p>
                  <p className="text-sm font-semibold text-white">Not a guarantee</p>
                </div>
              </div>
            </div>
            <div className="absolute -right-4 top-8 hidden rounded-xl border border-white/20 bg-white px-4 py-3 shadow-xl sm:block">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <p className="text-sm font-semibold text-primary">Screened, not just listed</p>
              </div>
            </div>
          </div>
        </div>
        <div className="relative mx-auto grid max-w-7xl grid-cols-2 border-t border-white/10 px-5 sm:grid-cols-4 sm:px-8 lg:px-10">
          <Stat value="7-point" label={t.stat1} />
          <Stat value="FDA / MoCRA" label={t.stat2} />
          <Stat value="Export data" label={t.stat3} />
          <Stat value="U.S. market" label={t.stat4} />
        </div>
      </section>

      {/* PROBLEM */}
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
        <SectionHeading eyebrow={t.problemEyebrow} title={t.problemTitle} text={t.problemText} />
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {t.problemCols.map((col) => (
            <article
              key={col.title}
              className={`rounded-2xl border p-6 shadow-sm ${col.highlight ? "border-primary bg-primary text-primary-foreground shadow-xl" : "border-border bg-card"}`}
            >
              <h3 className={`text-base font-semibold ${col.highlight ? "text-white" : "text-primary"}`}>{col.title}</h3>
              <p className={`mt-3 text-sm leading-7 ${col.highlight ? "text-slate-200" : "text-muted-foreground"}`}>{col.desc}</p>
              {col.highlight && (
                <div className="mt-6 flex items-center gap-2 text-xs font-medium text-accent">
                  <CheckCircle2 className="h-4 w-4" /> Structured process
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* VERIFICATION */}
      <section id="how-we-verify" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-primary">{t.verifyEyebrow}</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-primary sm:text-4xl">{t.verifyTitle}</h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">{t.verifyText}</p>
              <div className="mt-8 rounded-xl border border-accent/30 bg-accent/10 p-4">
                <p className="text-sm font-medium text-primary">Verification levels:</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {t.verifyLevels.map((level) => (
                    <span key={level} className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-primary">
                      {level}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">{t.verifyNote}</p>
              </div>
              <div className="mt-6">
                <Link href={localizePath("/how-we-verify", locale)} className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-cta">
                  How we verify — methodology <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {t.verifySteps.map(([num, title, desc], idx) => (
                <div key={num} className="flex gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
                    {idx + 1}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-primary">{title}</h3>
                    <p className="mt-1.5 text-xs leading-6 text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
        <SectionHeading eyebrow={t.categoriesEyebrow} title={t.categoriesTitle} text={t.categoriesText} />
        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {t.categories.map((cat) => (
            <article key={cat.title} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-primary">
                <Factory className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-base font-semibold text-primary">{cat.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{cat.desc}</p>
            </article>
          ))}
        </div>
        <div className="mt-8">
          <Link href="#sourcing-request" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-cta">
            {t.categoriesOther}
          </Link>
        </div>
      </section>

      {/* WHY VIETNAM */}
      <section className="border-y border-border bg-primary text-primary-foreground">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-accent">{t.vietnamEyebrow}</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{t.vietnamTitle}</h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">{t.vietnamText}</p>
              <div className="mt-8 grid grid-cols-2 gap-3">
                {t.vietnamPoints.map((p) => (
                  <div key={p} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200">
                    <Globe className="h-4 w-4 text-accent" />
                    {p}
                  </div>
                ))}
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-accent" />
                <p className="text-sm font-semibold text-white">Supply chain diversification</p>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                U.S. buyers are diversifying sourcing to improve resilience, not just cost. Vietnam offers growing capacity across food, supplements and beauty categories with an expanding export track record.
              </p>
              <div className="mt-6 rounded-xl bg-white p-4 text-primary">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Considerations we review</p>
                <ul className="mt-2 space-y-2 text-sm">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-accent" /> Product-specific HTS and duty considerations</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-accent" /> Capacity and lead times for your SKU</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-accent" /> Compliance readiness for U.S. market</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
        <div className="max-w-2xl">
          <p className="text-xs font-bold tracking-[0.2em] text-primary">{t.howEyebrow}</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-primary sm:text-4xl">{t.howTitle}</h2>
          <p className="mt-3 text-sm text-muted-foreground">{t.howNote}</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {t.howSteps.map(([num, title, desc]) => (
            <div key={num} className="relative rounded-2xl border border-border bg-card p-6 shadow-sm">
              <span className="text-3xl font-semibold text-accent">{num}</span>
              <h3 className="mt-4 text-base font-semibold text-primary">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TRANSPARENCY */}
      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-5 py-20 sm:px-8 lg:py-24">
          <SectionHeading eyebrow={t.transparencyEyebrow} title={t.transparencyTitle} />
          <div className="mt-10 rounded-2xl border border-border bg-card p-6 sm:p-8">
            <div className="grid gap-4">
              {t.transparencyItems.map((item) => (
                <div key={item} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                    <XCircle className="h-4 w-4" />
                  </span>
                  <p className="text-sm leading-6 text-primary">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CATALOG */}
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-primary">{t.catalogEyebrow}</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-primary sm:text-4xl">{t.catalogTitle}</h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">{t.catalogText}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-cta text-cta-foreground hover:bg-cta/90">
                <Link href={localizePath("/products", locale)}>
                  {t.catalogCta} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-primary/20 text-primary">
                <Link href={localizePath("/how-we-verify", locale)}>How we verify</Link>
              </Button>
            </div>
            <div className="mt-8 rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Example profile card</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Company information reviewed</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Export history reviewed</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Production capability reviewed</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Certifications reviewed</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> U.S. regulatory requirements reviewed</div>
                <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" /> On-site verification — pending</div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Last reviewed: Sep 2026</p>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-[1.4rem] border border-border bg-muted/30 p-3 shadow-xl">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
              <Image src="/landing/evidence-factory.jpg" alt="Screened Vietnamese factory - production line with QC inspection" fill className="object-cover" sizes="(max-width: 1024px) 90vw, 50vw" />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/70 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-white">Screened factories, not just listings</p>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary">View catalog</span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg bg-card p-3 border"><p className="font-semibold text-primary">Food</p><p className="text-muted-foreground">FDA reviewed</p></div>
              <div className="rounded-lg bg-card p-3 border"><p className="font-semibold text-primary">Supplements</p><p className="text-muted-foreground">cGMP docs</p></div>
              <div className="rounded-lg bg-card p-3 border"><p className="font-semibold text-primary">Cosmetics</p><p className="text-muted-foreground">MoCRA review</p></div>
            </div>
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] leading-4 text-emerald-800">
              <span className="font-semibold">On-site verification example:</span> Production capability, QC process and documentation reviewed. Last reviewed: Sep 2026.
            </div>
          </div>
        </div>
      </section>

      {/* COMPENSATION */}
      <section className="border-y border-border bg-primary text-primary-foreground">
        <div className="mx-auto max-w-4xl px-5 py-20 sm:px-8 lg:py-24">
          <p className="text-xs font-bold tracking-[0.2em] text-accent">{t.compEyebrow}</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{t.compTitle}</h2>
          <div className="mt-8 rounded-2xl bg-white/5 p-6 sm:p-8 border border-white/10">
            <p className="text-lg font-semibold text-white">{t.compText1}</p>
            <p className="mt-3 text-base leading-7 text-slate-200">{t.compText2}</p>
            <p className="mt-6 text-sm leading-6 text-slate-400">{t.compNote}</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <Search className="h-5 w-5 text-accent" />
                <p className="mt-3 text-sm font-medium text-white">No upfront fee for buyers</p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <BadgeCheck className="h-5 w-5 text-accent" />
                <p className="mt-3 text-sm font-medium text-white">No Vexim line-item markup</p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <ClipboardCheck className="h-5 w-5 text-accent" />
                <p className="mt-3 text-sm font-medium text-white">Transparent quotations</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-4xl px-5 py-20 sm:px-8 lg:py-28">
        <SectionHeading eyebrow={t.faqEyebrow} title={t.faqTitle} />
        <div className="mt-10 divide-y divide-border rounded-2xl border border-border bg-card px-5">
          {t.faqs.map(([q, a]) => (
            <details key={q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left text-sm font-semibold text-primary marker:hidden">
                <span>{q}</span>
                <span className="text-xl font-normal text-accent transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="max-w-3xl pr-8 pt-3 text-sm leading-7 text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* RFQ FORM */}
      <section id="sourcing-request" className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div className="pt-3">
              <p className="text-xs font-bold tracking-[0.2em] text-primary">{t.formEyebrow}</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-primary sm:text-4xl">{t.formTitle}</h2>
              <p className="mt-5 text-base leading-8 text-muted-foreground">{t.formText}</p>
              <div className="mt-8 space-y-4">
                <div className="flex items-center gap-3 text-sm text-primary">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15">
                    <ClipboardCheck className="h-4 w-4" />
                  </span>
                  Initial screened matches, not just a list
                </div>
                <div className="flex items-center gap-3 text-sm text-primary">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15">
                    <Clock className="h-4 w-4" />
                  </span>
                  As little as 48 hours* — timing depends on category and specs
                </div>
                <div className="flex items-center gap-3 text-sm text-primary">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15">
                    <BadgeCheck className="h-4 w-4" />
                  </span>
                  No upfront fee for buyers — confidential
                </div>
              </div>
              <div className="mt-8 rounded-xl border border-border bg-card p-4 text-sm">
                <p className="font-semibold text-primary">Example of what you get:</p>
                <div className="mt-3 rounded-lg bg-muted/50 p-3 font-mono text-xs leading-6">
                  <p>ABC Vietnam Food Co., Ltd.</p>
                  <p>✓ Company information reviewed</p>
                  <p>✓ Export history reviewed</p>
                  <p>✓ Production capability reviewed</p>
                  <p>✓ Certifications reviewed</p>
                  <p>✓ U.S. regulatory requirements reviewed</p>
                  <p>○ On-site verification — pending</p>
                  <p className="text-muted-foreground">Last reviewed: Sep 2026</p>
                </div>
              </div>
            </div>
            <BuyerRfqForm locale={locale} />
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-[#0f172a] text-slate-200">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#0f172a]">
                  <TrendingUp className="h-5 w-5" />
                </span>
                <span className="text-base font-bold tracking-tight text-white">Vexim Trade</span>
              </div>
              <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">
                {locale === "vi"
                  ? "Giúp buyer Mỹ tìm nguồn từ nhà máy Việt Nam đã sàng lọc với hỗ trợ kiểm tra NCC, rà soát tuân thủ FDA/MoCRA và điều phối QC. Không thu phí sourcing upfront cho buyer."
                  : "Helping U.S. buyers source from screened Vietnamese factories with supplier verification, FDA/MoCRA review and QC coordination. No upfront sourcing fee for buyers."}
              </p>
              <div className="mt-6 space-y-2 text-sm">
                <a href={`mailto:${siteConfig.contact.email}`} className="block font-medium text-white hover:text-accent">
                  {siteConfig.contact.email}
                </a>
                <a href={`tel:${siteConfig.contact.phone}`} className="block font-semibold text-white hover:text-accent">
                  {siteConfig.contact.hotline} · {siteConfig.contact.phone}
                </a>
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {t.footerNote}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-slate-400">
                {locale === "vi" ? "VĂN PHÒNG VIỆT NAM" : "VIETNAM OFFICE"}
              </p>
              <div className="mt-4 space-y-1 text-sm leading-6 text-slate-300">
                <p className="font-semibold text-white">{siteConfig.contact.vietnamOffice.label}</p>
                <p>{siteConfig.contact.vietnamOffice.street}</p>
                <p>{siteConfig.contact.vietnamOffice.ward}</p>
                <p className="pt-2 text-xs">
                  <span className="text-slate-500">MST / Tax ID:</span> <span className="font-mono font-semibold text-white">{siteConfig.contact.vietnamOffice.taxId}</span>
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-slate-400">
                {locale === "vi" ? "ĐẠI DIỆN TẠI MỸ" : "U.S. AGENT"}
              </p>
              <div className="mt-4 space-y-1 text-sm leading-6 text-slate-300">
                <p className="font-semibold text-white">{siteConfig.contact.usAgent.label}</p>
                <p>{siteConfig.contact.usAgent.street}</p>
                <p>{siteConfig.contact.usAgent.city}</p>
                <p className="pt-2 text-xs">
                  <span className="text-slate-500">EIN:</span> <span className="font-mono font-semibold text-white">{siteConfig.contact.usAgent.ein}</span>
                </p>
                <p className="pt-1 text-[11px] leading-4 text-slate-500">
                  {locale === "vi"
                    ? "Đại diện tuân thủ tại Mỹ. Không phải văn phòng giao dịch trực tiếp cho buyer walk-in."
                    : "U.S. compliance agent. Not a walk-in office for buyers."}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-slate-400">{locale === "vi" ? "LIÊN KẾT" : "LINKS"}</p>
              <div className="mt-4 flex flex-col gap-2.5 text-sm">
                <Link href={localizePath("/products", locale)} className="text-slate-300 hover:text-white">
                  {locale === "vi" ? "NCC đã sàng lọc" : "Screened suppliers"}
                </Link>
                <Link href={localizePath("/how-we-verify", locale)} className="text-slate-300 hover:text-white">
                  {locale === "vi" ? "Cách chúng tôi sàng lọc" : "How we verify"}
                </Link>
                <Link href={localizePath("/for-suppliers", locale)} className="text-slate-400 hover:text-white">
                  {locale === "vi" ? "Dành cho NCC" : "For suppliers"}
                </Link>
                <Link href={localizePath("/legal", locale)} className="text-slate-400 hover:text-white">
                  {locale === "vi" ? "Pháp lý" : "Legal"}
                </Link>
                <Link href={localizePath("/legal/privacy", locale)} className="mt-2 text-xs text-slate-500 hover:text-white">
                  Privacy · Terms · Cookies
                </Link>
              </div>
            </div>
          </div>
          <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {new Date().getFullYear()} {siteConfig.legalName} · MST {siteConfig.contact.vietnamOffice.taxId} · EIN {siteConfig.contact.usAgent.ein}
            </p>
            <p className="max-w-2xl leading-5">
              {locale === "vi"
                ? "Vexim cung cấp dịch vụ rà soát và điều phối, không phải tư vấn pháp lý. Đăng ký/listing FDA không phải là phê duyệt của FDA."
                : "Vexim provides review and coordination services, not legal advice. FDA facility registration/listing is not FDA approval."}
            </p>
          </div>
        </div>
      </footer>
    </main>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-r border-white/10 px-4 py-5 first:pl-0 last:border-r-0">
      <p className="text-xl font-semibold text-white sm:text-2xl">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-300">{label}</p>
    </div>
  )
}

function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-bold tracking-[0.2em] text-primary">{eyebrow}</p>
      <h2 className="mt-4 text-3xl font-semibold tracking-tight text-primary sm:text-4xl">{title}</h2>
      {text && <p className="mt-4 text-base leading-7 text-muted-foreground">{text}</p>}
    </div>
  )
}
