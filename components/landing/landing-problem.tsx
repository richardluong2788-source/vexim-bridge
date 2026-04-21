import { AlertTriangle, FileX, Languages, ShieldAlert } from "lucide-react"

const PAIN_POINTS = [
  {
    icon: FileX,
    title: "Thủ tục FDA khó nắm",
    desc: "Thiếu 1 số đăng ký, lô hàng bị giữ ở cảng Mỹ — chi phí lưu kho và demurrage vượt lợi nhuận.",
  },
  {
    icon: ShieldAlert,
    title: "Wire fraud khi chuyển tiền",
    desc: "Kẻ gian mạo danh buyer gửi SWIFT giả. Doanh nghiệp VN mất hàng, mất tiền, không có evidence.",
  },
  {
    icon: Languages,
    title: "Rào cản đàm phán",
    desc: "Người bán lộ danh tính quá sớm, bị ép giá. Email qua lại tay đôi thiếu audit trail.",
  },
  {
    icon: AlertTriangle,
    title: "Không có single source of truth",
    desc: "Thông tin nằm rải rác trên Excel, Zalo, email — không ai biết lead đang ở giai đoạn nào.",
  },
]

export function LandingProblem() {
  return (
    <section aria-labelledby="problem-title" className="border-b border-border/60 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">Vấn đề hiện tại</p>
          <h2
            id="problem-title"
            className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Xuất khẩu sang Mỹ vẫn còn nhiều rủi ro
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
            Chỉ 1 sai sót nhỏ về FDA hay SWIFT có thể phá huỷ nhiều tháng chuẩn bị. Vexim Bridge
            được thiết kế để chặn đứng các rủi ro này ngay ở lớp quy trình.
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
