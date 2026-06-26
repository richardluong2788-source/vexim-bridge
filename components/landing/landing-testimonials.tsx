const STORIES = [
  {
    before: "8 tháng · 15 đầu mối · 0 đơn vì FDA sai",
    after: "$180,000",
    afterLabel: "kim ngạch · 3 tháng đầu với Vexim",
    quote: "Vexim hoàn thiện hồ sơ FDA trong 1 tuần rồi quay lại đàm phán với đúng buyer đó — đơn thứ nhất chốt trong tháng thứ 2.",
    name: "Nguyễn Văn T.",
    role: "Giám đốc · Xưởng cà phê rang xay",
    location: "Đắk Lắk · 45 công nhân",
    industry: "Thực phẩm & đồ uống",
    initial: "T",
    avatarBg: "bg-blue-600",
  },
  {
    before: "Không ai đàm phán tiếng Anh được · 2 deal hỏng",
    after: "3/3",
    afterLabel: "đợt thanh toán USD đúng hạn, không tranh chấp",
    quote: "Buyer gửi yêu cầu sửa hợp đồng. Lần trước im lặng vì không biết trả lời — deal hỏng. Lần này Vexim xử lý toàn bộ. Deal thành công tháng 3.",
    name: "Trần Thanh H.",
    role: "Phó GĐ · Công ty thủy sản",
    location: "An Giang · 120 nhân sự",
    industry: "Thực phẩm & đồ uống",
    initial: "H",
    avatarBg: "bg-teal-600",
  },
  {
    before: "Xưởng 20 người · Không có phòng xuất khẩu",
    after: "40%",
    afterLabel: "doanh thu từ thị trường Mỹ sau 12 tháng",
    quote: "Tôi nghĩ mình quá nhỏ để vào Mỹ. Đúng 11 tuần sau khi ký, tôi có đơn mẫu đầu tiên từ một wellness store tại California.",
    name: "Lê Hoàng D.",
    role: "Chủ xưởng · Mỹ phẩm thảo dược",
    location: "Bình Dương · 20 nhân sự",
    industry: "Mỹ phẩm & CSKN",
    initial: "D",
    avatarBg: "bg-violet-600",
  },
]

export function LandingTestimonials() {
  return (
    <section
      id="testimonials"
      aria-labelledby="testimonials-title"
      className="scroll-mt-20 border-b border-border/60 bg-secondary/30"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">Kết quả thực tế</p>
          <h2
            id="testimonials-title"
            className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Từ 0 đến doanh thu USD — trong vòng 3 tháng
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {STORIES.map((story) => (
            <article
              key={story.name}
              className="flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm"
            >
              {/* Top: before/after visual strip */}
              <div className="grid grid-cols-2 divide-x divide-border/60">
                <div className="bg-destructive/5 px-4 py-3">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-destructive/60">Trước</p>
                  <p className="text-xs font-medium leading-tight text-muted-foreground">{story.before}</p>
                </div>
                <div className="bg-emerald-50/60 px-4 py-3 dark:bg-emerald-950/20">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Sau Vexim</p>
                  <p className="text-xl font-semibold leading-none tracking-tight text-emerald-600">{story.after}</p>
                  <p className="mt-0.5 text-[10px] text-emerald-700/70">{story.afterLabel}</p>
                </div>
              </div>

              {/* Bottom: quote + profile */}
              <div className="flex flex-1 flex-col gap-4 p-5">
                <span className="inline-flex w-fit rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent">
                  {story.industry}
                </span>
                <blockquote className="flex-1 text-sm italic leading-relaxed text-muted-foreground">
                  {`"${story.quote}"`}
                </blockquote>
                <div className="flex items-center gap-3 border-t border-border/60 pt-4">
                  <div
                    aria-hidden="true"
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${story.avatarBg}`}
                  >
                    {story.initial}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{story.name}</p>
                    <p className="text-xs text-muted-foreground">{story.role}</p>
                    <p className="text-xs text-muted-foreground">{story.location}</p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Nội dung dựa trên khách hàng thực tế. Tên và chi tiết nhận dạng đã được thay đổi để bảo vệ quyền riêng tư.
        </p>
      </div>
    </section>
  )
}
