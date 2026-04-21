import { Coffee, Sparkles, Pill, Check } from "lucide-react"

const INDUSTRIES = [
  {
    icon: Coffee,
    badge: "Thực phẩm & đồ uống",
    title: "Cà phê, hạt điều, trà, gia vị, thực phẩm khô",
    bullets: [
      "Hỗ trợ đăng ký FDA Food Facility và Prior Notice trước khi giao hàng",
      "Kết nối với chuỗi phân phối thực phẩm nhập khẩu tại Mỹ",
      "Lưu hồ sơ HACCP, CoA, hun trùng theo từng lô hàng",
    ],
  },
  {
    icon: Sparkles,
    badge: "Mỹ phẩm & chăm sóc cá nhân",
    title: "Serum, kem dưỡng, dầu gội, xà phòng thảo dược",
    bullets: [
      "Hỗ trợ FDA Cosmetic Listing theo luật MoCRA mới nhất",
      "Tìm buyer là chuỗi nhà thuốc, wellness store và salon tại Mỹ",
      "Quản lý chứng nhận Organic, Cruelty-free, Halal kèm từng sản phẩm",
    ],
  },
  {
    icon: Pill,
    badge: "Thực phẩm chức năng",
    title: "Viên uống bổ sung, thảo dược, collagen, vitamin & khoáng chất",
    bullets: [
      "Hỗ trợ FDA Food Facility + hồ sơ DSHEA và nhãn Supplement Facts đúng chuẩn 21 CFR 101.36",
      "Kết nối với chuỗi health store, phòng khám và nhà phân phối TPCN tại Mỹ",
      "Rà soát claim sản phẩm (structure/function) để tránh bị FDA flag hoặc buyer từ chối",
    ],
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
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">Ngành hàng phục vụ</p>
          <h2
            id="audiences-title"
            className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Chuyên sâu cho 3 ngành xuất khẩu chủ lực sang Mỹ
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
            Mỗi ngành có quy định và thị trường buyer riêng. Vexim Bridge có chuyên gia
            am hiểu từng ngành — không áp dụng một công thức chung cho tất cả.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {INDUSTRIES.map((industry) => {
            const Icon = industry.icon
            return (
              <article
                key={industry.title}
                className="group relative flex flex-col gap-4 rounded-xl border border-border/80 bg-card p-6 transition-all hover:border-accent/60 hover:shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/5 text-primary ring-1 ring-inset ring-primary/10 transition-colors group-hover:bg-accent/10 group-hover:text-accent group-hover:ring-accent/20">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <span className="inline-block rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent">
                    {industry.badge}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-foreground">{industry.title}</h3>
                <ul className="mt-1 flex flex-col gap-2.5">
                  {industry.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                        <Check className="h-2.5 w-2.5" aria-hidden="true" strokeWidth={3} />
                      </span>
                      <span className="leading-relaxed">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </article>
            )
          })}
        </div>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          Đang mở rộng sang thiết bị y tế (FDA 510(k), Establishment Registration) và một số ngành khác.{" "}
          <a href="#final-cta" className="font-semibold text-primary underline-offset-4 hover:underline">
            Liên hệ để chúng tôi đánh giá ngành của bạn
          </a>
          .
        </p>
      </div>
    </section>
  )
}
