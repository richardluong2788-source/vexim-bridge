import { AlertTriangle, FileX, Languages, ShieldAlert } from "lucide-react"

const PAIN_POINTS = [
  {
    icon: FileX,
    title: "Hàng kẹt ở cảng vì FDA",
    desc: "Một sai sót nhỏ trong FDA Prior Notice là container bị giữ ở Long Beach. Phí lưu container 150–300 USD/ngày, phí kho bãi cộng dồn - lỗ hết lợi nhuận đơn hàng trong 2 tuần.",
  },
  {
    icon: ShieldAlert,
    title: "L/C giả và chuyển tiền lừa đảo",
    desc: "Buyer gửi PDF L/C scan từ ngân hàng không có quan hệ đại lý với VCB/BIDV, hoặc Swift copy giả. Hàng đã lên tàu, tiền không về - không có bằng chứng để kiện.",
  },
  {
    icon: Languages,
    title: "Bị ép giá vì không có người tại Mỹ",
    desc: "Đàm phán qua email cá nhân, lộ thông tin nhà máy quá sớm. Buyer Mỹ biết bạn không có ai theo dõi tại chỗ - giá bị ép xuống 15–25% so với mặt bằng thị trường.",
  },
  {
    icon: AlertTriangle,
    title: "Tự xây phòng sale Mỹ tốn hàng tỷ đồng",
    desc: "Lương 1 sales rep tại Mỹ tối thiểu 80–120K USD/năm chưa kể tools, đào tạo và bảo hiểm. Mất 9–18 tháng để có đơn đầu tiên - phần lớn nhà máy không đủ runway.",
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
            4 lý do nhà máy Việt mất tiền khi tự bán sang Mỹ
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
            Đây là những thiệt hại thực tế chúng tôi gặp hàng tuần khi tiếp nhận khách
            hàng mới. Phần lớn không phải do chất lượng sản phẩm, mà do thiếu hệ thống
            kiểm soát thị trường Mỹ.
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
