const STEPS = [
  {
    week: "Tuần 1–2",
    icon: "🤝",
    title: "Onboard & FDA",
    short: "Vexim chuẩn bị mọi thứ",
    actions: ["Tư vấn 1:1, hiểu sản phẩm và năng lực nhà máy", "Hoàn thiện hồ sơ FDA trong 24–48h", "Dựng profile nhà máy theo chuẩn buyer Mỹ"],
    you: "Cung cấp giấy tờ sẵn có",
    color: "bg-blue-500/10 border-blue-500/30 text-blue-600",
    dot: "bg-blue-500",
  },
  {
    week: "Tuần 3–8",
    icon: "🎯",
    title: "Tìm Buyer",
    short: "50+ buyer/tháng được tiếp cận",
    actions: ["Sàng lọc 50+ buyer Mỹ có lịch sử nhập khẩu", "Soạn & gửi email chào hàng chuyên nghiệp", "Thương lượng giá và timeline giao mẫu"],
    you: "Nhận thông báo khi có buyer quan tâm",
    color: "bg-amber-500/10 border-amber-500/30 text-amber-600",
    dot: "bg-amber-500",
  },
  {
    week: "Tuần 8–12",
    icon: "💰",
    title: "Đơn hàng & Tiền về",
    short: "Tiền USD vào tài khoản bạn",
    actions: ["Phối hợp giao mẫu và chứng từ xuất nhập khẩu", "Xác thực SWIFT qua quy trình 2 lớp độc lập", "Theo dõi đến khi tiền thực vào tài khoản"],
    you: "Sản xuất và giao hàng — Vexim lo phần còn lại",
    color: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600",
    dot: "bg-emerald-500",
  },
]

export function LandingHowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-title"
      className="scroll-mt-20 border-b border-border/60 bg-secondary/30"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">8–12 tuần từ ký HĐ đến đơn hàng đầu tiên</p>
          <h2
            id="how-it-works-title"
            className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Bạn làm sản xuất. Chúng tôi lo phần còn lại.
          </h2>
        </div>

        {/* Horizontal progress bar — visual anchor */}
        <div className="mx-auto mt-12 max-w-3xl">
          <div className="relative flex items-center justify-between">
            {STEPS.map((step, i) => (
              <div key={step.week} className="flex flex-1 flex-col items-center">
                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <div
                    aria-hidden="true"
                    className="absolute left-0 right-0 top-5 -z-10 h-0.5 bg-border"
                    style={{ left: `${(i + 0.5) / STEPS.length * 100}%`, right: `${(STEPS.length - i - 1.5) / STEPS.length * 100}%` }}
                  />
                )}
                {/* Step circle */}
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 bg-card text-xl ${step.color}`}>
                  {step.icon}
                </div>
                <p className="mt-2 text-[11px] font-semibold text-muted-foreground">{step.week}</p>
                <p className="text-xs font-semibold text-foreground">{step.title}</p>
              </div>
            ))}
            {/* Full connector */}
            <div aria-hidden="true" className="absolute left-[16.6%] right-[16.6%] top-5 -z-10 h-0.5 bg-border" />
          </div>
        </div>

        {/* Step detail cards */}
        <ol className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {STEPS.map((step) => (
            <li
              key={step.week}
              className={`flex flex-col gap-4 rounded-xl border p-6 ${step.color.includes("blue") ? "border-blue-200 bg-blue-50/50 dark:border-blue-900/30 dark:bg-blue-950/20" : step.color.includes("amber") ? "border-amber-200 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/20" : "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/30 dark:bg-emerald-950/20"}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl" aria-hidden="true">{step.icon}</span>
                <div>
                  <p className="font-semibold text-foreground">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.week}</p>
                </div>
              </div>

              <ul className="flex flex-col gap-2">
                {step.actions.map((action) => (
                  <li key={action} className="flex items-start gap-2 text-sm">
                    <span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${step.dot}`} aria-hidden="true" />
                    <span className="text-muted-foreground">{action}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto rounded-lg border border-primary/15 bg-primary/5 px-3 py-2">
                <span className="text-xs font-semibold text-primary">Bạn: </span>
                <span className="text-xs text-foreground">{step.you}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
