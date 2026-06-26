import Link from "next/link"
import { ArrowRight, TrendingUp, Clock, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConsultationBookingDialog } from "@/components/landing/consultation-booking-dialog"

interface LandingHeroProps {
  isAuthed: boolean
  dashboardHref: string
}

export function LandingHero({ isAuthed, dashboardHref }: LandingHeroProps) {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden border-b border-border/60 bg-background"
    >
      {/* Subtle grid backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(to right, color-mix(in oklch, var(--primary) 5%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklch, var(--primary) 5%, transparent) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 lg:px-8 lg:pb-28 lg:pt-24">

        {/* Eye-catching kicker */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-1.5 text-sm font-semibold text-accent">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            180+ nhà máy Việt Nam đã có đơn hàng USD
          </div>
        </div>

        {/* Main headline — outcome, not feature */}
        <h1
          id="hero-title"
          className="mx-auto mt-8 max-w-4xl text-balance text-center text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl"
        >
          Nhà máy của bạn xứng đáng có{" "}
          <span className="text-primary">đơn hàng từ Mỹ</span>
          {" "}— không phải chờ đợi thêm 2 năm nữa.
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-balance text-center text-lg leading-relaxed text-muted-foreground">
          Vexim Trade là đội sales xuất khẩu chuyên trách của bạn tại thị trường Mỹ. Chúng tôi chủ động tìm buyer, đàm phán, xử lý FDA — bạn chỉ cần lo sản xuất và nhận tiền.
        </p>

        {/* CTA buttons */}
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {isAuthed ? (
            <Button asChild size="lg" className="gap-2">
              <Link href={dashboardHref}>
                Vào Dashboard
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <>
              <ConsultationBookingDialog
                trigger={
                  <Button size="lg" className="gap-2 text-base">
                    Đặt lịch tư vấn miễn phí
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                }
              />
              <Button asChild size="lg" variant="outline" className="text-base">
                <a href="#comparison">Tại sao không tự lập phòng sales?</a>
              </Button>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Tư vấn 1:1 miễn phí · Phản hồi trong 24 giờ làm việc · Không ràng buộc
        </p>

        {/* Outcome metrics — the 3 numbers that matter to a factory owner */}
        <dl className="mx-auto mt-16 grid max-w-3xl grid-cols-1 gap-px overflow-hidden rounded-xl border border-border/80 bg-border/40 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5 bg-card px-8 py-6">
            <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Clock className="h-4 w-4 text-accent" aria-hidden="true" />
              Đơn mẫu đầu tiên
            </dt>
            <dd className="text-3xl font-semibold tracking-tight text-foreground">8–12 tuần</dd>
            <p className="text-xs text-muted-foreground">Tính từ ngày ký hợp đồng dịch vụ</p>
          </div>
          <div className="flex flex-col gap-1.5 bg-card px-8 py-6">
            <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-accent" aria-hidden="true" />
              Buyer được tiếp cận mỗi tháng
            </dt>
            <dd className="text-3xl font-semibold tracking-tight text-foreground">50+</dd>
            <p className="text-xs text-muted-foreground">Chủ động tìm và sàng lọc — không thụ động chờ</p>
          </div>
          <div className="flex flex-col gap-1.5 bg-card px-8 py-6">
            <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <DollarSign className="h-4 w-4 text-accent" aria-hidden="true" />
              Kim ngạch đã thanh toán
            </dt>
            <dd className="text-3xl font-semibold tracking-tight text-foreground">$12.4M</dd>
            <p className="text-xs text-muted-foreground">Cho các nhà máy Việt Nam trong hệ thống Vexim</p>
          </div>
        </dl>
      </div>
    </section>
  )
}
