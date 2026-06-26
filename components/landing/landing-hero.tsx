import Link from "next/link"
import Image from "next/image"
import { ArrowRight, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConsultationBookingDialog } from "@/components/landing/consultation-booking-dialog"
import { HeroRevenueChart } from "@/components/landing/hero-revenue-chart"

interface LandingHeroProps {
  isAuthed: boolean
  dashboardHref: string
}

export function LandingHero({ isAuthed, dashboardHref }: LandingHeroProps) {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden border-b border-border/60"
      style={{ background: "oklch(0.17 0.04 264)" }}
    >
      {/* Dot pattern overlay */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">

        {/* LEFT — copy */}
        <div className="flex flex-col gap-6">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-semibold text-white">
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-400" />
            </span>
            180+ nhà máy Việt Nam đã có đơn hàng USD
          </div>

          <h1
            id="hero-title"
            className="text-balance text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-[3.25rem]"
          >
            Nhà máy của bạn xứng đáng có{" "}
            <span className="text-teal-300">đơn hàng từ Mỹ</span>{" "}
            — không phải chờ thêm 2 năm.
          </h1>

          <p className="max-w-lg text-pretty text-lg leading-relaxed text-white/70">
            Vexim Trade là đội sales xuất khẩu chuyên trách của bạn. Chúng tôi chủ động tìm buyer, đàm phán, xử lý FDA — bạn chỉ cần lo sản xuất và nhận tiền.
          </p>

          {/* Key proof points */}
          <ul className="flex flex-col gap-2">
            {[
              "Đơn mẫu đầu tiên trong 8–12 tuần",
              "50+ buyer Mỹ được tiếp cận mỗi tháng",
              "Hoa hồng chỉ thu khi tiền USD vào tài khoản bạn",
            ].map((point) => (
              <li key={point} className="flex items-center gap-2.5 text-sm text-white/80">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-teal-400" aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>

          {/* CTAs */}
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            {isAuthed ? (
              <Button asChild size="lg" className="gap-2 bg-teal-500 text-white hover:bg-teal-400">
                <Link href={dashboardHref}>
                  Vào Dashboard <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <>
                <ConsultationBookingDialog
                  trigger={
                    <Button size="lg" className="gap-2 bg-teal-500 text-white hover:bg-teal-400">
                      Đặt lịch tư vấn miễn phí
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  }
                />
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  <a href="#comparison">So sánh vs tự lập phòng sales</a>
                </Button>
              </>
            )}
          </div>
          <p className="text-xs text-white/40">Miễn phí tư vấn · Không ràng buộc · Phản hồi trong 24h</p>
        </div>

        {/* RIGHT — visual panel */}
        <div className="flex flex-col gap-4">
          {/* Dashboard mockup */}
          <div className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/40">
            <div className="flex items-center gap-1.5 border-b border-white/10 bg-white/5 px-4 py-2.5">
              <span className="h-3 w-3 rounded-full bg-red-400/70" aria-hidden="true" />
              <span className="h-3 w-3 rounded-full bg-yellow-400/70" aria-hidden="true" />
              <span className="h-3 w-3 rounded-full bg-green-400/70" aria-hidden="true" />
              <span className="ml-2 text-xs text-white/40">Vexim Trade — Pipeline</span>
            </div>
            <Image
              src="/landing/hero-dashboard.png"
              alt="Màn hình quản lý pipeline đơn hàng xuất khẩu của Vexim Trade"
              width={640}
              height={400}
              className="w-full object-cover"
              priority
            />
          </div>

          {/* Revenue chart card */}
          <HeroRevenueChart />

          {/* Mini stat strip */}
          <div className="grid grid-cols-3 divide-x divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-white/5">
            {[
              { value: "8–12", label: "Tuần ra đơn", unit: "tuần" },
              { value: "$12.4M", label: "Đã thanh toán", unit: "" },
              { value: "94%", label: "Đạt FDA / 30 ngày", unit: "" },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center justify-center px-4 py-4 text-center">
                <span className="text-xl font-semibold text-white">{s.value}</span>
                <span className="mt-0.5 text-[11px] text-white/50">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
