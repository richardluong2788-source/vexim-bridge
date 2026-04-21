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
    title: "FDA Compliance Gate",
    desc: "Mọi lead mới chỉ được giao cho nhà sản xuất có số đăng ký FDA hợp lệ. Theo dõi ngày hết hạn và cảnh báo tự động trước 30 ngày.",
    tag: "R-02",
  },
  {
    icon: EyeOff,
    title: "Buyer Anonymous Mode",
    desc: "Danh tính người mua Mỹ được ẩn cho đến khi giá được chốt — bảo vệ cả hai phía khỏi bị bypass và ép giá trong đàm phán.",
    tag: "R-04",
  },
  {
    icon: BadgeCheck,
    title: "SWIFT Verification 2-eye",
    desc: "Người upload chứng từ SWIFT không được tự xác minh. Segregation of Duties cứng ở DB layer — không ai bypass được, kể cả admin.",
    tag: "R-05",
  },
  {
    icon: KanbanSquare,
    title: "Pipeline đa vai trò",
    desc: "Kanban 5 giai đoạn (New → Contacted → Quoted → Won / Lost). AE, Lead Researcher, Finance mỗi người thấy đúng phần công việc của mình.",
    tag: "RBAC",
  },
  {
    icon: Receipt,
    title: "Invoice + Billing Plan",
    desc: "Phát hành invoice USD, billing plan theo milestone, operating expenses — tất cả liên kết với opportunity gốc và audit trail WORM.",
    tag: "FIN",
  },
  {
    icon: Lock,
    title: "Audit trail không thể xoá",
    desc: "Mọi thay đổi cost_price, role, compliance doc đều ghi vào bảng activities với trigger chống update/delete. Sẵn sàng cho thanh tra.",
    tag: "R-06",
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
            Mọi rào cản xuất khẩu, giải quyết ở tầng quy trình
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
            Không phải checklist rời rạc. Vexim Bridge enforce từng rule ngay trong database,
            server action và UI — nên team vận hành không cần nhớ thủ công.
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
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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
