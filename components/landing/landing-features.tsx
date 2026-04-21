import {
  BadgeCheck,
  EyeOff,
  FileCheck2,
  KanbanSquare,
  Lock,
  Receipt,
} from "lucide-react"

const FEATURES = [
  {
    icon: FileCheck2,
    title: "Tự động kiểm tra FDA",
    desc: "Đơn hàng chỉ giao cho nhà máy có giấy phép FDA còn hạn. Hệ thống tự nhắc trước 30 ngày để bạn kịp gia hạn, không lo hàng bị giữ ở cảng.",
    tag: "FDA",
  },
  {
    icon: EyeOff,
    title: "Liên hệ trực tiếp, không qua trung gian",
    desc: "Vexim kết nối thẳng nhà máy với buyer Mỹ - không có tầng broker ép giá hay chen vào đơn hàng. Thông tin buyer được bảo mật trong giai đoạn đàm phán để tránh bị cướp mối.",
    tag: "Bảo mật",
  },
  {
    icon: BadgeCheck,
    title: "Xác thực chuyển tiền hai lớp",
    desc: "Người nhập chứng từ chuyển tiền quốc tế không được tự xác nhận. Hai người độc lập cùng duyệt mới ghi nhận thanh toán - không ai có thể làm tắt.",
    tag: "An toàn",
  },
  {
    icon: KanbanSquare,
    title: "Theo dõi đơn hàng rõ ràng",
    desc: "Bảng đơn hàng 5 bước (Mới → Đã liên hệ → Đã chào giá → Thành công / Thất bại). Mỗi bộ phận chỉ thấy đúng phần việc của mình.",
    tag: "Quy trình",
  },
  {
    icon: Receipt,
    title: "Hoá đơn & lịch thanh toán",
    desc: "Phát hành hoá đơn, chia nhỏ theo từng đợt giao hàng, quản lý chi phí vận hành - tất cả gắn với đơn hàng gốc để dễ đối chiếu.",
    tag: "Tài chính",
  },
  {
    icon: Lock,
    title: "Lịch sử đơn hàng không thể chỉnh sửa",
    desc: "Mọi thay đổi về giá, nhân sự phụ trách, giấy tờ đều được ghi lại và không ai có thể xoá — sẵn sàng khi cần đối chứng với đối tác hoặc thanh tra.",
    tag: "Minh bạch",
  },
]

export function LandingFeatures() {
  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className="scroll-mt-20 border-b border-border/60 bg-secondary/40"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">Tính năng</p>
          <h2
            id="features-title"
            className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Giải quyết mọi rào cản xuất khẩu, ngay trong quy trình
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
            Không phải danh sách kiểm tra thủ công. Vexim Bridge tự nhắc và tự chặn đúng lúc — đội
            ngũ của bạn không cần nhớ từng quy định, chỉ cần làm đúng việc của mình.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon
            return (
              <article
                key={feature.title}
                className="group relative flex flex-col gap-4 rounded-xl border border-border/80 bg-card p-6 transition-all hover:border-accent/60 hover:shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/5 text-primary ring-1 ring-inset ring-primary/10 transition-colors group-hover:bg-accent/10 group-hover:text-accent group-hover:ring-accent/20">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {feature.tag}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{feature.desc}</p>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
