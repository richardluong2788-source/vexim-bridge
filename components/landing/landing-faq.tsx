import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export const LANDING_FAQS = [
  {
    q: "Tôi có thể tự thuê 1–2 nhân viên sales xuất khẩu rẻ hơn không?",
    a: "Chi phí bề mặt của 1 nhân viên sales có kinh nghiệm xuất khẩu Mỹ là 15–25 triệu/tháng. Nhưng đó chưa tính: thời gian tuyển dụng (2–4 tháng), đào tạo FDA và quy trình thanh toán quốc tế (thêm 3–6 tháng), và rủi ro nhân sự nghỉ việc mang theo toàn bộ mối quan hệ buyer. Vexim cung cấp cả đội (sales, FDA expert, đàm phán) vận hành ngay từ tuần đầu — với hoa hồng chỉ tính khi bạn có đơn.",
  },
  {
    q: "Mất bao lâu mới có đơn hàng đầu tiên? Vexim có cam kết không?",
    a: "Thời gian trung bình từ ký hợp đồng đến đơn mẫu đầu tiên là 8–12 tuần — dựa trên dữ liệu thực tế của 180+ nhà máy trong hệ thống. Vexim cam kết tiếp cận tối thiểu 50 buyer tiềm năng mỗi tháng và báo cáo đầy đủ cho bạn. Nếu sau 4 tháng không có kết quả tiến triển nào, bạn có quyền dừng hợp đồng theo điều khoản đã ký.",
  },
  {
    q: "Tôi sẽ không biết Vexim đang làm gì cho mình — có minh bạch không?",
    a: "Đây là câu hỏi chính đáng. Dashboard của bạn hiển thị real-time: từng buyer đang được tiếp cận, trạng thái từng deal, toàn bộ email đàm phán và chứng từ. Bạn thấy chính xác đội Vexim đang làm gì mỗi tuần — không phải báo cáo tóm tắt cuối tháng, mà là dữ liệu trực tiếp từ hệ thống.",
  },
  {
    q: "Tôi chưa có FDA, có vào được không?",
    a: "Được. Đây là tình huống phổ biến nhất của nhà máy mới bắt đầu xuất khẩu. Vexim sẽ hỗ trợ hoàn thiện toàn bộ hồ sơ FDA theo đúng ngành hàng của bạn trong 24–48 giờ (hoặc 5–7 ngày nếu bạn cần đăng ký thêm mã số doanh nghiệp quốc tế). Quá trình này hoàn thành song song với việc bắt đầu nghiên cứu buyer.",
  },
  {
    q: "Nếu buyer Mỹ không thanh toán, Vexim xử lý thế nào?",
    a: "Vexim chỉ kết nối bạn với buyer đã được thẩm định kỹ về lịch sử nhập khẩu và khả năng tài chính. Toàn bộ chứng từ và trao đổi được lưu trong hệ thống — nếu có tranh chấp, đội pháp lý Vexim đại diện bạn làm việc với buyer mà không tính phí thêm. Quan trọng hơn: hoa hồng thành công chỉ được thu khi tiền USD đã vào tài khoản của bạn.",
  },
  {
    q: "Phí hàng tháng có bị tăng sau khi ký không?",
    a: "Không. Mức phí được cố định trong hợp đồng dịch vụ, không điều chỉnh trong suốt thời hạn hợp đồng. Nếu bạn muốn mở rộng sang ngành hàng mới hoặc thêm thị trường, sẽ có báo giá riêng rõ ràng trước khi bổ sung — không bao giờ thay đổi đơn phương.",
  },
  {
    q: "Vexim phù hợp với nhà máy quy mô nào?",
    a: "Từ xưởng 15–20 nhân sự đến nhà máy 500+ công nhân. Điều kiện cần: bạn có sản phẩm đã sản xuất ổn định, có năng lực đáp ứng đơn hàng định kỳ và nghiêm túc đầu tư cho thị trường Mỹ dài hạn. Ngành chủ lực: thực phẩm & đồ uống, mỹ phẩm & CSKN, thực phẩm chức năng. Các ngành khác được đánh giá theo từng trường hợp.",
  },
]

export function LandingFaq() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="scroll-mt-20 border-b border-border/60 bg-secondary/40"
    >
      <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">Câu hỏi thường gặp</p>
          <h2
            id="faq-title"
            className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Mọi thắc mắc, trả lời ngắn gọn
          </h2>
        </div>

        <Accordion type="single" collapsible className="mt-12 w-full">
          {LANDING_FAQS.map((faq, index) => (
            <AccordionItem key={faq.q} value={`faq-${index}`}>
              <AccordionTrigger className="text-left text-base font-semibold text-foreground">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
