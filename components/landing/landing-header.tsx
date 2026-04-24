import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BrandMark } from "@/components/landing/brand-mark"
import { ConsultationBookingDialog } from "@/components/landing/consultation-booking-dialog"

interface LandingHeaderProps {
  isAuthed: boolean
  dashboardHref: string
}

const NAV_LINKS = [
  { href: "#features", label: "Tính năng" },
  { href: "#how-it-works", label: "Quy trình" },
  { href: "#security", label: "An toàn" },
  { href: "#audiences", label: "Đối tượng" },
  { href: "/insights", label: "Insights" },
  { href: "#faq", label: "Câu hỏi" },
]

export function LandingHeader({ isAuthed, dashboardHref }: LandingHeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Vexim Bridge — Trang chủ" className="flex items-center gap-2">
          <BrandMark className="h-8 w-8" />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight text-foreground">Vexim Bridge</span>
            <span className="text-[11px] text-muted-foreground">Cầu nối xuất khẩu Việt – Mỹ</span>
          </div>
        </Link>

        <nav aria-label="Điều hướng chính" className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {isAuthed ? (
            <Button asChild size="sm" className="gap-1.5">
              <Link href={dashboardHref}>
                Vào Dashboard
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/auth/login">Đăng nhập</Link>
              </Button>
              <ConsultationBookingDialog
                trigger={
                  <Button size="sm" className="gap-1.5">
                    Đặt lịch tư vấn
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                }
              />
            </>
          )}
        </div>
      </div>
    </header>
  )
}
