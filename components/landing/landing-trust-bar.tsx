const STATS = [
  { label: "Nhà sản xuất VN đã onboard", value: "180+" },
  { label: "Buyer Mỹ đã verify", value: "420+" },
  { label: "GMV đã thanh toán qua SWIFT", value: "$12.4M" },
  { label: "Tỷ lệ đạt FDA sau 30 ngày", value: "94%" },
]

export function LandingTrustBar() {
  return (
    <section aria-label="Chỉ số nền tảng" className="border-b border-border/60 bg-secondary/50">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <dl className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </dt>
              <dd className="text-3xl font-semibold tracking-tight text-foreground">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
