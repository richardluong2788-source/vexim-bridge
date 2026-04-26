import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRight, FileText, Shield, Cookie } from "lucide-react"
import { siteConfig } from "@/lib/site-config"

const PATHNAME = "/legal"
const TITLE = "Trung tâm pháp lý"
const SUMMARY =
  "Tổng hợp các tài liệu pháp lý của Vexim Bridge: điều khoản dịch vụ, chính sách bảo mật và chính sách cookie. Tất cả tài liệu được cập nhật định kỳ và áp dụng cho toàn bộ khách hàng sử dụng nền tảng tại veximbridge.com."

const URL = `${siteConfig.url}${PATHNAME}`

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: `${TITLE} — ${siteConfig.name}`,
  description: SUMMARY,
  alternates: { canonical: PATHNAME, languages: { "vi-VN": PATHNAME } },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: URL,
    siteName: siteConfig.name,
    title: `${TITLE} — ${siteConfig.name}`,
    description: SUMMARY,
    images: [{ url: siteConfig.ogImage, width: 1600, height: 1000, alt: TITLE }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: SUMMARY },
  robots: { index: true, follow: true },
}

const DOCS = [
  {
    href: "/legal/terms",
    title: "Điều khoản dịch vụ",
    description:
      "Thoả thuận giữa Vexim Bridge và khách hàng về phạm vi dịch vụ, phí, tuân thủ FDA, xác thực SWIFT, trách nhiệm và giải quyết tranh chấp.",
    icon: FileText,
  },
  {
    href: "/legal/privacy",
    title: "Chính sách bảo mật",
    description:
      "Cách chúng tôi thu thập, sử dụng, lưu trữ và bảo vệ dữ liệu khách hàng (FDA, hợp đồng, hóa đơn, tài liệu SWIFT/B/L) cùng các quyền của bạn.",
    icon: Shield,
  },
  {
    href: "/legal/cookies",
    title: "Chính sách cookie",
    description:
      "Cookie thiết yếu cho phiên đăng nhập, cookie chức năng cho ngôn ngữ và đo lường ẩn danh qua Vercel Analytics.",
    icon: Cookie,
  },
]

export default function LegalIndexPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <header className="border-b border-border/60 pb-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Tài liệu pháp lý
        </p>
        <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {TITLE}
        </h1>
        <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground">
          {SUMMARY}
        </p>
      </header>

      <ul className="mt-10 grid gap-4 sm:grid-cols-1 lg:grid-cols-3">
        {DOCS.map((doc) => {
          const Icon = doc.icon
          return (
            <li key={doc.href}>
              <Link
                href={doc.href}
                className="flex h-full flex-col gap-3 rounded-lg border border-border/60 bg-card p-6 transition-colors hover:border-foreground/30 hover:bg-muted/40"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="text-lg font-semibold text-foreground">{doc.title}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{doc.description}</p>
                <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-foreground">
                  Xem tài liệu
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
