import { Quote } from "lucide-react"

const STORIES = [
  {
    before: "8 tháng, 15 đầu mối Mỹ — không chốt được đơn nào vì FDA sai",
    after: "2 đơn hàng ký trong 3 tháng đầu tiên với Vexim",
    quote:
      "Hồ sơ FDA của chúng tôi thiếu Prior Notice đúng thời điểm. Buyer liên hệ nhưng không thể ký vì không đủ giấy tờ. Vexim hoàn thiện hồ sơ trong 1 tuần rồi quay lại đàm phán — đơn thứ nhất chốt trong tháng thứ 2.",
    name: "Anh Nguyễn Văn T.",
    role: "Giám đốc xưởng cà phê rang xay",
    location: "Đắk Lắk · 45 công nhân",
    industry: "Thực phẩm & đồ uống",
    metric: "$180,000",
    metricLabel: "kim ngạch trong 3 tháng đầu",
    initial: "T",
  },
  {
    before: "Không ai trong công ty nói được tiếng Anh thương mại đủ để đàm phán",
    after: "3 đợt thanh toán USD đúng hạn, không tranh chấp",
    quote:
      "Buyer Mỹ gửi yêu cầu sửa hợp đồng 2 lần. Lần trước chúng tôi im lặng vì không biết trả lời thế nào — deal hỏng. Lần này Vexim xử lý toàn bộ thư từ và chứng từ, deal thành công ngay tháng thứ 3.",
    name: "Chị Trần Thanh H.",
    role: "Phó giám đốc công ty thủy sản",
    location: "An Giang · 120 nhân sự",
    industry: "Thực phẩm & đồ uống",
    metric: "3/3",
    metricLabel: "đợt thanh toán đúng hạn, không phát sinh tranh chấp",
    initial: "H",
  },
  {
    before: "Xưởng 20 người, không có phòng xuất khẩu, không có ngân sách thuê nhân sự",
    after: "Đơn hàng Mỹ chiếm 40% tổng doanh thu trong năm đầu",
    quote:
      "Tôi nghĩ mình quá nhỏ để vào thị trường Mỹ. Vexim bảo không — họ đã làm cho xưởng 15 người còn nhỏ hơn tôi. Đúng 11 tuần sau khi ký, tôi có đơn mẫu đầu tiên từ một wellness store tại California.",
    name: "Anh Lê Hoàng D.",
    role: "Chủ xưởng mỹ phẩm thảo dược",
    location: "Bình Dương · 20 nhân sự",
    industry: "Mỹ phẩm & chăm sóc cá nhân",
    metric: "40%",
    metricLabel: "doanh thu đến từ thị trường Mỹ sau 12 tháng",
    initial: "D",
  },
]

export function LandingTestimonials() {
  return (
    <section
      id="testimonials"
      aria-labelledby="testimonials-title"
      className="scroll-mt-20 border-b border-border/60 bg-secondary/40"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">Kết quả thực tế</p>
          <h2
            id="testimonials-title"
            className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Từ không có đơn hàng nào đến doanh thu USD — trong vòng 3 tháng
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
            Những nhà máy dưới đây không phải trường hợp đặc biệt. Đây là kết quả điển hình khi có đúng đội ngũ và quy trình.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {STORIES.map((story) => (
            <article
              key={story.name}
              className="relative flex flex-col gap-4 rounded-xl border border-border/80 bg-card p-6 shadow-sm"
            >
              <Quote
                className="absolute right-5 top-5 h-7 w-7 text-accent/15"
                aria-hidden="true"
              />

              {/* Before / After */}
              <div className="flex flex-col gap-1.5 rounded-lg bg-secondary/60 p-3">
                <div className="flex items-start gap-2 text-xs">
                  <span className="flex-shrink-0 font-semibold text-muted-foreground">Trước:</span>
                  <span className="text-muted-foreground">{story.before}</span>
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <span className="flex-shrink-0 font-semibold text-accent">Sau:</span>
                  <span className="font-medium text-foreground">{story.after}</span>
                </div>
              </div>

              <span className="inline-flex w-fit rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent">
                {story.industry}
              </span>

              <blockquote className="text-sm leading-relaxed text-muted-foreground">
                {`"${story.quote}"`}
              </blockquote>

              <div className="mt-auto flex items-center gap-3 border-t border-border/60 pt-4">
                <div
                  aria-hidden="true"
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                >
                  {story.initial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{story.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{story.role}</p>
                  <p className="truncate text-xs text-muted-foreground">{story.location}</p>
                </div>
              </div>

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-2xl font-semibold leading-none tracking-tight text-primary">
                  {story.metric}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{story.metricLabel}</p>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Nội dung dựa trên khách hàng thực tế của Vexim Trade. Tên và chi tiết nhận dạng đã được thay đổi để bảo vệ quyền riêng tư.
        </p>
      </div>
    </section>
  )
}
