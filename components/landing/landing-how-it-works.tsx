const STEPS = [
  {
    week: "Tuần 1–2",
    label: "Vexim làm",
    title: "Chúng tôi gặp bạn, hiểu nhà máy và chuẩn bị mọi thứ",
    what_vexim_does: [
      "Tư vấn 1:1 để hiểu sản phẩm, năng lực sản xuất và mục tiêu của bạn",
      "Kiểm tra và hoàn thiện toàn bộ hồ sơ FDA theo đúng ngành hàng",
      "Dựng profile nhà máy theo chuẩn buyer Mỹ — không phải bản dịch Google",
    ],
    you_do: "Bạn chỉ cần cung cấp thông tin và giấy tờ sẵn có",
  },
  {
    week: "Tuần 3–8",
    label: "Vexim làm",
    title: "Đội sales chủ động tìm và thuyết phục buyer phù hợp với bạn",
    what_vexim_does: [
      "Nghiên cứu và sàng lọc 50+ buyer Mỹ có lịch sử nhập khẩu từng ngành",
      "Soạn và gửi email chào hàng chuyên nghiệp, theo dõi phản hồi hàng ngày",
      "Thương lượng giá, điều khoản và timeline giao mẫu với buyer quan tâm",
    ],
    you_do: "Bạn nhận thông báo khi có buyer quan tâm, quyết định tiến hay không",
  },
  {
    week: "Tuần 8–12",
    label: "Vexim đảm bảo",
    title: "Đơn mẫu đầu tiên — tiền USD về tài khoản, không rủi ro",
    what_vexim_does: [
      "Phối hợp lịch giao mẫu, chứng từ xuất nhập khẩu và điều kiện thanh toán",
      "Xác thực chứng từ thanh toán SWIFT qua quy trình 2 lớp độc lập",
      "Theo dõi đến khi tiền thực sự vào tài khoản của bạn",
    ],
    you_do: "Bạn sản xuất và giao hàng — Vexim lo phần còn lại",
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
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">Từ ký hợp đồng đến đơn hàng đầu tiên</p>
          <h2
            id="how-it-works-title"
            className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Bạn làm sản xuất. Chúng tôi lo phần còn lại.
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
            Trong 8–12 tuần đầu, bạn không cần học cách xuất khẩu sang Mỹ. Đội Vexim sẽ đồng hành từng bước — bạn chỉ cần đưa ra quyết định cuối cùng.
          </p>
        </div>

        <ol className="mt-14 flex flex-col gap-6 lg:gap-0">
          {STEPS.map((step, index) => (
            <li
              key={step.week}
              className="relative grid grid-cols-1 gap-6 lg:grid-cols-[200px_1fr]"
            >
              {/* Connector line between steps on desktop */}
              {index < STEPS.length - 1 && (
                <div
                  aria-hidden="true"
                  className="absolute left-[99px] top-14 hidden h-full w-px border-l border-dashed border-border/60 lg:block"
                />
              )}

              {/* Timeline label */}
              <div className="flex items-start gap-3 lg:flex-col lg:items-center lg:text-center">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-semibold">
                  {index + 1}
                </div>
                <div className="lg:mt-2">
                  <p className="text-sm font-semibold text-foreground">{step.week}</p>
                  <span className="inline-block rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                    {step.label}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-card p-6 lg:mb-8">
                <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                <ul className="flex flex-col gap-2">
                  {step.what_vexim_does.map((action) => (
                    <li key={action} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" aria-hidden="true" />
                      {action}
                    </li>
                  ))}
                </ul>
                <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-primary">Bạn:</span>
                  <span className="text-sm text-foreground">{step.you_do}</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
