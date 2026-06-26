import { X, Check } from "lucide-react"

const SELF_SETUP = [
  "Tuyển 2–3 nhân sự sales biết tiếng Anh thương mại: 6–9 tháng, chi phí lương + đào tạo từ 300–600 triệu/năm",
  "Mày mò đăng ký FDA, xử lý từng loại giấy phép theo ngành: mất 3–6 tháng chỉ để hoàn thiện hồ sơ",
  "Tự xây dựng danh sách buyer Mỹ từ đầu — không có dữ liệu, không có mạng lưới quan hệ",
  "Không ai kiểm tra chứng từ thanh toán quốc tế: 1 lần bị lừa SWIFT giả có thể mất trắng cả đơn",
  "Thông tin đơn hàng nằm trên Excel, Zalo, email — không ai biết đơn đang ở bước nào",
  "Khi nhân sự nghỉ việc, toàn bộ mối quan hệ buyer và kinh nghiệm đi theo họ",
]

const VEXIM_WAY = [
  "Đội sales chuyên trách sẵn có, vận hành ngay từ tuần đầu — không cần tuyển dụng, không cần đào tạo",
  "Chuyên gia FDA xử lý toàn bộ hồ sơ cho bạn trong 24–48 giờ, kể cả khi bạn chưa có giấy tờ",
  "Tiếp cận ngay 420+ buyer Mỹ đã được thẩm định — có lịch sử nhập khẩu thực tế, không phải danh sách ngẫu nhiên",
  "Xác thực chuyển tiền 2 lớp độc lập: không ai tự xác nhận thanh toán của chính mình được",
  "Bảng theo dõi đơn hàng real-time, bạn thấy đúng trạng thái từng deal mọi lúc mọi nơi",
  "Toàn bộ lịch sử buyer, đàm phán và chứng từ nằm trong hệ thống — không bao giờ mất dù nhân sự thay đổi",
]

export function LandingComparison() {
  return (
    <section
      id="comparison"
      aria-labelledby="comparison-title"
      className="scroll-mt-20 border-b border-border/60 bg-secondary/30"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">So sánh thực tế</p>
          <h2
            id="comparison-title"
            className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Tự lập phòng sales xuất khẩu hay thuê Vexim?
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
            Nhiều chủ nhà máy nghĩ rằng tự làm sẽ tiết kiệm hơn. Nhưng khi cộng đủ chi phí ẩn — lương nhân sự, thời gian mày mò, đơn hàng bị trễ và rủi ro thanh toán — con số thực tế thường khiến họ ngạc nhiên.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Self-setup column */}
          <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-card p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <X className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Tự lập phòng sales</h3>
                <p className="text-sm text-muted-foreground">Khởi động từ con số không</p>
              </div>
            </div>

            <ul className="flex flex-col gap-3 pt-2">
              {SELF_SETUP.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"
                    aria-hidden="true"
                  >
                    <X className="h-3 w-3" strokeWidth={2.5} />
                  </span>
                  <span className="text-sm leading-relaxed text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
              <p className="text-sm font-semibold text-foreground">Chi phí ước tính năm đầu:</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-destructive">500M – 1 tỷ VND</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Chưa tính rủi ro thanh toán và không có đơn hàng nào được đảm bảo</p>
            </div>
          </div>

          {/* Vexim column */}
          <div className="flex flex-col gap-4 rounded-xl border border-accent/40 bg-card p-6 shadow-lg shadow-accent/5 sm:p-8 ring-1 ring-inset ring-accent/20">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-accent">
                <Check className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Thuê Vexim Trade</h3>
                <p className="text-sm text-muted-foreground">Vận hành ngay từ tuần đầu</p>
              </div>
            </div>

            <ul className="flex flex-col gap-3 pt-2">
              {VEXIM_WAY.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent"
                    aria-hidden="true"
                  >
                    <Check className="h-3 w-3" strokeWidth={2.5} />
                  </span>
                  <span className="text-sm leading-relaxed text-foreground">{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto rounded-lg border border-accent/30 bg-accent/8 px-4 py-3">
              <p className="text-sm font-semibold text-foreground">Hoa hồng chỉ tính khi:</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-accent">Tiền USD đã vào tài khoản bạn</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Vexim không nhận đồng hoa hồng nào trước khi bạn được thanh toán</p>
            </div>
          </div>
        </div>

        {/* Callout */}
        <p className="mx-auto mt-8 max-w-2xl text-balance text-center text-sm text-muted-foreground">
          Câu hỏi thực sự không phải là <span className="font-semibold text-foreground">"Vexim có đắt không?"</span> — mà là{" "}
          <span className="font-semibold text-foreground">"Mỗi tháng không có đơn hàng Mỹ đang tốn bạn bao nhiêu cơ hội?"</span>
        </p>
      </div>
    </section>
  )
}
