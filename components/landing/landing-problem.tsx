import { AlertTriangle, FileX, Languages, ShieldAlert } from "lucide-react"

const PAIN_POINTS = [
  {
    icon: FileX,
    title: "Hồ sơ chuẩn FDA",
    desc: "Thiếu một giấy tờ nhỏ, lô hàng bị giữ ở cảng Mỹ — tiền lưu kho và phạt chậm trả vượt cả lợi nhuận của đơn hàng.",
  },
  {
    icon: ShieldAlert,
    title: "Lừa đảo chuyển tiền quốc tế",
    desc: "Kẻ gian mạo danh người mua gửi chứng từ chuyển tiền giả. Doanh nghiệp mất hàng, mất tiền, không có bằng chứng để khiếu nại.",
  },
  {
    icon: Languages,
    title: "Dễ bị ép giá khi đàm phán",
    desc: "Lộ thông tin nhà máy quá sớm khiến đối tác ép giá. Trao đổi qua email cá nhân không lưu lại để đối chiếu sau này.",
  },
  {
    icon: AlertTriangle,
    title: "Thông tin đơn hàng phân tán",
    desc: "Dữ liệu nằm rải rác trên Excel, Zalo, email — không ai biết đơn hàng đang ở bước nào, ai phụ trách, khi nào giao.",
  },
]

export function LandingProblem() {
  return (
    <section aria-labelledby="problem-title" className="border-b border-border/60 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">Thách thức hiện tại</p>
          <h2
            id="problem-title"
            className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Xuất khẩu sang Mỹ vẫn nhiều rủi ro
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
            Chỉ một sai sót nhỏ về giấy phép hay thanh toán có thể phá hỏng nhiều tháng chuẩn bị.
            Vexim Bridge được thiết kế để chặn những rủi ro này ngay trong quy trình vận hành hàng ngày.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PAIN_POINTS.map((pain) => {
            const Icon = pain.icon
            return (
              <article
                key={pain.title}
                className="flex flex-col gap-3 rounded-lg border border-border/80 bg-card p-6 transition-shadow hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-foreground">{pain.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{pain.desc}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
