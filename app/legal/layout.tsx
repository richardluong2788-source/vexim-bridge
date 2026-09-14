import type { ReactNode } from "react"
import Link from "next/link"
import { siteConfig } from "@/lib/site-config"

/**
 * Shell tối giản cho các trang /legal/*.
 *
 * Trước đây layout này dùng lại header/footer của landing page; sau khi
 * landing page bị gỡ (viết lại toàn bộ), layout tự cung cấp chrome riêng
 * để các văn bản pháp lý vẫn hiển thị độc lập và index được trên Google.
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  const year = new Date().getFullYear()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-foreground"
          >
            {siteConfig.name}
          </Link>
          <Link
            href="/auth/login"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Đăng nhập
          </Link>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <span>
            © {year} {siteConfig.legalName}
          </span>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link href="/legal/terms" className="transition-colors hover:text-foreground">
              Điều khoản dịch vụ
            </Link>
            <Link href="/legal/privacy" className="transition-colors hover:text-foreground">
              Chính sách bảo mật
            </Link>
            <Link href="/legal/cookies" className="transition-colors hover:text-foreground">
              Chính sách cookie
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
