import { Database, Fingerprint, KeyRound, ScrollText } from "lucide-react"

const SECURITY_PROPS = [
  {
    icon: Database,
    title: "Phân quyền chặt chẽ",
    desc: "Mỗi nhân viên chỉ thấy đúng phần việc của mình",
  },
  {
    icon: Fingerprint,
    title: "Kiểm soát chéo",
    desc: "Không ai được tự duyệt thanh toán của chính mình",
  },
  {
    icon: ScrollText,
    title: "Lịch sử không thể xoá",
    desc: "Mọi thay đổi đều có dấu vết - sẵn sàng đối chứng",
  },
  {
    icon: KeyRound,
    title: "Mã hoá tiêu chuẩn ngân hàng",
    desc: "Chứng từ và thông tin nhạy cảm được bảo vệ end-to-end",
  },
]

/**
 * Compact security band — single horizontal section, low visual weight.
 * Meant to reassure without competing with the outcome-driven sections.
 */
export function LandingSecurity() {
  return (
    <section
      id="security"
      aria-labelledby="security-title"
      className="scroll-mt-20 border-b border-border/60 bg-primary text-primary-foreground"
    >
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
          <div className="lg:max-w-md">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
              An toàn dữ liệu
            </p>
            <h2
              id="security-title"
              className="mt-2 text-balance text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              Tiêu chuẩn bảo mật như ngân hàng
            </h2>
            <p className="mt-3 text-pretty text-sm leading-relaxed text-primary-foreground/80">
              Mọi thao tác đều có dấu vết để bạn, đối tác và luật sư có thể đối chứng
              khi cần. Không một quản trị viên nào - kể cả nội bộ Vexim - có thể tự ý
              duyệt thanh toán của chính mình.
            </p>
          </div>

          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex-1 lg:grid-cols-4">
            {SECURITY_PROPS.map((prop) => {
              const Icon = prop.icon
              return (
                <li
                  key={prop.title}
                  className="flex items-start gap-3 rounded-lg border border-primary-foreground/10 bg-primary-foreground/5 p-4 transition-colors hover:border-accent/40 hover:bg-primary-foreground/10"
                >
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-semibold leading-tight">
                      {prop.title}
                    </h3>
                    <p className="text-xs leading-relaxed text-primary-foreground/75">
                      {prop.desc}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}
