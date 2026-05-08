import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export const LANDING_FAQS = [
  {
    q: "Vexim Bridge phù hợp với doanh nghiệp quy mô nào?",
    a: "Chúng tôi phục vụ các nhà máy Việt Nam đã có năng lực sản xuất ổn định và nghiêm túc muốn xây dựng thị trường Mỹ dài hạn. Quy mô từ xưởng 20 nhân sự đến nhà máy 500+ công nhân, tập trung vào 4 ngành FDA chủ lực: thực phẩm & đồ uống, mỹ phẩm & chăm sóc cá nhân (MoCRA), thực phẩm chức năng (DSHEA) và thiết bị y tế Class I/II (510(k)). Các ngành khác được đánh giá theo từng trường hợp.",
  },
  {
    q: "Vexim có hỗ trợ logistics, kho bãi và fulfillment tại Mỹ không?",
    a: "Có. Vexim điều phối toàn bộ chuỗi logistics qua mạng lưới đối tác chiến lược đã được thẩm định: forwarder hai đầu Việt - Mỹ, customs broker, kho 3PL tại Bờ Đông, Bờ Tây và Trung Mỹ. Chúng tôi hỗ trợ Amazon FBA prep, retail compliance (Walmart, Target, Costco) và B2B distribution. Bạn không cần thuê kho riêng tại Mỹ hay làm việc với nhiều nhà cung cấp - chỉ một đầu mối duy nhất là Vexim.",
  },
  {
    q: "So với tự xây phòng sale tại Mỹ, Vexim khác gì?",
    a: "Tự tuyển 1 sales tại Mỹ tốn tối thiểu 80–120K USD/năm chưa kể tools, đào tạo và 9–18 tháng để có đơn đầu tiên. Khi nhân sự nghỉ, bạn mất luôn pipeline và quan hệ. Với Vexim, bạn thuê một đội đã có sẵn năng lực FDA, mạng lưới buyer, quy trình verify L/C và đối tác logistics - chỉ trả phí duy trì cố định + hoa hồng khi có doanh thu thực. Tổng chi phí thường thấp hơn 60–75% so với tự xây, và có đơn đầu tiên trong 8–12 tuần.",
  },
  {
    q: "Chi phí sử dụng Vexim Bridge là bao nhiêu?",
    a: "Vexim Bridge là dịch vụ “phòng kinh doanh xuất khẩu thuê ngoài”, không phải sàn tự phục vụ. Chi phí gồm ba cấu phần: (1) Phí khởi tạo một lần khi ký hợp đồng — để thẩm định nhà máy, chuẩn bị hồ sơ FDA và dựng profile buyer-ready; (2) Phí duy trì hàng tháng — nuôi đội sales tại Mỹ và nền tảng dành riêng cho nhà máy bạn; (3) Hoa hồng thành công — % trên kim ngạch chỉ thu khi đơn đã thanh toán bằng USD. Con số cụ thể được báo giá riêng theo ngành hàng và quy mô, ghi rõ trong hợp đồng từ đầu, không phí ẩn.",
  },
  {
    q: "Tại sao phải có phí duy trì hàng tháng, không phải chỉ trả khi có đơn?",
    a: "Vì Vexim nuôi một đội sales Mỹ, chuyên gia FDA và nhân sự đàm phán làm việc liên tục cho nhà máy của bạn — không phải chờ đơn mới hoạt động. Phí duy trì đảm bảo chúng tôi có thể cam kết tiếp cận và sàng lọc 50+ buyer tiềm năng mỗi tháng, thay vì đăng tin thụ động. Đây cũng là cơ chế lọc khách: chúng tôi chỉ nhận những nhà máy nghiêm túc đầu tư cho thị trường Mỹ.",
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
