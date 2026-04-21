import { Quote } from "lucide-react"

const STORIES = [
  {
    quote:
      "Trước đây chúng tôi mất 8 tháng chào hàng qua 15 đầu mối Mỹ nhưng không chốt được đơn nào vì hồ sơ FDA chưa đúng chuẩn. Sau 3 tháng dùng Vexim Bridge, nhà máy đã ký được 2 đơn với tổng kim ngạch hơn 180.000 USD.",
    name: "Anh Nguyễn Văn T.",
    role: "Giám đốc xưởng cà phê rang xay",
    location: "Đắk Lắk · 45 công nhân",
    industry: "Thực phẩm & đồ uống",
    result: "+$180,000",
    resultLabel: "kim ngạch trong 3 tháng",
    initial: "T",
  },
  {
    quote:
      "Chúng tôi xuất khẩu máy nông nghiệp nhưng đội ngũ trong nước không có ai nói được tiếng Anh thương mại. Vexim đàm phán thẳng với buyer và xử lý chứng từ kỹ thuật — đã nhận đủ 3 đợt thanh toán, không phát sinh tranh chấp nào.",
    name: "Chị Trần Thanh H.",
    role: "Phó giám đốc công ty cơ khí chế tạo",
    location: "Bình Dương · 120 nhân sự",
    industry: "Máy móc & thiết bị công nghiệp",
    result: "3/3",
    resultLabel: "đợt thanh toán đúng hạn",
    initial: "H",
  },
  {
    quote:
      "Tôi là xưởng nhỏ, không có phòng pháp chế hay phòng xuất khẩu riêng. Đội Vexim hỗ trợ từ kiểm tra hồ sơ FDA đến đàm phán giá với buyer. Bây giờ đơn hàng Mỹ chiếm 40% doanh thu của xưởng.",
    name: "Anh Lê Hoàng D.",
    role: "Chủ xưởng mỹ phẩm thảo dược",
    location: "Bình Dương · 20 nhân sự",
    industry: "Mỹ phẩm & chăm sóc cá nhân",
    result: "40%",
    resultLabel: "doanh thu đến từ thị trường Mỹ",
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
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">Khách hàng nói gì</p>
          <h2
            id="testimonials-title"
            className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Những nhà máy Việt Nam đã xuất khẩu thành công cùng Vexim
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {STORIES.map((story) => (
            <article
              key={story.name}
              className="relative flex flex-col gap-5 rounded-xl border border-border/80 bg-card p-6 shadow-sm"
            >
              <Quote
                className="absolute right-6 top-6 h-8 w-8 text-accent/20"
                aria-hidden="true"
              />

              <span className="inline-flex w-fit rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent">
                {story.industry}
              </span>

              <blockquote className="text-sm leading-relaxed text-foreground">
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

              <div className="rounded-lg bg-secondary/60 p-3">
                <p className="text-xl font-semibold leading-none tracking-tight text-primary">
                  {story.result}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{story.resultLabel}</p>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Nội dung minh hoạ dựa trên các khách hàng thực tế của Vexim Bridge. Tên và một số chi
          tiết nhận dạng đã được thay đổi để bảo vệ quyền riêng tư của doanh nghiệp.
        </p>
      </div>
    </section>
  )
}
