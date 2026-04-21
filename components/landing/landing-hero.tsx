import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ShieldCheck, BadgeCheck } from "lucide-react"
import { Button } from "@/components/ui/button"

interface LandingHeroProps {
  isAuthed: boolean
  dashboardHref: string
}

export function LandingHero({ isAuthed, dashboardHref }: LandingHeroProps) {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden border-b border-border/60"
    >
      {/* Subtle grid backdrop, stays behind content */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(to right, color-mix(in oklch, var(--primary) 6%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklch, var(--primary) 6%, transparent) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 right-[-10%] h-[480px] w-[480px] rounded-full bg-accent/10 blur-3xl"
      />

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:gap-10 lg:px-8 lg:py-24">
        <div className="lg:col-span-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            Đã có 180+ nhà sản xuất Việt Nam xuất khẩu cùng Vexim Bridge
          </div>

          <h1
            id="hero-title"
            className="mt-6 text-balance text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl"
          >
            Phòng kinh doanh xuất khẩu Mỹ,{" "}
            <span className="relative whitespace-nowrap text-primary">
              thuê ngoài trọn gói
              <svg
                aria-hidden="true"
                viewBox="0 0 200 8"
                className="absolute -bottom-1 left-0 h-2 w-full text-accent"
                preserveAspectRatio="none"
              >
                <path
                  d="M0 5 C 50 0, 150 0, 200 5"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            .
          </h1>

          <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
            Thay vì tuyển và đào tạo một đội kinh doanh riêng cho thị trường Mỹ, bạn thuê
            Vexim Bridge làm phòng sales xuất khẩu. Chuyên gia của chúng tôi chủ động tìm
            buyer, đàm phán, xử lý FDA và thủ tục tuân thủ thị trường Hoa Kỳ theo từng ngành hàng - vận hành trên nền tảng quản lý
            minh bạch mà cả nhà máy và buyer cùng sử dụng.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {isAuthed ? (
              <Button asChild size="lg" className="gap-2">
                <Link href={dashboardHref}>
                  Vào Dashboard
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg" className="gap-2">
                  <Link href="/auth/login">
                    Đặt lịch tư vấn 1:1
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href="#how-it-works">Xem Vexim hoạt động thế nào</a>
                </Button>
              </>
            )}
          </div>

          <dl className="mt-10 grid grid-cols-2 gap-6 border-t border-border/60 pt-6 sm:max-w-md">
            <div>
              <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <BadgeCheck className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                Buyer Mỹ tiếp cận mỗi tháng
              </dt>
              <dd className="mt-1 text-2xl font-semibold tracking-tight text-foreground">50+</dd>
              <p className="text-xs text-muted-foreground">
                Được đội sales của Vexim chủ động tiếp cận và sàng lọc
              </p>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                Đơn hàng mẫu đầu tiên
              </dt>
              <dd className="mt-1 text-2xl font-semibold tracking-tight text-foreground">8 - 12 tuần</dd>
              <p className="text-xs text-muted-foreground">
                Thời gian trung bình từ khi ký hợp đồng dịch vụ đến khi có đơn mẫu
              </p>
            </div>
          </dl>
        </div>

        <div className="relative lg:col-span-4">
          <div className="relative mx-auto aspect-[4/3] w-full max-w-sm overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xl shadow-primary/10">
            <Image
              src="/landing/hero-dashboard.jpg"
              alt="Dashboard Vexim Bridge hiển thị đơn hàng xuất khẩu từ Việt Nam sang Mỹ"
              fill
              priority
              sizes="(min-width: 1024px) 360px, 100vw"
              className="object-cover"
            />
          </div>
          <div
            aria-hidden="true"
            className="absolute -bottom-4 -left-4 hidden rounded-lg border border-border bg-card p-4 shadow-lg sm:block lg:-bottom-6 lg:-left-6"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-accent">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Đã nhận thanh toán</span>
                <span className="text-sm font-semibold text-foreground">$48,200 · paid</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
