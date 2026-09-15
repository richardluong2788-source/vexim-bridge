import { redirect } from "next/navigation"
import Link from "next/link"
import {
  BookOpen,
  BriefcaseBusiness,
  Search,
  Factory,
  ArrowRight,
  Clock,
  FileText,
} from "lucide-react"
import { getCurrentRole } from "@/lib/auth/guard"

export const dynamic = "force-dynamic"

const GUIDES = [
  {
    href: "/admin/knowledge/ae",
    role: "account_executive",
    icon: BriefcaseBusiness,
    iconBg: "bg-teal-500/10 text-teal-600",
    titleVi: "Tài liệu vận hành AE",
    titleEn: "Account Executive",
    tagline:
      "Nhận buyer từ AI matching, hỏi nhu cầu, dựng shortlist nhà cung cấp, chuyển cơ hội sang kanban và chốt đơn.",
    status: "ready" as const,
    audience: ["account_executive", "admin", "super_admin"],
    highlights: [
      "Toàn bộ vòng đời một buyer: từ inbox đến won/lost",
      "Sơ đồ luồng trực quan theo từng giai đoạn engagement",
      "Ngưỡng hệ thống, quy tắc bảo mật và bảng lỗi thường gặp",
    ],
  },
  {
    href: "#",
    role: "lead_researcher",
    icon: Search,
    iconBg: "bg-violet-500/10 text-violet-600",
    titleVi: "Tài liệu vận hành LR",
    titleEn: "Lead Researcher",
    tagline:
      "Tìm và làm giàu dữ liệu buyer (ImportYeti, intake thủ công), phân tích tín hiệu ngành/quốc gia, theo dãi chất lượng matching.",
    status: "soon" as const,
    audience: ["lead_researcher", "admin", "super_admin"],
    highlights: [],
  },
  {
    href: "#",
    role: "supplier_researcher",
    icon: Factory,
    iconBg: "bg-amber-500/10 text-amber-600",
    titleVi: "Tài liệu vận hành SR",
    titleEn: "Supplier Researcher",
    tagline:
      "Tìm và định danh nhà cung cấp Việt Nam, thu thập hồ sơ năng lực/chứng từ tuân thủ và đưa client lên hệ thống.",
    status: "soon" as const,
    audience: ["supplier_researcher", "admin", "super_admin"],
    highlights: [],
  },
]

export default async function KnowledgeHubPage() {
  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 lg:p-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="h-4 w-4" />
          <span>Trung tâm kiến thức nội bộ</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Tài liệu vận hành theo vai trò</h1>
        <p className="max-w-3xl text-muted-foreground">
          Mỗi tài liệu mô tả đúng những gì nhân sự vai trò đó thao tác trên hệ thống Vexim
          Bridge: vào màn hình nào, bấm gì ở mỗi bước, hệ thống tự động làm gì, các ngưỡng bắt
          buộc và quy tắc không được vi phạm.
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-3">
        {GUIDES.map((g) => {
          const isMine = current.role === g.role
          const card = (
            <div
              className={`flex h-full flex-col rounded-2xl border bg-card p-6 shadow-sm transition ${
                g.status === "ready" ? "hover:border-teal-400 hover:shadow-md" : "opacity-70"
              }`}
            >
              <div className="mb-4 flex items-start justify-between">
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${g.iconBg}`}>
                  <g.icon className="h-6 w-6" />
                </span>
                {g.status === "ready" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                    <FileText className="h-3 w-3" /> Đã có
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    <Clock className="h-3 w-3" /> Sắp ra mắt
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold">{g.titleVi}</h2>
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {g.titleEn}
              </div>
              <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">{g.tagline}</p>
              {g.status === "ready" && g.highlights.length > 0 && (
                <ul className="mt-4 space-y-1.5 text-sm">
                  {g.highlights.map((h) => (
                    <li key={h} className="flex gap-2 text-foreground/80">
                      <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-teal-500" />
                      {h}
                    </li>
                  ))}
                </ul>
              )}
              {g.status === "ready" ? (
                <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-600">
                  Mở tài liệu <ArrowRight className="h-4 w-4" />
                </div>
              ) : (
                <div className="mt-5 text-sm font-medium text-muted-foreground">
                  Đang biên soạn…
                </div>
              )}
              {isMine && (
                <div className="mt-3 text-xs font-semibold text-teal-600">
                  ↑ Tài liệu dành cho vai trò của bạn
                </div>
              )}
            </div>
          )
          return g.status === "ready" ? (
            <Link key={g.role} href={g.href} className="block">
              {card}
            </Link>
          ) : (
            <div key={g.role} aria-disabled className="cursor-not-allowed">
              {card}
            </div>
          )
        })}
      </div>
    </div>
  )
}
