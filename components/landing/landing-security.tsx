import { Database, Fingerprint, KeyRound, ScrollText } from "lucide-react"

const SECURITY_PROPS = [
  {
    icon: Database,
    title: "Dữ liệu phân quyền chặt chẽ",
    desc: "Mỗi nhân viên chỉ thấy đúng đơn hàng thuộc trách nhiệm của mình. Thông tin giá gốc, người mua, hoa hồng… không bị lộ ngang cấp.",
  },
  {
    icon: Fingerprint,
    title: "Phân quyền theo vai trò",
    desc: "Nhân viên kinh doanh, kế toán, quản lý, nhà máy — mỗi vai trò có quyền xem và thao tác riêng, không ai thao túng ngoài phạm vi của mình.",
  },
  {
    icon: ScrollText,
    title: "Lịch sử không thể xoá",
    desc: "Mọi thay đổi về giá, vai trò, chứng từ đều để lại dấu vết vĩnh viễn. Khi cần đối chứng với đối tác hay thanh tra, bạn luôn có bằng chứng.",
  },
  {
    icon: KeyRound,
    title: "Bảo mật thông tin nhạy cảm",
    desc: "Chứng từ, hoá đơn, thông tin ngân hàng được mã hoá và lưu trữ theo tiêu chuẩn quốc tế. Vexim Bridge không chia sẻ dữ liệu nếu không có sự đồng ý của bạn.",
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
              An toàn &amp; Minh bạch
            </p>
            <h2
              id="security-title"
              className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              Tiêu chuẩn bảo mật như ngân hàng, cho xuất khẩu B2B
            </h2>
            <p className="mt-4 text-pretty text-base leading-relaxed text-primary-foreground/80">
              Vexim Bridge áp dụng những nguyên tắc bảo mật cao nhất của ngành tài chính —
              phân quyền nhiều lớp, kiểm soát chéo và lưu vết đầy đủ. Mọi thao tác đều có
              dấu vết để bạn, đối tác và luật sư đều có thể đối chứng khi cần.
            </p>
            <div className="mt-8 flex flex-col gap-3 rounded-lg border border-primary-foreground/10 bg-primary-foreground/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                Nguyên tắc kiểm soát chéo
              </p>
              <p className="text-sm leading-relaxed text-primary-foreground/90">
                &ldquo;Người nhập chứng từ thanh toán không được tự xác nhận.&rdquo; Việc xác
                nhận luôn do một người độc lập khác thực hiện — không ai có thể tự duyệt tiền
                của chính mình, dù là quản lý cấp cao nhất.
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
