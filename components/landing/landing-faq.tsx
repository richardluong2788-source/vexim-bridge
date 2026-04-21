import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export const LANDING_FAQS = [
  {
    q: "Vexim Bridge dành cho doanh nghiệp quy mô nào?",
    a: "Bất kỳ nhà sản xuất Việt Nam nào đã có hoặc sẵn sàng đăng ký FDA đều có thể onboard. Chúng tôi phục vụ từ workshop 20 nhân sự đến nhà máy xuất khẩu 500+ công nhân, ưu tiên các ngành food, supplement, cosmetics và medical device.",
  },
  {
    q: "Chi phí sử dụng nền tảng là bao nhiêu?",
    a: "Mô hình phí của Vexim Bridge được thiết kế dựa trên hiệu suất và sự an toàn. Bạn sẽ trả một khoản phí dịch vụ ban đầu và phí duy trì định kỳ để chúng tôi vận hành bộ máy tìm kiếm và sàng lọc buyer. Sau đó, bạn chỉ trả thêm phí hoa hồng trên những đơn hàng đã được xác thực SWIFT an toàn tuyệt đối.",
  },
  {
    q: "FDA registration có bắt buộc không?",
    a: "Có. Chúng tôi không giao lead cho tài khoản chưa verify FDA — đây là rule nền tảng (R-02). Nếu bạn chưa có số đăng ký, đội ngũ có thể hướng dẫn bạn hoàn tất trong 24-48h và 5-7 ngày nếu bạn chưa có mã DUNS.",
  },
  {
    q: "Danh tính người mua Mỹ được bảo vệ như thế nào?",
    a: "Trong giai đoạn New và Contacted, buyer được mask — bạn chỉ thấy ngành hàng, volume dự kiến và vùng địa lý. Danh tính đầy đủ được mở khi giá và điều khoản được chốt, nhằm tránh bypass và ép giá.",
  },
  {
    q: "SWIFT verification 2-eye hoạt động ra sao?",
    a: "Người upload chứng từ SWIFT (thường là AE) không được cùng bấm nút 'Verified'. Bước verify bắt buộc do một người khác (admin hoặc super admin) thực hiện. Rule này enforce ở cả server action và database CHECK constraint — không thể bypass.",
  },
  {
    q: "Dữ liệu của tôi được lưu ở đâu?",
    a: "Database Postgres managed trên Supabase với Row-Level Security. Tài liệu compliance lưu trên Vercel Blob với signed URL. Backup tự động theo lịch. Vexim Bridge không chia sẻ dữ liệu bạn với bên thứ ba nếu không có chấp thuận bằng văn bản.",
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
