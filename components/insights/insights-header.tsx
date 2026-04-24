import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BrandMark } from "@/components/landing/brand-mark"
import { INSIGHT_CATEGORIES } from "@/lib/insights/types"

interface InsightsHeaderProps {
  locale?: "vi" | "en"
  activeCategory?: string
}

export function InsightsHeader({ locale = "vi", activeCategory }: InsightsHeaderProps) {
  const categories = INSIGHT_CATEGORIES.filter((c) => c.value !== "general")

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" aria-label="Vexim Bridge" className="flex items-center gap-2">
            <BrandMark className="h-8 w-8" />
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight text-foreground">
                Vexim Bridge
              </span>
              <span className="text-[11px] text-muted-foreground">
                {locale === "vi" ? "Insights" : "Insights"}
              </span>
            </div>
          </Link>

          <nav
            aria-label={locale === "vi" ? "Danh mục" : "Categories"}
            className="hidden items-center gap-6 md:flex"
          >
            <Link
              href="/insights"
              className={
                !activeCategory
                  ? "text-sm font-semibold text-foreground"
                  : "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              {locale === "vi" ? "Tất cả" : "All"}
            </Link>
            {categories.map((c) => (
              <Link
                key={c.value}
                href={`/insights?category=${c.value}`}
                className={
                  activeCategory === c.value
                    ? "text-sm font-semibold text-foreground"
                    : "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                }
              >
                {locale === "vi" ? c.labelVi : c.labelEn}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/">{locale === "vi" ? "Về trang chủ" : "Back to site"}</Link>
          </Button>
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/auth/login">
              {locale === "vi" ? "Đăng nhập" : "Sign in"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
