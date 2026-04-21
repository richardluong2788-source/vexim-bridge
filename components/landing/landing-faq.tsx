import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export const LANDING_FAQS = [
  {
    q: "Vexim Bridge phù hợp với doanh nghiệp quy mô nào?",
    a: "Mọi nhà sản xuất Việt Nam đã có hoặc sẵn sàng đăng ký FDA đều có thể tham gia. Chúng tôi đang phục vụ từ xưởng 20 nhân sự đến nhà máy 500+ công nhân, tập trung vào 4 ngành: thực phẩm & đồ uống, thực phẩm chức năng, mỹ phẩm & chăm sóc cá nhân, và thiết bị y tế.",
  },
  {
    q: "Chi phí sử dụng Vexim Bridge là bao nhiêu?",
    a: "Nguyên tắc cốt lõi của chúng tôi là “không có đơn hàng, không mất phí”. Bạn đăng ký và sử dụng nền tảng miễn phí — Vexim chỉ thu hoa hồng trên những đơn hàng đã được thanh toán thành công bằng USD. Tỷ lệ hoa hồng cụ thể tuỳ ngành hàng và được ghi rõ trong hợp đồng ngay từ đầu, không phát sinh phí ẩn.",
  },
  {
    q: "Vexim có đi tìm người mua Mỹ giúp tôi không, hay tôi phải tự đăng tin?",
    a: "Đội ngũ Vexim tại Mỹ và Việt Nam chủ động đi tìm, thẩm định doanh nghiệp và khảo sát nhu cầu của người mua — bạn không phải tự đăng tin chờ đợi. Khi có đơn hàng phù hợp với ngành nghề và năng lực sản xuất của nhà máy, chúng tôi sẽ chuyển trực tiếp cho bạn qua hệ thống.",
  },
  {
    q: "Nếu buyer không thanh toán hoặc có tranh chấp, Vexim xử lý thế nào?",
    a: "Vì chúng tôi đã thẩm định buyer trước khi kết nối và toàn bộ trao đổi, chứng từ đều được lưu trong hệ thống, khả năng xảy ra tranh chấp rất thấp. Nếu có vấn đề, đội pháp lý của Vexim sẽ đại diện bạn làm việc với buyer và đối tác tài chính Mỹ để xử lý — đây là một phần của dịch vụ, không tính phí thêm.",
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
