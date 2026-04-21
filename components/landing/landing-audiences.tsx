import Image from "next/image"
import { Check } from "lucide-react"

const AUDIENCES = [
  {
    badge: "Dành cho nhà sản xuất VN",
    title: "Xuất khẩu không cần phòng pháp chế riêng",
    bullets: [
      "Auto-check FDA & cảnh báo trước khi hết hạn",
      "Nhận lead đã qua sàng lọc của Lead Researcher",
      "Được bảo vệ danh tính đến khi chốt giá",
    ],
    image: "/landing/audience-manufacturer.jpg",
    imageAlt: "Nhà máy xuất khẩu Việt Nam đạt chuẩn FDA",
  },
  {
    badge: "Dành cho Account Executive",
    title: "Pipeline sạch, cost-price được bảo vệ",
    bullets: [
      "Kanban 5 stage kèm SLA và compliance gate",
      "Không được sửa giá gốc — chỉ thấy net profit margin",
      "Mọi hoạt động ghi vào audit log tự động",
    ],
    image: "/landing/audience-team.jpg",
    imageAlt: "Đội ngũ Account Executive Vexim Bridge đang làm việc",
  },
  {
    badge: "Dành cho Finance",
    title: "Invoice USD + billing plan trong một nơi",
    bullets: [
      "Phát hành invoice theo milestone, tự đánh số",
      "SWIFT verification 2-eye trước khi mark paid",
      "Operating expense và P&L xuất export ready",
    ],
    image: "/landing/audience-buyer.jpg",
    imageAlt: "Warehouse tại Mỹ, đại diện cho quy trình finance & logistics",
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
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">Đối tượng</p>
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
