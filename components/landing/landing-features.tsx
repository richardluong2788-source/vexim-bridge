import {
  Banknote,
  PackageCheck,
  Handshake,
  ShieldCheck,
  Eye,
  Scale,
} from "lucide-react"

/**
 * "What you actually get" section. Outcome-driven, not feature-driven —
 * every card answers the customer question: "Tôi nhận được gì?"
 */

const OUTCOMES = [
  {
    icon: Banknote,
    title: "USD vào đúng tài khoản nhà máy",
    desc: "Mỗi khoản thanh toán được xác thực hai lớp độc lập trước khi ghi nhận. Bạn nhận USD đúng số, đúng hạn - không bị lừa SWIFT, không bị quỵt nợ.",
    metric: "100%",
    metricLabel: "khoản thu được verify",
  },
  {
    icon: PackageCheck,
    title: "Hàng không bao giờ kẹt ở cảng Mỹ",
    desc: "FDA Food Facility, Prior Notice, MoCRA và DSHEA đều được Vexim chuẩn bị và gia hạn cho bạn. Container của bạn qua hải quan Mỹ trong 24-48 giờ.",
    metric: "0",
    metricLabel: "lô hàng bị giữ tại cảng",
  },
  {
    icon: Handshake,
    title: "Buyer trực tiếp, không qua broker ép giá",
    desc: "Vexim kết nối thẳng nhà máy với người mua cuối tại Mỹ. Không có tầng broker chen vào ăn margin, không bị cướp mối, không bị bỏ qua trong chuỗi cung ứng.",
    metric: "15-25%",
    metricLabel: "giá tốt hơn so với qua broker",
  },
  {
    icon: ShieldCheck,
    title: "Ngân hàng và L/C của buyer được thẩm định",
    desc: "Mọi BIC SWIFT đều được đối chiếu với danh sách OFAC, EU sanctions và phân tier rủi ro. Chặn L/C giả mạo và ngân hàng không uy tín trước khi xuống hàng.",
    metric: "Tier 1-4",
    metricLabel: "phân loại tự động",
  },
  {
    icon: Eye,
    title: "Luôn biết tiền của bạn đang ở đâu",
    desc: "Một dashboard duy nhất theo dõi từ buyer đầu tiên đến lúc USD về. Mỗi đơn hàng có timeline rõ ràng, không cần lục Zalo hay Excel rời rạc.",
    metric: "24/7",
    metricLabel: "truy cập real-time",
  },
  {
    icon: Scale,
    title: "Bằng chứng pháp lý khi có tranh chấp",
    desc: "Mọi email, hợp đồng, chứng từ thanh toán đều được lưu vĩnh viễn, không thể chỉnh sửa. Sẵn sàng đối chứng với buyer, ngân hàng hoặc cơ quan thanh tra.",
    metric: "10 năm",
    metricLabel: "lưu trữ tối thiểu",
  },
]

export function LandingFeatures() {
  return (
    <section
      id="outcomes"
      aria-labelledby="outcomes-title"
      className="scroll-mt-20 border-b border-border/60 bg-background"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">
            Bạn nhận được gì
          </p>
          <h2
            id="outcomes-title"
            className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            6 cam kết cụ thể, đo được bằng số
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
            Vexim Bridge không bán phần mềm hay danh sách buyer. Chúng tôi cam kết kết
            quả - tiền USD vào tài khoản, hàng đến đúng hẹn, không bị lừa đảo và có
            đầy đủ bằng chứng cho mọi giao dịch.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {OUTCOMES.map((outcome) => {
            const Icon = outcome.icon
            return (
              <article
                key={outcome.title}
                className="group relative flex flex-col gap-4 rounded-xl border border-border/80 bg-card p-6 transition-all hover:border-accent/60 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/5 text-primary ring-1 ring-inset ring-primary/10 transition-colors group-hover:bg-accent/10 group-hover:text-accent group-hover:ring-accent/20">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="flex flex-col items-end text-right">
                    <span className="text-xl font-semibold tracking-tight text-foreground">
                      {outcome.metric}
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {outcome.metricLabel}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-lg font-semibold leading-snug text-foreground">
                    {outcome.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {outcome.desc}
                  </p>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
