import { HandCoins, Scale, HeartHandshake } from "lucide-react"

const PROMISES = [
  {
    icon: HandCoins,
    title: "Không có đơn hàng, không mất phí",
    desc: "Chúng tôi chỉ thu hoa hồng khi đơn hàng đã được thanh toán thành công. Không phí ẩn, không phí giữ chỗ, không phí “xem buyer”.",
  },
  {
    icon: Scale,
    title: "Minh bạch từ đầu đến cuối",
    desc: "Mức phí cố định và tỷ lệ hoa hồng được ghi rõ trong hợp đồng trước khi bạn bắt đầu. Không phát sinh bất ngờ sau này.",
  },
  {
    icon: HeartHandshake,
    title: "Bạn thành công, chúng tôi thành công",
    desc: "Lợi ích của Vexim gắn trực tiếp với doanh thu xuất khẩu của bạn. Chúng tôi không kiếm được tiền nếu bạn không bán được hàng.",
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
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">Cam kết chi phí</p>
          <h2
            id="pricing-promise-title"
            className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Công bằng, minh bạch, không rủi ro phí ẩn
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          {PROMISES.map((promise) => {
            const Icon = promise.icon
            return (
              <article
                key={promise.title}
                className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-6"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10 text-accent ring-1 ring-inset ring-accent/20">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-foreground">{promise.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{promise.desc}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
