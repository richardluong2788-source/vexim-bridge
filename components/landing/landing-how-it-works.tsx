import { Building2, Handshake, ShieldCheck } from "lucide-react"

const STEPS = [
  {
    number: "01",
    icon: Building2,
    title: "Onboard và verify FDA",
    desc: "Đăng ký tài khoản nhà sản xuất, tải FDA cert và COA. Hệ thống kiểm tra định dạng số FDA và ngày hết hạn trước khi mở khoá nhận lead.",
  },
  {
    number: "02",
    icon: Handshake,
    title: "Nhận lead ẩn danh",
    desc: "Đội ngũ Lead Researcher giao buyer Mỹ đã sàng lọc. Bạn đàm phán qua email template của Vexim Bridge — mọi tin nhắn đều được lưu audit.",
  },
  {
    number: "03",
    icon: ShieldCheck,
    title: "Chốt giá và SWIFT-verified",
    desc: "Khi hai bên đồng ý giá, danh tính buyer được mở. Chứng từ SWIFT qua quy trình 2-eye verification rồi mới đánh dấu paid.",
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
            Từ đăng ký đến nhận tiền USD trong 3 bước
          </h2>
        </div>

        <ol className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {STEPS.map((step) => {
            const Icon = step.icon
            return (
              <li key={step.number} className="relative flex flex-col">
                <div className="flex items-start gap-4">
                  <div className="relative flex-shrink-0">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-accent/15">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent font-mono text-[10px] font-semibold text-accent-foreground">
                      {step.number.replace("0", "")}
                    </span>
                  </div>
                  <div className="flex-1 pt-1.5">
                    <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
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
