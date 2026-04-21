import { FileSignature, CalendarClock, HandCoins } from "lucide-react"

const FEE_COMPONENTS = [
  {
    icon: FileSignature,
    label: "Bước 1",
    title: "Phí khởi tạo",
    subtitle: "Một lần duy nhất khi ký hợp đồng",
    desc: "Dành cho việc thẩm định năng lực nhà máy, chuẩn bị hồ sơ FDA, chụp ảnh sản phẩm, dựng profile buyer-ready và đào tạo đội ngũ của bạn dùng nền tảng. Đây là khoản đầu tư ban đầu để đảm bảo nhà máy sẵn sàng trước khi Vexim bắt đầu đi tìm buyer.",
    highlight: "Chỉ đóng một lần",
  },
  {
    icon: CalendarClock,
    label: "Bước 2",
    title: "Phí duy trì hàng tháng",
    subtitle: "Vận hành đội sales chuyên trách",
    desc: "Nuôi một đội sales chuyên nghiệp, chuyên gia FDA, nhân viên đàm phán và hạ tầng nền tảng cho riêng nhà máy của bạn. Đây là lý do Vexim có thể cam kết tiếp cận 50+ buyer tiềm năng mỗi tháng - không phải đăng tin chờ khách.",
    highlight: "Trả theo tháng, Hoàn 50% phí duy trì vào hoa hồng của đơn hàng thành công đầu tiên",
  },
  {
    icon: HandCoins,
    label: "Bước 3",
    title: "Hoa hồng thành công",
    subtitle: "Chỉ thu khi tiền đã về tài khoản",
    desc: "Tỷ lệ % trên kim ngạch của những đơn hàng đã được thanh toán thành công. Nếu đơn chưa thu được tiền, Vexim không nhận đồng nào từ khoản này - lợi ích của chúng tôi gắn trực tiếp với dòng tiền USD thực tế của bạn.",
    highlight: "Không có thanh toán, không thu hoa hồng",
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
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">Cấu trúc chi phí</p>
          <h2
            id="pricing-promise-title"
            className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Minh bạch như hợp đồng thuê phòng kinh doanh riêng
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
            Vexim Bridge không phải sàn tự phục vụ. Bạn đang thuê một phòng sales xuất khẩu
            vận hành bởi chuyên gia và công nghệ - chi phí gồm ba cấu phần rõ ràng, ghi trong
            hợp đồng từ đầu, không phí ẩn.
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
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10 text-accent ring-1 ring-inset ring-accent/20">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {fee.label}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-semibold text-foreground">{fee.title}</h3>
                  <p className="text-xs font-medium text-accent">{fee.subtitle}</p>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{fee.desc}</p>
                <div className="mt-auto rounded-lg bg-secondary/60 px-3 py-2 text-xs font-medium text-foreground">
                  {fee.highlight}
                </div>
              </article>
            )
          })}
        </div>

        <div className="mx-auto mt-10 max-w-3xl rounded-xl border border-border/80 bg-secondary/40 p-6 text-center">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Con số cụ thể (phí khởi tạo, mức retainer và % hoa hồng) được báo giá riêng cho
            từng nhà máy tuỳ ngành hàng và quy mô. Tất cả được ghi rõ trong hợp đồng dịch vụ
            trước khi bạn ký —{" "}
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
