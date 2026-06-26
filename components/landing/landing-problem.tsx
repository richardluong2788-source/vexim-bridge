const GAPS = [
  {
    icon: "🔍",
    label: "Không có mạng lưới buyer",
    detail: "Tự tìm mất 1–2 năm mò mẫm",
    loss: "1–2 năm",
  },
  {
    icon: "📋",
    label: "Hồ sơ FDA thiếu / sai",
    detail: "Buyer từ chối hoặc hàng bị giữ cảng",
    loss: "$5K–$15K/lần",
  },
  {
    icon: "✍️",
    label: "Email thương mại kém",
    detail: "Buyer im lặng sau email đầu tiên",
    loss: "$30K–$200K/deal",
  },
  {
    icon: "💸",
    label: "Rủi ro SWIFT giả",
    detail: "Mất trắng cả lô hàng không lấy lại được",
    loss: "Cả lô hàng",
  },
]

export function LandingProblem() {
  return (
    <section aria-labelledby="problem-title" className="border-b border-border/60 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
          {/* Left: copy */}
          <div className="flex flex-col gap-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">Rào cản thực tế</p>
            <h2
              id="problem-title"
              className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
            >
              Sản phẩm tốt thôi là chưa đủ để có đơn hàng Mỹ
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground">
              Hầu hết nhà máy thất bại không phải vì sản phẩm kém — mà vì thiếu 4 thứ này. Mỗi tháng thiếu = một tháng doanh thu USD chạy vào tay đối thủ.
            </p>

            {/* Gap cards — compact horizontal */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {GAPS.map((gap) => (
                <div
                  key={gap.label}
                  className="flex items-start gap-3 rounded-xl border border-border/80 bg-card p-4"
                >
                  <span className="text-2xl leading-none" aria-hidden="true">{gap.icon}</span>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-semibold text-foreground">{gap.label}</p>
                    <p className="text-xs text-muted-foreground">{gap.detail}</p>
                    <p className="mt-1 text-xs font-semibold text-destructive">Thiệt hại: {gap.loss}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: visual flow diagram VN → Vexim → USA */}
          <div className="rounded-2xl border border-border/80 bg-secondary/40 p-8">
            <p className="mb-6 text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Luồng xuất khẩu khi có Vexim
            </p>
            <div className="flex flex-col items-center gap-3">
              {/* VN Factory node */}
              <div className="flex w-full max-w-xs flex-col items-center rounded-xl border-2 border-primary bg-primary/5 px-6 py-4 text-center">
                <span className="text-3xl" aria-hidden="true">🏭</span>
                <p className="mt-2 font-semibold text-foreground">Nhà máy Việt Nam</p>
                <p className="text-xs text-muted-foreground">Sản xuất, đảm bảo chất lượng</p>
              </div>

              {/* Arrow down */}
              <div className="flex flex-col items-center gap-1">
                <div className="h-6 w-px bg-border" aria-hidden="true" />
                <div className="h-0 w-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-border" aria-hidden="true" />
              </div>

              {/* Vexim node — highlighted */}
              <div className="flex w-full max-w-xs flex-col items-center rounded-xl border-2 border-accent bg-accent/10 px-6 py-4 text-center">
                <span className="text-3xl" aria-hidden="true">⚡</span>
                <p className="mt-2 font-semibold text-foreground">Vexim Trade</p>
                <div className="mt-2 flex flex-wrap justify-center gap-1">
                  {["Tìm buyer", "FDA", "Đàm phán", "Xác thực SWIFT"].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Arrow down */}
              <div className="flex flex-col items-center gap-1">
                <div className="h-6 w-px bg-border" aria-hidden="true" />
                <div className="h-0 w-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-border" aria-hidden="true" />
              </div>

              {/* USA Buyer node */}
              <div className="flex w-full max-w-xs flex-col items-center rounded-xl border-2 border-emerald-500/40 bg-emerald-500/5 px-6 py-4 text-center">
                <span className="text-3xl" aria-hidden="true">🇺🇸</span>
                <p className="mt-2 font-semibold text-foreground">Buyer Mỹ</p>
                <p className="mt-1 text-xs font-semibold text-emerald-600">Thanh toán USD · Không rủi ro</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
