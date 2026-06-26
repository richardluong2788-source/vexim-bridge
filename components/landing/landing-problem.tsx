const SCENARIOS = [
  {
    situation: "Sản phẩm đã sẵn sàng, chất lượng tốt",
    reality: "Nhưng không biết tìm buyer Mỹ ở đâu, chào hàng kiểu nào",
    cost: "Mất 1–2 năm mò mẫm, trong khi đối thủ đã có đơn hàng",
  },
  {
    situation: "Đã có một vài liên hệ từ Mỹ qua Alibaba",
    reality: "Nhưng thư thương mại kém, không chốt được, buyer im lặng",
    cost: "Mỗi deal hỏng = mất cơ hội $30,000–$200,000",
  },
  {
    situation: "Có nhân viên sales, nhưng không ai hiểu thị trường Mỹ",
    reality: "FDA sai, nhãn hàng sai, buyer từ chối vì lý do compliance",
    cost: "Chi phí thuê tư vấn FDA riêng: $5,000–$15,000/lần",
  },
  {
    situation: "Đã từng bị lừa chứng từ thanh toán giả",
    reality: "Hoặc biết người trong ngành bị mất cả lô hàng vì SWIFT giả",
    cost: "Một lần mất hàng có thể xóa trắng cả năm lợi nhuận",
  },
]

export function LandingProblem() {
  return (
    <section aria-labelledby="problem-title" className="border-b border-border/60 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">Bạn có đang ở đây không?</p>
          <h2
            id="problem-title"
            className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Sản phẩm tốt thôi là chưa đủ để vào thị trường Mỹ
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
            Hầu hết nhà máy Việt Nam thất bại ở thị trường Mỹ không phải vì sản phẩm kém — mà vì thiếu đúng thứ cần thiết vào đúng thời điểm. Mỗi tháng chậm trễ là một tháng doanh thu USD đang rơi vào tay đối thủ.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SCENARIOS.map((s) => (
            <article
              key={s.situation}
              className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-6"
            >
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-foreground">{s.situation}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{s.reality}</p>
              </div>
              <div className="flex items-start gap-2 rounded-lg bg-destructive/5 px-3 py-2.5">
                <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-destructive" aria-hidden="true" />
                <p className="text-sm font-medium text-destructive">{s.cost}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="mx-auto mt-10 max-w-2xl rounded-xl border border-accent/30 bg-accent/5 p-6 text-center">
          <p className="text-base font-semibold text-foreground">
            Vexim Trade được xây dựng chính xác để giải quyết những tình huống này — không phải bằng phần mềm, mà bằng đội ngũ chuyên gia vận hành thay bạn.
          </p>
        </div>
      </div>
    </section>
  )
}
