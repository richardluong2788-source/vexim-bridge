import { Database, Fingerprint, KeyRound, ScrollText } from "lucide-react"

const SECURITY_PROPS = [
  {
    icon: Database,
    title: "Row-Level Security",
    desc: "Postgres RLS enforce per-row access — AE chỉ thấy deal của mình, Finance chỉ thấy finance, không phải filter ở tầng code.",
  },
  {
    icon: Fingerprint,
    title: "Capability-based RBAC",
    desc: "Phân quyền qua capability layer thống nhất cho 7 role. Mỗi server action gate một capability, không có hardcode role scattered.",
  },
  {
    icon: ScrollText,
    title: "WORM audit trail",
    desc: "Bảng activities là write-once, read-many — trigger chặn UPDATE/DELETE. Mọi thay đổi role, cost_price, SWIFT đều có evidence.",
  },
  {
    icon: KeyRound,
    title: "Secrets quản lý tập trung",
    desc: "API key, service role, SMTP creds quản lý qua Vercel env vars. Không có secret trong code, không có fallback default trong build.",
  },
]

export function LandingSecurity() {
  return (
    <section
      id="security"
      aria-labelledby="security-title"
      className="scroll-mt-20 border-b border-border/60 bg-primary text-primary-foreground"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">
              An toàn &amp; Tuân thủ
            </p>
            <h2
              id="security-title"
              className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              Thiết kế theo tiêu chuẩn fintech, cho xuất khẩu B2B
            </h2>
            <p className="mt-4 text-pretty text-base leading-relaxed text-primary-foreground/80">
              Vexim Bridge được xây với các nguyên tắc bảo mật hiện đại — RLS, defense-in-depth,
              least privilege, audit trail WORM. Mọi thay đổi đều để lại dấu vết có thể truy
              ngược cho thanh tra, đối tác và luật sư.
            </p>
            <div className="mt-8 flex flex-col gap-3 rounded-lg border border-primary-foreground/10 bg-primary-foreground/5 p-5">
              <p className="font-mono text-xs uppercase tracking-wider text-accent">R-05 · Segregation of Duties</p>
              <p className="text-sm leading-relaxed text-primary-foreground/90">
                &ldquo;Người upload chứng từ SWIFT không được tự xác minh.&rdquo; — enforce ở cả
                application layer (server action) và database layer (CHECK constraint). Hai lớp
                độc lập, cùng một luật.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-7">
            {SECURITY_PROPS.map((prop) => {
              const Icon = prop.icon
              return (
                <article
                  key={prop.title}
                  className="flex flex-col gap-3 rounded-lg border border-primary-foreground/10 bg-primary-foreground/5 p-6 transition-colors hover:border-accent/40 hover:bg-primary-foreground/10"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent/15 text-accent">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="text-base font-semibold">{prop.title}</h3>
                  <p className="text-sm leading-relaxed text-primary-foreground/75">{prop.desc}</p>
                </article>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
