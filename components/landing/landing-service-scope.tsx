import {
  Award,
  Search,
  HandCoins,
  Banknote,
  ShieldCheck,
  Ship,
  Warehouse,
  Scale,
} from "lucide-react"

/**
 * "What we actually do for you" — the full end-to-end service stack.
 * Designed to answer the most common buyer question: "Bao gồm những gì?"
 * — including logistics, warehousing and fulfillment via partners.
 */

type Service = {
  icon: typeof Award
  title: string
  desc: string
  badge?: "Trực tiếp" | "Qua đối tác chiến lược"
}

const SERVICES: Service[] = [
  {
    icon: Award,
    title: "Đăng ký FDA & tuân thủ Hoa Kỳ",
    desc: "Food Facility, MoCRA cosmetics, DSHEA supplements, 510(k) thiết bị y tế. Đứng tên U.S. Agent, gia hạn định kỳ - bạn không cần thuê tư vấn riêng.",
    badge: "Trực tiếp",
  },
  {
    icon: Search,
    title: "Tìm và sàng lọc buyer Mỹ",
    desc: "Đội sales tại Mỹ chủ động tiếp cận 50+ buyer/tháng theo đúng ngành hàng của bạn. Mỗi buyer được thẩm định pháp lý và tài chính trước khi giới thiệu.",
    badge: "Trực tiếp",
  },
  {
    icon: HandCoins,
    title: "Đàm phán giá & điều khoản hợp đồng",
    desc: "Chuyên gia của chúng tôi đàm phán thay bạn theo chuẩn Incoterms 2020, bảo vệ giá sàn, lock điều khoản thanh toán có lợi cho nhà máy.",
    badge: "Trực tiếp",
  },
  {
    icon: ShieldCheck,
    title: "Thẩm định ngân hàng & L/C của buyer",
    desc: "Verify SWIFT BIC, đối chiếu danh sách OFAC/EU sanctions, phân loại tier rủi ro - chặn L/C giả mạo và ngân hàng phát hành không uy tín trước khi xuống hàng.",
    badge: "Trực tiếp",
  },
  {
    icon: Banknote,
    title: "Thu USD và xác thực thanh toán",
    desc: "Quy trình xác nhận chuyển tiền hai lớp độc lập - chỉ ghi nhận đã thanh toán khi USD thực sự vào tài khoản. Theo dõi từng đợt giao hàng đến từng cent.",
    badge: "Trực tiếp",
  },
  {
    icon: Ship,
    title: "Vận tải biển & thủ tục hải quan",
    desc: "Booking tàu, làm bộ chứng từ xuất khẩu, làm việc với forwarder và customs broker hai đầu Việt - Mỹ. Đảm bảo hàng đến cảng đích đúng tiến độ.",
    badge: "Qua đối tác chiến lược",
  },
  {
    icon: Warehouse,
    title: "Kho bãi & Fulfillment tại Mỹ",
    desc: "Mạng lưới 3PL tại Bờ Đông, Bờ Tây và Trung Mỹ. Chuẩn Amazon FBA prep, retail compliance, B2B distribution. Bạn không cần thuê kho riêng tại Mỹ.",
    badge: "Qua đối tác chiến lược",
  },
  {
    icon: Scale,
    title: "Hỗ trợ pháp lý khi tranh chấp",
    desc: "Khi có sự cố với buyer hoặc cơ quan kiểm tra, đội pháp lý của Vexim làm việc trực tiếp với luật sư Mỹ - không phát sinh phí, đã nằm trong gói dịch vụ.",
    badge: "Trực tiếp",
  },
]

export function LandingServiceScope() {
  return (
    <section
      id="service-scope"
      aria-labelledby="service-scope-title"
      className="scroll-mt-20 border-b border-border/60 bg-background"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">
            Phạm vi dịch vụ
          </p>
          <h2
            id="service-scope-title"
            className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Trọn gói từ FDA đến tay người tiêu dùng Mỹ
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
            Bạn không phải chắp ghép từ nhiều nhà cung cấp khác nhau. Một hợp đồng,
            một đầu mối - chúng tôi xử lý tất cả mắt xích cho đến khi container
            của bạn nằm trên kệ siêu thị Mỹ hoặc trong kho Amazon FBA.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((service) => {
            const Icon = service.icon
            const isPartner = service.badge === "Qua đối tác chiến lược"
            return (
              <article
                key={service.title}
                className="group flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-5 transition-all hover:border-accent/60 hover:shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5 text-primary ring-1 ring-inset ring-primary/10 transition-colors group-hover:bg-accent/10 group-hover:text-accent group-hover:ring-accent/20">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  {service.badge && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        isPartner
                          ? "border border-border bg-secondary/60 text-muted-foreground"
                          : "border border-accent/30 bg-accent/10 text-accent"
                      }`}
                    >
                      {service.badge}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-semibold leading-snug text-foreground">
                  {service.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {service.desc}
                </p>
              </article>
            )
          })}
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Lưu ý:</span> Các hạng mục
          gắn nhãn &ldquo;Qua đối tác chiến lược&rdquo; được thực hiện bởi mạng lưới
          forwarder và 3PL đã thẩm định, do Vexim điều phối và giám sát. Bạn vẫn chỉ
          làm việc với một đầu mối duy nhất.
        </p>
      </div>
    </section>
  )
}
