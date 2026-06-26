import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConsultationBookingDialog } from "@/components/landing/consultation-booking-dialog"

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
              Mỗi tháng chờ đợi là một tháng đối thủ có thêm đơn hàng Mỹ.
            </h2>
            <p className="mt-4 text-pretty text-base leading-relaxed text-primary-foreground/80">
              Đặt lịch tư vấn 1:1 miễn phí. Trong 30 phút, chuyên gia Vexim sẽ đánh giá nhà máy của bạn, chỉ ra cụ thể hồ sơ FDA cần bổ sung gì và đưa ra kế hoạch tiếp cận buyer phù hợp với ngành hàng của bạn.
            </p>

            {/* Risk reversal */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-primary-foreground/70">
              <span>Tư vấn miễn phí, không ràng buộc</span>
              <span aria-hidden="true">·</span>
              <span>Phản hồi trong 24 giờ làm việc</span>
              <span aria-hidden="true">·</span>
              <span>Hoa hồng chỉ thu khi bạn nhận được tiền</span>
            </div>

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
                  <ConsultationBookingDialog
                    trigger={
                      <Button
                        size="lg"
                        className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90 text-base"
                      >
                        Đặt lịch tư vấn miễn phí ngay
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    }
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
