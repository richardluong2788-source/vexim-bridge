import {
  Building2,
  Search,
  Handshake,
  ShieldCheck,
  Truck,
} from "lucide-react"

const STEPS = [
  {
    number: "01",
    icon: Building2,
    owner: "Tuần 1-2",
    title: "Onboarding & FDA",
    desc: "Bạn ký hợp đồng dịch vụ và cung cấp giấy phép kinh doanh, hồ sơ chất lượng. Vexim hoàn tất FDA Registration, Prior Notice template và dựng buyer-ready profile cho nhà máy.",
  },
  {
    number: "02",
    icon: Search,
    owner: "Tuần 3-8",
    title: "Tìm và sàng lọc buyer Mỹ",
    desc: "Đội sales tại Mỹ tiếp cận 50+ buyer mỗi tháng, thẩm định pháp lý và tài chính. Bạn chỉ nhận đơn hàng phù hợp với năng lực sản xuất - thông tin buyer được giữ kín cho đến khi bạn đồng ý đàm phán.",
  },
  {
    number: "03",
    icon: Handshake,
    owner: "Khi có đơn",
    title: "Đàm phán & ký hợp đồng",
    desc: "Vexim đàm phán giá, MOQ, Incoterms và điều khoản thanh toán thay bạn. Khi đôi bên đồng thuận, hợp đồng được ký với điều khoản pháp lý chuẩn quốc tế và lock vào hệ thống.",
  },
  {
    number: "04",
    icon: ShieldCheck,
    owner: "Trước khi giao hàng",
    title: "Verify L/C & xác thực thanh toán",
    desc: "Vexim verify SWIFT BIC, đối chiếu OFAC sanctions, phân tier ngân hàng phát hành L/C. Chỉ khi 6/6 mục checklist L/C được tick xác nhận, hàng mới được phép xuống tàu.",
  },
  {
    number: "05",
    icon: Truck,
    owner: "Logistics & Fulfillment",
    title: "Giao hàng đến tay buyer Mỹ",
    desc: "Vexim điều phối forwarder, hải quan và kho bãi tại Mỹ qua mạng lưới đối tác chiến lược. Hỗ trợ Amazon FBA prep, retail compliance hoặc B2B distribution - đến khi USD vào tài khoản nhà máy.",
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
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">
            Quy trình
          </p>
          <h2
            id="how-it-works-title"
            className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            5 bước từ ký hợp đồng đến USD vào tài khoản
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
            Bạn không phải đoán xem bước tiếp theo là gì hay phải tự làm việc với
            forwarder, ngân hàng, customs broker. Vexim điều phối tất cả - bạn chỉ
            cần tập trung sản xuất.
          </p>
        </div>

        <ol className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-5 lg:gap-6">
          {STEPS.map((step) => {
            const Icon = step.icon
            return (
              <li key={step.number} className="relative flex flex-col">
                <div className="flex flex-col items-start gap-4">
                  <div className="relative flex-shrink-0">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-accent/15">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">
                      {step.number.replace("0", "")}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col">
                    <span className="inline-flex w-fit items-center rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {step.owner}
                    </span>
                    <h3 className="mt-2 text-base font-semibold text-foreground">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {step.desc}
                    </p>
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
