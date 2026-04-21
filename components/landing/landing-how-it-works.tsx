import { Building2, Handshake, ShieldCheck } from "lucide-react"

const STEPS = [
  {
    number: "01",
    icon: Building2,
    owner: "Bạn cung cấp — Vexim hỗ trợ",
    title: "Đăng ký nhà máy và hoàn thiện hồ sơ FDA",
    desc: "Bạn tạo tài khoản và tải lên giấy phép kinh doanh, FDA, chứng nhận chất lượng. Nếu thiếu giấy tờ, đội Vexim hướng dẫn hoàn tất trong vòng 24–48 giờ — bạn không cần thuê tư vấn riêng.",
  },
  {
    number: "02",
    icon: Handshake,
    owner: "Vexim chủ động tìm buyer",
    title: "Chúng tôi đưa đơn hàng đến cho bạn",
    desc: "Đội sales của Vexim tại Mỹ và Việt Nam chủ động tìm kiếm, xác minh doanh nghiệp và khảo sát nhu cầu của người mua. Bạn chỉ nhận những đơn hàng phù hợp với ngành nghề và năng lực sản xuất của mình.",
  },
  {
    number: "03",
    icon: ShieldCheck,
    owner: "Nền tảng đảm bảo an toàn",
    title: "Bạn chốt giá — hệ thống lo phần thanh toán",
    desc: "Khi hai bên đồng thuận, thông tin người mua được mở. Tiền USD từ Mỹ chuyển về qua quy trình xác thực hai lớp độc lập. Hệ thống chỉ đánh dấu “đã thanh toán” khi tiền thực sự vào tài khoản của bạn.",
  },
]

export function LandingHowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-title"
      className="scroll-mt-20 border-b border-border/60 bg-background"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">Quy trình</p>
          <h2
            id="how-it-works-title"
            className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Đội ngũ Vexim đồng hành ở từng bước — bạn không phải đi một mình
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
            Khác với các sàn B2B thông thường, chúng tôi không chỉ cho bạn chỗ đăng sản phẩm.
            Vexim chủ động đi tìm, thẩm định người mua Mỹ và lo cả phần thanh toán quốc tế.
          </p>
        </div>

        <ol className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {STEPS.map((step) => {
            const Icon = step.icon
            return (
              <li key={step.number} className="relative flex flex-col">
                <div className="flex items-start gap-4">
                  <div className="relative flex-shrink-0">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-accent/15">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">
                      {step.number.replace("0", "")}
                    </span>
                  </div>
                  <div className="flex-1 pt-1">
                    <span className="inline-block rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {step.owner}
                    </span>
                    <h3 className="mt-2 text-lg font-semibold text-foreground">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
