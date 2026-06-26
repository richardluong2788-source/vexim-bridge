import { FileSignature, CalendarClock, HandCoins, TrendingUp } from "lucide-react"

const FEE_COMPONENTS = [
  {
    icon: FileSignature,
    step: "Bước 1 · Một lần duy nhất",
    title: "Phí khởi tạo",
    roi: "Tiết kiệm 3–6 tháng tự mày mò FDA",
    desc: "Vexim thẩm định nhà máy, hoàn thiện hồ sơ FDA, dựng profile buyer-ready và xây dựng kế hoạch tiếp cận thị trường Mỹ riêng cho bạn. Xong trước khi bắt đầu tìm buyer.",
  },
  {
    icon: CalendarClock,
    step: "Bước 2 · Trả hàng tháng",
    title: "Phí duy trì đội sales",
    roi: "Bằng 1/5 lương 1 nhân viên sales — nhưng có cả đội",
    desc: "Chi phí duy trì Account Executive, chuyên gia FDA, nhân viên đàm phán và nền tảng quản lý dành riêng cho nhà máy bạn. Cộng thêm: 50% phí này được khấu trừ vào hoa hồng đơn hàng đầu tiên.",
  },
  {
    icon: HandCoins,
    step: "Bước 3 · Chỉ khi có tiền về",
    title: "Hoa hồng thành công",
    roi: "Vexim chỉ được trả khi bạn được trả",
    desc: "% trên kim ngạch đơn hàng đã thanh toán thành công bằng USD. Nếu buyer không thanh toán, Vexim không thu. Lợi ích của chúng tôi gắn trực tiếp với dòng tiền thực tế của bạn.",
  },
]

export function LandingPricingPromise() {
  return (
    <section
      id="pricing-promise"
      aria-labelledby="pricing-promise-title"
      className="scroll-mt-20 border-b border-border/60 bg-background"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">Đầu tư, không phải chi phí</p>
          <h2
            id="pricing-promise-title"
            className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Mỗi đồng bạn trả Vexim đều gắn với kết quả bạn nhận được
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
            Không phí ẩn. Không cam kết dài hạn mù. Ba cấu phần minh bạch — mỗi cái đều có lý do và gắn với một kết quả cụ thể bạn có thể đo được.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          {FEE_COMPONENTS.map((fee) => {
            const Icon = fee.icon
            return (
              <article
                key={fee.title}
                className="flex flex-col gap-4 rounded-xl border border-border/80 bg-card p-6"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10 text-accent ring-1 ring-inset ring-accent/20">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <span className="text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {fee.step}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-semibold text-foreground">{fee.title}</h3>
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                    <p className="text-sm font-semibold text-accent">{fee.roi}</p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{fee.desc}</p>
              </article>
            )
          })}
        </div>

        {/* Risk reversal callout */}
        <div className="mx-auto mt-10 max-w-3xl rounded-xl border border-accent/30 bg-accent/5 p-6">
          <p className="text-center text-base font-semibold text-foreground">
            Vexim chỉ thực sự có lãi khi nhà máy của bạn có đơn hàng USD.
          </p>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Con số cụ thể (phí khởi tạo, retainer và % hoa hồng) được báo giá riêng theo ngành hàng và quy mô nhà máy. Tất cả ghi rõ trong hợp đồng trước khi ký, không phí ẩn —{" "}
            <a href="#final-cta" className="font-semibold text-primary underline-offset-4 hover:underline">
              đặt lịch tư vấn để nhận báo giá chi tiết
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  )
}
