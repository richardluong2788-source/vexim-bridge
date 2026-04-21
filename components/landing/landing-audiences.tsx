import Image from "next/image"
import { Check } from "lucide-react"

const AUDIENCES = [
  {
    badge: "Dành cho nhà sản xuất Việt Nam",
    title: "Xuất khẩu sang Mỹ không cần phòng pháp chế riêng",
    bullets: [
      "Tự động kiểm tra giấy phép FDA và nhắc trước khi hết hạn",
      "Nhận đơn hàng đã được đội Vexim sàng lọc sẵn",
      "Giữ kín thông tin nhà máy cho đến khi chốt giá",
    ],
    image: "/landing/audience-manufacturer.jpg",
    imageAlt: "Nhà máy xuất khẩu Việt Nam đạt chuẩn FDA",
  },
  {
    badge: "Dành cho nhân viên kinh doanh",
    title: "Đơn hàng rõ ràng, giá gốc được bảo vệ",
    bullets: [
      "Bảng đơn hàng 5 bước, nhắc nhở mốc thời gian và giấy tờ cần nộp",
      "Không thấy giá gốc — chỉ thấy phần lợi nhuận thuộc về mình",
      "Mọi thao tác tự động ghi vào lịch sử, không cần báo cáo thủ công",
    ],
    image: "/landing/audience-team.jpg",
    imageAlt: "Đội ngũ nhân viên kinh doanh Vexim Bridge đang làm việc",
  },
  {
    badge: "Dành cho kế toán & tài chính",
    title: "Hoá đơn USD và lịch thanh toán ở cùng một nơi",
    bullets: [
      "Phát hành hoá đơn theo từng đợt giao hàng, tự động đánh số",
      "Hai lớp xác thực chứng từ chuyển tiền trước khi ghi nhận thanh toán",
      "Chi phí vận hành và báo cáo lãi/lỗ sẵn sàng để xuất ra Excel",
    ],
    image: "/landing/audience-buyer.jpg",
    imageAlt: "Kho vận tại Mỹ, minh hoạ quy trình tài chính và logistics",
  },
]

export function LandingAudiences() {
  return (
    <section
      id="audiences"
      aria-labelledby="audiences-title"
      className="scroll-mt-20 border-b border-border/60 bg-background"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">Đối tượng sử dụng</p>
          <h2
            id="audiences-title"
            className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Một nền tảng, đúng góc nhìn cho từng vai trò
          </h2>
        </div>

        <div className="mt-14 flex flex-col gap-20">
          {AUDIENCES.map((audience, index) => {
            const isReverse = index % 2 === 1
            return (
              <article
                key={audience.title}
                className={`grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12 ${
                  isReverse ? "lg:[&>div:first-child]:order-2" : ""
                }`}
              >
                <div className="lg:col-span-6">
                  <span className="inline-block rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent">
                    {audience.badge}
                  </span>
                  <h3 className="mt-4 text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    {audience.title}
                  </h3>
                  <ul className="mt-6 flex flex-col gap-3">
                    {audience.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-3 text-sm text-muted-foreground">
                        <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                          <Check className="h-3 w-3" aria-hidden="true" strokeWidth={3} />
                        </span>
                        <span className="leading-relaxed">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="lg:col-span-6">
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border/80 bg-card shadow-lg">
                    <Image
                      src={audience.image}
                      alt={audience.imageAlt}
                      fill
                      sizes="(min-width: 1024px) 540px, 100vw"
                      className="object-cover"
                    />
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
