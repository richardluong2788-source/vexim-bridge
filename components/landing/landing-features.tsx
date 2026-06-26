// Bento grid: 1 hero card wide + 2 small, then 3 small
const BENTO = [
  {
    emoji: "👥",
    title: "Đội sales chuyên trách",
    metric: "50+",
    metricLabel: "buyer/tháng",
    desc: "Chủ động tìm, sàng lọc và chào hàng — không cần bạn tuyển dụng hay đào tạo.",
    wide: true,
    accent: "border-blue-200 bg-blue-50/60 dark:border-blue-900/30 dark:bg-blue-950/20",
    metricColor: "text-blue-600",
  },
  {
    emoji: "📋",
    title: "FDA trọn gói",
    metric: "94%",
    metricLabel: "đạt chuẩn / 30 ngày",
    desc: "Xử lý đăng ký FDA, nhãn hàng, hồ sơ tuân thủ. Không cần thuê tư vấn riêng.",
    wide: false,
    accent: "border-teal-200 bg-teal-50/60 dark:border-teal-900/30 dark:bg-teal-950/20",
    metricColor: "text-teal-600",
  },
  {
    emoji: "🛡️",
    title: "Xác thực SWIFT 2 lớp",
    metric: "0",
    metricLabel: "rủi ro thanh toán giả",
    desc: "Hai người độc lập xác nhận mỗi giao dịch. Tiền thật mới đánh dấu hoàn thành.",
    wide: false,
    accent: "border-violet-200 bg-violet-50/60 dark:border-violet-900/30 dark:bg-violet-950/20",
    metricColor: "text-violet-600",
  },
  {
    emoji: "📊",
    title: "Dashboard real-time",
    metric: "24/7",
    metricLabel: "theo dõi đơn hàng",
    desc: "Biết chính xác deal nào đang ở bước nào — không hỏi qua Zalo nữa.",
    wide: false,
    accent: "border-amber-200 bg-amber-50/60 dark:border-amber-900/30 dark:bg-amber-950/20",
    metricColor: "text-amber-600",
  },
  {
    emoji: "✍️",
    title: "Đàm phán tiếng Anh thương mại",
    metric: "100%",
    metricLabel: "tiếng Anh chuẩn",
    desc: "Không mất deal vì rào cản ngôn ngữ. Mọi email lưu trong hệ thống.",
    wide: false,
    accent: "border-rose-200 bg-rose-50/60 dark:border-rose-900/30 dark:bg-rose-950/20",
    metricColor: "text-rose-600",
  },
  {
    emoji: "🗂️",
    title: "Lịch sử giao dịch bất biến",
    metric: "∞",
    metricLabel: "dữ liệu được lưu giữ",
    desc: "Không bao giờ mất dù nhân sự thay đổi. Sẵn sàng đối chiếu với đối tác hay thanh tra.",
    wide: false,
    accent: "border-slate-200 bg-slate-50/60 dark:border-slate-900/30 dark:bg-slate-950/20",
    metricColor: "text-slate-600",
  },
]

export function LandingFeatures() {
  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className="scroll-mt-20 border-b border-border/60 bg-background"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">Bạn nhận được gì</p>
          <h2
            id="features-title"
            className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            6 thứ bạn có ngay từ tháng đầu tiên
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
            Không phải phần mềm bạn tự dùng — đây là đội ngũ, quy trình và hạ tầng xuất khẩu hoàn chỉnh, vận hành thay bạn.
          </p>
        </div>

        {/* Bento grid */}
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENTO.map((item) => (
            <article
              key={item.title}
              className={`flex flex-col gap-3 rounded-xl border p-6 transition-shadow hover:shadow-md ${item.wide ? "sm:col-span-2 lg:col-span-1" : ""} ${item.accent}`}
            >
              {/* Emoji + metric side by side */}
              <div className="flex items-start justify-between">
                <span className="text-4xl leading-none" aria-hidden="true">{item.emoji}</span>
                <div className="text-right">
                  <p className={`text-2xl font-semibold leading-none tracking-tight ${item.metricColor}`}>
                    {item.metric}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{item.metricLabel}</p>
                </div>
              </div>
              <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
