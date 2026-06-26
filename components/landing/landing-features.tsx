import { Users, FileCheck2, BadgeCheck, BarChart3, Headphones, ShieldCheck } from "lucide-react"

const DELIVERABLES = [
  {
    icon: Users,
    tag: "Bạn nhận được",
    title: "Đội sales chuyên trách của riêng bạn",
    outcome: "50+ buyer Mỹ được tiếp cận mỗi tháng",
    desc: "Account Executive am hiểu ngành của bạn, biết thị trường Mỹ và chủ động mang đơn hàng về. Không phải đăng tin, không phải chờ khách tự liên hệ.",
  },
  {
    icon: FileCheck2,
    tag: "Bạn nhận được",
    title: "Hồ sơ FDA đúng chuẩn, không lo bị giữ hàng",
    outcome: "94% nhà máy đạt chuẩn FDA trong 30 ngày",
    desc: "Chuyên gia của Vexim xử lý đăng ký FDA, chuẩn bị nhãn hàng và hồ sơ tuân thủ cho từng lô hàng. Bạn không cần thuê tư vấn riêng.",
  },
  {
    icon: BadgeCheck,
    tag: "Bạn nhận được",
    title: "Thanh toán USD được xác thực hai lớp",
    outcome: "Không ai có thể làm giả SWIFT trong hệ thống",
    desc: "Chứng từ thanh toán quốc tế luôn được xác nhận bởi hai người độc lập. Bạn chỉ nhận đơn hoàn thành khi tiền thực sự vào tài khoản.",
  },
  {
    icon: BarChart3,
    tag: "Bạn nhận được",
    title: "Dashboard theo dõi deal real-time",
    outcome: "Biết chính xác đơn nào đang ở bước nào, lúc nào",
    desc: "Không còn hỏi qua Zalo. Bạn đăng nhập bất cứ lúc nào và thấy trạng thái từng deal, từng tài liệu, từng bước đàm phán.",
  },
  {
    icon: Headphones,
    tag: "Bạn nhận được",
    title: "Đàm phán chuyên nghiệp bằng tiếng Anh thương mại",
    outcome: "Không mất deal vì rào cản ngôn ngữ",
    desc: "Đội Vexim soạn thảo, đàm phán và xử lý toàn bộ giao tiếp với buyer bằng tiếng Anh chuẩn thương mại quốc tế — lưu hết vào hệ thống để bạn theo dõi.",
  },
  {
    icon: ShieldCheck,
    tag: "Bạn nhận được",
    title: "Toàn bộ lịch sử giao dịch được bảo vệ",
    outcome: "Không bao giờ mất dữ liệu dù nhân sự thay đổi",
    desc: "Mọi trao đổi, chứng từ và lịch sử giá đều được ghi lại và không thể xoá. Bạn luôn có bằng chứng để đối chiếu với đối tác hoặc cơ quan thanh tra.",
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
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">Bạn nhận được gì</p>
          <h2
            id="features-title"
            className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            6 thứ bạn có ngay từ tháng đầu tiên
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
            Không phải phần mềm để bạn tự dùng. Đây là đội ngũ, quy trình và cơ sở hạ tầng xuất khẩu hoàn chỉnh — vận hành thay bạn.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {DELIVERABLES.map((item) => {
            const Icon = item.icon
            return (
              <article
                key={item.title}
                className="group flex flex-col gap-4 rounded-xl border border-border/80 bg-card p-6 transition-all hover:border-accent/60 hover:shadow-lg"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/5 text-primary ring-1 ring-inset ring-primary/10 transition-colors group-hover:bg-accent/10 group-hover:text-accent group-hover:ring-accent/20">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                  <p className="text-sm font-semibold text-accent">{item.outcome}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
