const STATS = [
  { label: "Nhà sản xuất VN đang dùng", value: "180+", icon: "🏭" },
  { label: "Buyer Mỹ đã thẩm định", value: "420+", icon: "🤝" },
  { label: "Kim ngạch đã thanh toán", value: "$12.4M", icon: "💵" },
  { label: "Đạt chuẩn FDA / 30 ngày", value: "94%", icon: "✅" },
]

const INDUSTRIES = ["Thực phẩm & Đồ uống", "Mỹ phẩm & CSKN", "Thực phẩm chức năng", "Thiết bị y tế"]

export function LandingTrustBar() {
  return (
    <section aria-label="Chỉ số nền tảng" className="border-b border-border/60 bg-primary">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* Stats */}
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="flex flex-col gap-0.5">
                <dd className="text-2xl font-semibold tracking-tight text-white">{stat.value}</dd>
                <dt className="text-xs text-white/60">{stat.label}</dt>
              </div>
            ))}
          </dl>

          {/* Industry pills */}
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <span className="text-xs font-medium text-white/50">Ngành:</span>
            {INDUSTRIES.map((ind) => (
              <span
                key={ind}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/80"
              >
                {ind}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
