import Link from "next/link"
import { BrandMark } from "@/components/landing/brand-mark"
import { siteConfig } from "@/lib/site-config"

const COLUMNS = [
  {
    title: "Sản phẩm",
    links: [
      { label: "Tính năng", href: "#features" },
      { label: "Quy trình", href: "#how-it-works" },
      { label: "An toàn", href: "#security" },
      { label: "Câu hỏi thường gặp", href: "#faq" },
    ],
  },
  {
    title: "Công ty",
    links: [
      { label: "Về chúng tôi", href: "#audiences" },
      { label: "Liên hệ", href: `mailto:${siteConfig.contact.email}` },
      { label: "Hỗ trợ", href: `mailto:${siteConfig.contact.support}` },
    ],
  },
  {
    title: "Pháp lý",
    links: [
      { label: "Điều khoản dịch vụ", href: "/legal/terms" },
      { label: "Chính sách bảo mật", href: "/legal/privacy" },
      { label: "Chính sách cookie", href: "/legal/cookies" },
    ],
  },
]

export function LandingFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="bg-background" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Chân trang
      </h2>
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Link href="/" className="flex items-center gap-2" aria-label="Vexim Bridge — Trang chủ">
              <BrandMark className="h-8 w-8" />
              <span className="text-sm font-semibold tracking-tight text-foreground">
                {siteConfig.name}
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {siteConfig.description}
            </p>
            <p className="mt-4 text-xs text-muted-foreground">{siteConfig.contact.address}</p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-8">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h3 className="text-sm font-semibold text-foreground">{col.title}</h3>
                <ul className="mt-4 flex flex-col gap-3">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-8 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            &copy; {year} {siteConfig.legalName}. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a
              href={siteConfig.social.linkedin}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              aria-label="LinkedIn"
              rel="noopener noreferrer"
              target="_blank"
            >
              LinkedIn
            </a>
            <span aria-hidden="true" className="text-muted-foreground">
              ·
            </span>
            <a
              href={siteConfig.social.facebook}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Facebook"
              rel="noopener noreferrer"
              target="_blank"
            >
              Facebook
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
