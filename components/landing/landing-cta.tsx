import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface LandingCtaProps {
  isAuthed: boolean
  dashboardHref: string
}

export function LandingCta({ isAuthed, dashboardHref }: LandingCtaProps) {
  return (
    <section aria-labelledby="final-cta-title" className="border-b border-border/60 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-primary px-6 py-16 text-primary-foreground sm:px-12 sm:py-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-accent/25 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-20 left-1/3 h-72 w-72 rounded-full bg-accent/10 blur-3xl"
          />

          <div className="relative mx-auto max-w-2xl text-center">
            <h2
              id="final-cta-title"
              className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              Sẵn sàng xuất khẩu sang Mỹ một cách an toàn?
            </h2>
            <p className="mt-4 text-pretty text-base leading-relaxed text-primary-foreground/80">
              Mở tài khoản nhà sản xuất miễn phí trong 5 phút. Đội ngũ của chúng tôi sẽ liên hệ
              hướng dẫn bạn hoàn tất FDA và nhận lead đầu tiên.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {isAuthed ? (
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  <Link href={dashboardHref}>
                    Vào Dashboard
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button
                    asChild
                    size="lg"
                    className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    <Link href="/auth/login">
                      Đăng ký miễn phí
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                  >
                    <a href="mailto:hello@veximbridge.com">Liên hệ tư vấn</a>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
