import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export const LANDING_FAQS = [
  {
    q: "Vexim Bridge phù hợp với doanh nghiệp quy mô nào?",
    a: "Mọi nhà sản xuất Việt Nam đã có hoặc sẵn sàng đăng ký FDA đều có thể tham gia. Chúng tôi đang phục vụ từ xưởng 20 nhân sự đến nhà máy 500+ công nhân, ưu tiên các ngành thực phẩm, thực phẩm chức năng, mỹ phẩm và thiết bị y tế.",
  },
  {
    q: "Chi phí sử dụng nền tảng là bao nhiêu?",
    a: "Mô hình phí của Vexim Bridge gồm một khoản phí khởi tạo và phí duy trì hàng tháng để chúng tôi vận hành đội ngũ tìm kiếm và sàng lọc người mua. Ngoài ra, bạn chỉ trả thêm hoa hồng trên những đơn hàng đã được xác thực thanh toán thành công — nghĩa là chúng tôi chỉ kiếm tiền khi bạn kiếm tiền.",
  },
  {
    q: "Có bắt buộc phải có giấy phép FDA không?",
    a: "Có. Chúng tôi không giao đơn hàng cho nhà máy chưa có giấy phép FDA hợp lệ — đây là nguyên tắc nền tảng để bảo vệ cả hai bên. Nếu bạn chưa có, đội ngũ Vexim sẽ hướng dẫn hoàn tất trong 24–48 giờ (hoặc 5–7 ngày nếu bạn chưa có mã số đăng ký doanh nghiệp quốc tế).",
  },
  {
    q: "Thông tin người mua Mỹ được bảo vệ như thế nào?",
    a: "Trong giai đoạn đầu, thông tin người mua được giữ kín — bạn chỉ thấy ngành hàng, sản lượng dự kiến và khu vực. Danh tính đầy đủ chỉ được mở khi hai bên đã thống nhất giá và điều khoản. Cách làm này giúp tránh bị vượt cầu hoặc ép giá.",
  },
  {
    q: "Xác thực chuyển tiền hai lớp hoạt động ra sao?",
    a: "Người tải chứng từ chuyển tiền lên hệ thống (thường là nhân viên kinh doanh) không được tự bấm xác nhận. Bước xác nhận cuối cùng luôn do một người khác (quản lý hoặc kế toán) thực hiện. Nguyên tắc này không thể làm tắt, kể cả với tài khoản quản trị cao nhất.",
  },
  {
    q: "Dữ liệu của tôi được lưu ở đâu?",
    a: "Toàn bộ dữ liệu được lưu trên máy chủ đám mây tiêu chuẩn quốc tế, có sao lưu định kỳ. Chứng từ và hoá đơn được truy cập qua đường dẫn có thời hạn để đảm bảo an toàn. Vexim Bridge không chia sẻ dữ liệu của bạn với bên thứ ba khi chưa có sự đồng ý bằng văn bản.",
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
